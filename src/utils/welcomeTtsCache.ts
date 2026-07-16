import { API_CONFIG, buildApiUrl, apiCall } from '@/constants/api';

interface WelcomeTtsCacheEntry {
  interviewId: string;
  messagePromise: Promise<string>;
  audioBlobPromise: Promise<Blob | null>;
}

let cache: WelcomeTtsCacheEntry | null = null;

const FALLBACK_WELCOME = (name: string, pos: string) =>
  `Hello ${name}! Welcome to your ${pos} interview. I'm excited to learn more about you. Let's begin with our first question.`;

async function fetchWelcomePhrase(candidateName: string, position: string): Promise<string> {
  try {
    const response = await apiCall(API_CONFIG.ENDPOINTS.GENERATE_INTERVIEW_PHRASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phrase_type: 'welcome',
        candidate_name: candidateName,
        position,
      }),
    }, 10000);
    if (response.ok) {
      const data = await response.json();
      return data.phrase || FALLBACK_WELCOME(candidateName, position);
    }
  } catch (e) {
    console.warn('Welcome phrase prefetch failed, using fallback:', e);
  }
  return FALLBACK_WELCOME(candidateName, position);
}

/** Call this as soon as candidate_name + position are known (interview landing page). */
export function prefetchWelcomeTts(interviewId: string, candidateName: string, position: string) {
  if (cache && cache.interviewId === interviewId) return; // already in flight for this interview

  const messagePromise = fetchWelcomePhrase(candidateName, position);
  const audioBlobPromise = messagePromise
    .then((text) =>
      fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TTS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).then((r) => {
        if (!r.ok) throw new Error('Welcome TTS prefetch failed');
        return r.blob();
      })
    )
    .catch((e) => {
      console.warn('Welcome TTS audio prefetch failed:', e);
      return null;
    });

  cache = { interviewId, messagePromise, audioBlobPromise };
}

/** One-time consume — call from the interview screen's init effect. Returns null if nothing was prefetched (e.g. deep link / refresh). */
export function consumeWelcomeTtsCache(interviewId: string): WelcomeTtsCacheEntry | null {
  if (cache && cache.interviewId === interviewId) {
    const entry = cache;
    cache = null;
    return entry;
  }
  return null;
}
