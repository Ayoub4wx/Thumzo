export interface GenerationOptions {
  prompt: string;
  imageSize: "1K" | "2K" | "4K";
  aspectRatio: "16:9" | "9:16" | "1:1";
  targetPlatform?: "youtube" | "tiktok" | "instagram";
  targetFormat?: string;
  instructions?: string;
  styleJson?: string;
  model?: string;
  baseImage?: string;
  referenceImage?: string;
  referenceImagePurpose?: "subject" | "mask";
  intent?: GenerationIntent;
  allowVisibleText?: boolean;
  background?: "auto" | "opaque" | "transparent";
}

export type GenerationIntent = "edit" | "create" | "background_only";

export interface GeminiImageModelOption {
  id: string;
  label: string;
  description?: string;
}

export const NANO_BANANA_2_MODEL = "gemini-3.1-flash-image-preview";
export const NANO_BANANA_CREATOR_MODEL = "gemini-3-pro-image-preview";
export const GPT_IMAGE_2_MODEL = "gpt-image-2";
export const GPT_IMAGE_1_5_MODEL = "gpt-image-1.5";
export const GPT_IMAGE_1_MODEL = "gpt-image-1";
export const GPT_IMAGE_1_MINI_MODEL = "gpt-image-1-mini";

const LEGACY_MODEL_LABELS: Record<string, string> = {
  "Google Flash 2.5": "gemini-2.5-flash-image",
  "Google Flash 3.1": "gemini-3.1-flash-image-preview",
  "Google Pro 3": "gemini-3-pro-image-preview",
  "Nano Banana 2": "gemini-3.1-flash-image-preview",
  "Nano Banana Pro": "gemini-3-pro-image-preview",
  "Nano Banana Creator": "gemini-3-pro-image-preview",
  "GPT Image 2": GPT_IMAGE_2_MODEL,
  "GPT Image 1.5": GPT_IMAGE_1_5_MODEL,
  "GPT Image 1": GPT_IMAGE_1_MODEL,
  "GPT Image 1 Mini": GPT_IMAGE_1_MINI_MODEL,
};

const MODEL_LABELS: Record<string, string> = {
  "gemini-2.5-flash-image": "Gemini 2.5 Flash",
  "gemini-3-pro-image-preview": "Gemini 3 Pro (Nano Banana Creator)",
  "gemini-3.1-flash-image-preview": "Gemini 3.1 Flash (Nano Banana 2)",
  [GPT_IMAGE_2_MODEL]: "GPT Image 2",
  [GPT_IMAGE_1_5_MODEL]: "GPT Image 1.5",
  [GPT_IMAGE_1_MODEL]: "GPT Image 1",
  [GPT_IMAGE_1_MINI_MODEL]: "GPT Image 1 Mini",
};

export const FALLBACK_GEMINI_IMAGE_MODELS: GeminiImageModelOption[] = [
  {
    id: "gemini-3-pro-image-preview",
    label: MODEL_LABELS["gemini-3-pro-image-preview"],
    description: "Gemini 3 Pro Image Preview for professional, reasoning-enhanced compositions.",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: MODEL_LABELS["gemini-3.1-flash-image-preview"],
    description: "Gemini 3.1 Flash Image Preview for ultra-fast, high-fidelity generation.",
  },
  {
    id: "gemini-2.5-flash-image",
    label: MODEL_LABELS["gemini-2.5-flash-image"],
    description: "Legacy stable image generation and editing.",
  },
];

export const HIDDEN_GPT_IMAGE_MODELS: GeminiImageModelOption[] = [
  {
    id: GPT_IMAGE_2_MODEL,
    label: MODEL_LABELS[GPT_IMAGE_2_MODEL],
    description: "OpenAI GPT Image 2 for the best overall generation and edit quality.",
  },
  {
    id: GPT_IMAGE_1_5_MODEL,
    label: MODEL_LABELS[GPT_IMAGE_1_5_MODEL],
    description: "OpenAI GPT Image 1.5 for transparent backgrounds and fallback.",
  },
];

export const SUPPORTED_IMAGE_MODELS: GeminiImageModelOption[] = [
  ...FALLBACK_GEMINI_IMAGE_MODELS,
  ...HIDDEN_GPT_IMAGE_MODELS,
];

export const DEFAULT_GEMINI_IMAGE_MODEL = NANO_BANANA_CREATOR_MODEL;

export const TRANSPARENT_BACKGROUND_SUPPORTED_MODELS = [
  GPT_IMAGE_1_5_MODEL,
  GPT_IMAGE_1_MODEL,
  GPT_IMAGE_1_MINI_MODEL,
] as const;

export function modelSupportsTransparentBackground(modelId: string) {
  return TRANSPARENT_BACKGROUND_SUPPORTED_MODELS.includes(
    modelId as (typeof TRANSPARENT_BACKGROUND_SUPPORTED_MODELS)[number],
  );
}

export function promptRequestsVisibleText(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  return [
    /add text/,
    /include text/,
    /put text/,
    /with text/,
    /headline/,
    /title text/,
    /caption/,
    /wording/,
    /write /,
    /says? "/,
    /text:/,
    /quote/,
    /logo/,
    /branding/,
  ].some((pattern) => pattern.test(lowerPrompt));
}

export function promptIsBackgroundOnlyRequest(prompt: string) {
  const lowerPrompt = prompt.trim().toLowerCase();

  if (!lowerPrompt) {
    return false;
  }

  const hasBackgroundSignal = [
    /\bbg\b/,
    /\bbackground\b/,
    /\bbackdrop\b/,
    /\bplain\b/,
    /\bsolid\b/,
    /\bclear\b/,
    /\bclean\b/,
    /\btransparent\b/,
    /\bgradient\b/,
    /\btexture\b/,
    /\bpattern\b/,
    /\bwhite\b/,
    /\bblack\b/,
    /\bgray\b/,
    /\bgrey\b/,
    /\bblue\b/,
    /\bred\b/,
    /\bgreen\b/,
    /\byellow\b/,
    /\borange\b/,
    /\bpurple\b/,
    /\bpink\b/,
    /\bteal\b/,
    /\bcyan\b/,
    /\bbeige\b/,
    /\bbrown\b/,
  ].some((pattern) => pattern.test(lowerPrompt));

  const hasSubjectSignal = [
    /\bperson\b/,
    /\bpeople\b/,
    /\bman\b/,
    /\bwoman\b/,
    /\bboy\b/,
    /\bgirl\b/,
    /\bface\b/,
    /\bportrait\b/,
    /\bselfie\b/,
    /\bcharacter\b/,
    /\bavatar\b/,
    /\bsubject\b/,
    /\bmodel\b/,
    /\bbrain\b/,
    /\brobot\b/,
    /\banimal\b/,
    /\bdog\b/,
    /\bcat\b/,
    /\blaptop\b/,
    /\bcomputer\b/,
    /\bphone\b/,
    /\bcamera\b/,
    /\bcar\b/,
    /\bhouse\b/,
    /\bbuilding\b/,
    /\bproduct\b/,
    /\bobject\b/,
    /\bscene\b/,
    /\bdesk\b/,
    /\broom\b/,
    /\billustration\b/,
    /\bmascot\b/,
  ].some((pattern) => pattern.test(lowerPrompt));

  return hasBackgroundSignal && !hasSubjectSignal;
}

export function resolveGeminiImageModelId(model?: string) {
  const rawModel = model?.trim();

  if (!rawModel) {
    return DEFAULT_GEMINI_IMAGE_MODEL;
  }

  if (LEGACY_MODEL_LABELS[rawModel]) {
    return LEGACY_MODEL_LABELS[rawModel];
  }

  return rawModel.replace(/^models\//, "");
}
