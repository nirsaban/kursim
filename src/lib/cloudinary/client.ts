import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export function getCloudinary(): typeof cloudinary {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export function courseFolder(tenantId: string, courseId: string): string {
  return `tenants/${tenantId}/courses/${courseId}`;
}

/**
 * PUBLIC folder for AI-generated landing media. Landing pages are public, so
 * these assets are delivered as `type: upload` (unsigned CDN URLs) — distinct
 * from the authenticated lesson media under courseFolder(). The "media is never
 * public" rule still governs lesson video/attachments.
 */
export function marketingFolder(tenantId: string, courseId: string): string {
  return `tenants/${tenantId}/marketing/courses/${courseId}`;
}
