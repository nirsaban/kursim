import { getRedis } from '@/lib/redis';

/**
 * Shared parsing for Grow payment callbacks — used by the per-tenant course
 * webhook (/api/pay/grow) and the platform package webhook (/api/pay/plan).
 * Grow may POST JSON or form-encoded, flat or wrapped in `data`, and its
 * Payment-Links product signals success differently from older formats.
 */

/** Durable diagnostic ring buffer of the last raw callbacks (read via redis). */
export async function captureRawCallback(
  redisKey: string,
  entry: Record<string, unknown>,
): Promise<void> {
  try {
    const r = getRedis();
    await r.lpush(redisKey, JSON.stringify(entry));
    await r.ltrim(redisKey, 0, 49);
  } catch {
    /* diagnostics must never affect the response */
  }
}

/**
 * Some Grow payment pages nest every field under a `data` wrapper — form-encoded
 * as `data[statusCode]=2`, or JSON as `{"data":{...}}` — while others post the
 * same fields flat. Lift the wrapper so both shapes read identically downstream.
 * Deeper nesting (e.g. `data[productData][0][name]`) is not a field we consume
 * here and is left untouched.
 */
function unwrapData(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: unknown) => {
    if (v === null || typeof v === 'object') return;
    out[k] = String(v);
  };
  for (const [k, v] of Object.entries(obj)) {
    const nested = /^data\[([^[\]]+)\]$/.exec(k);
    if (nested) {
      put(nested[1], v);
    } else if (k === 'data' && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) put(ik, iv);
    } else {
      put(k, v);
    }
  }
  return out;
}

/**
 * Line items. A payment link that sells two courses posts two of these, as
 * `data[productData][0][...]` and `data[productData][1][...]` (or a JSON array).
 * `unwrapData` deliberately skips them, so pull them out separately.
 */
function extractProducts(obj: Record<string, unknown>): Array<Record<string, string>> {
  const byIndex = new Map<number, Record<string, string>>();
  const put = (i: number, k: string, v: unknown) => {
    if (v === null || typeof v === 'object') return;
    const row = byIndex.get(i) ?? {};
    row[k] = String(v);
    byIndex.set(i, row);
  };

  // Form-encoded: data[productData][0][name] — or the same without the wrapper.
  for (const [k, v] of Object.entries(obj)) {
    const m = /^(?:data\[productData\]|productData)\[(\d+)\]\[([^[\]]+)\]$/.exec(k);
    if (m) put(Number(m[1]), m[2], v);
  }

  // JSON: { productData: [...] } or { data: { productData: [...] } }.
  const wrapped = obj.data;
  const arrays = [
    Array.isArray(obj.productData) ? obj.productData : null,
    wrapped && typeof wrapped === 'object' && Array.isArray((wrapped as Record<string, unknown>).productData)
      ? ((wrapped as Record<string, unknown>).productData as unknown[])
      : null,
  ].filter(Boolean) as unknown[][];
  for (const arr of arrays) {
    arr.forEach((row, i) => {
      if (row && typeof row === 'object') {
        for (const [k, v] of Object.entries(row as Record<string, unknown>)) put(1000 + i, k, v);
      }
    });
  }

  return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

/** Parse from the already-read raw text, trying JSON first then form, regardless
 *  of the declared content-type. */
export function parseGrowBody(
  raw: string,
  ct: string,
): { fields: Record<string, string>; products: Array<Record<string, string>> } {
  const asForm = (s: string): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of new URLSearchParams(s)) obj[k] = v;
    return obj;
  };
  const tryJson = (s: string): Record<string, unknown> | null => {
    try {
      const j = JSON.parse(s);
      return j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const obj = (ct.includes('application/json') ? tryJson(raw) : null) ?? tryJson(raw) ?? asForm(raw);
  return { fields: unwrapData(obj), products: extractProducts(obj) };
}

/**
 * Did this callback report a successful charge, and under which reference?
 * Grow's Payment-Links webhook fires ONLY on a successful charge and signals it
 * with a reference number (asmachta) — there is no statusCode. Older/other Grow
 * formats use statusCode "2" / status "שולם". Accept any of these as paid.
 */
export function paidSignal(fields: Record<string, string>): {
  paid: boolean;
  transactionId: string;
} {
  const statusCode = String(fields.statusCode ?? '');
  const status = String(fields.status ?? '');
  const asmachta = String(fields.asmachta || '').trim();
  const transactionCode = String(fields.transactionCode || '').trim();
  const paid = statusCode === '2' || status === 'שולם' || Boolean(asmachta || transactionCode);
  const transactionId = (asmachta || transactionCode || String(fields.transactionId || '')).trim();
  return { paid, transactionId };
}
