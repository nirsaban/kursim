import { getCloudinary, courseFolder } from './client';

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: 'authenticated';
  resourceType: 'video' | 'image' | 'raw';
}

/**
 * Server-side signature for a direct browser→Cloudinary upload. The folder and
 * `type: authenticated` are pinned into the signature, so the client cannot
 * upload outside its tenant/course prefix or make an asset public.
 */
export function signUpload(
  tenantId: string,
  courseId: string,
  kind: 'video' | 'image' | 'raw',
): UploadSignature {
  const cld = getCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = courseFolder(tenantId, courseId);
  const signature = cld.utils.api_sign_request(
    { timestamp, folder, type: 'authenticated' },
    process.env.CLOUDINARY_API_SECRET!,
  );
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    timestamp,
    signature,
    folder,
    type: 'authenticated',
    resourceType: kind,
  };
}

/** An uploaded public_id must live inside the tenant's folder prefix. */
export function publicIdBelongsToCourse(
  publicId: string,
  tenantId: string,
  courseId: string,
): boolean {
  return publicId.startsWith(`${courseFolder(tenantId, courseId)}/`);
}

export function publicIdBelongsToTenant(publicId: string, tenantId: string): boolean {
  return publicId.startsWith(`tenants/${tenantId}/`);
}
