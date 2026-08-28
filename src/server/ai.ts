import { GoogleGenAI, Type } from "@google/genai";
import type { GenerationIntent, GenerationOptions } from "../lib/geminiShared.js";
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  FALLBACK_GEMINI_IMAGE_MODELS,
  HIDDEN_GPT_IMAGE_MODELS,
  GPT_IMAGE_1_5_MODEL,
  promptIsBackgroundOnlyRequest,
  promptRequestsVisibleText,
  modelSupportsTransparentBackground,
  resolveGeminiImageModelId,
} from "../lib/geminiShared.js";
import { TEMPLATE_CATEGORY_OPTIONS } from "../lib/studioMetadata.js";
import { serverEnv } from "./env.js";
import type {
  CtrEstimate,
  GrowthPatternKey,
  GrowthVariant,
  ThumbnailIdea,
  ThumbnailIdeasResponse,
} from "./types.js";

const DEFAULT_GEMINI_TEXT_MODEL = "gemini-3-flash-preview";
const IDEA_CATEGORY_IDS = TEMPLATE_CATEGORY_OPTIONS.map((option) => option.id);
const GEMINI_IMAGE_MODEL_FALLBACK_CHAIN = FALLBACK_GEMINI_IMAGE_MODELS.map((option) => option.id);
const OPENAI_IMAGE_MODEL_FALLBACK_CHAIN = HIDDEN_GPT_IMAGE_MODELS.map((option) => option.id);
const OPENAI_IMAGE_API_BASE_URL = "https://api.openai.com/v1/images";

function createGeminiClient() {
  if (!serverEnv.geminiApiKey) {
    throw new Error("Missing required server environment variable: GEMINI_API_KEY");
  }

  return new GoogleGenAI({ apiKey: serverEnv.geminiApiKey });
}

function getOpenAiApiKey() {
  if (!serverEnv.openaiApiKey) {
    throw new Error("Missing required server environment variable: OPENAI_API_KEY");
  }

  return serverEnv.openaiApiKey;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : null;

    if (message) {
      return message;
    }
  }

  return String(error ?? "");
}

function isResourceExhaustedError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return [
    "resource has been exhausted",
    "resource_exhausted",
    "check quota",
    "quota",
    "rate limit",
    "too many requests",
    "\"code\":429",
    "\"status\":\"resource_exhausted\"",
  ].some((signal) => message.includes(signal));
}

function isOpenAiModelFallbackError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return [
    "model",
    "does not exist",
    "not found",
    "unsupported",
    "not supported",
    "invalid_request_error",
    "invalid model",
  ].some((signal) => message.includes(signal));
}

function isOpenAiImageModel(modelId: string) {
  return modelId.startsWith("gpt-image-");
}

function getOpenAiImageModelCandidates(preferredModelId: string, background: GenerationOptions["background"]) {
  const transparentRequested = background === "transparent";
  const orderedModels = transparentRequested && !modelSupportsTransparentBackground(preferredModelId)
    ? [GPT_IMAGE_1_5_MODEL, ...OPENAI_IMAGE_MODEL_FALLBACK_CHAIN]
    : [preferredModelId, ...OPENAI_IMAGE_MODEL_FALLBACK_CHAIN];

  return orderedModels.filter((modelId, index, models) => {
    if (!modelId || models.indexOf(modelId) !== index) {
      return false;
    }

    if (transparentRequested && !modelSupportsTransparentBackground(modelId)) {
      return false;
    }

    return true;
  });
}

function getGeminiImageModelCandidates(preferredModelId: string) {
  return [preferredModelId, ...GEMINI_IMAGE_MODEL_FALLBACK_CHAIN, DEFAULT_GEMINI_IMAGE_MODEL].filter(
    (modelId, index, models) => Boolean(modelId) && models.indexOf(modelId) === index,
  );
}

function buildResourceExhaustedError() {
  return new Error(
    JSON.stringify({
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message: "AI generation is temporarily unavailable because the provider is busy or out of quota. Try again in a minute.",
      },
    }),
  );
}

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
};

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);

  if (!match) {
    throw new Error("Expected a base64 data URL image.");
  }

  return {
    mimeType: match[1] || "image/png",
    bytes: Buffer.from(match[2] || "", "base64"),
  };
}

function buildOpenAiImageSize(options: Pick<GenerationOptions, "imageSize" | "aspectRatio">) {
  if (options.aspectRatio === "1:1") {
    if (options.imageSize === "4K") {
      return "2880x2880";
    }

    return options.imageSize === "2K" ? "2048x2048" : "1024x1024";
  }

  if (options.aspectRatio === "9:16") {
    if (options.imageSize === "4K") {
      return "2160x3840";
    }

    return options.imageSize === "2K" ? "1152x2048" : "864x1536";
  }

  if (options.imageSize === "4K") {
    return "3840x2160";
  }

  return options.imageSize === "2K" ? "2048x1152" : "1536x864";
}

function buildOpenAiImageQuality(imageSize: GenerationOptions["imageSize"]) {
  if (imageSize === "4K") {
    return "high";
  }

  if (imageSize === "2K") {
    return "medium";
  }

  return "medium";
}

async function readOpenAiError(response: Response) {
  const text = await response.text();

  if (!text) {
    return `OpenAI image request failed with status ${response.status}.`;
  }

  try {
    const payload = JSON.parse(text) as OpenAiImageResponse;
    return payload.error?.message || text;
  } catch {
    return text;
  }
}

async function requestOpenAiGeneration(payload: Record<string, unknown>) {
  const response = await fetch(`${OPENAI_IMAGE_API_BASE_URL}/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readOpenAiError(response));
  }

  return response.json() as Promise<OpenAiImageResponse>;
}

async function requestOpenAiEdit(options: {
  payload: Record<string, string>;
  images: Array<{ name: string; dataUrl: string }>;
  mask?: string;
}) {
  const formData = new FormData();

  Object.entries(options.payload).forEach(([key, value]) => {
    formData.append(key, value);
  });

  options.images.forEach((image, index) => {
    const { mimeType, bytes } = parseDataUrl(image.dataUrl);
    formData.append("image", new Blob([bytes], { type: mimeType }), image.name || `image-${index + 1}.png`);
  });

  if (options.mask) {
    const { bytes } = parseDataUrl(options.mask);
    formData.append("mask", new Blob([bytes], { type: "image/png" }), "mask.png");
  }

  const response = await fetch(`${OPENAI_IMAGE_API_BASE_URL}/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readOpenAiError(response));
  }

  return response.json() as Promise<OpenAiImageResponse>;
}

function parseJsonResponseText(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim());
    }

    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }

    throw new Error("Response was not valid JSON.");
  }
}

type PromptClarificationResponse = {
  status: "ready" | "needs_clarification";
  question: string;
  optimizedPrompt: string;
};

function buildDirectClarification(prompt: string, hasPriorContext: boolean): PromptClarificationResponse | null {
  if (hasPriorContext) {
    return null;
  }

  const normalizedPrompt = prompt.trim().toLowerCase().replace(/\s+/g, " ");

  if (!normalizedPrompt) {
    return null;
  }

  if (/^(hi|hello|hey|yo|sup|what'?s up|salam|salaam)\b/.test(normalizedPrompt)) {
    return {
      status: "needs_clarification",
      question: "Hello. What kind of thumbnail or social cover do you want to create today?",
      optimizedPrompt: "",
    };
  }

  if (/\b(help|can you help|what can you do|how does this work|who are you)\b/.test(normalizedPrompt)) {
    return {
      status: "needs_clarification",
      question: "Tell me the topic, the mood, and whether you want a new thumbnail or an edit, and I will turn it into a clean prompt.",
      optimizedPrompt: "",
    };
  }

  if (/\b(thanks|thank you|thx)\b/.test(normalizedPrompt)) {
    return {
      status: "needs_clarification",
      question: "Any time. What thumbnail do you want to work on next?",
      optimizedPrompt: "",
    };
  }

  return null;
}

function normalizeClarificationResponse(payload: unknown, fallbackPrompt: string): PromptClarificationResponse {
  const parsed = payload && typeof payload === "object" ? (payload as Partial<PromptClarificationResponse>) : {};
  const status = parsed.status === "needs_clarification" ? "needs_clarification" : "ready";
  const question = typeof parsed.question === "string" ? parsed.question.trim() : "";
  const optimizedPrompt = typeof parsed.optimizedPrompt === "string" ? parsed.optimizedPrompt.trim() : "";

  if (status === "needs_clarification") {
    return {
      status,
      question: question || "What kind of thumbnail or social cover do you want to create?",
      optimizedPrompt,
    };
  }

  return {
    status: "ready",
    question: "",
    optimizedPrompt: optimizedPrompt || fallbackPrompt.trim(),
  };
}

function expandEditInstruction(prompt: string) {
  const normalized = prompt.trim();
  const lowerPrompt = normalized.toLowerCase();
  const directives: string[] = [];

  if (/\b(white bg|white background|background white|plain white)\b/.test(lowerPrompt)) {
    directives.push("Change only the background to a clean solid white backdrop.");
    directives.push("Keep the main subject, composition, proportions, pose, facial features, and existing foreground elements intact.");
    directives.push("Do not add any text, labels, icons, symbols, checkmarks, UI cards, or extra graphic elements.");
  }

  if (/\b(remove background|transparent background|cut out|cutout)\b/.test(lowerPrompt)) {
    directives.push("Remove the background cleanly while keeping the main subject edges natural and detailed.");
    directives.push("Do not add any new props, text, decorative marks, or replacement subject elements unless explicitly requested.");
  }

  if (/\b(brighten|lighter|more light|increase brightness)\b/.test(lowerPrompt)) {
    directives.push("Increase brightness and clarity without changing the core composition.");
  }

  if (/\b(darken|darker|moody|lower brightness)\b/.test(lowerPrompt)) {
    directives.push("Darken the scene subtly without changing the core composition.");
  }

  if (/\b(remove text|no text|without text)\b/.test(lowerPrompt)) {
    directives.push("Remove any readable text from the image.");
  }

  if (directives.length === 0) {
    return normalized;
  }

  return `${normalized}\n\nIntent expansion:\n- ${directives.join("\n- ")}`;
}

function promptExplicitlyForbidsVisibleText(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  return [/remove text/, /no text/, /without text/, /textless/, /no words/, /without words/].some((pattern) =>
    pattern.test(lowerPrompt),
  );
}

function promptTargetsExistingTextStyling(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  return [
    /make text/,
    /change text/,
    /keep text/,
    /headline/,
    /title/,
    /caption/,
    /font/,
    /typography/,
    /letter/,
    /word/,
    /glow/,
    /shadow/,
    /outline/,
    /stroke/,
    /fill/,
    /text color/,
    /make .* black/,
    /make .* white/,
    /simpl(e|ify)/,
  ].some((pattern) => pattern.test(lowerPrompt));
}

const TOP_CHANNEL_PATTERN_PRIOR = [
  "Top YouTube channel performance prior:",
  "- Learn from broad high-performing channel patterns, but do not copy any specific creator, channel, logo, font, thumbnail, face, layout, or copyrighted asset.",
  "- Build around one instantly understood click promise that is visible at mobile size.",
  "- Use one dominant focal point: expressive face, high-value object, visible result, or before-versus-after contrast.",
  "- Keep 2-3 visual beats max with strong foreground/background separation, simple shapes, high contrast, and readable hierarchy.",
  "- Match the niche archetype: spectacle challenge, creator reaction, gaming action, tech proof, education curiosity, finance signal, lifestyle transformation, food payoff, music or celebrity identity, sports moment, or news urgency.",
  "- The title and image must tell the same story; the image should communicate the core reason to click without needing a paragraph.",
  "- Preserve the user's source image, subject identity, topic, brand constraints, and composition when editing an existing thumbnail.",
].join("\n");

function buildTopChannelPatternPrior(topic?: string) {
  const normalizedTopic = topic?.trim();

  return normalizedTopic
    ? `${TOP_CHANNEL_PATTERN_PRIOR}\n- Adapt the pattern choices to this topic or niche: ${normalizedTopic}.`
    : TOP_CHANNEL_PATTERN_PRIOR;
}

function getPlatformFormatLabel(options: Pick<GenerationOptions, "aspectRatio" | "targetPlatform" | "targetFormat">) {
  const targetFormat = options.targetFormat?.trim();

  if (targetFormat) {
    return targetFormat;
  }

  if (options.targetPlatform === "tiktok") {
    return "TikTok 9:16 cover thumbnail";
  }

  if (options.targetPlatform === "instagram") {
    return options.aspectRatio === "1:1" ? "Instagram square feed thumbnail" : "Instagram Reels 9:16 cover thumbnail";
  }

  return "YouTube 16:9 thumbnail";
}

function buildPlatformPatternPrior(options: Pick<GenerationOptions, "aspectRatio" | "targetPlatform" | "targetFormat">, topic?: string) {
  if (!options.targetPlatform || options.targetPlatform === "youtube") {
    return buildTopChannelPatternPrior(topic);
  }

  const normalizedTopic = topic?.trim();
  const formatLabel = getPlatformFormatLabel(options);
  const baseRules = [
    `${formatLabel} performance prior:`,
    "- Design for fast mobile scanning, with one dominant subject and a clear visual promise.",
    "- Keep the main subject and any headline inside the center safe area so app chrome, captions, and controls do not cover it.",
    "- Use bold foreground/background separation, strong contrast, and simple shapes that remain legible at feed size.",
    "- Avoid platform UI, app buttons, reaction counters, watermarks, copyrighted logos, or creator-specific brand imitation.",
  ];

  if (options.targetPlatform === "tiktok") {
    baseRules.push(
      "- Favor a vertical hook frame: expressive subject, visible result, before/after tension, or a single curiosity object.",
      "- Leave breathing room near the lower edge because TikTok captions and action controls often compete with that area.",
    );
  } else {
    baseRules.push(
      "- Favor polished editorial clarity for Instagram: clean crop, intentional color contrast, and strong grid readability.",
      options.aspectRatio === "1:1"
        ? "- Compose for a square grid tile with the key subject centered and readable without relying on tiny text."
        : "- Compose for Reels or Stories with the key subject centered vertically and readable under overlay controls.",
    );
  }

  if (normalizedTopic) {
    baseRules.push(`- Adapt the pattern choices to this topic or niche: ${normalizedTopic}.`);
  }

  return baseRules.join("\n");
}

function buildPrompt(options: GenerationOptions) {
  const modelId = resolveGeminiImageModelId(options.model);
  const intent: GenerationIntent =
    options.intent ?? (options.baseImage ? "edit" : promptIsBackgroundOnlyRequest(options.prompt) ? "background_only" : "create");
  const isEditMode = intent === "edit";
  const interpretedPrompt = isEditMode ? expandEditInstruction(options.prompt) : options.prompt.trim();
  const allowsVisibleText = options.allowVisibleText ?? promptRequestsVisibleText(options.prompt);
  const forbidsVisibleText = promptExplicitlyForbidsVisibleText(options.prompt);
  const targetsExistingTextStyling = promptTargetsExistingTextStyling(options.prompt);
  const formatLabel = getPlatformFormatLabel(options);
  let finalPrompt = "";

  if (intent === "background_only") {
    finalPrompt = `Create only a ${options.aspectRatio} ${formatLabel} background based on this request: ${interpretedPrompt}.`;
    finalPrompt +=
      "\n\nBackground-only rules: fill the full canvas edge to edge with the requested background treatment. Do not add any person, face, hand, character, subject, product, object, icon, logo, badge, border, frame, inset card, panel, checkmark, button, UI element, or decorative foreground prop.";

    if (allowsVisibleText) {
      finalPrompt +=
        "\n\nVisible text is allowed only because the user explicitly requested it. If text is requested, include only the requested wording and no extra labels, symbols, or badges.";
    } else {
      finalPrompt += "\n\nDo not include any readable text, letters, numbers, captions, labels, logos, or symbols in the final image.";
    }

    finalPrompt += "\n\nStyle: clean, full-bleed, cohesive background art suitable for later thumbnail composition.";
  } else if (isEditMode) {
    const attachmentContext = options.referenceImage ? " using the provided attachment" : "";
    finalPrompt = `Edit the provided ${formatLabel}${attachmentContext} using this instruction: ${interpretedPrompt}.`;
  } else {
    const attachmentContext = options.referenceImage ? " featuring the subject in the attachment" : "";
    finalPrompt = `Create a high-quality ${formatLabel}${attachmentContext} for: ${interpretedPrompt}.`;
  }

  if (options.instructions) {
    finalPrompt += `\n\nAdditional Instructions: ${options.instructions}`;
  }

  if (options.styleJson) {
    finalPrompt += `\n\nFollow this style configuration (JSON): ${options.styleJson}`;
  }

  if (isEditMode) {
    finalPrompt +=
      "\n\nImportant edit rules: treat the user's words as instructions for changing the image, not as text to place inside it. Apply the edit to the full thumbnail canvas and keep the full scene coherent unless the user explicitly asks for a localized change. Preserve the existing composition, subject placement, framing, and layout unless the instruction clearly asks for a layout change.";

    if (allowsVisibleText) {
      finalPrompt +=
        "\n\nVisible text is allowed only because the user explicitly requested it. Add or modify only the specific text treatment needed for the request. Do not invent extra words, labels, badges, or symbols.";
    } else if (forbidsVisibleText) {
      finalPrompt +=
        "\n\nRemove readable text from the final edited image because the user explicitly asked for no text. Do not leave behind badges, logos, labels, or symbols.";
    } else if (targetsExistingTextStyling) {
      finalPrompt +=
        "\n\nPreserve the existing text content from the source image and only adjust its styling or effects according to the instruction. Do not replace the wording, remove the text, or invent new text.";
    } else {
      finalPrompt +=
        "\n\nDo not add any new readable words, numbers, labels, captions, logos, icons, badges, or checkmarks. If the source image already contains text, preserve that existing text unless the user explicitly asks to remove or restyle it.";
    }
  } else if (intent === "create" && forbidsVisibleText) {
    finalPrompt += "\n\nDo not include readable text, labels, captions, numbers, logos, or symbols in the final image.";
  }

  if (intent !== "background_only") {
    finalPrompt += `\n\nStyle: Professional, vibrant, high contrast, engaging, optimized for ${formatLabel}.`;
    finalPrompt += `\n\n${buildPlatformPatternPrior(options, options.prompt)}`;
    finalPrompt += "\n\nCRITICAL QUALITY RULES:";
    finalPrompt += "\n1. SUBJECT IDENTITY: If a reference image of a person is provided, preserve their facial identity with 99% accuracy. Maintain the exact eye shape, jawline, and unique facial features. Do not 'beautify' or genericize the face.";
    finalPrompt += "\n2. LIGHTING MATCH: Analyze the light source in the background and apply matching directional shadows and highlights to the inserted subject. The subject must look like they were physically present in the scene.";
    finalPrompt += "\n3. ANATOMY: Ensure perfect human anatomy. No artifacts on hands, eyes, or edges.";
    finalPrompt += "\n4. BLENDING: Ensure the edges of the inserted subject are clean and naturally anti-aliased against the new background.";
  }

  return { finalPrompt, modelId };
}

export async function clarifyPromptOnServer(options: {
  prompt: string;
  baseImage?: string;
  memory?: Array<{ role: "user" | "model", text: string }>;
  aspectRatio?: GenerationOptions["aspectRatio"];
  targetPlatform?: GenerationOptions["targetPlatform"];
  targetFormat?: string;
}) {
  const directClarification = buildDirectClarification(options.prompt, Boolean(options.memory?.length));

  if (directClarification) {
    return directClarification;
  }

  const ai = createGeminiClient();
  const modelId = "gemini-2.5-pro";
  const outputContext = {
    aspectRatio: options.aspectRatio ?? "16:9",
    targetPlatform: options.targetPlatform ?? "youtube",
    targetFormat: options.targetFormat,
  };
  const formatLabel = getPlatformFormatLabel(outputContext);

  const parts: Array<Record<string, unknown>> = [];

  // Step 1: Pre-analyze the image if provided to give the agent "vision"
  let imageContext = "";
  if (options.baseImage) {
    try {
      const analysis = await analyzeImageOnServer(options.baseImage, "Briefly describe the colors, lighting sources, primary subjects, and overall mood of this thumbnail in 3 bullet points.");
      imageContext = `\n\n--- IMAGE ANALYSIS ---\n${analysis.raw_text || JSON.stringify(analysis)}\n-----------------------\n`;
    } catch (e) {
      console.warn("Agent pre-analysis failed", e);
    }
  }

  let memoryContext = "";
  if (options.memory && options.memory.length > 0) {
    memoryContext = "\n\n--- CACHED SESSION MEMORY ---\n" + options.memory.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.text}`).join("\n") + "\n-----------------------------\n";
  }

  parts.push({
    text: `You are an elite social thumbnail designer and expert AI prompt engineer.
The user wants to generate or edit a ${formatLabel}.
Use this platform-pattern training context when optimizing the request:
${buildPlatformPatternPrior(outputContext, options.prompt)}
${imageContext}
${memoryContext}
Current user instruction: "${options.prompt}"

Your goal is to figure out EXACTLY what the user wants and create the most powerful, highly-optimized prompt for an image generation model. You have access to the cached session memory and image analysis to understand the context of their current reply.

1. CLARIFY: If the user's prompt is too vague (e.g., "make it better", "cool thumbnail") and the context doesn't make it clear, ask a brief clarifying question to understand their vision.
   - If the user is greeting you, making small talk, asking for help, or otherwise chatting instead of giving an image request, respond like an assistant and set "status" to "needs_clarification".
   - In those chat-first cases, ask one short helpful question and leave "optimizedPrompt" as an empty string.
2. OPTIMIZE: Always generate an "optimizedPrompt". This prompt should transform their simple idea into a highly descriptive, professional prompt designed for ${formatLabel}.
   - MANDATORY: Maintain consistent lighting and colors. If the image analysis says "Blue lighting", the optimized prompt MUST explicitly mention "maintaining the cinematic blue ambient lighting and sharp shadows".
   - Include keywords like: "High contrast, vibrant colors, 4k, hyper-detailed, highly engaging ${formatLabel} style, mobile-readable, dramatic lighting, sharp focus".
   - If editing, describe exactly how to blend elements seamlessly.

Return ONLY a JSON object with this exact structure:
{
  "status": "ready" | "needs_clarification",
  "question": "Your question for the user (only if needs_clarification, else empty string)",
  "optimizedPrompt": "The highly optimized, descriptive technical prompt"
}
Ensure it is valid JSON. Do not use markdown blocks.`
  });

  if (options.baseImage) {
    const base64Data = options.baseImage.split(",")[1] || options.baseImage;
    const mimeType = options.baseImage.includes(";") ? options.baseImage.split(";")[0]?.split(":")[1] : "image/png";
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType || "image/png",
      },
    });
  }

  const response = await ai.models.generateContent({
    model: modelId,
    contents: [{ role: "user", parts }],
    config: {
        responseMimeType: "application/json"
    }
  });

  let text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
      throw new Error("No response from AI");
  }

  return normalizeClarificationResponse(parseJsonResponseText(text), options.prompt);
}

async function generateImagesWithGemini(options: GenerationOptions, finalPrompt: string, modelId: string) {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];

  if (options.baseImage) {
    const commaIdx = options.baseImage.indexOf(",");
    if (commaIdx !== -1) {
      const base64Data = options.baseImage.slice(commaIdx + 1);
      const mimeType = options.baseImage.slice(0, commaIdx).split(";")[0]?.split(":")[1] || "image/png";
      parts.push({
        inlineData: { data: base64Data, mimeType },
      });
    }
  }

  if (options.referenceImage) {
    const commaIdx = options.referenceImage.indexOf(",");
    if (commaIdx !== -1) {
      const base64Data = options.referenceImage.slice(commaIdx + 1);
      const mimeType = options.referenceImage.slice(0, commaIdx).split(";")[0]?.split(":")[1] || "image/png";
      parts.push({
        inlineData: { data: base64Data, mimeType },
      });
    }
    parts.push({
      text:
        options.referenceImagePurpose === "mask"
          ? "The provided image with blue/cyan highlights is a binary mask. Only change pixels in the areas where the mask is active. Keep all other pixels identical to the source image."
          : "The provided reference image is a strict IDENTITY REFERENCE. \n" +
            "COMPOSITION RULES:\n" +
            "1. ANALYZE & INTEGRATE: Study the background scene's lighting, shadows, and perspective. Place the subject from the reference image into the scene so they look 100% physically present. \n" +
            "2. STYLE HARMONY: Match the color grading, film grain, and artistic contrast of the background perfectly. The subject must not look like an 'overlay' or 'sticker'.\n" +
            "3. IDENTITY: You MUST extract the exact facial features, skin tone, and unique persona from this reference person. They must be recognizable as the same individual.",
    });
  }

  parts.push({ text: finalPrompt });

  const imageConfig: Record<string, unknown> = {
    aspectRatio: options.aspectRatio,
    imageSize: options.imageSize || "1K",
  };
  const candidateModels = getGeminiImageModelCandidates(modelId);
  let lastError: unknown = null;

  for (let index = 0; index < candidateModels.length; index += 1) {
    const candidateModel = candidateModels[index];

    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents: { parts },
        config: { imageConfig },
      });

      const responseParts =
        response.candidates?.flatMap((candidate: any) => candidate?.content?.parts ?? []) ?? [];
      const images = responseParts
        .filter((part: any) => part?.inlineData?.data)
        .map((part: any) => `data:image/png;base64,${part.inlineData.data}`);

      if (images.length === 0) {
        throw new Error("No images were generated. Try a more specific prompt.");
      }

      return images;
    } catch (error) {
      lastError = error;

      if (!isResourceExhaustedError(error)) {
        throw error;
      }

      const hasMoreCandidates = index < candidateModels.length - 1;
      console.warn(`Gemini image generation exhausted for ${candidateModel}.`, getErrorMessage(error));

      if (!hasMoreCandidates) {
        throw buildResourceExhaustedError();
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("No image model was available for generation.");
}

async function generateImagesWithOpenAi(options: GenerationOptions, finalPrompt: string, modelId: string) {
  const background = options.background ?? "opaque";
  const outputFormat = "png";
  const size = buildOpenAiImageSize(options);
  const quality = buildOpenAiImageQuality(options.imageSize || "1K");
  const candidateModels = getOpenAiImageModelCandidates(modelId, background);
  const imageInputs: Array<{ name: string; dataUrl: string }> = [];

  if (options.baseImage) {
    imageInputs.push({ name: "base-image.png", dataUrl: options.baseImage });
  }

  if (options.referenceImage && options.referenceImagePurpose !== "mask") {
    imageInputs.push({
      name: options.referenceImagePurpose === "subject" ? "reference-subject.png" : "reference-image.png",
      dataUrl: options.referenceImage,
    });
  }

  const mask = options.referenceImagePurpose === "mask" ? options.referenceImage : undefined;
  let lastError: unknown = null;

  for (let index = 0; index < candidateModels.length; index += 1) {
    const candidateModel = candidateModels[index];

    try {
      const response =
        imageInputs.length > 0 || mask
          ? await requestOpenAiEdit({
              payload: {
                model: candidateModel,
                prompt: finalPrompt,
                size,
                quality,
                background,
                output_format: outputFormat,
                n: "1",
              },
              images: imageInputs,
              mask,
            })
          : await requestOpenAiGeneration({
              model: candidateModel,
              prompt: finalPrompt,
              size,
              quality,
              background,
              output_format: outputFormat,
              n: 1,
            });

      const images = (response.data || [])
        .map((entry) => entry?.b64_json)
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => `data:image/${outputFormat};base64,${entry}`);

      if (images.length === 0) {
        throw new Error("No images were generated. Try a more specific prompt.");
      }

      return images;
    } catch (error) {
      lastError = error;
      const hasMoreCandidates = index < candidateModels.length - 1;

      if (!isResourceExhaustedError(error) && !isOpenAiModelFallbackError(error)) {
        throw error;
      }

      console.warn(`OpenAI image generation fallback from ${candidateModel}.`, getErrorMessage(error));

      if (!hasMoreCandidates) {
        if (isResourceExhaustedError(error)) {
          throw buildResourceExhaustedError();
        }

        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("No image model was available for generation.");
}

export async function generateImagesOnServer(options: GenerationOptions) {
  const { finalPrompt, modelId } = buildPrompt(options);

  if (isOpenAiImageModel(modelId)) {
    if (!serverEnv.openaiApiKey) {
      console.warn("OPENAI_API_KEY is missing. Falling back to Gemini image generation.");
      return generateImagesWithGemini(options, finalPrompt, DEFAULT_GEMINI_IMAGE_MODEL);
    }

    return generateImagesWithOpenAi(options, finalPrompt, modelId);
  }

  return generateImagesWithGemini(options, finalPrompt, modelId);
}

type ThumbnailIdeasOptions = {
  topic: string;
  category?: string;
  goal?: string;
  visualVibe?: string;
  startMode?: "blank" | "sketch";
  referenceImage?: string;
};

type OptimizationPackOptions = {
  title: string;
  baseImage?: string;
  patternKey?: GrowthPatternKey | null;
};

type GrowthImageEditOptions = {
  title?: string;
  baseImage: string;
  patternKey?: GrowthPatternKey | null;
};

type GrowthOptimizationIdea = {
  title: string;
  prompt: string;
  rationale: string;
  patternKey: GrowthPatternKey | null;
};

function summarizeSourceThumbnailContext(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const entries = Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.map((entry) => String(entry)).filter(Boolean).join(", ")}`;
      }

      if (value && typeof value === "object") {
        return `${key}: ${JSON.stringify(value)}`;
      }

      return `${key}: ${String(value ?? "")}`;
    })
    .filter((entry) => !entry.endsWith(": "))
    .slice(0, 10);

  return entries.join("\n");
}

const GROWTH_PATTERN_LABELS: Record<GrowthPatternKey, string> = {
  high_stakes_challenge: "High-Stakes Challenge",
  ai_authority: "AI Authority",
  finance_signal: "Finance Signal",
};

const GROWTH_PATTERN_PROMPTS: Record<GrowthPatternKey, string> = {
  high_stakes_challenge:
    "Use a high-stakes challenge thumbnail archetype: one oversized emotional subject, obvious contrast, simple background separation, visual tension, and a clear impossible-versus-possible story. Do not copy any specific creator brand, logo, font, or exact layout.",
  ai_authority:
    "Use an AI authority thumbnail archetype: crisp futuristic workspace cues, clear human-or-tool focal point, cool tech accents, readable hierarchy, and a credible expert tone without clutter.",
  finance_signal:
    "Use a finance signal thumbnail archetype: clean chart or money signal, confident subject framing, strong green/red contrast where useful, minimal text area, and a trustworthy high-value framing.",
};

function clampScore(value: unknown, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function getPerformanceLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 72) return "Strong";
  if (score >= 58) return "Promising";
  if (score >= 42) return "Needs work";
  return "Weak";
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const strings = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);

  return strings.length ? strings.slice(0, 5) : fallback;
}

function normalizeCtrEstimate(payload: unknown): CtrEstimate {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const score = clampScore(source.score, 62);
  const rawFactors = Array.isArray(source.factors) ? source.factors : [];
  const factors = rawFactors
    .map((factor, index) => {
      const item = factor && typeof factor === "object" ? factor as Record<string, unknown> : {};
      const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : `Factor ${index + 1}`;

      return {
        key: typeof item.key === "string" && item.key.trim() ? item.key.trim() : label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label,
        score: clampScore(item.score, score),
        detail: typeof item.detail === "string" && item.detail.trim() ? item.detail.trim() : "No detail provided.",
      };
    })
    .slice(0, 8);

  const fallbackFactors = [
    { key: "faces", label: "Faces", score, detail: "Subject presence and emotion are estimated from the image." },
    { key: "contrast", label: "Contrast", score, detail: "Visual separation and color contrast are estimated." },
    { key: "composition", label: "Composition", score, detail: "Focal clarity and layout balance are estimated." },
  ];

  return {
    score,
    performanceLabel:
      typeof source.performanceLabel === "string" && source.performanceLabel.trim()
        ? source.performanceLabel.trim()
        : getPerformanceLabel(score),
    factors: factors.length ? factors : fallbackFactors,
    recommendations: normalizeStringArray(source.recommendations, [
      "Increase subject clarity and keep one dominant focal point.",
      "Push contrast between the subject and background.",
      "Keep the title promise visually obvious at a glance.",
    ]),
    analysis:
      source.analysis && typeof source.analysis === "object"
        ? source.analysis as Record<string, unknown>
        : {},
  };
}

function normalizeGrowthPatternKey(value: unknown): GrowthPatternKey | null {
  return value === "high_stakes_challenge" || value === "ai_authority" || value === "finance_signal" ? value : null;
}

function buildMockMetrics(score: number, index: number) {
  const impressions = 1200 + score * 37 + index * 280;
  const ctr = Math.max(1.2, Math.min(18, score / 10 + 0.6 + index * 0.18));
  const clicks = Math.round(impressions * (ctr / 100));

  return {
    impressions,
    clicks,
    ctr: Number(ctr.toFixed(2)),
    watchTimeLift: Number(Math.max(-3, (score - 58) / 7 + index * 0.4).toFixed(1)),
  };
}

function normalizeOptimizationIdeas(
  payload: unknown,
  title: string,
  patternKey: GrowthPatternKey | null,
  hasSourceThumbnail: boolean,
): GrowthOptimizationIdea[] {
  const parsed = payload && typeof payload === "object" ? payload as { ideas?: unknown } : {};
  const source = Array.isArray(parsed.ideas) ? parsed.ideas : [];
  const ideas = source
    .map((idea, index) => {
      const item = idea && typeof idea === "object" ? idea as Record<string, unknown> : {};
      const nextTitle = typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : `${title} ${index + 1}`;
      const prompt = typeof item.prompt === "string" && item.prompt.trim()
        ? item.prompt.trim()
        : hasSourceThumbnail
          ? `Edit the provided thumbnail for "${nextTitle}" while preserving the same main subject, visible topic, composition, crop, and background. Improve only title packaging, contrast, and clarity.`
          : `Create a high-CTR YouTube thumbnail for "${nextTitle}" with one clear focal subject, strong contrast, and a clean visual hook.`;

      return {
        title: nextTitle,
        prompt,
        rationale:
          typeof item.rationale === "string" && item.rationale.trim()
            ? item.rationale.trim()
            : "Clearer title promise with a matched visual hook.",
        patternKey: normalizeGrowthPatternKey(item.patternKey) ?? patternKey,
      };
    })
    .slice(0, 3);

  if (ideas.length >= 3) {
    return ideas;
  }

  return [
    ...ideas,
    {
      title: `I Tried ${title}`,
      prompt: hasSourceThumbnail
        ? `Edit the provided thumbnail for "I Tried ${title}". Keep the same person or main subject, scene, topic, crop, and background. Only adjust wording, contrast, clarity, and thumbnail polish.`
        : `Create a high-CTR YouTube thumbnail for "I Tried ${title}". Show one expressive subject, a clear before/after tension, vibrant contrast, and a simple background.`,
      rationale: "Turns the working title into a first-person curiosity hook.",
      patternKey,
    },
    {
      title: `The Truth About ${title}`,
      prompt: hasSourceThumbnail
        ? `Edit the provided thumbnail for "The Truth About ${title}". Preserve the source thumbnail's subject matter, visual layout, face identity, background, and 16:9 framing. Improve readability and contrast only.`
        : `Create a high-CTR YouTube thumbnail for "The Truth About ${title}". Use a bold focal object, dramatic lighting, and clear negative space for optional text.`,
      rationale: "Frames the video around reveal and stakes.",
      patternKey,
    },
    {
      title: `${title}: What Nobody Shows`,
      prompt: hasSourceThumbnail
        ? `Edit the provided thumbnail for "${title}: What Nobody Shows". Keep the main image recognizable as the same thumbnail and avoid introducing unrelated objects, locations, or storylines.`
        : `Create a high-CTR YouTube thumbnail for "${title}: What Nobody Shows". Make the hidden contrast obvious with a strong focal point, readable composition, and polished creator-style lighting.`,
      rationale: "Adds a curiosity gap while preserving the original topic.",
      patternKey,
    },
  ].slice(0, 3);
}

export async function scoreThumbnailCtrOnServer(options: { imageUrl: string; title?: string }): Promise<CtrEstimate> {
  const title = options.title?.trim() || "Untitled video";
  const analysis = await analyzeImageOnServer(
    options.imageUrl,
    [
      "Analyze this YouTube thumbnail for estimated click performance.",
      `Video title or working title: ${title}`,
      buildTopChannelPatternPrior(title),
      "Return ONLY JSON with this shape:",
      "{",
      '  "score": number from 0 to 100,',
      '  "performanceLabel": "Weak" | "Needs work" | "Promising" | "Strong" | "Excellent",',
      '  "factors": [',
      '    {"key":"faces","label":"Faces","score":number,"detail":"face count, prominence, expression intensity"},',
      '    {"key":"contrast","label":"Contrast","score":number,"detail":"contrast and color separation"},',
      '    {"key":"composition","label":"Composition","score":number,"detail":"focal clarity, layout, balance"},',
      '    {"key":"readability","label":"Readability","score":number,"detail":"text or title readability if visible"},',
      '    {"key":"lighting","label":"Lighting","score":number,"detail":"lighting consistency and drama"},',
      '    {"key":"niche_fit","label":"Niche fit","score":number,"detail":"fit between title, subject, and niche expectations"}',
      "  ],",
      '  "recommendations": ["short practical recommendation"],',
      '  "analysis": {"faceCount":number,"faceProminence":"low|medium|high","expressionIntensity":"low|medium|high","gazeAlignment":"low|medium|high","focalClarity":"low|medium|high"}',
      "}",
      "Use estimate language. Do not claim this is actual YouTube CTR.",
    ].join("\n"),
  );

  return normalizeCtrEstimate(analysis);
}

export async function generateOptimizationPackOnServer(options: OptimizationPackOptions) {
  const ai = createGeminiClient();
  const title = options.title.trim();
  const patternKey = options.patternKey ?? null;
  const patternInstruction = patternKey ? GROWTH_PATTERN_PROMPTS[patternKey] : "Use a broadly high-performing YouTube thumbnail layout with clear focal hierarchy.";
  const sourceAnalysis = options.baseImage
    ? await analyzeImageOnServer(
        options.baseImage,
        [
          "Analyze this source YouTube thumbnail. It is the MAIN image that future variants must follow.",
          "Return ONLY JSON with this shape:",
          "{",
          '  "visibleText": ["exact readable text from the thumbnail"],',
          '  "primarySubject": "main person, object, or focal subject",',
          '  "secondarySubjects": ["important visible objects only"],',
          '  "setting": "visible background or environment",',
          '  "composition": "subject placement, crop, text placement, and layout",',
          '  "colorsAndLighting": "dominant colors and lighting style",',
          '  "apparentTopic": "what this thumbnail appears to be about based only on visible evidence",',
          '  "mustPreserve": ["specific elements that should stay recognizable"]',
          "}",
          "Do not invent vehicles, people, places, products, or storylines that are not visible.",
        ].join("\n"),
      ).catch((error) => {
        console.warn("Source thumbnail analysis failed for optimization pack.", getErrorMessage(error));
        return null;
      })
    : null;
  const sourceContext = summarizeSourceThumbnailContext(sourceAnalysis);

  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_TEXT_MODEL,
    contents: {
      parts: [
        {
          text: [
            "You are a YouTube packaging strategist.",
            `Working title: ${title}`,
            sourceContext
              ? `SOURCE THUMBNAIL CONTEXT - this is the main image and must be followed:\n${sourceContext}`
              : "No source thumbnail was provided.",
            `Requested archetype: ${patternKey ? GROWTH_PATTERN_LABELS[patternKey] : "Auto"}`,
            patternInstruction,
            buildTopChannelPatternPrior(title),
            "Generate exactly 3 title + thumbnail prompt pairings.",
            "Each title must be concise, high-curiosity, and materially different.",
            sourceContext
              ? "Every title must stay about the same apparent topic as the source thumbnail. If the working title is generic, derive the topic from the source thumbnail context."
              : "Each title must stay aligned with the working title.",
            sourceContext
              ? "Each prompt must be an edit instruction for the provided source thumbnail. Keep the main subject, visible topic, background, composition, crop, and text zones recognizable. Do not introduce unrelated cars, locations, people, props, products, or storylines."
              : "Each prompt must describe the final thumbnail image, not process notes.",
            "Avoid direct references to creator names, copyrighted logos, exact brand assets, or platform UI.",
          ].join("\n"),
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["ideas"],
        properties: {
          ideas: {
            type: Type.ARRAY,
            minItems: 3,
            maxItems: 3,
            items: {
              type: Type.OBJECT,
              required: ["title", "prompt", "rationale"],
              properties: {
                title: { type: Type.STRING },
                prompt: { type: Type.STRING },
                rationale: { type: Type.STRING },
                patternKey: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const ideas = normalizeOptimizationIdeas(parseJsonResponseText(text), title, patternKey, Boolean(options.baseImage));
  const variants: Array<Omit<GrowthVariant, "id" | "experimentId" | "imageUrl"> & { imageDataUrl: string; rationale: string }> = [];

  for (let index = 0; index < ideas.length; index += 1) {
    const idea = ideas[index];
    const prompt = [
      options.baseImage
        ? [
            "The provided thumbnail is the MAIN canvas and source of truth.",
            sourceContext ? `Source thumbnail context:\n${sourceContext}` : undefined,
            `Variant title: ${idea.title}`,
            idea.prompt,
            idea.patternKey ? GROWTH_PATTERN_PROMPTS[idea.patternKey] : undefined,
            buildTopChannelPatternPrior(idea.title),
            "Make this a conservative packaging variant of the same thumbnail. Preserve the same apparent topic, main subject identity, subject placement, camera crop, background, composition, and 16:9 framing.",
            "Do not add unrelated cars, locations, people, objects, products, logos, or new storylines. Do not rebuild the thumbnail from scratch.",
            "Only improve what supports the same main idea: title wording area, contrast, color grading, lighting polish, clarity, and focal hierarchy.",
          ].filter(Boolean).join("\n\n")
        : "Create a polished 16:9 YouTube thumbnail from scratch.",
      !options.baseImage ? idea.prompt : undefined,
      !options.baseImage && idea.patternKey ? GROWTH_PATTERN_PROMPTS[idea.patternKey] : undefined,
      !options.baseImage ? buildTopChannelPatternPrior(idea.title) : undefined,
    ].filter(Boolean).join("\n\n");

    const [imageDataUrl] = await generateImagesOnServer({
      prompt,
      baseImage: options.baseImage,
      referenceImage: options.baseImage,
      referenceImagePurpose: options.baseImage ? "subject" : undefined,
      imageSize: "1K",
      aspectRatio: "16:9",
      intent: options.baseImage ? "edit" : "create",
      allowVisibleText: promptRequestsVisibleText(prompt) || promptRequestsVisibleText(idea.title),
      instructions: options.baseImage
        ? "Follow the main/source thumbnail closely. This is an image variation task, not a new concept generation task."
        : undefined,
      model: DEFAULT_GEMINI_IMAGE_MODEL,
    });

    const ctrEstimate = await scoreThumbnailCtrOnServer({ imageUrl: imageDataUrl, title: idea.title });

    variants.push({
      title: idea.title,
      prompt,
      imageDataUrl,
      ctrEstimate,
      mockMetrics: buildMockMetrics(ctrEstimate.score, index),
      metricsSource: "mock",
      externalVideoId: null,
      patternKey: idea.patternKey,
      status: "draft",
      rationale: idea.rationale,
    });
  }

  return variants;
}

export async function optimizeFaceOnServer(options: GrowthImageEditOptions) {
  const prompt = [
    "Identity-safe face polish pass for a YouTube thumbnail.",
    "Keep the exact person from the source thumbnail. Preserve identity, age, skin tone, face shape, eye shape, nose, mouth, teeth, facial hair, hairline, hairstyle, and expression.",
    "Do not change facial geometry, smile shape, gaze direction, head size, head angle, crop, body, clothing, background, or overall composition.",
    "Only make subtle non-destructive thumbnail polish: slightly brighten the face if needed, add natural catchlights, reduce harsh shadows, improve local sharpness around eyes, and match the existing scene lighting.",
    "Avoid beautification, smoothing, facial reconstruction, a wider smile, different teeth, different eyes, different jawline, or a more generic/model-like face.",
    "If an improvement would alter identity, keep that area unchanged. Do not add logos or unrelated text.",
    options.title ? `Working title: ${options.title}` : undefined,
  ].filter(Boolean).join("\n");

  const [imageDataUrl] = await generateImagesOnServer({
    prompt,
    baseImage: options.baseImage,
    referenceImage: options.baseImage,
    referenceImagePurpose: "subject",
    imageSize: "1K",
    aspectRatio: "16:9",
    intent: "edit",
    allowVisibleText: false,
    instructions:
      "Treat the attached source thumbnail as both the edit canvas and the strict identity reference. This is not a face regeneration task; preserve the face and scene, and apply only subtle retouching-level improvements.",
    model: DEFAULT_GEMINI_IMAGE_MODEL,
  });

  const ctrEstimate = await scoreThumbnailCtrOnServer({ imageUrl: imageDataUrl, title: options.title });
  return { imageDataUrl, ctrEstimate, prompt };
}

export async function applyViralPatternOnServer(options: GrowthImageEditOptions) {
  const patternKey = options.patternKey ?? "high_stakes_challenge";
  const sourceAnalysis = await analyzeImageOnServer(
    options.baseImage,
    [
      "Analyze this source YouTube thumbnail. It is the MAIN image that a viral-pattern edit must follow.",
      "Return ONLY JSON with visibleText, primarySubject, secondarySubjects, setting, composition, colorsAndLighting, apparentTopic, and mustPreserve.",
      "Only describe what is visible. Do not invent unrelated concepts.",
    ].join("\n"),
  ).catch((error) => {
    console.warn("Source thumbnail analysis failed for viral pattern.", getErrorMessage(error));
    return null;
  });
  const sourceContext = summarizeSourceThumbnailContext(sourceAnalysis);
  const prompt = [
    "The provided thumbnail is the MAIN canvas and must stay recognizable.",
    sourceContext ? `Source thumbnail context:\n${sourceContext}` : undefined,
    GROWTH_PATTERN_PROMPTS[patternKey],
    buildTopChannelPatternPrior(options.title || GROWTH_PATTERN_LABELS[patternKey]),
    "Apply this archetype only as a styling and packaging layer on the provided thumbnail. Preserve the same apparent topic, main subject identity, subject placement, background, crop, text zones, and 16:9 canvas.",
    "Do not introduce unrelated vehicles, locations, people, props, products, logos, or storylines. Do not rebuild the thumbnail from scratch.",
    "Do not copy any specific creator brand, logo, exact title treatment, or proprietary asset.",
    options.title ? `Working title: ${options.title}` : undefined,
  ].filter(Boolean).join("\n\n");

  const [imageDataUrl] = await generateImagesOnServer({
    prompt,
    baseImage: options.baseImage,
    referenceImage: options.baseImage,
    referenceImagePurpose: "subject",
    imageSize: "1K",
    aspectRatio: "16:9",
    intent: "edit",
    allowVisibleText: promptRequestsVisibleText(options.title || ""),
    instructions: "Follow the main/source thumbnail closely. This is a same-thumbnail pattern variation, not a new scene generation task.",
    model: DEFAULT_GEMINI_IMAGE_MODEL,
  });

  const ctrEstimate = await scoreThumbnailCtrOnServer({ imageUrl: imageDataUrl, title: options.title });
  return { imageDataUrl, ctrEstimate, prompt, patternKey };
}

function normalizeRecommendedCategory(value: unknown) {
  if (typeof value !== "string") {
    return "other";
  }

  const normalized = value.trim().toLowerCase();
  return IDEA_CATEGORY_IDS.includes(normalized as (typeof IDEA_CATEGORY_IDS)[number]) ? normalized : "other";
}

function normalizeIdeaText(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim();
}

function normalizeIdeasPayload(payload: unknown): ThumbnailIdeasResponse {
  const parsed = payload && typeof payload === "object" ? (payload as Partial<ThumbnailIdeasResponse>) : {};
  const ideasSource = Array.isArray(parsed.ideas) ? parsed.ideas : [];
  const ideas = ideasSource
    .map((idea, index) => {
      const nextIdea = idea && typeof idea === "object"
        ? (idea as unknown as Partial<Record<keyof ThumbnailIdea, unknown>>)
        : {};
      const labelFallback = `Direction ${index + 1}`;

      return {
        label: normalizeIdeaText(nextIdea.label, labelFallback),
        hook: normalizeIdeaText(nextIdea.hook, "Clearer CTR hook."),
        titleAngle: normalizeIdeaText(nextIdea.titleAngle, "Refine the title angle before generating."),
        visualDirection: normalizeIdeaText(nextIdea.visualDirection, "Keep the layout simple and subject-led."),
        prompt: normalizeIdeaText(nextIdea.prompt, "Create a clean, clickable YouTube thumbnail based on this concept."),
      };
    })
    .slice(0, 4);

  return {
    summary: normalizeIdeaText(parsed.summary, "Here are a few thumbnail directions you can take into the studio."),
    recommendedCategory: normalizeRecommendedCategory(parsed.recommendedCategory),
    ideas:
      ideas.length > 0
        ? ideas
        : [
            {
              label: "Default Direction",
              hook: "Push the clearest promise first.",
              titleAngle: "Use the strongest payoff from the topic.",
              visualDirection: "Keep the subject large, the framing simple, and the contrast obvious.",
              prompt: "Create a clean, clickable YouTube thumbnail with a strong focal subject, clear hierarchy, and a polished creator-style finish.",
            },
          ],
  };
}

export async function generateThumbnailIdeasOnServer(options: ThumbnailIdeasOptions): Promise<ThumbnailIdeasResponse> {
  const ai = createGeminiClient();
  const topic = options.topic.trim();

  if (!topic) {
    throw new Error("topic is required.");
  }

  const category = normalizeRecommendedCategory(options.category);
  const goal = options.goal?.trim() || "higher click-through rate";
  const visualVibe = options.visualVibe?.trim() || "clean and modern";
  const startMode = options.startMode === "sketch" ? "sketch" : "blank";
  const parts: Array<Record<string, unknown>> = [];

  if (options.referenceImage?.startsWith("data:image/")) {
    const base64Data = options.referenceImage.split(",")[1];
    const mimeType = options.referenceImage.split(";")[0]?.split(":")[1] || "image/png";

    parts.push({
      inlineData: { data: base64Data, mimeType },
    });
    parts.push({
      text:
        "The attached image is a rough sketch or visual reference. Use it only to infer composition or energy. Do not describe it as the final image output.",
    });
  }

  parts.push({
    text: [
      "You are a YouTube thumbnail ideation assistant.",
      `Topic or working title: ${topic}`,
      `Current category hint: ${category}`,
      `Primary goal: ${goal}`,
      `Visual vibe: ${visualVibe}`,
      `Starting mode: ${startMode}`,
      `Allowed categories: ${IDEA_CATEGORY_IDS.join(", ")}`,
      buildTopChannelPatternPrior(topic),
      "Return a compact idea pack for a creator who wants to move directly into thumbnail generation.",
      "Each idea must feel distinct, practical, and ready to use as a generation prompt.",
      "Prompts must describe the final thumbnail direction, not the brainstorming process.",
      "Avoid mentioning colors that are not necessary. Do not mention UI, dashboards, or software chrome.",
    ].join("\n"),
  });

  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_TEXT_MODEL,
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["summary", "recommendedCategory", "ideas"],
        properties: {
          summary: {
            type: Type.STRING,
          },
          recommendedCategory: {
            type: Type.STRING,
          },
          ideas: {
            type: Type.ARRAY,
            minItems: 3,
            maxItems: 4,
            items: {
              type: Type.OBJECT,
              required: ["label", "hook", "titleAngle", "visualDirection", "prompt"],
              properties: {
                label: {
                  type: Type.STRING,
                },
                hook: {
                  type: Type.STRING,
                },
                titleAngle: {
                  type: Type.STRING,
                },
                visualDirection: {
                  type: Type.STRING,
                },
                prompt: {
                  type: Type.STRING,
                },
              },
            },
          },
        },
      },
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return normalizeIdeasPayload(parseJsonResponseText(text));
}

function assertSafeImageUrl(url: string) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Invalid image URL."); }
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Only http/https image URLs are allowed.");
  const hostname = parsed.hostname.toLowerCase();
  
  if (
    hostname === "localhost" || hostname.endsWith(".localhost") ||
    /^127\./.test(hostname) || /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^192\.168\./.test(hostname) || /^169\.254\./.test(hostname) ||
    hostname === "::1" || hostname === "[::1]"
  ) throw new Error("Image URL points to a private/internal host.");
  return url;
}

function normalizeGeneratedThumbnailTitle(value: string, fallback = "High-Impact Thumbnail") {
  const normalized = value
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .find(Boolean)
    ?.replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 80 ? `${normalized.slice(0, 77).trim()}...` : normalized;
}

export async function generateViralTitleFromImage(
  imageUrl: string,
  options: { currentTitle?: string; prompt?: string } = {},
) {
  const ai = createGeminiClient();
  
  let base64Data: string;
  let mimeType: string;

  if (imageUrl.startsWith("data:image/")) {
    base64Data = imageUrl.split(",")[1];
    mimeType = imageUrl.split(";")[0]?.split(":")[1] || "image/png";
  } else {
    const imageResponse = await fetch(assertSafeImageUrl(imageUrl));
    const blob = await imageResponse.blob();
    const buffer = await blob.arrayBuffer();
    base64Data = Buffer.from(buffer).toString("base64");
    mimeType = blob.type;
  }

  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_TEXT_MODEL,
    contents: {
      parts: [
        {
          inlineData: { data: base64Data, mimeType },
        },
        {
          text: `Act as a Viral YouTube Growth Expert and Thumbnail Consultant. 
          Analyze this thumbnail image and generate ONE high-CTR, catchy, and curiosity-gap driven YouTube title (max 8 words).

          Current title, if useful: ${options.currentTitle?.trim() || "None"}
          Current edit prompt, if useful: ${options.prompt?.trim() || "None"}

          ${buildTopChannelPatternPrior()}
          
          Follow these viral patterns:
          - Use stakes ("The Truth About...", "Why 99% Fail...")
          - Use curiosity ("I tried...", "The Secret to...")
          - Be punchy and direct.
          - Do not return generic tool labels like "Inserted Person", "Upscale 4K", "Polish / Enhance", "Remove Background", or "Blank Canvas".
          
          Return ONLY the plain text title, no quotes, no explanations.`,
        },
      ],
    },
  });

  return normalizeGeneratedThumbnailTitle(
    response.candidates?.[0]?.content?.parts?.[0]?.text || "",
    "Amazing YouTube Thumbnail",
  );
}

export async function analyzeImageOnServer(imageUrl: string, customPrompt?: string) {
  const ai = createGeminiClient();
  
  let base64Data: string;
  let mimeType: string;

  if (imageUrl.startsWith("data:image/")) {
    base64Data = imageUrl.split(",")[1];
    mimeType = imageUrl.split(";")[0]?.split(":")[1] || "image/png";
  } else {
    const imageResponse = await fetch(assertSafeImageUrl(imageUrl));
    const blob = await imageResponse.blob();
    const buffer = await blob.arrayBuffer();
    base64Data = Buffer.from(buffer).toString("base64");
    mimeType = blob.type;
  }

  const defaultPrompt = "Analyze this YouTube thumbnail. Extract its style, color palette, composition, and key visual elements. Return a JSON object with color_palette, composition, lighting, and vibe. Return ONLY the JSON object, no markdown code blocks.";
  
  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_TEXT_MODEL,
    contents: {
      parts: [
        {
          inlineData: { data: base64Data, mimeType },
        },
        {
          text: customPrompt || defaultPrompt,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    return parseJsonResponseText(text);
  } catch (e) {
    // If it's not JSON, but we expect a title (like from the admin panel), wrap it
    if (customPrompt?.toLowerCase().includes("title")) {
      return { title: text.trim().replace(/^"|"$/g, '') };
    }
    
    return {
      color_palette: ["#000000", "#ffffff"],
      composition: "Unknown",
      lighting: "Standard",
      vibe: "Clean",
      raw_text: text
    };
  }
}
