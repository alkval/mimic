export type LanguageOption = {
  code: string;
  name: string;
  flag: string;
  speechCode?: string;
};

const ALL_LANGUAGES: LanguageOption[] = [
  { code: 'af', name: 'Afrikaans', flag: '🇿🇦', speechCode: 'af-ZA' },
  { code: 'sq', name: 'Albanian', flag: '🇦🇱', speechCode: 'sq-AL' },
  { code: 'am', name: 'Amharic', flag: '🇪🇹', speechCode: 'am-ET' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', speechCode: 'ar-SA' },
  { code: 'hy', name: 'Armenian', flag: '🇦🇲', speechCode: 'hy-AM' },
  { code: 'az', name: 'Azerbaijani', flag: '🇦🇿', speechCode: 'az-AZ' },
  { code: 'eu', name: 'Basque', flag: '🇪🇸', speechCode: 'eu-ES' },
  { code: 'be', name: 'Belarusian', flag: '🇧🇾', speechCode: 'be-BY' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', speechCode: 'bn-BD' },
  { code: 'bs', name: 'Bosnian', flag: '🇧🇦', speechCode: 'bs-BA' },
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬', speechCode: 'bg-BG' },
  { code: 'ca', name: 'Catalan', flag: '🇪🇸', speechCode: 'ca-ES' },
  { code: 'ceb', name: 'Cebuano', flag: '🇵🇭' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', speechCode: 'zh-CN' },
  { code: 'zh-tw', name: 'Chinese (Traditional)', flag: '🇹🇼', speechCode: 'zh-TW' },
  { code: 'co', name: 'Corsican', flag: '🇫🇷' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷', speechCode: 'hr-HR' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿', speechCode: 'cs-CZ' },
  { code: 'da', name: 'Danish', flag: '🇩🇰', speechCode: 'da-DK' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', speechCode: 'nl-NL' },
  { code: 'en', name: 'English', flag: '🇬🇧', speechCode: 'en-US' },
  { code: 'eo', name: 'Esperanto', flag: '🏳️' },
  { code: 'et', name: 'Estonian', flag: '🇪🇪', speechCode: 'et-EE' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮', speechCode: 'fi-FI' },
  { code: 'fr', name: 'French', flag: '🇫🇷', speechCode: 'fr-FR' },
  { code: 'fy', name: 'Frisian', flag: '🇳🇱' },
  { code: 'gl', name: 'Galician', flag: '🇪🇸', speechCode: 'gl-ES' },
  { code: 'ka', name: 'Georgian', flag: '🇬🇪', speechCode: 'ka-GE' },
  { code: 'de', name: 'German', flag: '🇩🇪', speechCode: 'de-DE' },
  { code: 'el', name: 'Greek', flag: '🇬🇷', speechCode: 'el-GR' },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳', speechCode: 'gu-IN' },
  { code: 'ht', name: 'Haitian Creole', flag: '🇭🇹' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'haw', name: 'Hawaiian', flag: '🇺🇸' },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱', speechCode: 'he-IL' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', speechCode: 'hi-IN' },
  { code: 'hmn', name: 'Hmong', flag: '🇱🇦' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺', speechCode: 'hu-HU' },
  { code: 'is', name: 'Icelandic', flag: '🇮🇸', speechCode: 'is-IS' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', speechCode: 'id-ID' },
  { code: 'ga', name: 'Irish', flag: '🇮🇪', speechCode: 'ga-IE' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', speechCode: 'it-IT' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', speechCode: 'ja-JP' },
  { code: 'jw', name: 'Javanese', flag: '🇮🇩' },
  { code: 'kn', name: 'Kannada', flag: '🇮🇳', speechCode: 'kn-IN' },
  { code: 'kk', name: 'Kazakh', flag: '🇰🇿', speechCode: 'kk-KZ' },
  { code: 'km', name: 'Khmer', flag: '🇰🇭', speechCode: 'km-KH' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', speechCode: 'ko-KR' },
  { code: 'ku', name: 'Kurdish', flag: '🇮🇶' },
  { code: 'ky', name: 'Kyrgyz', flag: '🇰🇬', speechCode: 'ky-KG' },
  { code: 'lo', name: 'Lao', flag: '🇱🇦', speechCode: 'lo-LA' },
  { code: 'la', name: 'Latin', flag: '🏛️' },
  { code: 'lv', name: 'Latvian', flag: '🇱🇻', speechCode: 'lv-LV' },
  { code: 'lt', name: 'Lithuanian', flag: '🇱🇹', speechCode: 'lt-LT' },
  { code: 'lb', name: 'Luxembourgish', flag: '🇱🇺' },
  { code: 'mk', name: 'Macedonian', flag: '🇲🇰', speechCode: 'mk-MK' },
  { code: 'mg', name: 'Malagasy', flag: '🇲🇬' },
  { code: 'ms', name: 'Malay', flag: '🇲🇾', speechCode: 'ms-MY' },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳', speechCode: 'ml-IN' },
  { code: 'mt', name: 'Maltese', flag: '🇲🇹', speechCode: 'mt-MT' },
  { code: 'mi', name: 'Maori', flag: '🇳🇿' },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳', speechCode: 'mr-IN' },
  { code: 'mn', name: 'Mongolian', flag: '🇲🇳', speechCode: 'mn-MN' },
  { code: 'my', name: 'Myanmar', flag: '🇲🇲', speechCode: 'my-MM' },
  { code: 'ne', name: 'Nepali', flag: '🇳🇵', speechCode: 'ne-NP' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴', speechCode: 'nb-NO' },
  { code: 'ny', name: 'Nyanja', flag: '🇲🇼' },
  { code: 'or', name: 'Odia', flag: '🇮🇳' },
  { code: 'ps', name: 'Pashto', flag: '🇦🇫', speechCode: 'ps-AF' },
  { code: 'fa', name: 'Persian', flag: '🇮🇷', speechCode: 'fa-IR' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', speechCode: 'pl-PL' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', speechCode: 'pt-PT' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳', speechCode: 'pa-IN' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴', speechCode: 'ro-RO' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', speechCode: 'ru-RU' },
  { code: 'sm', name: 'Samoan', flag: '🇼🇸' },
  { code: 'gd', name: 'Scottish Gaelic', flag: '🏴' },
  { code: 'sr', name: 'Serbian', flag: '🇷🇸', speechCode: 'sr-RS' },
  { code: 'st', name: 'Sesotho', flag: '🇱🇸' },
  { code: 'sn', name: 'Shona', flag: '🇿🇼' },
  { code: 'sd', name: 'Sindhi', flag: '🇵🇰' },
  { code: 'si', name: 'Sinhala', flag: '🇱🇰', speechCode: 'si-LK' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰', speechCode: 'sk-SK' },
  { code: 'sl', name: 'Slovenian', flag: '🇸🇮', speechCode: 'sl-SI' },
  { code: 'so', name: 'Somali', flag: '🇸🇴', speechCode: 'so-SO' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', speechCode: 'es-ES' },
  { code: 'su', name: 'Sundanese', flag: '🇮🇩' },
  { code: 'sw', name: 'Swahili', flag: '🇹🇿', speechCode: 'sw-TZ' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪', speechCode: 'sv-SE' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭', speechCode: 'fil-PH' },
  { code: 'tg', name: 'Tajik', flag: '🇹🇯' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', speechCode: 'ta-IN' },
  { code: 'tt', name: 'Tatar', flag: '🇷🇺' },
  { code: 'te', name: 'Telugu', flag: '🇮🇳', speechCode: 'te-IN' },
  { code: 'th', name: 'Thai', flag: '🇹🇭', speechCode: 'th-TH' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', speechCode: 'tr-TR' },
  { code: 'tk', name: 'Turkmen', flag: '🇹🇲' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', speechCode: 'uk-UA' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', speechCode: 'ur-PK' },
  { code: 'ug', name: 'Uyghur', flag: '🇨🇳' },
  { code: 'uz', name: 'Uzbek', flag: '🇺🇿', speechCode: 'uz-UZ' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', speechCode: 'vi-VN' },
  { code: 'cy', name: 'Welsh', flag: '🏴', speechCode: 'cy-GB' },
  { code: 'xh', name: 'Xhosa', flag: '🇿🇦' },
  { code: 'yi', name: 'Yiddish', flag: '🇮🇱' },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'zu', name: 'Zulu', flag: '🇿🇦' },
];

const FEATURED_LANGUAGE_CODES = ['no', 'es', 'en', 'ko', 'zh'];

export const LANGUAGE_OPTIONS = ALL_LANGUAGES;

export function getLanguageByCode(code: string): LanguageOption | undefined {
  return LANGUAGE_OPTIONS.find((lang) => lang.code === code);
}

export const FEATURED_LANGUAGES = FEATURED_LANGUAGE_CODES.map((code) => getLanguageByCode(code)).filter(
  (lang): lang is LanguageOption => Boolean(lang),
);

export function fuzzyLanguageSearch(query: string): LanguageOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return FEATURED_LANGUAGES;
  }

  const starts: LanguageOption[] = [];
  const includes: LanguageOption[] = [];

  for (const lang of LANGUAGE_OPTIONS) {
    const hay = `${lang.name.toLowerCase()} ${lang.code.toLowerCase()}`;
    if (hay.startsWith(normalized)) {
      starts.push(lang);
    } else if (hay.includes(normalized)) {
      includes.push(lang);
    }
  }

  return [...starts, ...includes].slice(0, 20);
}
