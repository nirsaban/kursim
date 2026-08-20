import { describe, expect, it } from 'vitest';
import { buildLessonChunks } from '@/lib/knowledge/chunking';

const opts = { chunkSize: 40, chunkOverlap: 10 };

describe('buildLessonChunks — video (no chapters)', () => {
  it('groups consecutive segments up to the size limit', () => {
    const segments = [
      { startSeconds: 0, endSeconds: 5, text: 'aaaaaaaaaa' }, // 10
      { startSeconds: 5, endSeconds: 10, text: 'bbbbbbbbbb' }, // +11=21
      { startSeconds: 10, endSeconds: 15, text: 'cccccccccc' }, // +11=32
      { startSeconds: 15, endSeconds: 20, text: 'dddddddddd' }, // would be 43 > 40 → new chunk
    ];
    const chunks = buildLessonChunks({ segments, chapters: [], attachments: [] }, opts);
    expect(chunks.length).toBe(2);
    expect(chunks[0].sourceType).toBe('VIDEO');
    expect(chunks[0].startSeconds).toBe(0);
    expect(chunks[0].endSeconds).toBe(15);
    expect(chunks[1].startSeconds).toBe(15);
    expect(chunks[1].endSeconds).toBe(20);
    // Sequence is contiguous starting at 0.
    expect(chunks.map((c) => c.sequence)).toEqual([0, 1]);
  });

  it('carries character overlap into the next chunk', () => {
    const segments = [
      { startSeconds: 0, endSeconds: 5, text: 'x'.repeat(35) },
      { startSeconds: 5, endSeconds: 10, text: 'y'.repeat(10) },
    ];
    const chunks = buildLessonChunks({ segments, chapters: [], attachments: [] }, opts);
    expect(chunks.length).toBe(2);
    // The tail of chunk 1 reappears at the start of chunk 2.
    expect(chunks[1].content.startsWith('x')).toBe(true);
    expect(chunks[1].content.endsWith('y'.repeat(10))).toBe(true);
  });

  it('returns nothing for an empty transcript', () => {
    expect(buildLessonChunks({ segments: [], chapters: [], attachments: [] }, opts)).toEqual([]);
  });
});

describe('buildLessonChunks — video (with chapters)', () => {
  const segments = [
    { startSeconds: 0, endSeconds: 5, text: 'intro part one' },
    { startSeconds: 5, endSeconds: 10, text: 'intro part two' },
    { startSeconds: 10, endSeconds: 15, text: 'deep dive part one' },
    { startSeconds: 15, endSeconds: 20, text: 'deep dive part two' },
  ];
  const chapters = [
    { title: 'הקדמה', startSeconds: 0, endSeconds: 10 },
    { title: 'העמקה', startSeconds: 10, endSeconds: 20 },
  ];

  it('groups by chapter boundary first, tagging each chunk with its chapter', () => {
    const chunks = buildLessonChunks(
      { segments, chapters, attachments: [] },
      { chunkSize: 1000, chunkOverlap: 0 },
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata).toEqual({ chapterTitle: 'הקדמה' });
    expect(chunks[0].content).toContain('intro part one');
    expect(chunks[0].content).toContain('intro part two');
    expect(chunks[1].metadata).toEqual({ chapterTitle: 'העמקה' });
    expect(chunks[1].content).toContain('deep dive');
  });

  it('splits a single chapter into multiple chunks once it exceeds the size limit', () => {
    const chunks = buildLessonChunks(
      { segments, chapters, attachments: [] },
      { chunkSize: 20, chunkOverlap: 5 },
    );
    const fromFirstChapter = chunks.filter((c) => c.metadata?.chapterTitle === 'הקדמה');
    expect(fromFirstChapter.length).toBeGreaterThan(1);
  });

  it('still covers segments that fall outside every chapter window', () => {
    const withGap = [...segments, { startSeconds: 25, endSeconds: 30, text: 'orphaned tail segment' }];
    const chunks = buildLessonChunks(
      { segments: withGap, chapters, attachments: [] },
      { chunkSize: 1000, chunkOverlap: 0 },
    );
    const orphan = chunks.find((c) => c.content.includes('orphaned tail segment'));
    expect(orphan).toBeDefined();
    expect(orphan?.metadata).toBeUndefined();
  });
});

describe('buildLessonChunks — attachments', () => {
  it('splits by paragraph, packing under the size limit', () => {
    const text = ['פסקה ראשונה קצרה.', 'פסקה שנייה גם היא קצרה.', 'פסקה שלישית.'].join('\n\n');
    const chunks = buildLessonChunks(
      { segments: [], chapters: [], attachments: [{ attachmentId: 'a1', filename: 'x.pdf', text }] },
      { chunkSize: 1000, chunkOverlap: 0 },
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourceType).toBe('ATTACHMENT');
    expect(chunks[0].attachmentId).toBe('a1');
    expect(chunks[0].startSeconds).toBeUndefined();
  });

  it('hard-splits one paragraph that alone exceeds the size limit', () => {
    const text = 'פ'.repeat(120);
    const chunks = buildLessonChunks(
      { segments: [], chapters: [], attachments: [{ attachmentId: 'a1', filename: 'x.pdf', text }] },
      { chunkSize: 40, chunkOverlap: 5 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(40);
  });

  it('sequences attachment chunks after video chunks', () => {
    const segments = [{ startSeconds: 0, endSeconds: 5, text: 'video text' }];
    const chunks = buildLessonChunks(
      {
        segments,
        chapters: [],
        attachments: [{ attachmentId: 'a1', filename: 'x.pdf', text: 'doc text' }],
      },
      opts,
    );
    expect(chunks[0].sourceType).toBe('VIDEO');
    expect(chunks[1].sourceType).toBe('ATTACHMENT');
    expect(chunks[1].sequence).toBe(1);
  });
});
