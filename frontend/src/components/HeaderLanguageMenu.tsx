import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LanguageOption } from '../types/language';
import { fuzzyLanguageSearch } from '../types/language';

type HeaderLanguageMenuProps = {
  selected: LanguageOption;
  onSelect: (language: LanguageOption) => void;
};

export default function HeaderLanguageMenu({ selected, onSelect }: HeaderLanguageMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options = useMemo(() => fuzzyLanguageSearch(query), [query]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Current language ${selected.name}`}
        onPress={() => setOpen(true)}
        className="mr-2 flex-row items-center rounded-full border border-[#dfeecd] bg-white px-2 py-2"
      >
        <Text className="text-base font-black text-ink">
          {selected.flag} {selected.code.toUpperCase()}
        </Text>
        <MaterialIcons name="expand-more" size={18} color="#243526" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/35 px-6" onPress={() => setOpen(false)}>
          <Pressable className="w-full max-w-[360px] rounded-3xl border-2 border-[#dfeecd] bg-white p-4" onPress={(event) => event.stopPropagation()}>
            <View className="flex-row items-center justify-center">
              <Text className="text-lg font-black text-ink">Choose language</Text>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Type to search language"
              className="mt-3 rounded-xl border border-[#dfeecd] bg-[#f9ffef] px-3 py-2 text-ink"
            />

            <FlatList
              data={options}
              keyExtractor={(item) => item.code}
              className="mt-3 max-h-64"
              keyboardShouldPersistTaps="handled"
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
