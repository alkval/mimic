import { useEffect, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ChatBubble from '../components/ChatBubble';
import LanguagePicker from '../components/LanguagePicker';
import { sendTutorMessage } from '../services/api';
import type { TutorChatMessage } from '../types';
import { FEATURED_LANGUAGES, getLanguageByCode } from '../types/language';
import type { LanguageOption } from '../types/language';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type HubertChatScreenProps = {
  targetLanguage?: LanguageOption;
  onChangeLanguage?: (language: LanguageOption) => void;
  showLanguagePicker?: boolean;
  onModelLoaded?: () => void;
};

export default function HubertChatScreen({
  targetLanguage: controlledLanguage,
  onChangeLanguage,
  showLanguagePicker = true,
  onModelLoaded,
}: HubertChatScreenProps) {
  const [internalTargetLanguage, setInternalTargetLanguage] = useState(getLanguageByCode('ko') || FEATURED_LANGUAGES[3]);
  const targetLanguage = controlledLanguage ?? internalTargetLanguage;
  const setTargetLanguage = onChangeLanguage ?? setInternalTargetLanguage;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<TutorChatMessage[]>([]);
  const [sending, setSending] = useState(false);
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

        {sending && <Text className="mb-2 text-center text-sm font-semibold text-ink/70">Hubert is thinking...</Text>}

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
            accessibilityLabel="Send message"
            onPress={onSend}
            className={`ml-2 rounded-xl border-b-4 p-2 ${sending ? 'border-[#6c7d63] bg-[#95ad8d]' : 'border-accentDark bg-accent'}`}
            disabled={sending}
          >
            <MaterialIcons name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
