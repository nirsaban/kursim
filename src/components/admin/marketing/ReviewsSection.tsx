import { he } from '@/lib/he';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import ReviewsModeration from '@/components/admin/ReviewsModeration';

export default function ReviewsSection({ courseId }: { courseId: string }) {
  return (
    <Card>
      <CardHeader title={he.reviews} subtitle={he.reviewsTitle} />
      <CardBody>
        <ReviewsModeration courseId={courseId} />
      </CardBody>
    </Card>
  );
}
