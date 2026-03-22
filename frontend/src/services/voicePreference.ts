import AsyncStorage from '@react-native-async-storage/async-storage';

const PINNED_LANGUAGES_KEY = 'mimic:pinned_languages';

export async function loadPinnedLanguageCodes(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(PINNED_LANGUAGES_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return null;
  }
}

export async function savePinnedLanguageCodes(codes: string[]): Promise<void> {
  await AsyncStorage.setItem(PINNED_LANGUAGES_KEY, JSON.stringify(codes));
}
