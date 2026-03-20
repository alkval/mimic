import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LanguageOption } from '../types/language';
import { fuzzyLanguageSearch } from '../types/language';

type LanguagePickerProps = {
  selected: LanguageOption;
  onSelect: (language: LanguageOption) => void;
  label?: string;
  placeholder: string;
};

export default function LanguagePicker({ selected, onSelect, label, placeholder }: LanguagePickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const options = useMemo(() => fuzzyLanguageSearch(query), [query]);

  return (
    <View className="mt-3">
      {!!label && <Text className="text-xs font-black tracking-[0.8px] text-ink/70">{label}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Current language ${selected.name}`}
        className={`flex-row items-center justify-between rounded-2xl border-2 border-[#dfeecd] bg-white px-3 py-3 ${label ? 'mt-2' : ''}`}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text className="text-base font-semibold text-ink">
          {selected.flag} {selected.name}
        </Text>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color="#243526" />
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
            className="mt-2 max-h-48"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.name}`}
                onPress={() => {
                  onSelect(item);
                  setQuery('');
                  setOpen(false);
                }}
                className="mb-1 rounded-xl bg-paper px-3 py-2"
              >
                <Text className="text-base text-ink">
                  {item.flag} {item.name}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}
