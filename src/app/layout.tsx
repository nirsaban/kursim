import type { Metadata } from 'next';
import { Heebo, Frank_Ruhl_Libre, Playpen_Sans_Hebrew } from 'next/font/google';
import './globals.css';
import { he } from '@/lib/he';
import { BRAND } from '@/lib/brand';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-heebo',
  display: 'swap',
});

const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-frank',
  display: 'swap',
});

// Handwritten-script accent — used only by the "Coral Hota" landing template
// for the highlighted headline word, echoing that design's cursive display font.
const playpen = Playpen_Sans_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['700'],
  variable: '--font-script',
  display: 'swap',
});

/**
 * Absolute base for every og:/twitter: URL. Link-preview crawlers (WhatsApp
 * above all) reject relative image paths, so this has to resolve to the public
 * origin — a malformed APP_URL falls back rather than failing the render.
 */
function siteUrl(): URL {
  try {
    return new URL(process.env.APP_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  // Pages set a bare title; the brand suffix is appended here, once.
  title: { default: he.metaTitle, template: `%s \u00b7 ${BRAND.name}` },
  description: he.metaDescription,
  applicationName: BRAND.name,
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    locale: 'he_IL',
    title: he.metaTitle,
    description: he.metaDescription,
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html dir="rtl" lang="he" className={`${heebo.variable} ${frank.variable} ${playpen.variable}`}>
      <body>{children}</body>
    </html>
  );
}
