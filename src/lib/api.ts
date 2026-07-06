import { NextResponse } from 'next/server';
import { ZodType, ZodTypeDef } from 'zod';

export function apiError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Parse + validate a JSON body; returns the typed data or a ready 400 response. */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<{ data: T } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: apiError(400, 'invalid JSON body') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: apiError(400, 'validation failed', {
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      }),
    };
  }
  return { data: parsed.data };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
