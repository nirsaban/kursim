# Lesson Transcription, Attachment Extraction & Course Knowledge (RAG)

Every lesson video is transcribed (Hebrew, Gemini, structured — timestamped
segments + auto chapters) and every readable attachment (PDF / image / text)
has its content extracted. Both feed a per-lesson **knowledge base**: chunked,
embedded (Gemini embeddings), and stored in Postgres/pgvector. The AI mentor
answers students by retrieving the top-K relevant chunks for their question
(RAG) instead of dumping the whole course into the prompt — so it can cite
"מוסבר בשיעור 4 — 07:32" with an accurate, deep-linkable timestamp.

## Flow

```
video attach / attachment upload  ──►  status = PENDING, enqueue (BullMQ "transcription")
                                              │
                        worker (npm run worker, concurrency 2)
                                              │
             lesson: Cloudinary signed URL or local disk ─► ffmpeg ─► mono 64k MP3
             attachment: signed download (raw/image)
                                              │
             Gemini Files API upload ─► generateContent (structured JSON) ─► delete file
                                              │
       lesson: Transcript + TranscriptSegment[] + Chapter[], Lesson.transcript (joined text)
       attachment: Attachment.extractedText
                    status = COMPLETED, mentor brain cache invalidated
                                              │
                         enqueue {kind:'index', lessonId} (same queue)
                                              │
        chunk (chapter/segment boundaries) ─► embed (Gemini) ─► KnowledgeVersion
                                              │
              atomically ACTIVATE new version, SUPERSEDE the old one
                                              │
                    mentor RAG: embed question ─► pgvector search
                    (tenantId + courseId + ACTIVE version only) ─► top-K chunks
```

Audio-only upload is why there is no chunking of the *media* itself: a 2-hour
lesson is ~60MB of MP3, far under the Files API 2GB cap and Gemini's ~9.5h
audio window. (Semantic *chunking* of the resulting transcript — for
retrieval — is a separate, later step; see "Knowledge chunks" below.)

## State machines

`Lesson.transcriptStatus` / `Attachment.textStatus` (unchanged):
`NONE → PENDING → PROCESSING → COMPLETED | FAILED`.

- `PROCESSING` is a DB compare-and-set lock — a duplicate job exits instead of
  paying Gemini twice; the queue also dedupes by jobId (`lesson_{id}` /
  `attachment_{id}` — BullMQ rejects `:` in a custom jobId).
- `COMPLETED` is never redone unless the request carries `force` (a new video
  upload forces automatically; an unchanged one never re-spends).
- Transient errors (429/5xx/network) retry 3× with exponential backoff
  (30s→60s→120s). Permanent ones (`EMPTY_TRANSCRIPT`, `LESSON_VIDEO_NOT_FOUND`,
  …) throw `UnrecoverableError` and stop. A Gemini response that fails
  `videoAnalysisSchema` validation (`TRANSCRIPT_SCHEMA_INVALID`) is retryable
  — never persisted malformed.
- Stored errors are stable codes only — never signed URLs or raw messages.

`KnowledgeVersion.status`: `PENDING → CHUNKING → EMBEDDING → ACTIVATING →
ACTIVE | FAILED`, with a prior `ACTIVE` row flipped to `SUPERSEDED` in the
same transaction that activates the new one. Only one `ACTIVE` version per
lesson can ever exist (a hand-written partial unique index enforces this at
the DB level) — the mentor only ever reads `ACTIVE` chunks, so a lesson being
reprocessed keeps serving its old knowledge until the new version is fully
chunked + embedded, never a half-built one.

## Triggering

| When | What |
|---|---|
| Video attached (`POST /api/lessons/{id}/video`) | auto, `force: true` → transcribe → auto re-index |
| Video deleted | transcript + status cleared |
| Attachment uploaded | auto (readable kinds only) → extract → auto re-index |
| Admin sync button (course content tab) | `POST /api/courses/{id}/transcriptions` — queues everything missing/failed; `{force:true}` redoes all |
| One lesson retry / reprocess | `POST /api/lessons/{id}/transcription` `{force?}` — re-runs the whole chain through to activation |
| Status for the UI | `GET /api/courses/{id}/transcriptions` (now includes `knowledgeStatus`/`chunkCount` per lesson) |
| Pre-existing videos | `npm run transcribe:backfill` (`-- --dry` to count) |

## Knowledge chunks & RAG

- **Chunking** (`src/lib/knowledge/chunking.ts`, pure/testable): chapter
  boundaries first, then consecutive transcript segments grouped up to
  `KNOWLEDGE_CHUNK_SIZE` chars with `KNOWLEDGE_CHUNK_OVERLAP` characters of
  trailing context carried into the next chunk. Attachments are chunked by
  paragraph, same size limit, appended after the video's chunks.
- **Embeddings** (`src/lib/ai/embeddings.ts`): `GEMINI_EMBEDDING_MODEL`
  (default `gemini-embedding-001`, truncated to 768 dims via
  `output_dimensionality` to match the `vector(768)` column; changing the
  model/dimension needs a new migration, never a silent change).
- **Storage/activation** (`src/lib/knowledge/chunk-repository.ts`): the only
  file with raw pgvector SQL. Inserts every chunk + embedding and flips the
  version `ACTIVE` (superseding the old one) in one transaction.
- **Retrieval** (`src/lib/knowledge/retrieval.ts`): embeds the student's
  question, then a cosine-similarity search scoped to `(tenantId, courseId)`
  and `ACTIVE` chunks only — `RAG_TOP_K` results (default 6).
- **Mentor** (`src/lib/mentor.ts`): RAG is the primary path; it falls back to
  the old whole-course "brain" dump only when a course has no indexed
  knowledge yet (not reprocessed, or embeddings unavailable) — nothing
  regresses mid-rollout. Citations use `src/lib/video/timestamp.ts` for
  `mm:ss` formatting and the student lesson deep link (`?t=` seconds).

## Configuration (.env)

```
TRANSCRIPTION_ENABLED=true            # off switch; on whenever GEMINI_API_KEY is set — also gates indexing
GEMINI_TRANSCRIPTION_MODEL=gemini-2.5-flash
TRANSCRIPTION_CONCURRENCY=2           # parallel jobs in the worker (shared by transcription + indexing)
TRANSCRIPTION_MAX_ATTEMPTS=3
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
KNOWLEDGE_CHUNK_SIZE=1200
KNOWLEDGE_CHUNK_OVERLAP=150
RAG_TOP_K=6
```

pgvector requires the `postgres` service to run the `pgvector/pgvector:pg16`
image (see `docker-compose.yml` / `docker-compose.prod.yml`) — plain
`postgres:16-alpine` does not ship the extension.

## Monitoring

Worker logs are grep-able by `[transcription]` (transcribe/extract stage) and
`[knowledge]` (chunk/embed/activate stage): queued/start/completed/failed per
item, with duration, transcript length/chunk count and Gemini token usage on
success and a stable error code on failure. Failed items stay visible in the
admin UI (red dot on the lesson icon) and are re-queued by the sync button.
