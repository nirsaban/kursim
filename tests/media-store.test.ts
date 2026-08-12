import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

const ROOT = path.join(os.tmpdir(), 'kursim-media-test');
process.env.MEDIA_ROOT = ROOT;
process.env.AUTH_SECRET = 'test-secret-for-media-urls';

const {
  PART_SIZE,
  courseKeyPrefix,
  keyBelongsToCourse,
  keyBelongsToTenant,
  newVideoKey,
  resolveKey,
  contentTypeForKey,
} = await import('@/lib/media-store/paths');
const { signedMediaUrl, verifyMediaSignature } = await import('@/lib/media-store/sign');
const store = await import('@/lib/media-store/store');
const { planChunks } = await import('@/lib/client/upload');

const TENANT = 'fa6cd40a-5092-4334-b6d8-45ca048fef90';
const OTHER_TENANT = '11111111-1111-4111-8111-111111111111';
const COURSE = '492863a1-534e-4ceb-a40e-ec259389a550';
const OTHER_COURSE = '22222222-2222-4222-8222-222222222222';

beforeAll(async () => {
  await fs.rm(ROOT, { recursive: true, force: true });
  await fs.mkdir(ROOT, { recursive: true });
});

describe('key prefixes', () => {
  it('mirrors the Cloudinary folder layout', () => {
    expect(courseKeyPrefix(TENANT, COURSE)).toBe(`tenants/${TENANT}/courses/${COURSE}`);
  });

  it("accepts its own course's key and rejects everyone else's", () => {
    const key = `${courseKeyPrefix(TENANT, COURSE)}/abc.mp4`;
    expect(keyBelongsToCourse(key, TENANT, COURSE)).toBe(true);
    expect(keyBelongsToTenant(key, TENANT)).toBe(true);
    expect(keyBelongsToCourse(key, OTHER_TENANT, COURSE)).toBe(false);
    expect(keyBelongsToCourse(key, TENANT, OTHER_COURSE)).toBe(false);
    expect(keyBelongsToTenant(key, OTHER_TENANT)).toBe(false);
  });

  it('rejects a prefix that only looks like the folder', () => {
    expect(keyBelongsToCourse(`${courseKeyPrefix(TENANT, COURSE)}-evil/x.mp4`, TENANT, COURSE)).toBe(
      false,
    );
  });
});

describe('resolveKey', () => {
  it('resolves a normal key under the media root', () => {
    expect(resolveKey(`${courseKeyPrefix(TENANT, COURSE)}/a.mp4`)).toBe(
      path.join(ROOT, 'tenants', TENANT, 'courses', COURSE, 'a.mp4'),
    );
  });

  it('refuses anything that would escape the root', () => {
    // The single most important guard here: a key is user-influenced input and
    // gets joined to a filesystem path.
    expect(resolveKey('../../../etc/passwd')).toBeNull();
    expect(resolveKey('tenants/../../etc/passwd')).toBeNull();
    expect(resolveKey('/etc/passwd')).toBeNull();
    expect(resolveKey('tenants/./x')).toBeNull();
    expect(resolveKey('tenants/x\0.mp4')).toBeNull();
    expect(resolveKey('')).toBeNull();
  });
});

describe('newVideoKey', () => {
  it('lands inside the course prefix whatever the filename says', () => {
    const key = newVideoKey(TENANT, COURSE, '../../../etc/passwd.sh');
    expect(keyBelongsToCourse(key, TENANT, COURSE)).toBe(true);
    expect(resolveKey(key)).not.toBeNull();
    expect(key).not.toContain('..');
    expect(key.endsWith('.mp4')).toBe(true);
  });

  it('keeps a known video extension and drops an unknown one', () => {
    expect(newVideoKey(TENANT, COURSE, 'clip.MOV').endsWith('.mov')).toBe(true);
    expect(newVideoKey(TENANT, COURSE, 'clip.exe').endsWith('.mp4')).toBe(true);
  });

  it('never repeats a key', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newVideoKey(TENANT, COURSE, 'a.mp4')));
    expect(keys.size).toBe(50);
  });
});

describe('signed media URLs', () => {
  const key = `${courseKeyPrefix(TENANT, COURSE)}/abc.mp4`;

  it('round-trips a fresh signature', () => {
    const url = signedMediaUrl(key, 60);
    const params = new URL(url, 'https://example.com').searchParams;
    expect(verifyMediaSignature(key, Number(params.get('exp')), params.get('sig')!)).toBe(true);
  });

  it('rejects a tampered key, a tampered signature, and an expired one', () => {
    const url = signedMediaUrl(key, 60);
    const params = new URL(url, 'https://example.com').searchParams;
    const exp = Number(params.get('exp'));
    const sig = params.get('sig')!;

    // A signature for one video must not unlock another.
    expect(verifyMediaSignature(`${courseKeyPrefix(TENANT, COURSE)}/other.mp4`, exp, sig)).toBe(
      false,
    );
    expect(verifyMediaSignature(key, exp, sig.replace(/.$/, '0'))).toBe(false);
    expect(verifyMediaSignature(key, exp, '')).toBe(false);
    // Extending the deadline invalidates it — exp is signed, not just checked.
    expect(verifyMediaSignature(key, exp + 3600, sig)).toBe(false);
    expect(verifyMediaSignature(key, Math.floor(Date.now() / 1000) - 1, sig)).toBe(false);
  });
});

describe('chunked upload', () => {
  it('assembles parts back into the original bytes', async () => {
    const body = Buffer.from('kursim'.repeat(5000)); // ~30KB
    const upload = await store.createUpload(TENANT, COURSE, 'lesson.mp4', body.length);
    expect(upload.parts).toBe(1);

    await store.writePart(upload.uploadId, 1, new Blob([body]).stream());
    const key = await store.completeUpload(upload.uploadId);

    expect(key).toBe(upload.key);
    const written = await fs.readFile(resolveKey(key!)!);
    expect(written.equals(body)).toBe(true);
  });

  it('splits a multi-part file and puts it back together in order', async () => {
    const partSize = PART_SIZE;
    const body = Buffer.concat([
      Buffer.alloc(partSize, 1),
      Buffer.alloc(partSize, 2),
      Buffer.alloc(1024, 3),
    ]);
    const upload = await store.createUpload(TENANT, COURSE, 'big.mp4', body.length);
    expect(upload.parts).toBe(3);

    const chunks = planChunks(body.length, upload.partSize);
    // Deliberately out of order: parts are named by number, not arrival.
    for (const i of [2, 0, 1]) {
      const slice = body.subarray(chunks[i].start, chunks[i].end);
      await store.writePart(upload.uploadId, i + 1, new Blob([slice]).stream());
    }

    const key = await store.completeUpload(upload.uploadId);
    const written = await fs.readFile(resolveKey(key!)!);
    expect(written.length).toBe(body.length);
    expect(written.equals(body)).toBe(true);
  });

  it('refuses to finish when a part never arrived', async () => {
    const upload = await store.createUpload(TENANT, COURSE, 'truncated.mp4', PART_SIZE + 100);
    await store.writePart(upload.uploadId, 1, new Blob([Buffer.alloc(PART_SIZE)]).stream());
    // Part 2 is missing — completing must fail rather than store a short file.
    expect(await store.completeUpload(upload.uploadId)).toBeNull();
    expect(await store.readUploadMeta(upload.uploadId)).toBeNull();
  });

  it('refuses a size that does not match what was declared', async () => {
    const upload = await store.createUpload(TENANT, COURSE, 'short.mp4', 10_000);
    await store.writePart(upload.uploadId, 1, new Blob([Buffer.alloc(10)]).stream());
    expect(await store.completeUpload(upload.uploadId)).toBeNull();
  });

  it('drops the scratch directory on abort', async () => {
    const upload = await store.createUpload(TENANT, COURSE, 'gone.mp4', 100);
    await store.abortUpload(upload.uploadId);
    expect(await store.readUploadMeta(upload.uploadId)).toBeNull();
  });

  it('ignores an upload id that is not one of ours', async () => {
    expect(await store.readUploadMeta('../../etc')).toBeNull();
    expect(await store.readUploadMeta('not-a-hex-id')).toBeNull();
    expect(await store.completeUpload('../../etc')).toBeNull();
  });
});

describe('deletion', () => {
  it('removes a whole course prefix', async () => {
    const upload = await store.createUpload(TENANT, COURSE, 'doomed.mp4', 4);
    await store.writePart(upload.uploadId, 1, new Blob([Buffer.from('abcd')]).stream());
    const key = await store.completeUpload(upload.uploadId);
    expect(await fs.stat(resolveKey(key!)!)).toBeTruthy();

    await store.destroyLocalCoursePrefix(TENANT, COURSE);
    await expect(fs.stat(resolveKey(key!)!)).rejects.toThrow();
  });
});

describe('contentTypeForKey', () => {
  it('maps the extensions the uploader allows', () => {
    expect(contentTypeForKey('a/b.mp4')).toBe('video/mp4');
    expect(contentTypeForKey('a/b.webm')).toBe('video/webm');
    expect(contentTypeForKey('a/b.weird')).toBe('application/octet-stream');
  });
});
