export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  url: string,
  options: {
    method?: string;
    json?: unknown;
    token?: string | null;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง';
    throw new ApiError(msg, res.status);
  }

  return data as T;
}

const THAI_LETTER_MAP: Record<string, string> = {
  A: 'เอ',
  B: 'บี',
  C: 'ซี',
  D: 'ดี',
  E: 'อี',
};

const THAI_DIGIT_MAP: Record<string, string> = {
  '0': 'ศูนย์',
  '1': 'หนึ่ง',
  '2': 'สอง',
  '3': 'สาม',
  '4': 'สี่',
  '5': 'ห้า',
  '6': 'หก',
  '7': 'เจ็ด',
  '8': 'แปด',
  '9': 'เก้า',
};

function buildSpokenAnnouncement(queueNo: string, counter: number): string {
  const spokenQueue = queueNo
    .replace(/-/g, '')
    .toUpperCase()
    .split('')
    .map((ch) => THAI_LETTER_MAP[ch] ?? THAI_DIGIT_MAP[ch] ?? ch)
    .join(' ');
  const spokenCounter = THAI_DIGIT_MAP[String(counter)] ?? String(counter);
  return `ขอเชิญหมายเลข ${spokenQueue} ที่ช่องบริการ ${spokenCounter} ค่ะ`;
}

let sharedAudioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentHtmlAudio: HTMLAudioElement | null = null;
const wavBufferCache = new Map<string, ArrayBuffer>();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

/**
 * Call synchronously inside user click handlers so browsers allow audio playback
 * after async API requests complete.
 */
export function unlockQueueAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function stopCurrentPlayback() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // ignore
    }
    currentSource = null;
  }
  if (currentHtmlAudio) {
    try {
      currentHtmlAudio.pause();
      currentHtmlAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentHtmlAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

async function playWavBuffer(arrayBuffer: ArrayBuffer): Promise<boolean> {
  const ctx = getAudioContext();
  if (ctx) {
    try {
      if (ctx.state !== 'running') {
        await ctx.resume();
      }
      if (ctx.state === 'running') {
        const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
        stopCurrentPlayback();
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        currentSource = source;
        source.onended = () => {
          if (currentSource === source) currentSource = null;
        };
        source.start(0);
        return true;
      }
    } catch {
      // fall through to HTMLAudioElement
    }
  }

  try {
    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    stopCurrentPlayback();
    const audio = new Audio(url);
    currentHtmlAudio = audio;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (currentHtmlAudio === audio) currentHtmlAudio = null;
    };
    audio.onended = cleanup;
    audio.onerror = cleanup;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function fallbackBrowserSpeech(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = synth.getVoices().filter((v) =>
      v.lang.toLowerCase().startsWith('th'),
    );
    const femalePattern =
      /premwadee|achara|kanya|narisa|female|woman|google\s*ภาษาไทย|google\s*thai|หญิง/i;
    const voice =
      voices.find((v) => femalePattern.test(v.name)) ?? voices[0] ?? null;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 0.92;
    utterance.pitch = 1.1;
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
    return voices.length > 0;
  } catch {
    return false;
  }
}

export async function speakThaiQueueCall(
  queueNo: string,
  counter: number,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: false };

  const normalized = queueNo.trim().toUpperCase();
  const cacheKey = `${normalized}:${counter}`;
  const fallbackText = buildSpokenAnnouncement(normalized, counter);

  const cachedBuf = wavBufferCache.get(cacheKey);
  if (cachedBuf) {
    const played = await playWavBuffer(cachedBuf);
    if (played) return { ok: true };
  }

  try {
    const res = await apiFetch<{
      audioBase64: string;
      mimeType: string;
      text: string;
    }>('/api/tts', {
      method: 'POST',
      json: { queueNo: normalized, counter },
    });

    const wavBuf = base64ToArrayBuffer(res.audioBase64);
    wavBufferCache.set(cacheKey, wavBuf);
    const played = await playWavBuffer(wavBuf);
    if (played) return { ok: true };

    const browserSpoken = fallbackBrowserSpeech(res.text || fallbackText);
    if (browserSpoken) return { ok: true };
    return {
      ok: false,
      error:
        'เบราว์เซอร์บล็อกการเล่นเสียง กรุณาแตะหน้าจอหรือกดปุ่มทดสอบเสียงอีกครั้ง',
    };
  } catch (err) {
    const browserSpoken = fallbackBrowserSpeech(fallbackText);
    return {
      ok: browserSpoken,
      error:
        err instanceof Error ? err.message : 'ไม่สามารถเล่นเสียงเรียกคิวได้',
    };
  }
}
