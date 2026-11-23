import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Settings > Secrets สำหรับสร้างเสียงเรียกคิว',
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1alpha',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
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

export function buildThaiQueueAnnouncementText(
  queueNo: string,
  counter: number,
): string {
  const spokenQueue = queueNo
    .replace(/-/g, '')
    .toUpperCase()
    .split('')
    .map((ch) => THAI_LETTER_MAP[ch] ?? THAI_DIGIT_MAP[ch] ?? ch)
    .join(' ');
  const spokenCounter = THAI_DIGIT_MAP[String(counter)] ?? String(counter);
  return `ขอเชิญหมายเลข ${spokenQueue} ที่ช่องบริการ ${spokenCounter} ค่ะ`;
}

const ttsCache = new Map<string, string>();
const MAX_TTS_CACHE = 100;

export async function generateThaiFemaleQueueTts(
  queueNo: string,
  counter: number,
): Promise<{ audioBase64: string; mimeType: string; text: string }> {
  const normalizedQueue = queueNo.trim().toUpperCase();
  const cacheKey = `${normalizedQueue}:${counter}`;
  const text = buildThaiQueueAnnouncementText(normalizedQueue, counter);

  const cached = ttsCache.get(cacheKey);
  if (cached) {
    return { audioBase64: cached, mimeType: 'audio/wav', text };
  }

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text,
            speechMetadata: {
              style:
                'Polite, warm, clear Thai female government counter announcer',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  const base64Audio = inline?.data;

  if (!base64Audio) {
    throw new Error('ไม่สามารถสร้างไฟล์เสียงเรียกคิวได้ กรุณาลองใหม่อีกครั้ง');
  }

  if (ttsCache.size >= MAX_TTS_CACHE) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey) ttsCache.delete(oldestKey);
  }
  ttsCache.set(cacheKey, base64Audio);

  return {
    audioBase64: base64Audio,
    mimeType: inline?.mimeType || 'audio/wav',
    text,
  };
}
