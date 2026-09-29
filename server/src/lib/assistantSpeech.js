import { env } from '../config/env.js';
import { assertAiConsent } from './aiConsent.js';

const unavailable = () => Object.assign(new Error('ქართული ხმოვანი პასუხი ჯერ არ არის ჩართული. პასუხი ტექსტად შეგიძლია წაიკითხო.'), { status: 503, code: 'ASSISTANT_SPEECH_UNAVAILABLE', messageEn: 'Voice replies aren’t turned on yet. You can read the reply as text.' });
/** English voices (the app in English). Region/key are the same Azure recipient already disclosed. */
export const ENGLISH_SPEECH_VOICES = Object.freeze(['en-US-AvaNeural', 'en-US-JennyNeural', 'en-US-AndrewNeural', 'en-GB-SoniaNeural']);
const englishVoice = config => (ENGLISH_SPEECH_VOICES.includes(config.AZURE_SPEECH_VOICE_EN) ? config.AZURE_SPEECH_VOICE_EN : 'en-US-AvaNeural');
export const hasAssistantSpeech = (config = env) => Boolean(config.AZURE_SPEECH_KEY && config.AZURE_SPEECH_REGION);
export const escapeSpeechXml = text => text.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);

/** Plain text only, a fixed Georgian (or, for English readers, English) voice and an Azure regional host. No profile/audio uploads. */
export async function synthesizeAssistantSpeech(userId, text, { config = env, check = assertAiConsent, transport = fetch, lang = 'ka' } = {}) {
  if (!hasAssistantSpeech(config)) throw unavailable();
  if (!/^[a-z0-9-]+$/.test(config.AZURE_SPEECH_REGION) || !['ka-GE-EkaNeural', 'ka-GE-GiorgiNeural'].includes(config.AZURE_SPEECH_VOICE)) throw unavailable();
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw Object.assign(new Error('ხმოვანი პასუხის ტექსტი არასწორია.'), { status: 400, messageEn: 'The voice reply text is invalid.' });
  const english = lang === 'en';
  const voice = english ? englishVoice(config) : config.AZURE_SPEECH_VOICE;
  const xmlLang = english ? voice.slice(0, 5) : 'ka-GE';
  await check(userId); // Recheck immediately before every external call, including after revocation.
  let response;
  try {
    response = await transport(`https://${config.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
      headers: { 'Ocp-Apim-Subscription-Key': config.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'MEDICARD-Medi' },
      body: `<speak version="1.0" xml:lang="${xmlLang}"><voice name="${voice}">${escapeSpeechXml(text)}</voice></speak>`,
    });
  } catch {
    throw Object.assign(new Error('ხმის კავშირი შეფერხდა. პასუხი ტექსტად რჩება.'), { status: 502, code: 'ASSISTANT_SPEECH_FAILED', messageEn: 'The voice connection dropped. The reply stays as text.' });
  }
  // Never surface provider responses (they can echo text or configuration).
  if (!response.ok || !/^audio\/(mpeg|mp3)(?:;|$)/i.test(response.headers.get('content-type') || '')) {
    throw Object.assign(new Error('ხმოვანი პასუხი ვერ ჩაირთო. შეგიძლია ტექსტით გააგრძელო.'), { status: 502, code: 'ASSISTANT_SPEECH_FAILED', messageEn: 'The voice reply couldn’t start. You can continue with text.' });
  }
  const chunks = []; let size = 0;
  try {
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 1500000) throw new Error('audio_limit');
      chunks.push(chunk);
    }
  } catch {
    // Includes timeouts while reading: do not expose transport internals to users/logs.
    throw Object.assign(new Error('ხმოვანი პასუხი შეწყდა. შეგიძლია ტექსტით გააგრძელო.'), { status: 502, code: 'ASSISTANT_SPEECH_FAILED', messageEn: 'The voice reply was cut off. You can continue with text.' });
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 100 || !(bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224))) {
    throw Object.assign(new Error('ხმა ვერ დამუშავდა. პასუხი ტექსტად წაიკითხე.'), { status: 502, messageEn: 'The audio couldn’t be processed. Please read the reply as text.' });
  }
  return { data: bytes.toString('base64'), format: 'mp3', synthetic: true };
}
