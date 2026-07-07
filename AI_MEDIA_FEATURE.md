# Kursim — AI Course Media (Gemini) + Scroll-Scrubbed Landing Animation

Feature: after an owner fills in a course, a **"ייצר מדיה עם AI"** button generates a
photoreal, topic-tailored **8-second Veo video** (rendered as a 240-frame,
scroll-scrubbed hero animation like the GeniriFlow landing page) plus a few **Imagen
stills**. All AI is **Gemini** (text prompt-writer + Veo video + Imagen images).

Decisions locked:
- **Scope:** Veo video → 240 scroll frames **+** Imagen hero/gallery stills.
- **Trigger:** manual button in the wizard's final step and the marketing tab (cached per course; re-generate on demand).
- **Storage:** public Cloudinary folder `tenants/{tenantId}/marketing/courses/{courseId}/…` (landing pages are already public — this is the documented exception to the "media is never public" rule, which stays in force for lesson videos).

Reference implementation studied: `../GeniriFlow/GemiriFlowLandingPage/src/components/media/ScrollFrameSequence.tsx` (canvas, rAF lerp, concurrency-6 preload, poster + reduced-motion/data-saver fallback, mobile auto-play) and `RevealSequence.tsx` (tall sticky track → `md:h-[800vh]` + `md:sticky md:top-0`). 240 frames, `frame_0001.jpg`…`frame_0240.jpg`, `pad=4`, `ext=jpg`.

---

## 1. Pipeline

```
Wizard/marketing inputs (title, topic, audience, outcomes, tone, accent hex, emoji, instructor, language=he, region=IL)
   │  POST /api/admin/courses/[id]/generate-media   (zod, owner-guarded, tenant-scoped)
   ▼
[A] Gemini TEXT (gemini-2.5-pro)  → strict JSON: 1 Veo prompt + N Imagen prompts + negatives + palette
   ▼
[B] Veo generateVideos (long-running op, poll ~every 10s) → 8s 16:9 mp4 (no on-screen text)
    Imagen generateImages → hero (16:9) + 2 gallery (4:5) stills
   ▼
[C] ffmpeg normalizes mp4 → EXACTLY 240 jpg frames + a poster (frame 240)
   ▼
[D] Upload 240 frames + poster + stills → Cloudinary public marketing folder
   ▼
[E] Persist CourseMedia row (status=ready, framesBaseUrl, frameCount=240, poster, stills[], promptJson)
   ▼
[F] Landing page c/[courseId] scroll-scrubs the frames via ported <ScrollFrameSequence/>
```

Veo takes **minutes**, so [B]–[E] run in a **background job**, and the UI **polls status**. Never block the HTTP request on Veo.

**240-frame normalization** (Veo is ~24fps ≈ 192 frames; force 240):
```bash
ffmpeg -y -i clip.mp4 -vf "fps=30,scale=1280:-2:flags=lanczos" -q:v 3 \
  "$OUT/frame_%04d.jpg"          # 8s × 30fps = 240
cp "$OUT/frame_0240.jpg" "$OUT/poster.jpg"
```
`frameCount` is a prop on the component, so 240 is a normalization target, not a hard constraint — if a clip yields fewer, set the count accordingly.

---

## 2. The Gemini prompt-writer (system prompt)

The text model turns course inputs into cinematic generation prompts tuned for a
smooth scroll-scrub (ONE continuous slow camera move, single scene, no hard cuts) and
for overlaying our own Hebrew copy (NO in-frame text).

```text
You are a senior creative director and prompt engineer for photorealistic AI video
(Veo) and image (Imagen). You turn an online course's details into production-ready
generation prompts for a PUBLIC MARKETING LANDING PAGE.

The video will be rendered as a SCROLL-SCRUBBED FRAME SEQUENCE (Apple-style): the user
scrolls and the clip plays frame by frame. Therefore the shot MUST be ONE CONTINUOUS,
SLOW, EVOLVING CAMERA MOVE over a SINGLE COHERENT SCENE — a gentle dolly-in, slow
orbit, crane, or push-through. ABSOLUTELY NO hard cuts, scene changes, flash
transitions, or teleporting subjects: consecutive frames must differ only slightly or
the scroll animation breaks.

HARD RULES for every prompt you output:
- Photorealistic, cinematic, high production value. Real people/materials, natural
  imperfections. Never illustration/3D-render/cartoon unless the topic is explicitly
  about those.
- NO on-screen text, letters, numbers, captions, logos, watermarks, UI, or signage —
  we overlay our own Hebrew copy. Repeat this in the negative prompt.
- Composition must leave CALM NEGATIVE SPACE (usually upper or one side) for overlaid
  headline text. Say where it sits.
- Palette harmonizes with the given landing accent hex (use as key light / prop /
  environment accent, not a color filter).
- Culturally appropriate and inclusive for the audience/region. SFW, brand-safe, no
  real public figures or trademarks.
- Aspect ratio 16:9, ~8 seconds, slow camera motion (not fast subject motion).

Translate the TOPIC into a concrete, filmable scene evoking the TRANSFORMATION the
student gets — not a literal classroom. (Cooking → slow push-in on a chef plating a
dish, steam, warm window light. Finance → slow dolly across a calm modern desk,
morning light, hand + laptop, plants. Fitness → slow orbit around an athlete
mid-stretch at golden hour.) Choose the single most evocative scene.

INPUT (JSON): { title, topic, audience, outcomes[], tone, language, region,
                accentColorHex, emoji, instructorName, industry }

OUTPUT: return ONLY valid JSON matching exactly:
{
  "concept": "<1-sentence rationale>",
  "video": {
    "model_hint": "veo",
    "prompt": "<rich cinematic paragraph: subject, setting, wardrobe, ONE continuous
                camera move + speed, lens, lighting/time-of-day, mood, accent-color
                cues, and where the negative space sits>",
    "negative_prompt": "text, captions, letters, numbers, logos, watermark, subtitles,
                        UI, hard cuts, scene change, flicker, warping, extra fingers,
                        distorted faces, low quality",
    "duration_seconds": 8,
    "aspect_ratio": "16:9",
    "camera_motion": "<slow dolly-in | slow orbit | crane-up | push-through>"
  },
  "stills": [
    { "role": "hero",    "prompt": "<photoreal still, same world as the video, strong
                                     negative space for a headline>",
      "negative_prompt": "<...>", "aspect_ratio": "16:9" },
    { "role": "gallery1","prompt": "<detail shot supporting an outcome>",
      "negative_prompt": "<...>", "aspect_ratio": "4:5" },
    { "role": "gallery2","prompt": "<environment/context shot>",
      "negative_prompt": "<...>", "aspect_ratio": "4:5" }
  ],
  "palette": ["<hex>","<hex>","<hex>"]
}
```

Per-course user turn (example):
```json
{ "title":"מבוא לבישול איטלקי ביתי","topic":"בישול איטלקי ביתי",
  "audience":"מבשלים חובבים בישראל","outcomes":["להכין פסטה טרייה","לתבל נכון"],
  "tone":"חם ומזמין","language":"he","region":"IL",
  "accentColorHex":"#C26A3B","emoji":"👨‍🍳","instructorName":"נועה","industry":"אוכל" }
```
Because in-frame text is forbidden and we overlay Hebrew ourselves, this works for any
language without Veo/Imagen having to render Hebrew (which they do poorly).

---

## 3. Gemini config (verify IDs against current docs)

Verified live against the provided key's `ListModels` (real IDs available now):

```
# .env additions (key lives in .env only, never committed)
GEMINI_API_KEY=                          # required
GEMINI_TEXT_MODEL=gemini-3.1-pro-preview # prompt writer (or gemini-3.5-flash = cheaper)
GEMINI_VIDEO_MODEL=veo-3.1-fast-generate-preview  # also: veo-3.1-generate-preview (best), -lite (cheapest)
GEMINI_IMAGE_MODEL=imagen-4.0-generate-001        # also: -ultra- (hero), -fast-
AI_MEDIA_ENABLED=true
```
Use `@google/genai` (unified JS SDK). Veo = async operation: submit → poll
`operations.get` until done → download the returned file. Imagen = direct call.

**Hardening (validated):** a real test call produced excellent cinematic output but
occasionally emitted slightly malformed JSON (a stray bracket) even with
`responseMimeType: application/json`. So the prompt-writer MUST use
`generationConfig.responseSchema` (structured output) to force a guaranteed-valid
object — do not rely on free-form JSON parsing. Ignore any `model_hint` the model
returns; always use the configured `GEMINI_VIDEO_MODEL`.

---

## 4. Data model (tenant-isolated — follows CLAUDE.md rule #1)

New tenant-owned table `CourseMedia` (denormalized `tenantId`, RLS policy in a
migration, registered in `scoped-prisma.ts`):

```prisma
model CourseMedia {
  id            String   @id @default(uuid())
  tenantId      String
  courseId      String   @unique
  status        String   @default("idle") // idle|generating|ready|failed
  framesBaseUrl String?  // Cloudinary base, frames appended frame_0001.jpg…
  frameCount    Int      @default(240)
  posterUrl     String?
  videoUrl      String?  // the source mp4 (also public marketing)
  stills        Json?    // [{role, url, aspectRatio}]
  promptJson    Json?    // the Gemini output, for re-runs/debugging
  error         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  course        Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  @@index([tenantId])
}
```
Migration also: `ALTER TABLE "CourseMedia" ENABLE ROW LEVEL SECURITY;` + tenant policy
(mirror an existing tenant table's policy). Register the model in the scoped client.

---

## 5. Backend

- **Lib:** `src/lib/ai/gemini.ts` — `writeMediaPrompt(inputs)`, `generateVeoVideo(prompt)`, `generateImages(prompts)`. `src/lib/ai/frames.ts` — `extractFrames(mp4Path) → 240 jpgs` (use `ffmpeg-static` so no system dependency; or `apt-get install -y ffmpeg` in the Dockerfile). `src/lib/ai/publish.ts` — upload frames+poster+stills to the public marketing folder via the existing Cloudinary signer.
- **Job:** use **BullMQ on the existing Redis** (already have ioredis) — a `course-media` queue + a worker process. Handles the multi-minute Veo op with retries/backoff; writes `status` transitions to `CourseMedia`. (Simpler fallback: fire-and-forget async in-process + DB status, acceptable for single-instance self-host, but BullMQ is the clean fit.)
- **Routes** (zod on every boundary — rule #5; owner-guarded):
  - `POST /api/admin/courses/[id]/generate-media` → validates, enqueues job, sets `status=generating`, returns 202.
  - `GET /api/admin/courses/[id]/media` → returns `CourseMedia` (for polling).

---

## 6. Frontend

- Port `ScrollFrameSequence.tsx` → `src/components/media/ScrollFrameSequence.tsx` (unchanged logic; `framesPath` = Cloudinary base). Add the pinned sticky-track wrapper (like `RevealSequence`) into the landing hero in `src/app/t/[slug]/c/[courseId]/page.tsx`, gated on `status==='ready'`; otherwise fall back to the current theme gradient hero.
- **Generate button + status** in the wizard's final step and the marketing tab: a "ייצר מדיה עם AI" button → POST, then poll `GET …/media` every ~5s showing `idle → מייצר סרטון… (2–4 דק׳) → מוכן ✓ / נכשל`. Show a thumbnail/poster + "צור מחדש" once ready.
- **he.ts strings** (rule #3): `generateMedia` "ייצר מדיה עם AI", `mediaGenerating` "מייצרים סרטון בהתאמה אישית… זה יכול לקחת כמה דקות", `mediaReady` "המדיה מוכנה", `mediaFailed` "יצירת המדיה נכשלה, נסו שוב", `regenerateMedia` "צור מחדש".

---

## 7. Prerequisites to implement
1. `GEMINI_API_KEY` (and confirm your account has Veo access — it's gated/paid).
2. Confirm current Veo/Imagen/text model IDs for the July-2026 timeline.
3. ffmpeg available (via `ffmpeg-static` npm — no infra change — or Dockerfile apt install).
4. OK to add BullMQ + a worker process to the stack (uses existing Redis).
5. Note: Veo is **slow and costs money per clip** — the manual button + per-course cache keeps spend controlled; consider a per-tenant monthly generation cap.

---

## 8. Suggested build order
1. Schema + migration + RLS + scoped-client registration for `CourseMedia`.
2. `src/lib/ai/gemini.ts` (prompt writer first — testable with just a text call).
3. Frames + Cloudinary publish libs.
4. BullMQ queue + worker + the two API routes.
5. Port `ScrollFrameSequence` + landing hero integration.
6. Wizard/marketing button + polling UI + he.ts strings.
```
