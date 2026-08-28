import type { ThumbnailIdea, ThumbnailIdeasResponse } from "../server/types";
import {
  getTemplateCategoryLabel,
  normalizeTemplateCategory,
  type TemplateCategory,
} from "./studioMetadata";
import type { IdeaAssistantHandoffMode } from "./ideaAssistant";

export const STUDIO_EDITOR_DRAFT_KIND = "studio_editor_project";
export const STUDIO_EDITOR_DRAFT_VERSION = 1;
export const IDEA_ASSISTANT_DRAFT_KIND = "idea_assistant_session";
export const IDEA_ASSISTANT_DRAFT_VERSION = 1;
export const ARCHIVE_STATE_DRAFT_TITLE = "__studio_archive_state__";
export const ARCHIVE_STATE_DRAFT_KIND = "studio_archive_state";
export const STUDIO_OUTPUT_FORMAT_IDS = ["youtube", "tiktok", "instagram-reel", "instagram-square"] as const;
export const DEFAULT_STUDIO_OUTPUT_FORMAT_ID = "youtube";

export type StudioOutputFormatId = (typeof STUDIO_OUTPUT_FORMAT_IDS)[number];

export function normalizeStudioOutputFormatId(value: unknown): StudioOutputFormatId {
  return typeof value === "string" && STUDIO_OUTPUT_FORMAT_IDS.includes(value as StudioOutputFormatId)
    ? value as StudioOutputFormatId
    : DEFAULT_STUDIO_OUTPUT_FORMAT_ID;
}

export type StudioDraftAgentMemoryEntry = {
  role: "user" | "model";
  text: string;
};

export type StudioDraftClarificationData = {
  status: "ready" | "needs_clarification";
  question: string;
  optimizedPrompt: string;
  source: "brain" | "assistant";
};

export type StudioDraftHistoryItem = {
  url: string | null;
  title?: string | null;
  prompt: string;
  formatId?: StudioOutputFormatId;
  isPlaceholder?: boolean;
  generationId?: string;
  assetReference?: string | null;
  preserveFullSourceFrame?: boolean;
  sourceType?: "youtube" | null;
  sourceId?: string | null;
  sourceTitle?: string | null;
};

export type StudioEditorDraftData = {
  kind: typeof STUDIO_EDITOR_DRAFT_KIND;
  version: typeof STUDIO_EDITOR_DRAFT_VERSION;
  title: string | null;
  history: StudioDraftHistoryItem[];
  currentFrameIndex: number;
  promptDraft: string;
  agentMemory: StudioDraftAgentMemoryEntry[];
  clarificationData: StudioDraftClarificationData | null;
  isBrainModeEnabled: boolean;
  attachmentAssetReference: string | null;
  ownedAssetReferences: string[];
};

export type StudioEditorDraftRecord = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  data: StudioEditorDraftData;
};

export type IdeaAssistantDraftBrief = {
  topic: string;
  category: TemplateCategory;
  goal: string;
  visualVibe: string;
  startMode: IdeaAssistantHandoffMode;
  hasReference: boolean;
};

export type IdeaAssistantDraftData = {
  kind: typeof IDEA_ASSISTANT_DRAFT_KIND;
  version: typeof IDEA_ASSISTANT_DRAFT_VERSION;
  title: string | null;
  topic: string;
  category: TemplateCategory;
  goal: string;
  visualVibe: string;
  startMode: IdeaAssistantHandoffMode;
  submittedBrief: IdeaAssistantDraftBrief | null;
  response: ThumbnailIdeasResponse | null;
  selectedIdeaLabel: string | null;
  referenceImageAssetReference: string | null;
  referenceImageName: string | null;
  ownedAssetReferences: string[];
};

export type IdeaAssistantDraftRecord = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  data: IdeaAssistantDraftData;
};

export type AppDraftRecord = StudioEditorDraftRecord | IdeaAssistantDraftRecord;

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function normalizeHistoryItem(value: unknown): StudioDraftHistoryItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const prompt =
    typeof candidate.prompt === "string" && candidate.prompt.trim() ? candidate.prompt : "Untitled thumbnail";

  return {
    url: typeof candidate.url === "string" ? candidate.url : null,
    title: normalizeString(candidate.title),
    prompt,
    formatId: normalizeStudioOutputFormatId(candidate.formatId),
    isPlaceholder: candidate.isPlaceholder === true,
    generationId: typeof candidate.generationId === "string" ? candidate.generationId : undefined,
    assetReference: typeof candidate.assetReference === "string" ? candidate.assetReference : null,
    preserveFullSourceFrame: candidate.preserveFullSourceFrame === true,
    sourceType: candidate.sourceType === "youtube" ? "youtube" : null,
    sourceId: typeof candidate.sourceId === "string" ? candidate.sourceId : null,
    sourceTitle: normalizeString(candidate.sourceTitle),
  };
}

function normalizeAgentMemory(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Record<string, unknown>;
    if ((candidate.role !== "user" && candidate.role !== "model") || typeof candidate.text !== "string") {
      return [];
    }

    return [{ role: candidate.role, text: candidate.text } satisfies StudioDraftAgentMemoryEntry];
  });
}

function normalizeClarificationData(value: unknown): StudioDraftClarificationData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    (candidate.status !== "ready" && candidate.status !== "needs_clarification") ||
    (candidate.source !== "brain" && candidate.source !== "assistant") ||
    typeof candidate.question !== "string" ||
    typeof candidate.optimizedPrompt !== "string"
  ) {
    return null;
  }

  return {
    status: candidate.status,
    question: candidate.question,
    optimizedPrompt: candidate.optimizedPrompt,
    source: candidate.source,
  };
}

function normalizeIdeaAssistantDraftBrief(value: unknown): IdeaAssistantDraftBrief | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const topic = normalizeString(candidate.topic);
  const goal = normalizeString(candidate.goal);
  const visualVibe = normalizeString(candidate.visualVibe);

  if (!topic || !goal || !visualVibe) {
    return null;
  }

  return {
    topic,
    category: normalizeTemplateCategory(typeof candidate.category === "string" ? candidate.category : undefined),
    goal,
    visualVibe,
    startMode: candidate.startMode === "sketch" ? "sketch" : "blank",
    hasReference: candidate.hasReference === true,
  };
}

function normalizeThumbnailIdea(value: unknown): ThumbnailIdea | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.label !== "string" ||
    typeof candidate.hook !== "string" ||
    typeof candidate.titleAngle !== "string" ||
    typeof candidate.visualDirection !== "string" ||
    typeof candidate.prompt !== "string"
  ) {
    return null;
  }

  return {
    label: candidate.label,
    hook: candidate.hook,
    titleAngle: candidate.titleAngle,
    visualDirection: candidate.visualDirection,
    prompt: candidate.prompt,
  };
}

function normalizeThumbnailIdeasResponse(value: unknown): ThumbnailIdeasResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.summary !== "string") {
    return null;
  }

  const normalizedIdeas = Array.isArray(candidate.ideas)
    ? candidate.ideas.map(normalizeThumbnailIdea).filter((entry): entry is ThumbnailIdea => Boolean(entry))
    : [];

  if (normalizedIdeas.length === 0) {
    return null;
  }

  return {
    summary: candidate.summary,
    recommendedCategory: normalizeTemplateCategory(
      typeof candidate.recommendedCategory === "string" ? candidate.recommendedCategory : undefined,
    ),
    ideas: normalizedIdeas,
  };
}

export function isStudioEditorDraftData(value: unknown): value is StudioEditorDraftData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.kind === STUDIO_EDITOR_DRAFT_KIND && candidate.version === STUDIO_EDITOR_DRAFT_VERSION;
}

export function isIdeaAssistantDraftData(value: unknown): value is IdeaAssistantDraftData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.kind === IDEA_ASSISTANT_DRAFT_KIND && candidate.version === IDEA_ASSISTANT_DRAFT_VERSION;
}

export function normalizeStudioEditorDraftRecord(row: any): StudioEditorDraftRecord | null {
  if (!row || typeof row !== "object" || !isStudioEditorDraftData(row.data)) {
    return null;
  }

  const history = Array.isArray(row.data.history)
    ? row.data.history.map(normalizeHistoryItem).filter((entry): entry is StudioDraftHistoryItem => Boolean(entry))
    : [];

  return {
    id: typeof row.id === "string" ? row.id : "",
    title: normalizeString(row.title) ?? normalizeString(row.data.title),
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updatedAt:
      typeof row.updated_at === "string"
        ? row.updated_at
        : typeof row.created_at === "string"
          ? row.created_at
          : new Date().toISOString(),
    data: {
      kind: STUDIO_EDITOR_DRAFT_KIND,
      version: STUDIO_EDITOR_DRAFT_VERSION,
      title: normalizeString(row.data.title),
      history,
      currentFrameIndex:
        typeof row.data.currentFrameIndex === "number" && Number.isFinite(row.data.currentFrameIndex)
          ? Math.max(0, Math.floor(row.data.currentFrameIndex))
          : 0,
      promptDraft: typeof row.data.promptDraft === "string" ? row.data.promptDraft : "",
      agentMemory: normalizeAgentMemory(row.data.agentMemory),
      clarificationData: normalizeClarificationData(row.data.clarificationData),
      isBrainModeEnabled: row.data.isBrainModeEnabled === true,
      attachmentAssetReference:
        typeof row.data.attachmentAssetReference === "string" ? row.data.attachmentAssetReference : null,
      ownedAssetReferences: Array.isArray(row.data.ownedAssetReferences)
        ? row.data.ownedAssetReferences.filter((entry: unknown): entry is string => typeof entry === "string")
        : [],
    },
  };
}

export function normalizeIdeaAssistantDraftRecord(row: any): IdeaAssistantDraftRecord | null {
  if (!row || typeof row !== "object" || !isIdeaAssistantDraftData(row.data)) {
    return null;
  }

  const submittedBrief = normalizeIdeaAssistantDraftBrief(row.data.submittedBrief);
  const topic = normalizeString(row.data.topic) ?? submittedBrief?.topic ?? "";
  const category = normalizeTemplateCategory(
    typeof row.data.category === "string" ? row.data.category : submittedBrief?.category,
  );
  const goal = normalizeString(row.data.goal) ?? submittedBrief?.goal ?? "Higher CTR";
  const visualVibe = normalizeString(row.data.visualVibe) ?? submittedBrief?.visualVibe ?? "Clean and modern";
  const startMode =
    row.data.startMode === "sketch" || submittedBrief?.startMode === "sketch" ? "sketch" : "blank";

  return {
    id: typeof row.id === "string" ? row.id : "",
    title: normalizeString(row.title) ?? normalizeString(row.data.title),
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updatedAt:
      typeof row.updated_at === "string"
        ? row.updated_at
        : typeof row.created_at === "string"
          ? row.created_at
          : new Date().toISOString(),
    data: {
      kind: IDEA_ASSISTANT_DRAFT_KIND,
      version: IDEA_ASSISTANT_DRAFT_VERSION,
      title: normalizeString(row.data.title),
      topic,
      category,
      goal,
      visualVibe,
      startMode,
      submittedBrief:
        submittedBrief ??
        (topic
          ? {
              topic,
              category,
              goal,
              visualVibe,
              startMode,
              hasReference: typeof row.data.referenceImageAssetReference === "string",
            }
          : null),
      response: normalizeThumbnailIdeasResponse(row.data.response),
      selectedIdeaLabel: normalizeString(row.data.selectedIdeaLabel),
      referenceImageAssetReference:
        typeof row.data.referenceImageAssetReference === "string" ? row.data.referenceImageAssetReference : null,
      referenceImageName: normalizeString(row.data.referenceImageName),
      ownedAssetReferences: normalizeStringArray(row.data.ownedAssetReferences),
    },
  };
}

export function normalizeAppDraftRecord(row: any): AppDraftRecord | null {
  return normalizeStudioEditorDraftRecord(row) ?? normalizeIdeaAssistantDraftRecord(row);
}

export function isIdeaAssistantDraftRecord(value: AppDraftRecord): value is IdeaAssistantDraftRecord {
  return value.data.kind === IDEA_ASSISTANT_DRAFT_KIND;
}

export function getIdeaAssistantDraftTitle(value: {
  title?: string | null;
  data?: Pick<IdeaAssistantDraftData, "title" | "selectedIdeaLabel" | "topic" | "category"> | null;
}) {
  return (
    normalizeString(value.title) ??
    normalizeString(value.data?.title) ??
    normalizeString(value.data?.selectedIdeaLabel) ??
    normalizeString(value.data?.topic) ??
    `${getTemplateCategoryLabel(value.data?.category)} idea session`
  );
}

export function getStudioDraftTitle(value: {
  title?: string | null;
  data?: Pick<StudioEditorDraftData, "title" | "history" | "currentFrameIndex"> | null;
}) {
  const directTitle = normalizeString(value.title) ?? normalizeString(value.data?.title);
  if (directTitle) {
    return directTitle;
  }

  const history = Array.isArray(value.data?.history) ? value.data.history : [];
  const currentFrame = history[value.data?.currentFrameIndex ?? 0] ?? history[0];
  return (
    normalizeString(currentFrame?.title) ??
    normalizeString(currentFrame?.sourceTitle) ??
    normalizeString(currentFrame?.prompt) ??
    "Untitled draft"
  );
}

export function getStudioDraftPreviewReference(data: Pick<StudioEditorDraftData, "history" | "currentFrameIndex">) {
  const history = Array.isArray(data.history) ? data.history : [];
  const currentFrame = history[data.currentFrameIndex] ?? history[0];

  const previewCandidate =
    currentFrame?.assetReference ??
    currentFrame?.url ??
    history.find((item) => item.assetReference || item.url)?.assetReference ??
    history.find((item) => item.assetReference || item.url)?.url;

  return typeof previewCandidate === "string" && previewCandidate ? previewCandidate : null;
}

export function getIdeaAssistantDraftPreviewReference(
  data: Pick<IdeaAssistantDraftData, "referenceImageAssetReference">,
) {
  return normalizeString(data.referenceImageAssetReference);
}
