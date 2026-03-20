import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LanguageOption } from '../types/language';
import { fuzzyLanguageSearch } from '../types/language';

type LanguagePickerProps = {
  selected: LanguageOption;
  onSelect: (language: LanguageOption) => void;
  pinnedLanguageCodes?: string[];
  onTogglePinnedLanguage?: (languageCode: string) => void;
  label?: string;
  placeholder: string;
};

export default function LanguagePicker({
  selected,
  onSelect,
  pinnedLanguageCodes = [],
  onTogglePinnedLanguage,
  label,
  placeholder,
}: LanguagePickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const closePicker = () => {
    setOpen(false);
    setQuery('');
  };

  const options = useMemo(() => fuzzyLanguageSearch(query, pinnedLanguageCodes), [query, pinnedLanguageCodes]);
  const pinnedSet = useMemo(() => new Set(pinnedLanguageCodes), [pinnedLanguageCodes]);
  const isSearching = query.trim().length > 0;

  return (
    <View className="mt-3">
      {!!label && <Text className="text-xs font-black tracking-[0.8px] text-ink/70">{label}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Current language ${selected.name}`}
        className={`flex-row items-center justify-between rounded-2xl border-2 border-[#dfeecd] bg-white px-4 py-3.5 ${label ? 'mt-2' : ''}`}
        onPress={() => {
          if (open) {
            closePicker();
            return;
          }
          setOpen(true);
        }}
      >
        <Text className="text-lg font-semibold text-ink">
          {selected.flag} {selected.name}
        </Text>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={24} color="#243526" />
      </Pressable>

      {open && (
        <View className="mt-2 rounded-2xl border-2 border-[#dfeecd] bg-white p-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            className="rounded-xl border border-[#dfeecd] bg-[#f9ffef] px-3 py-2 text-ink"
          />
          <FlatList
            data={options}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.code}
            className={isSearching ? 'mt-2 max-h-80' : 'mt-2'}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.name}`}
                onPress={() => {
                  onSelect(item);
                  closePicker();
                }}
                className="mb-1.5 flex-row items-center justify-between rounded-xl bg-paper px-4 py-3"
              >
                <Text className="text-lg text-ink">
                  {item.flag} {item.name}
                </Text>
                {!!onTogglePinnedLanguage && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={pinnedSet.has(item.code) ? `Unpin ${item.name}` : `Pin ${item.name}`}
                    onPress={(event) => {
                      event.stopPropagation();
                      onTogglePinnedLanguage(item.code);
                    }}
                    className="rounded-full p-1"
                  >
                    <MaterialIcons
                      name="push-pin"
                      size={15}
                      color={pinnedSet.has(item.code) ? '#58cc02' : '#95ad8d'}
                    />
                  </Pressable>
                )}
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}
