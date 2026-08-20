/**
 * Gemini transcription client — turns lesson audio / attachment documents into
 * text for the mentor brain. Same conventions as lib/ai/gemini.ts: plain fetch
 * against the Generative Language REST API, model ids from env, key never
 * logged and never sent anywhere but Google.
 *
 * Media goes through the Gemini Files API (resumable upload → poll ACTIVE →
 * generateContent with the file uri → delete). Inline base64 would cap us at
 * ~20MB per request; the Files API takes 2GB, which is why lesson audio of any
 * realistic length (Gemini hears up to ~9.5h per prompt) fits without chunking.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta';

export function transcriptionConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  return {
    // On by default wherever a key exists — transcription is a cheap one-time
    // cost per lesson, unlike Veo. TRANSCRIPTION_ENABLED=false switches it off.
    enabled: process.env.TRANSCRIPTION_ENABLED !== 'false' && !!apiKey,
    apiKey,
    model: process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-2.5-flash',
  };
}

function requireKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return key;
}

export const TRANSCRIBE_PROMPT = `אתה מנוע תמלול מקצועי. תמלל את ההקלטה המצורפת (שיעור מקורס דיגיטלי) במלואה ובמדויק.

כללים מחייבים:
- השפה המדוברת היא בעיקר עברית.
- שמור על הניסוח המקורי. אל תסכם, אל תשמיט משפטים ואל תוסיף מידע שלא נאמר.
- שמור על דיוק במונחים טכניים, שמות מוצרים, מילים באנגלית ומספרים.
- חלק לפסקאות טבעיות לפי הדיבור.
- אם יש כמה דוברים מובחנים סמן "דובר 1:", "דובר 2:" — אל תמציא שמות.
- קטע לא ברור סמן [לא ברור] במקום לנחש.
- החזר את התמליל בלבד, ללא הערות וללא כותרות.`;

export const EXTRACT_PROMPT = `אתה מנוע קריאת מסמכים. חלץ את כל הטקסט מהקובץ המצורף (חומר עזר של שיעור בקורס דיגיטלי).

כללים מחייבים:
- החזר את התוכן במלואו, כולל כותרות, רשימות וטבלאות (טבלה כשורות טקסט).
- אל תסכם ואל תוסיף מידע שלא מופיע בקובץ.
- בתמונה: תאר בקצרה מה רואים, וחלץ כל טקסט שמופיע בה.
- קטע לא קריא סמן [לא ברור].
- החזר את הטקסט בלבד, ללא הערות על התהליך.`;

export interface TranscriptResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// ── Files API ────────────────────────────────────────────────────────────────

interface GeminiFile {
  name: string;
  uri: string;
  state: string;
}

/** Resumable upload of a media buffer; resolves once Gemini can read it. */
export async function uploadToGemini(
  bytes: Buffer,
  mimeType: string,
  displayName: string,
): Promise<GeminiFile> {
  const key = requireKey();
  const start = await fetch(`${UPLOAD_BASE}/files?key=${key}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) {
    throw new Error(`Gemini file start ${start.status}: ${(await start.text()).slice(0, 300)}`);
  }
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini file start: no upload url');

  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Length': String(bytes.byteLength),
    },
    body: new Uint8Array(bytes),
  });
  if (!up.ok) throw new Error(`Gemini file upload ${up.status}`);
  const data = (await up.json()) as { file?: GeminiFile };
  if (!data.file?.uri) throw new Error('Gemini file upload: no file uri');

  // Audio/PDF need server-side processing before they are usable.
  let file = data.file;
  const started = Date.now();
  while (file.state === 'PROCESSING') {
    if (Date.now() - started > 5 * 60 * 1000) throw new Error('Gemini file processing timed out');
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${API_BASE}/${file.name}?key=${key}`);
    if (!res.ok) throw new Error(`Gemini file poll ${res.status}`);
    file = (await res.json()) as GeminiFile;
  }
  if (file.state !== 'ACTIVE') throw new Error(`Gemini file state ${file.state}`);
  return file;
}

/** Best-effort delete — uploaded media should not outlive the job. */
export async function deleteGeminiFile(name: string): Promise<void> {
  try {
    const key = requireKey();
    await fetch(`${API_BASE}/${name}?key=${key}`, { method: 'DELETE' });
  } catch {
    // Files auto-expire after 48h anyway.
  }
}

// ── Transcription / extraction ───────────────────────────────────────────────

/** One generateContent call over an uploaded file with the given instruction. */
export async function generateFromFile(
  file: GeminiFile,
  mimeType: string,
  prompt: string,
): Promise<TranscriptResult> {
  const key = requireKey();
  const { model } = transcriptionConfig();
  const res = await fetch(`${API_BASE}/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ fileData: { fileUri: file.uri, mimeType } }, { text: prompt }],
        },
      ],
      // Transcription wants fidelity, not creativity.
      generationConfig: { temperature: 0 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini transcribe ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return {
    text: text.trim(),
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** upload → prompt → delete, as one call. */
export async function transcribeMedia(
  bytes: Buffer,
  mimeType: string,
  displayName: string,
  prompt: string,
): Promise<TranscriptResult> {
  const file = await uploadToGemini(bytes, mimeType, displayName);
  try {
    return await generateFromFile(file, mimeType, prompt);
  } finally {
    await deleteGeminiFile(file.name);
  }
}

export interface StructuredResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Same generateContent call as generateFromFile, but forces JSON matching
 * `responseSchema` (Gemini structured output — see RESPONSE_SCHEMA in
 * src/lib/ai/gemini.ts for the same pattern) and returns the raw parsed JSON.
 * Callers validate with zod before persisting; this function does not parse
 * against a zod schema itself so it stays reusable for any structured shape.
 */
export async function generateStructuredFromFile(
  file: GeminiFile,
  mimeType: string,
  prompt: string,
  responseSchema: Record<string, unknown>,
): Promise<StructuredResult<unknown>> {
  const key = requireKey();
  const { model } = transcriptionConfig();
  const res = await fetch(`${API_BASE}/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ fileData: { fileUri: file.uri, mimeType } }, { text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini structured ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('Gemini structured: empty response');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini structured: invalid JSON');
  }
  return {
    data: parsed,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** upload → structured prompt → delete, as one call. */
export async function analyzeStructuredMedia(
  bytes: Buffer,
  mimeType: string,
  displayName: string,
  prompt: string,
  responseSchema: Record<string, unknown>,
): Promise<StructuredResult<unknown>> {
  const file = await uploadToGemini(bytes, mimeType, displayName);
  try {
    return await generateStructuredFromFile(file, mimeType, prompt, responseSchema);
  } finally {
    await deleteGeminiFile(file.name);
  }
}
