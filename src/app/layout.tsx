import type { Metadata } from 'next';
import { Heebo, Rubik } from 'next/font/google';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-heebo',
  display: 'swap',
});

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-rubik',
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
    <html dir="rtl" lang="he" className={`${heebo.variable} ${rubik.variable}`}>
      <body>{children}</body>
    </html>
  );
}
