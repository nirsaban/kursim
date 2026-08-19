import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/brand';

/**
 * The social-preview card every shareable page renders into its og:image.
 *
 * WhatsApp (and Telegram/Slack/Facebook) fetch this URL with an anonymous
 * crawler that runs no JavaScript, so the card has to be a plain public image —
 * it can never reuse the signed, expiring media URLs the app serves to
 * logged-in students. Everything here is therefore drawn from scratch.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/** Heebo lives in public/fonts so it survives into the standalone Docker image. */
let fontCache: { regular: Buffer; bold: Buffer } | null = null;

async function fonts() {
  if (!fontCache) {
    const dir = join(process.cwd(), 'public', 'fonts');
    const [regular, bold] = await Promise.all([
      readFile(join(dir, 'Heebo-400.ttf')),
      readFile(join(dir, 'Heebo-700.ttf')),
    ]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

// ── RTL ──────────────────────────────────────────────────────────────────────
// satori (the engine behind next/og) implements no Unicode bidi algorithm and
// ignores `direction: rtl` — it lays glyphs out in logical order, left to
// right, which renders Hebrew backwards. Verified: it draws "ים" with the yod
// on the left. So we hand it text already in *visual* order: reverse the
// characters of each Hebrew word, and let a `row-reverse` flex row place the
// words right-to-left. Wrapping stays with flexbox, so it still breaks on word
// boundaries at whatever width the line has.

const RTL_CHAR = /[֐-׿יִ-ﭏ]/;

/** Brackets and quotes point the other way once a run is reversed. */
const MIRRORED: Record<string, string> = {
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
};

function toVisualOrder(word: string): string {
  if (!RTL_CHAR.test(word)) return word; // Latin/numbers already read left-to-right
  return Array.from(word)
    .reverse()
    .map((c) => MIRRORED[c] ?? c)
    .join('');
}

function RtlText({
  text,
  size,
  weight = 400,
  color,
  lineHeight = 1.3,
  letterSpacing = 0,
  maxWidth,
}: {
  text: string;
  size: number;
  weight?: 400 | 700;
  color: string;
  lineHeight?: number;
  letterSpacing?: number;
  maxWidth?: number;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  // satori rejects `undefined` style values outright, so only set what we have.
  const style: Record<string, unknown> = {
    display: 'flex',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    columnGap: size * 0.25,
    rowGap: size * (lineHeight - 1),
    fontSize: size,
    fontWeight: weight,
    color,
    lineHeight,
    letterSpacing,
  };
  if (maxWidth) style.maxWidth = maxWidth;
  return (
    <div style={style}>
      {words.map((w, i) => (
        <div key={i} style={{ display: 'flex' }}>
          {toVisualOrder(w)}
        </div>
      ))}
    </div>
  );
}

function clamp(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export type OgCardInput = {
  /** Headline — the course/school name the reader actually recognises. */
  title: string;
  /** One supporting line; dropped when empty. */
  subtitle?: string | null;
  /** Small label beside the logo, e.g. the school's name. */
  eyebrow?: string | null;
  /** Tenant logo as a data URL (see validation/branding.ts); falls back to the mark. */
  logo?: string | null;
  /** Accent hex — the landing theme's color, so the preview matches the page. */
  accent?: string;
  /** Footer line; defaults to the platform tagline. */
  footer?: string;
};

export async function ogCard(input: OgCardInput): Promise<ImageResponse> {
  const { regular, bold } = await fonts();
  const accent = input.accent || BRAND.accent;
  const title = clamp(input.title || BRAND.name, 80);
  const subtitle = input.subtitle ? clamp(input.subtitle, 130) : '';
  const eyebrow = input.eyebrow ? clamp(input.eyebrow, 34) : '';
  const footer = input.footer || BRAND.tagline;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          padding: '58px 72px',
          background: `linear-gradient(150deg, ${BRAND.inkSoft} 0%, ${BRAND.ink} 62%, #0C0E14 100%)`,
          fontFamily: 'Heebo',
        }}
      >
        {/* Accent wash — ties the preview to the landing page's own theme. */}
        <div
          style={{
            position: 'absolute',
            top: -260,
            right: -200,
            width: 820,
            height: 820,
            display: 'flex',
            backgroundImage: `radial-gradient(circle at 50% 50%, ${accent}59 0%, ${accent}1F 45%, ${BRAND.ink}00 70%)`,
          }}
        />

        {/* Header: school identity on the right, seat dots on the left. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 22 }}>
            {input.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={input.logo}
                width={84}
                height={84}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 22,
                  objectFit: 'contain',
                  background: BRAND.paper,
                }}
                alt=""
              />
            ) : (
              <Mark size={84} accent={accent} />
            )}
            {eyebrow ? <RtlText text={eyebrow} size={30} color="#C7CBD4" /> : null}
          </div>
          {/* The seat-limit motif: two taken, one free. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  width: 14,
                  height: 14,
                  borderRadius: 14,
                  background: i === 2 ? 'rgba(245,242,235,0.25)' : accent,
                }}
              />
            ))}
          </div>
        </div>

        {/* Headline block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 24 }}>
          <RtlText
            text={title}
            size={title.length > 42 ? 62 : 76}
            weight={700}
            color={BRAND.paper}
            lineHeight={1.18}
            letterSpacing={-1.2}
            maxWidth={1000}
          />
          {subtitle ? (
            <RtlText text={subtitle} size={32} color="#9AA1AF" lineHeight={1.42} maxWidth={940} />
          ) : null}
        </div>

        {/* Footer: the platform signature */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 16 }}>
            <Mark size={46} accent={BRAND.accent} />
            <div style={{ display: 'flex', fontSize: 31, fontWeight: 700, color: BRAND.paper }}>
              {BRAND.name}
            </div>
          </div>
          <RtlText text={footer} size={26} color="#6F6C64" />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Heebo', data: regular, weight: 400, style: 'normal' },
        { name: 'Heebo', data: bold, weight: 700, style: 'normal' },
      ],
    },
  );
}

/** The GeniriSchool mark, inlined as JSX so satori draws it without a fetch. */
function Mark({ size, accent }: { size: number; accent: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: 'flex' }}>
      <rect width="512" height="512" rx="116" fill={BRAND.inkSoft} />
      <g fill="none" stroke={accent} strokeWidth="44" strokeLinecap="round">
        <path d="M 316.8 169.2 A 106 106 0 1 0 362 256" />
        <path d="M 256 256 L 362 256" />
      </g>
    </svg>
  );
}
