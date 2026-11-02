// Choices offered in the agent setup form. Shared by all workspaces.

export const LANGUAGES = [
  { value: "hi-IN", label: "Hindi" },
  { value: "en-IN", label: "English (India)" },
  { value: "mr-IN", label: "Marathi" },
  { value: "gu-IN", label: "Gujarati" },
  { value: "ta-IN", label: "Tamil" },
  { value: "te-IN", label: "Telugu" },
  { value: "kn-IN", label: "Kannada" },
  { value: "ml-IN", label: "Malayalam" },
  { value: "bn-IN", label: "Bengali" },
  { value: "od-IN", label: "Odia" },
  { value: "pa-IN", label: "Punjabi" },
] as const;

// Sarvam Bulbul voices.
export const VOICES = {
  female: ["priya", "ishita", "pooja", "kavya", "neha", "ritu", "roopa", "suhani", "tanya", "simran", "kavitha", "shruti", "shreya"],
  male: ["shubh", "ratan", "rahul", "amit", "rohan", "aditya", "dev", "kabir", "manan", "sumit", "varun", "advait"],
} as const;

export const PERSONALITIES = ["friendly", "professional", "warm", "energetic", "calm"] as const;

export const LLM_MODELS = [
  { provider: "anthropic", model: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fast, low cost, recommended for calls)" },
  { provider: "anthropic", model: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (smarter, slower, costs more)" },
] as const;

export const STT_PROVIDERS = [{ value: "deepgram", label: "Deepgram" }] as const;
export const TTS_PROVIDERS = [{ value: "sarvam", label: "Sarvam Bulbul" }] as const;

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.value === code)?.label ?? code;
}

export function modelLabel(model: string): string {
  return LLM_MODELS.find((m) => m.model === model)?.label.split(" (")[0] ?? model;
}
