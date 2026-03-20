import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { sendTutorMessage, transcribeSpeech } from '../services/api';
import { FEATURED_LANGUAGES, getLanguageByCode } from '../types/language';
import type { LanguageOption } from '../types/language';

type VoiceMode = 'idle' | 'listening' | 'thinking' | 'speaking';

type VoiceModeScreenProps = {
  targetLanguage?: LanguageOption;
};

const recordingOptions: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.MAX,
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  web: {
    mimeType: 'audio/wav',
    bitsPerSecond: 256000,
  },
};

export default function VoiceModeScreen({ targetLanguage: controlledLanguage }: VoiceModeScreenProps) {
  const targetLanguage = controlledLanguage ?? getLanguageByCode('ko') ?? FEATURED_LANGUAGES[3];
  const [mode, setMode] = useState<VoiceMode>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const runIdRef = useRef(0);
  const unmountedRef = useRef(false);

  const sanitizeForSpeech = (text: string): string => text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ').replace(/\s+/g, ' ').trim();

  const nextRun = () => {
    runIdRef.current += 1;
    return runIdRef.current;
  };

  const isActiveRun = (runId: number) => runIdRef.current === runId;

  const safeSetMode = (newMode: VoiceMode) => {
    if (!unmountedRef.current) {
      setMode(newMode);
    }
  };

  const stopSpeechSafe = async () => {
    try {
      await Speech.stop();
    } catch {
    }
  };

  const stopRecordingSafe = async (activeRecording: Audio.Recording | null) => {
    if (!activeRecording) {
      return;
    }

    try {
      await activeRecording.stopAndUnloadAsync();
    } catch {
    }
  };

  const setPlaybackAudioModeSafe = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch {
    }
  };

  const setRecordingAudioModeSafe = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch {
      throw new Error('Could not switch to recording audio mode.');
    }
  };

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      void Speech.stop();
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  const iconConfig = useMemo(() => {
    switch (mode) {
      case 'listening':
        return { name: 'mic' as const, color: '#ffffff', bg: 'bg-danger' };
      case 'thinking':
        return { name: 'hourglass-top' as const, color: '#ffffff', bg: 'bg-sky' };
      case 'speaking':
        return { name: 'volume-up' as const, color: '#ffffff', bg: 'bg-accent' };
      default:
        return { name: 'mic-none' as const, color: '#243526', bg: 'bg-white' };
    }
  }, [mode]);

  const startListening = async () => {
    const runId = nextRun();
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      safeSetMode('idle');
      return;
    }

    try {
      await setRecordingAudioModeSafe();
      const { recording: nextRecording } = await Audio.Recording.createAsync(recordingOptions);
      if (!isActiveRun(runId)) {
        await nextRecording.stopAndUnloadAsync();
        return;
      }
      recordingRef.current = nextRecording;
      safeSetMode('listening');
    } catch {
      safeSetMode('idle');
    }
  };

  const speakReply = (reply: string, runId: number) => {
    const spokenText = sanitizeForSpeech(reply);
    if (!spokenText) {
      safeSetMode('idle');
      return;
    }

    safeSetMode('speaking');
    Speech.speak(spokenText, {
      ...(targetLanguage.speechCode ? { language: targetLanguage.speechCode } : {}),
      onDone: () => {
        if (isActiveRun(runId)) {
          safeSetMode('idle');
        }
      },
      onStopped: () => {
        if (isActiveRun(runId)) {
          safeSetMode('idle');
        }
      },
      onError: () => {
        safeSetMode('idle');
      },
    });
  };

  const stopListeningAndRespond = async (activeRecording: Audio.Recording | null) => {
    if (!activeRecording) {
      safeSetMode('idle');
      return;
    }

    const runId = nextRun();

    try {
      safeSetMode('thinking');
      await activeRecording.stopAndUnloadAsync();
      await setPlaybackAudioModeSafe();

      const uri = activeRecording.getURI();
      if (!uri) {
        safeSetMode('idle');
        return;
      }

      const transcript = (await transcribeSpeech(uri, targetLanguage.code)).trim();
      if (!isActiveRun(runId)) {
        return;
      }
      if (!transcript) {
        safeSetMode('idle');
        return;
      }

      const reply = (await sendTutorMessage(transcript, targetLanguage.name)).trim();
      if (!isActiveRun(runId)) {
        return;
      }
      if (!reply) {
        safeSetMode('idle');
        return;
      }

      speakReply(reply, runId);
    } catch {
      safeSetMode('idle');
    }
  };

  const interruptAndListen = () => {
    const runId = nextRun();
    const activeRecording = recordingRef.current;
    recordingRef.current = null;

    safeSetMode('listening');

    void (async () => {
      await stopSpeechSafe();
      await stopRecordingSafe(activeRecording);
      await setPlaybackAudioModeSafe();

      if (isActiveRun(runId)) {
        await startListening();
      }
    })();
  };

  const onMicPress = () => {
    if (mode === 'thinking' || mode === 'speaking') {
      interruptAndListen();
      return;
    }

    if (mode === 'listening') {
      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      if (!activeRecording) {
        safeSetMode('idle');
        void startListening();
        return;
      }
      void stopListeningAndRespond(activeRecording);
      return;
    }

    void startListening();
  };

  return (
    <View className="flex-1 items-center justify-center bg-paper px-6">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voice mode microphone"
        onPress={onMicPress}
        className={`h-48 w-48 items-center justify-center rounded-full ${iconConfig.bg}`}
      >
        <MaterialIcons name={iconConfig.name} size={96} color={iconConfig.color} />
      </Pressable>
    </View>
  );
}
