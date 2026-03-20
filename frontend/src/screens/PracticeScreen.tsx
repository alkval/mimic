import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import LanguagePicker from '../components/LanguagePicker';
import { useSpeechToggle } from '../hooks/useSpeechToggle';
import { alignPronunciation } from '../services/api';
import type { CharacterScore } from '../types';
import { FEATURED_LANGUAGES, getLanguageByCode } from '../types/language';
import type { LanguageOption } from '../types/language';

export const recordingOptions: Audio.RecordingOptions = {
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

type PracticeScreenProps = {
  targetLanguage?: LanguageOption;
  onChangeLanguage?: (language: LanguageOption) => void;
  showLanguagePicker?: boolean;
};

export default function PracticeScreen({ targetLanguage: controlledLanguage, onChangeLanguage, showLanguagePicker = true }: PracticeScreenProps) {
  const [internalTargetLanguage, setInternalTargetLanguage] = useState(getLanguageByCode('ko') || FEATURED_LANGUAGES[3]);
  const targetLanguage = controlledLanguage ?? internalTargetLanguage;
  const setTargetLanguage = onChangeLanguage ?? setInternalTargetLanguage;
  const [targetWord, setTargetWord] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [scores, setScores] = useState<CharacterScore[]>([]);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const { activeKey, toggle } = useSpeechToggle();

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardInset(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const canRecord = useMemo(() => targetWord.trim().length > 0, [targetWord]);
  const averageScore = useMemo(
    () => (scores.length > 0 ? scores.reduce((sum, item) => sum + item.score, 0) / scores.length : 0),
    [scores],
  );

  const resultTone = useMemo(() => {
    if (averageScore >= 0.85) {
      return {
        label: 'Very good',
        textClass: 'text-accentDark',
        boxClass: 'border-[#a1e667] bg-[#e0ffab]',
      };
    }
    if (averageScore >= 0.7) {
      return {
        label: 'Good',
        textClass: 'text-[#4f9f2b]',
        boxClass: 'border-[#a1e667] bg-[#e0ffab]',
      };
    }
    if (averageScore >= 0.5) {
      return {
        label: 'OK',
        textClass: 'text-[#c47a00]',
        boxClass: 'border-[#f6d29a] bg-[#fff6e7]',
      };
    }
    return {
      label: 'Try again',
      textClass: 'text-[#f52727]',
      boxClass: 'border-[#f52727] bg-[#fab6b6]',
    };
  }, [averageScore]);

  const onListen = () => {
    if (!targetWord.trim()) {
      return;
    }
    void toggle('practice-listen', targetWord.trim(), targetLanguage.speechCode);
  };

  const onToggleRecord = async () => {
    setError(null);
    if (!canRecord) {
      setError('Type a target word or sentence first so Hubert can score it.');
      return;
    }

    if (recording) {
      try {
        setBusy(true);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (!uri) {
          setError('No recording file was produced.');
          return;
        }
        const result = await alignPronunciation(targetWord.trim(), uri, targetLanguage.code);
        setScores(result.scores);
        setTranscript(result.transcript || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Alignment failed.');
      } finally {
        setBusy(false);
      }
      return;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission is required.');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start recording.');
    }
  };

  const renderedLetters = useMemo(() => {
    if (!targetWord.trim()) {
      return null;
    }

    const rows: ReactNode[] = [];
    let scoreIndex = 0;
    for (const [rowIndex, rowText] of targetWord.trim().split(/\s+/).entries()) {
      const letters: ReactNode[] = [];
      for (const [letterIndex, letter] of [...rowText].entries()) {
        const currentScore = scores[scoreIndex]?.score;
        scoreIndex += 1;

        let toneClass = 'text-ink';
        if (typeof currentScore === 'number') {
          if (currentScore >= 0.75) {
            toneClass = 'text-accentDark';
          } else if (currentScore >= 0.5) {
            toneClass = 'text-[#f59e0b]';
          } else {
            toneClass = 'text-danger';
          }
        }

        letters.push(
          <Text key={`${rowIndex}-${letterIndex}`} className={`text-3xl font-black ${toneClass}`}>
            {letter}
          </Text>,
        );
      }

      rows.push(
        <View key={`word-${rowIndex}`} className="mx-1.5 my-0.5 flex-row items-center">
          {letters}
        </View>,
      );
    }

    return <View className="flex-row flex-wrap justify-center">{rows}</View>;
  }, [scores, targetWord]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View className="flex-1 px-5 py-6" style={{ paddingBottom: Platform.OS === 'android' ? keyboardInset : 0 }}>
        <View className="mt-0 rounded-3xl border-2 border-[#dfeecd] bg-white p-4">
          {showLanguagePicker && (
            <LanguagePicker
              selected={targetLanguage}
              onSelect={setTargetLanguage}
              label=""
              placeholder="Type to search language"
            />
          )}

          <TextInput
            value={targetWord}
            onChangeText={setTargetWord}
            placeholder="Type target word or sentence"
            className={`${showLanguagePicker ? 'mt-3' : 'mt-0'} rounded-2xl border-2 border-[#dfeecd] bg-[#f9ffef] px-4 py-3 text-base text-ink`}
          />

          <View className="mt-4 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Listen to target word"
              onPress={onListen}
              className="flex-1 flex-row items-center justify-center rounded-2xl border-b-4 border-[#0f8ec7] bg-sky px-4 py-3"
            >
              <MaterialIcons name={activeKey === 'practice-listen' ? 'stop-circle' : 'volume-up'} size={20} color="#ffffff" />
              <Text className="ml-2 font-extrabold text-white">{activeKey === 'practice-listen' ? 'Stop' : 'Listen'}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
              onPress={onToggleRecord}
              className={`flex-1 flex-row items-center justify-center rounded-2xl border-b-4 px-4 py-3 ${recording ? 'border-[#cf3d3d] bg-danger' : 'border-accentDark bg-accent'}`}
            >
              <MaterialIcons name="mic" size={20} color="#ffffff" />
              <Text className="ml-2 font-extrabold text-white">{recording ? 'Stop' : 'Record'}</Text>
            </Pressable>
          </View>
        </View>

        {error && <Text className="mt-4 font-semibold text-danger">{error}</Text>}

        {!!targetWord.trim() && (
          <View className="mt-4 rounded-2xl border-2 border-[#dfeecd] bg-white px-4 py-4">
            <View>{renderedLetters}</View>
          </View>
        )}

        {busy && (
          <View className="mt-3 flex-row items-center rounded-2xl border border-[#dfeecd] bg-white px-3 py-3">
            <ActivityIndicator color="#58cc02" />
            <Text className="ml-2 font-semibold text-ink">Hubert is analyzing your pronunciation...</Text>
          </View>
        )}

        {scores.length > 0 && !busy && (
          <View className={`mt-3 rounded-xl border px-3 py-3 ${resultTone.boxClass}`}>
            <Text className={`text-center text-base font-black tracking-[0.4px] ${resultTone.textClass}`}>
              {resultTone.label}
            </Text>
          </View>
        )}

        {!!transcript && scores.length > 0 && (
          <View className="mt-3 rounded-xl border border-[#dfeecd] bg-white px-3 py-2">
            <Text className="text-center text-xs font-black tracking-[0.6px] text-ink/70">HUBERT HEARD</Text>
            <Text className="mt-1 text-center text-sm font-semibold text-ink">{transcript}</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
