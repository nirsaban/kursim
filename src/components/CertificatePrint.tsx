'use client';

import { he } from '@/lib/he';
import Button from '@/components/ui/Button';

export default function CertificatePrint() {
  return (
    <Button type="button" variant="primary" onClick={() => window.print()}>
      {he.printCertificate}
    </Button>
  );
}
