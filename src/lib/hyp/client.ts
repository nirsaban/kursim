/**
 * Hyp Pay (hyp.co.il) hosted payment page — API client.
 *
 * Hyp never lets card data near us: we ask their API to sign a set of
 * transaction parameters, redirect the buyer to their hosted page with that
 * signature, and they redirect back to our success URL once the card clears.
 *
 * Two calls make up the whole integration:
 *   APISign / SIGN    — sign the parameters, giving us the redirect URL
 *   APISign / VERIFY  — hand the redirect's parameters back to Hyp and ask
 *                       whether they are genuine and untampered
 *
 * Docs: https://developers.hyp.co.il/pay
 */

/** Hyp's single endpoint — the `action` parameter selects the operation. */
const HYP_ENDPOINT = 'https://pay.hyp.co.il/p/';

/** Hyp answers `CCode=0` for success on every action. */
export const HYP_OK = '0';

export interface HypCredentials {
  /** Terminal number ("Masof"), 10 digits. Test terminals start with 00100. */
  masof: string;
  /** API key from the Hyp portal — Settings → Payment Page and API → Verification. */
  key: string;
  /** API password ("PassP"). NOT the portal login password. */
  passp: string;
}

/**
 * Platform Hyp credentials from the environment. Returns null when the
 * terminal isn't configured, which callers must treat as "Hyp checkout is
 * off" rather than crashing a course page.
 */
export function hypCredentials(): HypCredentials | null {
  const masof = process.env.HYP_MASOF?.trim();
  const key = process.env.HYP_KEY?.trim();
  const passp = process.env.HYP_PASSP?.trim();
  if (!masof || !key || !passp) return null;
  return { masof, key, passp };
}

/** Hyp test terminals are identifiable by their number alone. */
export function isTestTerminal(masof: string): boolean {
  return masof.startsWith('00100');
}

/**
 * Hyp replies with a URL-encoded query string, not JSON — for both success
 * (`Amount=10&...&signature=...`) and failure (`CCode=904`).
 */
export function parseHypResponse(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body.trim())) out[k] = v;
  return out;
}

export type SignResult =
  | { ok: true; url: string }
  | { ok: false; ccode: string; raw: string };

export type VerifyResult = { ok: boolean; ccode: string; raw: string };

/**
 * Split the buyer's full name into the two fields Hyp's page expects.
 *
 * Our checkout asks for one "full name", but Hyp has separate first and last
 * name inputs — sending the whole string as `ClientName` prefills its
 * first-name box with the surname attached. Everything up to the last word is
 * the first name and the last word the surname; a one-word name leaves the
 * surname empty rather than inventing one.
 */
export function splitFullName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** Money: Hyp wants major units with up to two decimals, never agorot. */
export function agorotToAmount(agorot: number): string {
  return (agorot / 100).toFixed(2);
}

/**
 * Ask Hyp to sign a transaction and hand back the URL to send the buyer to.
 *
 * `params` carries the transaction itself (Amount, Order, customer details,
 * …). Credentials and the fixed action parameters are added here so a caller
 * can never forget `Sign=True` — without it the completion redirect arrives
 * unsigned and cannot be verified, which would leave us granting access on an
 * unauthenticated query string.
 *
 * UTF8/UTF8out are always on: Hyp defaults to windows-1255, which mangles the
 * Hebrew course titles we send through as the invoice description.
 */
export async function createPaymentPage(
  creds: HypCredentials,
  params: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<SignResult> {
  const qs = new URLSearchParams({
    ...params,
    // Last, so the transaction parameters can never override them — a caller
    // that accidentally passes `Sign: 'False'` would otherwise produce an
    // unverifiable completion redirect.
    action: 'APISign',
    What: 'SIGN',
    Sign: 'True',
    Masof: creds.masof,
    KEY: creds.key,
    PassP: creds.passp,
    UTF8: 'True',
    UTF8out: 'True',
  });

  const res = await fetchImpl(`${HYP_ENDPOINT}?${qs.toString()}`, {
    method: 'GET',
    // A hung payment request must not hold a request handler open forever.
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.text()).trim();

  // A signed response echoes every parameter back with `signature` appended;
  // anything else is an error code. Checking for the signature rather than
  // for `CCode` is deliberate — a successful response has no CCode at all.
  if (!body.includes('signature=')) {
    return { ok: false, ccode: parseHypResponse(body).CCode ?? 'unknown', raw: body };
  }

  // Append the response verbatim: Hyp signed that exact string, in that exact
  // order, so re-encoding or re-ordering it would invalidate the signature.
  return { ok: true, url: `${HYP_ENDPOINT}?${body}` };
}

/**
 * Ask Hyp whether a completion redirect is genuine.
 *
 * `rawQuery` must be the success URL's query string exactly as received —
 * same parameters, same order, same encoding. Hyp checks it against their own
 * record of the transaction, so this is what turns "someone hit our success
 * URL" into "this payment really happened".
 */
export async function verifyTransaction(
  creds: HypCredentials,
  rawQuery: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifyResult> {
  const prefix = new URLSearchParams({
    action: 'APISign',
    What: 'VERIFY',
    Masof: creds.masof,
    KEY: creds.key,
    PassP: creds.passp,
  });
  const query = rawQuery.replace(/^\?/, '');
  const res = await fetchImpl(`${HYP_ENDPOINT}?${prefix.toString()}&${query}`, {
    method: 'GET',
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.text()).trim();
  const ccode = parseHypResponse(body).CCode ?? 'unknown';
  return { ok: ccode === HYP_OK, ccode, raw: body };
}

/**
 * Did the buyer actually pay? Hyp reuses `CCode` for authorizations that are
 * NOT a completed charge — 700 is a two-phase authorization and 800 a
 * postponed transaction. We sell instant access, so only a real charge counts.
 */
export function isPaid(ccode: string): boolean {
  return ccode === HYP_OK;
}
