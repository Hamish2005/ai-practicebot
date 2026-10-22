export const practiceVoices = ["marin", "cedar", "coral"] as const;
export type PracticeVoice = (typeof practiceVoices)[number];
export const defaultPracticeVoice: PracticeVoice = "marin";
