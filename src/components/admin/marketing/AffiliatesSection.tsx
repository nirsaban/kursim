import { he } from '@/lib/he';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import AffiliatesPanel from '@/components/admin/AffiliatesPanel';

export default function AffiliatesSection({ courseId }: { courseId: string }) {
  return (
    <Card>
      <CardHeader title={he.affiliatesSection} subtitle={he.affiliateTitle} />
      <CardBody>
        <AffiliatesPanel courseId={courseId} />
      </CardBody>
    </Card>
  );
}
