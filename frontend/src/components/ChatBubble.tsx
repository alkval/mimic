import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { TutorChatMessage } from '../types';
import { defineWord } from '../services/api';
import { useSpeechToggle } from '../hooks/useSpeechToggle';

type ChatBubbleProps = {
  message: TutorChatMessage;
  speechLanguage?: string;
  targetLanguageName?: string;
};

export default function ChatBubble({ message, speechLanguage, targetLanguageName }: ChatBubbleProps) {
  const isAssistant = message.role === 'assistant';
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordDefinition, setWordDefinition] = useState('');
  const [loadingDefinition, setLoadingDefinition] = useState(false);
  const { activeKey, toggle } = useSpeechToggle();

  const tokens = useMemo(() => {
    if (!isAssistant) {
      return [];
    }

    const matches = message.text.match(/\p{L}[\p{L}\p{N}]*|\p{N}+|\s+|[^\p{L}\p{N}\s]+/gu);
    return matches ?? [];
  }, [isAssistant, message.text]);

  const fetchWordDefinition = async (token: string) => {
    const cleaned = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!cleaned) {
      return;
    }

    setSelectedWord(cleaned);
    setWordDefinition('');
    setLoadingDefinition(true);
    try {
      const definition = await defineWord(cleaned, targetLanguageName || 'English', message.text);
      setWordDefinition(definition);
    } catch (error) {
      setWordDefinition(error instanceof Error ? error.message : 'Could not fetch definition.');
    } finally {
      setLoadingDefinition(false);
    }
  };

  return (
    <>
      <View className={`mb-3 w-full ${isAssistant ? 'items-start' : 'items-end'}`}>
        <View
          className={`max-w-[87%] rounded-3xl px-4 py-3 ${isAssistant ? 'border-2 border-[#dfeecd] bg-white' : 'border-b-4 border-accentDark bg-accent'}`}
        >
          <Text className={`mb-1 text-[10px] font-black tracking-[0.7px] ${isAssistant ? 'text-ink/50' : 'text-white/70'}`}>
            {isAssistant ? 'HUBERT' : 'YOU'}
          </Text>

          {isAssistant ? (
            <View className="flex-row flex-wrap">
              {tokens.map((token, index) => {
                if (/^\s+$/.test(token)) {
                  return (
                    <Text key={`space-${index}`} className="text-base leading-6 text-ink">
                      {token}
                    </Text>
                  );
                }

                const isWordToken = /^[\p{L}\p{N}]+$/u.test(token);
                if (!isWordToken) {
                  return (
                    <Text key={`punct-${index}`} className="text-base leading-6 text-ink">
                      {token}
                    </Text>
                  );
                }

                return (
                  <Pressable
                    key={`token-${index}`}
                    onPress={() => {
                      void fetchWordDefinition(token);
                    }}
                  >
                    <Text className="text-base leading-6 text-ink">
                      {token}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text className="text-base leading-6 text-white">{message.text}</Text>
          )}

          {isAssistant && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Speak Hubert reply"
              onPress={() => {
                void toggle('bubble-reply', message.text, speechLanguage);
              }}
              className="mt-2 self-end rounded-lg border border-[#dfeecd] bg-paper px-2 py-1"
            >
              <MaterialIcons
                name={activeKey === 'bubble-reply' ? 'stop-circle' : 'volume-up'}
                size={18}
                color="#243526"
              />
            </Pressable>
          )}
        </View>
      </View>

      <Modal visible={selectedWord !== null} transparent animationType="fade" onRequestClose={() => setSelectedWord(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/35 px-6" onPress={() => setSelectedWord(null)}>
          <Pressable className="w-full max-w-[360px] rounded-3xl border-2 border-[#dfeecd] bg-white p-5" onPress={(event) => event.stopPropagation()}>
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-black text-ink">{selectedWord}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Speak selected word"
                onPress={() => {
                  if (selectedWord) {
                    void toggle('bubble-definition', selectedWord, speechLanguage);
                  }
                }}
              >
                <MaterialIcons
                  name={activeKey === 'bubble-definition' ? 'stop-circle' : 'volume-up'}
                  size={22}
                  color="#243526"
                />
              </Pressable>
            </View>

            <Text className="mt-3 text-base leading-6 text-ink/90">
              {loadingDefinition ? 'Loading definition...' : wordDefinition || 'No definition available.'}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
