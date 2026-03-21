import { useEffect, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import ChatBubble from '../components/ChatBubble';
import LanguagePicker from '../components/LanguagePicker';
import { sendTutorMessage, transcribeSpeech } from '../services/api';
import type { TutorChatMessage } from '../types';
import { FEATURED_LANGUAGES, getLanguageByCode } from '../types/language';
import type { LanguageOption } from '../types/language';

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

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type HubertChatScreenProps = {
  targetLanguage?: LanguageOption;
  onChangeLanguage?: (language: LanguageOption) => void;
  pinnedLanguageCodes?: string[];
  onTogglePinnedLanguage?: (languageCode: string) => void;
  showLanguagePicker?: boolean;
  onModelLoaded?: () => void;
};

export default function HubertChatScreen({
  targetLanguage: controlledLanguage,
  onChangeLanguage,
  pinnedLanguageCodes,
  onTogglePinnedLanguage,
  showLanguagePicker = true,
  onModelLoaded,
}: HubertChatScreenProps) {
  const [internalTargetLanguage, setInternalTargetLanguage] = useState(getLanguageByCode('ko') || FEATURED_LANGUAGES[3]);
  const targetLanguage = controlledLanguage ?? internalTargetLanguage;
  const setTargetLanguage = onChangeLanguage ?? setInternalTargetLanguage;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<TutorChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [inputAssistError, setInputAssistError] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recording) {
        void recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);

  const appendToInput = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) {
      return;
    }

    setInput((prev) => {
      if (!prev.trim()) {
        return cleaned;
      }
      const needsSpace = /\s$/.test(prev);
      return `${prev}${needsSpace ? '' : ' '}${cleaned}`;
    });
  };

  const onToggleInputRecording = async () => {
    if (sending || transcribing) {
      return;
    }

    setInputAssistError(null);

    if (recording) {
      setTranscribing(true);
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);

        if (!uri) {
          throw new Error('No recording file was produced.');
        }

        const transcript = await transcribeSpeech(uri, targetLanguage.code);
        if (!transcript.trim()) {
          setInputAssistError('No speech detected. Try speaking a little louder.');
          return;
        }

        appendToInput(transcript);
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Could not transcribe speech right now.';
        setInputAssistError(detail);
      } finally {
        setTranscribing(false);
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setInputAssistError('Microphone permission is required to transcribe your speech.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: nextRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(nextRecording);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Could not start recording.';
      setInputAssistError(detail);
    }
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text || sending) {
      return;
    }

    const userMessage: TutorChatMessage = { id: makeId(), role: 'user', text };
    setMessages((prev) => [userMessage, ...prev]);
    setInput('');
    setSending(true);

    try {
      const reply = await sendTutorMessage(text, targetLanguage.name);
      setMessages((prev) => [{ id: makeId(), role: 'assistant', text: reply }, ...prev]);
      onModelLoaded?.();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const fallback = detail || (err instanceof Error ? err.message : 'Hubert could not respond right now.');
      setMessages((prev) => [{ id: makeId(), role: 'assistant', text: fallback }, ...prev]);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View className="flex-1 px-5 pt-5 pb-3" style={{ paddingBottom: 12 + (Platform.OS === 'android' ? keyboardInset : 0) }}>
        {showLanguagePicker && (
          <LanguagePicker
            selected={targetLanguage}
            onSelect={setTargetLanguage}
            pinnedLanguageCodes={pinnedLanguageCodes}
            onTogglePinnedLanguage={onTogglePinnedLanguage}
            label=""
            placeholder="Type to search language"
          />
        )}

        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              speechLanguage={targetLanguage.speechCode}
              targetLanguageName={targetLanguage.name}
            />
          )}
          className={`${showLanguagePicker ? 'mt-3' : 'mt-0'} flex-1`}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
        />

        {(sending || recording || transcribing) && (
          <Text className="mb-2 text-center text-sm font-semibold text-ink/70">
            {sending ? 'Hubert is thinking...' : recording ? 'Listening... tap mic again to stop' : 'Transcribing...'}
          </Text>
        )}
        {inputAssistError && <Text className="mb-2 text-center text-sm font-semibold text-[#b42318]">{inputAssistError}</Text>}

        <View className="mt-2 flex-row items-center rounded-2xl border-2 border-[#dfeecd] bg-white px-3 py-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Hubert"
            placeholderTextColor="#6b7280"
            className="flex-1 py-2 text-base text-ink"
            multiline={false}
            autoCapitalize="sentences"
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
            enablesReturnKeyAutomatically
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop recording to transcribe' : 'Record and transcribe message'}
            onPress={() => {
              void onToggleInputRecording();
            }}
            className={`ml-2 rounded-xl border-b-4 p-2 ${recording ? 'border-[#6c7d63] bg-[#95ad8d]' : 'border-[#cf6f00] bg-[#ff9f2a]'} ${transcribing || sending ? 'opacity-60' : ''}`}
            disabled={transcribing || sending}
          >
            <MaterialIcons name={recording ? 'stop' : 'mic'} size={18} color="#ffffff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={onSend}
            className={`ml-2 rounded-xl border-b-4 p-2 ${(sending || transcribing || recording) ? 'border-[#6c7d63] bg-[#95ad8d]' : 'border-accentDark bg-accent'}`}
            disabled={sending || transcribing || Boolean(recording)}
          >
            <MaterialIcons name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
