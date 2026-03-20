import axios from 'axios';
import type { CharacterScore, PronunciationResult } from '../types';

const baseURL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/$/, '');

const client = axios.create({
  baseURL,
  timeout: 90000,
});

function ensureApiConfigured(): void {
  if (!baseURL) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL. Configure it before building the app.');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toFriendlyError(error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error('Unexpected request failure');
  }

  const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
  if (detail) {
    return new Error(detail);
  }

  if (error.code === 'ECONNABORTED') {
    return new Error('Hubert is warming up. Please try again in a few seconds.');
  }

  if (error.message.toLowerCase().includes('network error')) {
    const endpoint = baseURL || '<unset>';
    return new Error(
      `Network error calling ${endpoint}. Confirm backend reachability from phone and allow cleartext HTTP for Android when using http:// URLs.`,
    );
  }

  return new Error(error.message || 'Request failed');
}

function inferAudioMeta(uri: string): { name: string; type: string } {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.m4a')) {
    return { name: 'attempt.m4a', type: 'audio/mp4' };
  }
  if (normalized.endsWith('.wav')) {
    return { name: 'attempt.wav', type: 'audio/wav' };
  }
  return { name: 'attempt.bin', type: 'application/octet-stream' };
}

function parseAlignResponse(data: unknown): PronunciationResult {
  if (Array.isArray(data)) {
    return {
      scores: data as CharacterScore[],
      transcript: '',
    };
  }

  if (data && typeof data === 'object') {
    const obj = data as {
      scores?: CharacterScore[];
      transcript?: string;
      debug?: { transcript?: string };
    };
    if (Array.isArray(obj.scores)) {
      return {
        scores: obj.scores,
        transcript:
          typeof obj.debug?.transcript === 'string'
            ? obj.debug.transcript
            : (typeof obj.transcript === 'string' ? obj.transcript : ''),
      };
    }
  }

  throw new Error('Invalid /align response payload.');
}

export async function alignPronunciation(targetText: string, audioUri: string, languageCode = ''): Promise<PronunciationResult> {
  ensureApiConfigured();

  const meta = inferAudioMeta(audioUri);
  const form = new FormData();
  form.append('target_text', targetText);
  form.append('language', languageCode);
  form.append('audio_file', {
    uri: audioUri,
    name: meta.name,
    type: meta.type,
  } as never);

  try {
    const response = await client.post('/align', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return parseAlignResponse(response.data);
  } catch (firstError) {
    if (axios.isAxiosError(firstError) && (firstError.code === 'ECONNABORTED' || !firstError.response)) {
      await sleep(800);
      try {
        const response = await client.post('/align', form, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return parseAlignResponse(response.data);
      } catch (retryError) {
        throw toFriendlyError(retryError);
      }
    }

    throw toFriendlyError(firstError);
  }
}

export async function sendTutorMessage(message: string, targetLanguage: string): Promise<string> {
  ensureApiConfigured();

  const payload = {
    message,
    target_language: targetLanguage,
  };

  try {
    const response = await client.post('/tutor_chat', payload);
    return response.data.response as string;
  } catch (firstError) {
    if (axios.isAxiosError(firstError) && (firstError.code === 'ECONNABORTED' || !firstError.response)) {
      await sleep(1200);
      try {
        const response = await client.post('/tutor_chat', payload);
        return response.data.response as string;
      } catch (retryError) {
        throw toFriendlyError(retryError);
      }
    }

    throw toFriendlyError(firstError);
  }
}

export async function unloadTutorModel(): Promise<void> {
  ensureApiConfigured();

  try {
    await client.post('/tutor_unload');
  } catch (error) {
    throw toFriendlyError(error);
  }
}

export async function defineWord(word: string, targetLanguage: string, context: string): Promise<string> {
  ensureApiConfigured();

  try {
    const response = await client.post('/define_word', {
      word,
      target_language: targetLanguage,
      context,
    });
    return response.data.definition as string;
  } catch (error) {
    throw toFriendlyError(error);
  }
}
