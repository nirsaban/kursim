import type { Metadata } from 'next';
import { Heebo, Frank_Ruhl_Libre, Playpen_Sans_Hebrew } from 'next/font/google';
import './globals.css';
import { he } from '@/lib/he';

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

export const metadata: Metadata = {
  title: he.metaTitle,
  description: he.metaDescription,
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
