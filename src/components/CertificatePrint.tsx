'use client';

import { he } from '@/lib/he';

export default function CertificatePrint() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
    >
      {he.printCertificate}
    </button>
  );
}
