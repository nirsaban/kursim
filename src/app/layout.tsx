import type { Metadata } from 'next';
import { Heebo, Frank_Ruhl_Libre } from 'next/font/google';
import './globals.css';

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

export const metadata: Metadata = {
  title: 'Kursim — פלטפורמת קורסים',
  description: 'פלטפורמה רב-ארגונית לבתי ספר דיגיטליים',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html dir="rtl" lang="he" className={`${heebo.variable} ${frank.variable}`}>
      <body>{children}</body>
    </html>
  );
}
