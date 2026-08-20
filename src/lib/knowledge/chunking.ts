/**
 * Turns one lesson's structured transcript (+ chapters) and attachment text
 * into KnowledgeChunk drafts, ready to embed. Pure/deterministic — no I/O —
 * so it's unit-testable without Gemini/DB.
 *
 * Strategy (spec order): chapter boundaries first, then consecutive-segment
 * grouping up to a size limit, sentence/paragraph boundaries as the natural
 * fallback (segments and paragraphs already ARE those boundaries — Gemini
 * segments by speech pauses, attachments split on blank lines), and a hard
 * character-limit split only as the last resort for one oversized unit.
 */

export interface SegmentInput {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface ChapterInput {
  title: string;
  startSeconds: number;
  endSeconds: number;
}

export interface AttachmentInput {
  attachmentId: string;
  filename: string;
  text: string;
}

export type ChunkDraft = {
  sourceType: 'VIDEO' | 'ATTACHMENT';
  attachmentId?: string;
  content: string;
  sequence: number;
  startSeconds?: number;
  endSeconds?: number;
  metadata?: Record<string, unknown>;
};

export interface ChunkingOptions {
  /** Target max characters per chunk. */
  chunkSize: number;
  /** Characters of trailing context repeated at the start of the next chunk. */
  chunkOverlap: number;
}

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  chunkSize: Number(process.env.KNOWLEDGE_CHUNK_SIZE) || 1200,
  chunkOverlap: Number(process.env.KNOWLEDGE_CHUNK_OVERLAP) || 150,
};

/** Group consecutive segments into chunks up to `chunkSize`, with character overlap carried into the next chunk. */
function packSegments(
  segments: SegmentInput[],
  opts: ChunkingOptions,
): Array<{ text: string; startSeconds: number; endSeconds: number }> {
  const out: Array<{ text: string; startSeconds: number; endSeconds: number }> = [];
  let bufText = '';
  let bufStart: number | null = null;
  let bufEnd = 0;

  const flush = () => {
    if (bufStart === null || !bufText.trim()) return;
    out.push({ text: bufText.trim(), startSeconds: bufStart, endSeconds: bufEnd });
  };

  for (const seg of segments) {
    const candidate = bufText ? `${bufText} ${seg.text}` : seg.text;
    if (bufText && candidate.length > opts.chunkSize) {
      flush();
      // Carry trailing overlap (characters) into the next chunk for context continuity.
      const overlapText = opts.chunkOverlap > 0 ? bufText.slice(-opts.chunkOverlap) : '';
      bufText = overlapText ? `${overlapText} ${seg.text}` : seg.text;
      bufStart = seg.startSeconds;
      bufEnd = seg.endSeconds;
    } else {
      bufText = candidate;
      if (bufStart === null) bufStart = seg.startSeconds;
      bufEnd = seg.endSeconds;
    }
  }
  flush();
  return out;
}

function buildVideoChunks(
  segments: SegmentInput[],
  chapters: ChapterInput[],
  opts: ChunkingOptions,
): ChunkDraft[] {
  if (segments.length === 0) return [];
  const drafts: ChunkDraft[] = [];
  let sequence = 0;

  if (chapters.length > 0) {
    for (const chapter of chapters) {
      const inChapter = segments.filter(
        (s) => s.startSeconds >= chapter.startSeconds && s.startSeconds < chapter.endSeconds,
      );
      if (inChapter.length === 0) continue;
      for (const part of packSegments(inChapter, opts)) {
        drafts.push({
          sourceType: 'VIDEO',
          content: part.text,
          sequence: sequence++,
          startSeconds: part.startSeconds,
          endSeconds: part.endSeconds,
          metadata: { chapterTitle: chapter.title },
        });
      }
    }
    // Segments outside every chapter's [start, end) window still need coverage.
    const covered = new Set<number>();
    for (const chapter of chapters) {
      segments.forEach((s, i) => {
        if (s.startSeconds >= chapter.startSeconds && s.startSeconds < chapter.endSeconds) covered.add(i);
      });
    }
    const uncovered = segments.filter((_, i) => !covered.has(i));
    for (const part of packSegments(uncovered, opts)) {
      drafts.push({
        sourceType: 'VIDEO',
        content: part.text,
        sequence: sequence++,
        startSeconds: part.startSeconds,
        endSeconds: part.endSeconds,
      });
    }
    return drafts;
  }

  for (const part of packSegments(segments, opts)) {
    drafts.push({
      sourceType: 'VIDEO',
      content: part.text,
      sequence: sequence++,
      startSeconds: part.startSeconds,
      endSeconds: part.endSeconds,
    });
  }
  return drafts;
}

/** Hard character-limit split for one paragraph that alone exceeds chunkSize. */
function splitLongParagraph(text: string, opts: ChunkingOptions): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + opts.chunkSize));
    i += opts.chunkSize - opts.chunkOverlap;
  }
  return out;
}

function buildAttachmentChunks(
  attachments: AttachmentInput[],
  startSequence: number,
  opts: ChunkingOptions,
): ChunkDraft[] {
  const drafts: ChunkDraft[] = [];
  let sequence = startSequence;
  for (const att of attachments) {
    const paragraphs = att.text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    let buf = '';
    const flush = () => {
      if (!buf.trim()) return;
      drafts.push({
        sourceType: 'ATTACHMENT',
        attachmentId: att.attachmentId,
        content: buf.trim(),
        sequence: sequence++,
        metadata: { filename: att.filename },
      });
      buf = '';
    };
    for (const para of paragraphs) {
      if (para.length > opts.chunkSize) {
        flush();
        for (const part of splitLongParagraph(para, opts)) {
          drafts.push({
            sourceType: 'ATTACHMENT',
            attachmentId: att.attachmentId,
            content: part,
            sequence: sequence++,
            metadata: { filename: att.filename },
          });
        }
        continue;
      }
      const candidate = buf ? `${buf}\n\n${para}` : para;
      if (buf && candidate.length > opts.chunkSize) {
        flush();
        buf = para;
      } else {
        buf = candidate;
      }
    }
    flush();
  }
  return drafts;
}

export function buildLessonChunks(
  input: {
    segments: SegmentInput[];
    chapters: ChapterInput[];
    attachments: AttachmentInput[];
  },
  opts: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS,
): ChunkDraft[] {
  const videoChunks = buildVideoChunks(input.segments, input.chapters, opts);
  const attachmentChunks = buildAttachmentChunks(input.attachments, videoChunks.length, opts);
  return [...videoChunks, ...attachmentChunks];
}
