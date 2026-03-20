export type CharacterScore = {
  character: string;
  score: number;
};

export type PronunciationResult = {
  scores: CharacterScore[];
  transcript: string;
};

export type TutorChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};
