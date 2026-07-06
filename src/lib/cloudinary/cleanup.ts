import { getCloudinary, courseFolder, isCloudinaryConfigured } from './client';

/** Best-effort destroy of every asset under a course prefix (course/lesson/tenant deletion). */
export async function destroyCoursePrefix(tenantId: string, courseId: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  const cld = getCloudinary();
  const prefix = `${courseFolder(tenantId, courseId)}/`;
  for (const resourceType of ['video', 'image', 'raw'] as const) {
    await cld.api
      .delete_resources_by_prefix(prefix, { resource_type: resourceType, type: 'authenticated' })
      .catch(() => {});
  }
}

export async function destroyTenantPrefix(tenantId: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  const cld = getCloudinary();
  const prefix = `tenants/${tenantId}/`;
  for (const resourceType of ['video', 'image', 'raw'] as const) {
    await cld.api
      .delete_resources_by_prefix(prefix, { resource_type: resourceType, type: 'authenticated' })
      .catch(() => {});
  }
}

export async function destroyPublicIds(
  items: Array<{ publicId: string; video: boolean }>,
): Promise<void> {
  if (!isCloudinaryConfigured() || items.length === 0) return;
  const cld = getCloudinary();
  for (const item of items) {
    await cld.uploader
      .destroy(item.publicId, {
        resource_type: item.video ? 'video' : 'image',
        type: 'authenticated',
      })
      .catch(() => {});
  }
}
