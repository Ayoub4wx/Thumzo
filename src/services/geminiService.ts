import { apiFetch } from "../lib/apiClient";
import {
  FALLBACK_GEMINI_IMAGE_MODELS,
  SUPPORTED_IMAGE_MODELS,
  type GenerationIntent,
  type GenerationOptions,
  type GeminiImageModelOption,
  NANO_BANANA_2_MODEL,
  DEFAULT_GEMINI_IMAGE_MODEL,
  promptIsBackgroundOnlyRequest,
  promptRequestsVisibleText,
  resolveGeminiImageModelId,
} from "../lib/geminiShared";
import type {
  CtrEstimate,
  GrowthExperiment,
  GrowthPatternKey,
  GrowthVariant,
  OptimizationPackResponse,
  ThumbnailIdeasResponse,
} from "../server/types";

export {
  FALLBACK_GEMINI_IMAGE_MODELS,
  SUPPORTED_IMAGE_MODELS,
  NANO_BANANA_2_MODEL,
  DEFAULT_GEMINI_IMAGE_MODEL,
  promptIsBackgroundOnlyRequest,
  promptRequestsVisibleText,
  resolveGeminiImageModelId,
};

export type { GenerationIntent, GenerationOptions, GeminiImageModelOption };

export async function listGeminiImageModels(): Promise<GeminiImageModelOption[]> {
  return SUPPORTED_IMAGE_MODELS;
}

export async function analyzeImage(imageUrl: string) {
  const response = await apiFetch<{ analysis: unknown }>("/api/ai/analyze", {
    method: "POST",
    body: { imageUrl },
  });

  return response.analysis;
}

type ThumbnailIdeasRequest = {
  topic: string;
  category: string;
  goal: string;
  visualVibe: string;
  startMode: "blank" | "sketch";
  referenceImage?: string;
};

export async function generateThumbnailIdeas(request: ThumbnailIdeasRequest) {
  return apiFetch<ThumbnailIdeasResponse>("/api/ai/ideas", {
    method: "POST",
    body: request,
  });
}

export async function generateAutoThumbnailTitle(request: {
  imageUrl: string;
  currentTitle?: string;
  prompt?: string;
}) {
  return apiFetch<{ title: string }>("/api/ai/auto-title", {
    method: "POST",
    body: request,
  });
}

export async function scoreThumbnailCtr(request: { imageUrl: string; title?: string }) {
  return apiFetch<{ estimate: CtrEstimate }>("/api/ai/ctr-score", {
    method: "POST",
    body: request,
  });
}

export async function generateOptimizationPack(request: {
  title: string;
  imageUrl?: string;
  patternKey?: GrowthPatternKey | null;
}) {
  return apiFetch<OptimizationPackResponse>("/api/ai/optimization-pack", {
    method: "POST",
    body: request,
  });
}

export async function optimizeThumbnailFace(request: { imageUrl: string; title?: string }) {
  return apiFetch<{ experiment: GrowthExperiment; variant: GrowthVariant }>("/api/ai/face-optimize", {
    method: "POST",
    body: request,
  });
}

export async function applyViralPattern(request: {
  imageUrl: string;
  title?: string;
  patternKey: GrowthPatternKey;
}) {
  return apiFetch<{ experiment: GrowthExperiment; variant: GrowthVariant }>("/api/ai/viral-pattern", {
    method: "POST",
    body: request,
  });
}

export async function clarifyPrompt(
  prompt: string,
  baseImage?: string,
  memory?: Array<{ role: "user" | "model", text: string }>,
  output?: Pick<GenerationOptions, "aspectRatio" | "targetPlatform" | "targetFormat">,
) {
  return apiFetch<{ status: "ready" | "needs_clarification"; question: string; optimizedPrompt: string }>("/api/ai/clarify", {
    method: "POST",
    body: { prompt, baseImage, memory, ...output },
  });
}

export async function generateThumbnails(options: GenerationOptions) {
  const response = await apiFetch<{ images: string[] }>("/api/ai/generate", {
    method: "POST",
    body: {
      ...options,
      model: options.model ? resolveGeminiImageModelId(options.model) : DEFAULT_GEMINI_IMAGE_MODEL,
    },
  });

  return response.images;
}
