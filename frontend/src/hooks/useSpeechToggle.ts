import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

function sanitizeForSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[\uFE0E\uFE0F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useSpeechToggle() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const clearIfActive = useCallback((key: string) => {
    if (!unmountedRef.current) {
      setActiveKey((current) => (current === key ? null : current));
    }
  }, []);

  const stop = useCallback(async () => {
    await Speech.stop();
    if (!unmountedRef.current) {
      setActiveKey(null);
    }
  }, []);

  const toggle = useCallback(
    async (key: string, text: string, language?: string) => {
      if (activeKey === key) {
        await stop();
        return;
      }

      const speechText = sanitizeForSpeech(text);
      if (!speechText) {
        if (!unmountedRef.current) {
          setActiveKey(null);
        }
        return;
      }

      if (!unmountedRef.current) {
        setActiveKey(key);
      }

      try {
        const alreadySpeaking = await Speech.isSpeakingAsync();
        if (alreadySpeaking) {
          await Speech.stop();
        }
      } catch {
      }

      Speech.speak(speechText, {
        ...(language ? { language } : {}),
        onDone: () => clearIfActive(key),
        onStopped: () => clearIfActive(key),
        onError: () => clearIfActive(key),
      });
    },
    [activeKey, clearIfActive, stop],
  );

  return {
    activeKey,
    toggle,
    stop,
  };
}
