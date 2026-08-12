/**
 * Prices are stored in agorot so arithmetic stays in integers — a course at
 * ₪349.90 is 34990, never 349.9. Display and parsing both live here so the
 * admin, the landing page and the checkout can't disagree about rounding.
 *
 * Safe to import from client components: no env, no I/O.
 */

/** 34990 → "349.90 ₪"; whole shekels drop the decimals: 34900 → "349 ₪". */
export function formatAgorot(agorot: number): string {
  const shekels = agorot / 100;
  const body = Number.isInteger(shekels) ? String(shekels) : shekels.toFixed(2);
  return `${body} ₪`;
}

/** 34990 → "349.90", for an editable input. Empty for null/0. */
export function agorotToInput(agorot: number | null | undefined): string {
  if (!agorot || agorot <= 0) return '';
  return (agorot / 100).toFixed(2).replace(/\.00$/, '');
}

/**
 * "349.90" / "349,90" / " 349 " → 34990. Returns null for anything that isn't
 * a usable price, so an empty field means "not for sale" rather than free.
 */
export function inputToAgorot(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const agorot = Math.round(Number(cleaned) * 100);
  return agorot > 0 ? agorot : null;
}
