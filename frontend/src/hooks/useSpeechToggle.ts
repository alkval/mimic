import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';

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

      Speech.speak(text, {
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
