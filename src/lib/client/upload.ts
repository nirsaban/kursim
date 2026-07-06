'use client';

import { apiFetch } from './api';

export interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  type: 'authenticated';
  resourceType: 'video' | 'image' | 'raw';
}

export interface CloudinaryUploadResult {
  public_id: string;
  duration?: number;
  bytes: number;
}

/** Ask the API to sign a direct upload into this course's tenant folder. */
export async function signCourseUpload(
  courseId: string,
  kind: 'video' | 'image' | 'raw',
): Promise<{ sign: SignResponse } | { error: 'not_configured' | 'failed' }> {
  const res = await apiFetch('/api/media/sign-upload', {
    method: 'POST',
    body: JSON.stringify({ courseId, kind }),
  });
  if (res.status === 503) return { error: 'not_configured' };
  if (!res.ok) return { error: 'failed' };
  return { sign: await res.json() };
}

/** Direct browser→Cloudinary upload with progress callback. */
export function uploadToCloudinary(
  file: File,
  sign: SignResponse,
  onProgress: (pct: number) => void,
): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sign.apiKey);
  form.append('timestamp', String(sign.timestamp));
  form.append('signature', sign.signature);
  form.append('folder', sign.folder);
  form.append('type', sign.type);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`,
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('upload failed'));
    xhr.send(form);
  });
}
