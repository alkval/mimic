import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LanguageOption } from '../types/language';
import { fuzzyLanguageSearch } from '../types/language';

type HeaderLanguageMenuProps = {
  selected: LanguageOption;
  onSelect: (language: LanguageOption) => void;
  pinnedLanguageCodes?: string[];
  onTogglePinnedLanguage?: (languageCode: string) => void;
};

export default function HeaderLanguageMenu({
  selected,
  onSelect,
  pinnedLanguageCodes = [],
  onTogglePinnedLanguage,
}: HeaderLanguageMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  const options = useMemo(() => fuzzyLanguageSearch(query, pinnedLanguageCodes), [query, pinnedLanguageCodes]);
  const pinnedSet = useMemo(() => new Set(pinnedLanguageCodes), [pinnedLanguageCodes]);
  const isSearching = query.trim().length > 0;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Current language ${selected.name}`}
        onPress={() => {
          if (open) {
            closeMenu();
            return;
          }
          setOpen(true);
        }}
        className="mr-2 flex-row items-center rounded-full border border-[#dfeecd] bg-white px-3 py-2.5"
      >
        <Text className="text-[17px] font-black text-ink">
          {selected.flag} {selected.code.toUpperCase()}
        </Text>
        <MaterialIcons name="expand-more" size={20} color="#243526" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable className="flex-1 items-center justify-center bg-black/35 px-6" onPress={closeMenu}>
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
              className={isSearching ? 'mt-3 max-h-80' : 'mt-3'}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${item.name}`}
                  onPress={() => {
                    onSelect(item);
                    closeMenu();
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
                        size={14}
                        color={pinnedSet.has(item.code) ? '#58cc02' : '#95ad8d'}
                      />
                    </Pressable>
                  )}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
