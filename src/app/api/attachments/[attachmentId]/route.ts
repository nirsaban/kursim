import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { destroyPublicIds } from '@/lib/cloudinary/cleanup';

type Params = { params: Promise<{ attachmentId: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { attachmentId } = await params;

  const db = forTenant(auth.tenantId!);
  const attachment = await db.attachment.findFirst({ where: { id: attachmentId } });
  if (!attachment) return apiError(404, 'not_found');

  await db.attachment.delete({ where: { id: attachment.id } });
  destroyPublicIds([{ publicId: attachment.publicId, video: false }]).catch(() => {});
  return NextResponse.json({ ok: true });
}
