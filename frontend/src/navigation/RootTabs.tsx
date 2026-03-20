import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import PracticeScreen from '../screens/PracticeScreen';
import HubertChatScreen from '../screens/HubertChatScreen';
import { unloadTutorModel } from '../services/api';
import HeaderLanguageMenu from '../components/HeaderLanguageMenu';
import { DEFAULT_PINNED_LANGUAGE_CODES, FEATURED_LANGUAGES, getLanguageByCode } from '../types/language';

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  const [practiceLanguage, setPracticeLanguage] = useState(getLanguageByCode('ko') || FEATURED_LANGUAGES[3]);
  const [hubertLanguage, setHubertLanguage] = useState(getLanguageByCode('ko') || FEATURED_LANGUAGES[3]);
  const [pinnedLanguageCodes, setPinnedLanguageCodes] = useState(DEFAULT_PINNED_LANGUAGE_CODES);
  const [hubertUnloaded, setHubertUnloaded] = useState(false);
  const [showPracticeInfo, setShowPracticeInfo] = useState(false);

  const onTogglePinnedLanguage = (languageCode: string) => {
    setPinnedLanguageCodes((previous) =>
      previous.includes(languageCode)
        ? previous.filter((code) => code !== languageCode)
        : [...previous, languageCode],
    );
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { color: '#243526', fontWeight: '800', fontSize: 20 },
          headerLeft: undefined,
          headerRight:
            route.name === 'Hubert'
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Unload Hubert model"
                    onPress={async () => {
                      try {
                        await unloadTutorModel();
                        setHubertUnloaded(true);
                      } catch {
                        setHubertUnloaded(false);
                      }
                    }}
                    style={{ marginRight: 8 }}
                  >
                    <Text style={{ color: '#7e8f79', fontSize: 12, fontWeight: '700' }}>
                      {hubertUnloaded ? 'Unloaded' : 'Unload'}
                    </Text>
                  </Pressable>
                )
              : route.name === 'Practice'
                ? () => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Practice information"
                      onPress={() => setShowPracticeInfo(true)}
                      style={{ marginRight: 8 }}
                    >
                      <MaterialIcons name="info-outline" size={20} color="#6b7f67" />
                    </Pressable>
                  )
              : undefined,
          headerTitle:
            route.name === 'Hubert'
              ? () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: '#243526', fontWeight: '800', fontSize: 20 }}>Hubert</Text>
                    <HeaderLanguageMenu
                      selected={hubertLanguage}
                      onSelect={setHubertLanguage}
                      pinnedLanguageCodes={pinnedLanguageCodes}
                      onTogglePinnedLanguage={onTogglePinnedLanguage}
                    />
                  </View>
                )
              : route.name === 'Practice'
                ? () => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: '#243526', fontWeight: '800', fontSize: 20 }}>Practice</Text>
                      <HeaderLanguageMenu
                        selected={practiceLanguage}
                        onSelect={setPracticeLanguage}
                        pinnedLanguageCodes={pinnedLanguageCodes}
                        onTogglePinnedLanguage={onTogglePinnedLanguage}
                      />
                    </View>
                  )
              : undefined,
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#dfeecd',
            borderTopWidth: 2,
            height: 64,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontWeight: '800' },
          tabBarActiveTintColor: '#58cc02',
          tabBarInactiveTintColor: '#95ad8d',
          tabBarIcon: ({ color, size }) => {
            const iconName = route.name === 'Practice' ? 'school' : 'forum';
            return <MaterialIcons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Practice">
          {() => (
            <PracticeScreen
              targetLanguage={practiceLanguage}
              onChangeLanguage={setPracticeLanguage}
              pinnedLanguageCodes={pinnedLanguageCodes}
              onTogglePinnedLanguage={onTogglePinnedLanguage}
              showLanguagePicker={false}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Hubert">
          {() => (
            <HubertChatScreen
              targetLanguage={hubertLanguage}
              onChangeLanguage={setHubertLanguage}
              pinnedLanguageCodes={pinnedLanguageCodes}
              onTogglePinnedLanguage={onTogglePinnedLanguage}
              showLanguagePicker={false}
              onModelLoaded={() => setHubertUnloaded(false)}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>

      <Modal visible={showPracticeInfo} transparent animationType="fade" onRequestClose={() => setShowPracticeInfo(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/35 px-6" onPress={() => setShowPracticeInfo(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="w-full max-w-[360px] rounded-3xl border-2 border-[#dfeecd] bg-white px-5 py-5"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-black tracking-[1px] text-accentDark">HUBERT PRACTICE</Text>
                <Text className="mt-1 text-3xl font-black text-ink">Train your pronunciation</Text>
              </View>
              <View className="h-14 w-14 items-center justify-center rounded-full border-2 border-accentDark bg-accent">
                <MaterialIcons name="record-voice-over" size={28} color="#ffffff" />
              </View>
            </View>
            <Text className="mt-2 text-base text-ink/80">
              Type a word or sentence, listen to native speech, then record your attempt for feedback.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
