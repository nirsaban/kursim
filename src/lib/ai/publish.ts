import { getCloudinary, marketingFolder, isCloudinaryConfigured } from '@/lib/cloudinary/client';
import type { ExtractedFrames } from './frames';
import type { GeneratedImage } from './gemini';

export interface PublishedMedia {
  videoUrl: string;
  framesBaseUrl: string; // append /frame_0001.jpg … frame_NNNN.jpg
  frameCount: number;
  posterUrl: string;
  stills: Array<{ role: string; url: string; aspectRatio: string }>;
}

/** Run up to `limit` async tasks at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Upload the Veo clip, its 240 frames + poster, and the Imagen stills to the
 * PUBLIC marketing folder (type: upload). Returns public CDN URLs.
 */
export async function publishCourseMedia(
  tenantId: string,
  courseId: string,
  assets: { frames: ExtractedFrames; images: GeneratedImage[] },
): Promise<PublishedMedia> {
  if (!isCloudinaryConfigured()) throw new Error('Cloudinary is not configured');
  const cld = getCloudinary();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const folder = marketingFolder(tenantId, courseId);
  const { frames, images } = assets;

  const upImage = (filePath: string, publicId: string) =>
    cld.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type: 'image',
      type: 'upload',
      overwrite: true,
      invalidate: true,
    });

  // Video (public marketing clip — also usable as a hero <video> fallback).
  const video = await cld.uploader.upload(frames.mp4Path, {
    folder,
    public_id: 'clip',
    resource_type: 'video',
    type: 'upload',
    overwrite: true,
    invalidate: true,
  });

  // Poster + 240 frames (frame_0001 … frame_0240), 8-at-a-time.
  await upImage(frames.posterPath, 'poster');
  await pool(frames.framePaths, 8, (fp, i) => upImage(fp, `frame_${String(i + 1).padStart(4, '0')}`));

  // Imagen stills, uploaded straight from base64 data URIs.
  const stills = await pool(images, 4, async (img, i) => {
    const r = await cld.uploader.upload(`data:${img.mimeType};base64,${img.bytesBase64}`, {
      folder,
      public_id: `still_${i + 1}_${img.role.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`,
      resource_type: 'image',
      type: 'upload',
      overwrite: true,
      invalidate: true,
    });
    return { role: img.role, url: r.secure_url as string, aspectRatio: img.aspectRatio };
  });

  return {
    videoUrl: video.secure_url as string,
    framesBaseUrl: `https://res.cloudinary.com/${cloudName}/image/upload/${folder}`,
    frameCount: frames.frameCount,
    posterUrl: `https://res.cloudinary.com/${cloudName}/image/upload/${folder}/poster.jpg`,
    stills,
  };
}
