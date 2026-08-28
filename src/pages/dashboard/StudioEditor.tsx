import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { 
  Image as ImageIcon, Layers, Puzzle, Play, Save, 
  Brush, Grid, ScanFace, Clapperboard, Stamp, Plus, Download, ImagePlus,
  ChevronDown, ArrowUp, Eye, Loader2, X, MoreHorizontal, Trash2, Edit2, Eraser, Minus, Youtube,
  Maximize2, Sparkles, Paperclip, Scissors, Brain, Check, BarChart3, Gauge, Target, Trophy, TrendingUp, WandSparkles, PenTool, Copy, Search,
  Instagram, Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBilling, type BillingSnapshot } from "../../context/BillingContext";
import { useStudioGeneration } from "../../context/StudioGenerationContext";
import { useToast } from "../../context/ToastContext";
import { ApiError, apiFetch } from "../../lib/apiClient";
import { cn } from "../../lib/utils";
import { isPaidPlan } from "../../lib/billingPlans";
import {
  FALLBACK_GEMINI_IMAGE_MODELS,
  GenerationIntent,
  GeminiImageModelOption,
  applyViralPattern,
  generateAutoThumbnailTitle,
  generateThumbnails,
  generateOptimizationPack,
  optimizeThumbnailFace,
  clarifyPrompt,
  listGeminiImageModels,
  NANO_BANANA_2_MODEL,
  DEFAULT_GEMINI_IMAGE_MODEL,
  promptIsBackgroundOnlyRequest,
  promptRequestsVisibleText,
  resolveGeminiImageModelId,
  scoreThumbnailCtr,
} from "../../services/geminiService";
import {
  downloadFileFromUrl,
  deleteUserAsset,
  getPublicImagePreviewUrl,
  getUserAssetPath,
  getUserAssetPreviewUrl,
  listTemplates,
  TemplateAsset,
  uploadUserBase64Image,
} from "../../services/storageService";
import { supabase } from "../../lib/supabase";
import StudioToolsModal from "../../components/StudioToolsModal";
import AssetsModal from "../../components/AssetsModal";
import { consumeIdeaAssistantHandoff } from "../../lib/ideaAssistant";
import {
  buildCreatorToolEditorUrl,
  buildIdeaAssistantUrl,
  buildYoutubeImportUrl,
  getCreatorTool,
} from "../../lib/studioMetadata";
import {
  STUDIO_EDITOR_DRAFT_KIND,
  STUDIO_EDITOR_DRAFT_VERSION,
  DEFAULT_STUDIO_OUTPUT_FORMAT_ID,
  normalizeStudioOutputFormatId,
  normalizeStudioEditorDraftRecord,
  type StudioDraftAgentMemoryEntry,
  type StudioDraftClarificationData,
  type StudioDraftHistoryItem,
  type StudioEditorDraftData,
  type StudioEditorDraftRecord,
  type StudioOutputFormatId,
} from "../../lib/studioDrafts";
import type { CtrEstimate, GrowthExperiment, GrowthPatternKey, GrowthVariant } from "../../server/types";

type EditorState = 'start' | 'editing';
type AgentMemoryEntry = StudioDraftAgentMemoryEntry;
type ClarificationData = StudioDraftClarificationData;

const MODEL_STORAGE_KEY = "thumora-ai:selected-gemini-model";
const AGENT_MEMORY_STORAGE_KEY = "thumzo:agent-memory";
const CONVERSATIONAL_PROMPT_PATTERNS = [
  /^(hi|hello|hey|yo|sup|what'?s up|salam|salaam)\b/i,
  /\b(thanks|thank you|thx)\b/i,
  /\b(help|can you help|what can you do|how does this work|who are you)\b/i,
];
const GENERIC_EDIT_PROMPT_PATTERNS = [
  /\b(make|edit|change|fix|improve|enhance|polish|upgrade|clean up)\b/i,
  /\bbetter\b/i,
  /\bmore viral\b/i,
  /\bcooler\b/i,
  /\bstronger\b/i,
];
const ACTIONABLE_PROMPT_PATTERNS = [
  /\bthumbnail\b/i,
  /\byoutube\b/i,
  /\btiktok\b/i,
  /\binstagram\b/i,
  /\breel\b/i,
  /\bstory\b/i,
  /\bbackground\b/i,
  /\bbg\b/i,
  /\bheadline\b/i,
  /\btitle\b/i,
  /\btext\b/i,
  /\bcaption\b/i,
  /\bremove\b/i,
  /\badd\b/i,
  /\breplace\b/i,
  /\bmake\b/i,
  /\bedit\b/i,
  /\bchange\b/i,
  /\bcreate\b/i,
  /\bgenerate\b/i,
  /\bdesign\b/i,
  /\bposter\b/i,
  /\bbanner\b/i,
  /\bcover\b/i,
  /\bface\b/i,
  /\bsubject\b/i,
  /\bphoto\b/i,
  /\bimage\b/i,
  /\bscene\b/i,
  /\bbright(?:er|ness)?\b/i,
  /\bdark(?:er|en)?\b/i,
  /\bcontrast\b/i,
  /\bcolor\b/i,
  /\bstyle\b/i,
  /\btemplate\b/i,
];
const OPTIMIZER_TABS = ["score", "titles", "ab", "face", "patterns"] as const;
type OptimizerTab = (typeof OPTIMIZER_TABS)[number];
type StudioPreviewMode = "image" | StudioOutputFormatId;
type StudioTargetPlatform = "youtube" | "tiktok" | "instagram";
type StudioOutputAspectRatio = "16:9" | "9:16" | "1:1";

type StudioOutputFormatOption = {
  id: StudioOutputFormatId;
  label: string;
  shortLabel: string;
  platformLabel: string;
  targetPlatform: StudioTargetPlatform;
  aspectRatio: StudioOutputAspectRatio;
  canvasWidth: number;
  canvasHeight: number;
  dimensions: string;
  promptLabel: string;
  description: string;
  Icon: LucideIcon;
};

const STUDIO_OUTPUT_FORMATS: StudioOutputFormatOption[] = [
  {
    id: "youtube",
    label: "YouTube Thumbnail",
    shortLabel: "YouTube",
    platformLabel: "YouTube",
    targetPlatform: "youtube",
    aspectRatio: "16:9",
    canvasWidth: 1280,
    canvasHeight: 720,
    dimensions: "1280 x 720",
    promptLabel: "YouTube 16:9 thumbnail",
    description: "Wide cover for video feeds and search.",
    Icon: Youtube,
  },
  {
    id: "tiktok",
    label: "TikTok Cover",
    shortLabel: "TikTok",
    platformLabel: "TikTok",
    targetPlatform: "tiktok",
    aspectRatio: "9:16",
    canvasWidth: 1080,
    canvasHeight: 1920,
    dimensions: "1080 x 1920",
    promptLabel: "TikTok 9:16 cover thumbnail",
    description: "Vertical cover for profile grids and clips.",
    Icon: Smartphone,
  },
  {
    id: "instagram-reel",
    label: "Instagram Reel",
    shortLabel: "Reel",
    platformLabel: "Instagram",
    targetPlatform: "instagram",
    aspectRatio: "9:16",
    canvasWidth: 1080,
    canvasHeight: 1920,
    dimensions: "1080 x 1920",
    promptLabel: "Instagram Reels 9:16 cover thumbnail",
    description: "Vertical cover for Reels and Stories.",
    Icon: Instagram,
  },
  {
    id: "instagram-square",
    label: "Instagram Square",
    shortLabel: "Square",
    platformLabel: "Instagram",
    targetPlatform: "instagram",
    aspectRatio: "1:1",
    canvasWidth: 1080,
    canvasHeight: 1080,
    dimensions: "1080 x 1080",
    promptLabel: "Instagram square feed thumbnail",
    description: "Square cover for feed and profile grids.",
    Icon: Instagram,
  },
];

function getStudioOutputFormat(formatId?: StudioOutputFormatId | null) {
  return (
    STUDIO_OUTPUT_FORMATS.find((format) => format.id === normalizeStudioOutputFormatId(formatId)) ??
    STUDIO_OUTPUT_FORMATS[0]
  );
}

function getOutputAspectClass(formatId?: StudioOutputFormatId | null) {
  const format = getStudioOutputFormat(formatId);

  if (format.aspectRatio === "9:16") {
    return "aspect-[9/16]";
  }

  if (format.aspectRatio === "1:1") {
    return "aspect-square";
  }

  return "aspect-video";
}

const GROWTH_PATTERN_OPTIONS: Array<{ key: GrowthPatternKey; label: string; description: string }> = [
  {
    key: "high_stakes_challenge",
    label: "High-Stakes Challenge",
    description: "Oversized emotion, obvious stakes, and clean focal tension.",
  },
  {
    key: "ai_authority",
    label: "AI Authority",
    description: "Crisp tech cues, expert framing, and confident visual hierarchy.",
  },
  {
    key: "finance_signal",
    label: "Finance Signal",
    description: "Money/chart signal, trusted contrast, and high-value clarity.",
  },
];

function normalizePromptForAssistantCheck(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function shouldUseAssistantGuard(prompt: string, hasBaseImage: boolean) {
  const normalizedPrompt = normalizePromptForAssistantCheck(prompt);

  if (!normalizedPrompt) {
    return false;
  }

  if (CONVERSATIONAL_PROMPT_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))) {
    return true;
  }

  if (!hasBaseImage && GENERIC_EDIT_PROMPT_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))) {
    return true;
  }

  const wordCount = normalizedPrompt.split(" ").filter(Boolean).length;
  return wordCount <= 2 && !ACTIONABLE_PROMPT_PATTERNS.some((pattern) => pattern.test(normalizedPrompt));
}


const ProcessingOverlay = () => (
  <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-black/10 backdrop-blur-[1px]">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1s_linear_infinite]" />
    <div className="rounded-full bg-black/60 p-3 shadow-lg backdrop-blur-md border border-white/10">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  </div>
);

function EmptyOptimizerState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-bold text-foreground">{title}</p>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function VariantPreviewImage({ variant }: { variant: GrowthVariant }) {
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState(variant.imageUrl);

  useEffect(() => {
    let cancelled = false;

    async function resolvePreviewUrl() {
      if (!variant.imageUrl) {
        setPreviewUrl("");
        return;
      }

      if (getUserAssetPath(variant.imageUrl, user?.uid)) {
        const signedUrl = await getUserAssetPreviewUrl(variant.imageUrl, user?.uid);
        if (!cancelled) {
          setPreviewUrl(signedUrl);
        }
        return;
      }

      if (!cancelled) {
        setPreviewUrl(getPublicImagePreviewUrl(variant.imageUrl));
      }
    }

    void resolvePreviewUrl();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, variant.imageUrl]);

  return <img src={previewUrl} alt={variant.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />;
}

function VariantList({ variants, onApply }: { variants: GrowthVariant[]; onApply: (variant: GrowthVariant) => Promise<void> }) {
  if (variants.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {variants.map((variant) => (
        <article key={variant.id || variant.imageUrl || variant.title} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-video bg-muted">
            <VariantPreviewImage variant={variant} />
          </div>
          <div className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-bold text-foreground">{variant.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Expected performance: {variant.ctrEstimate.performanceLabel}
                </p>
              </div>
              <span className="rounded-xl bg-foreground px-2.5 py-1 text-sm font-black text-background">
                {variant.ctrEstimate.score}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                <p className="text-[10px] font-bold text-muted-foreground">Impr.</p>
                <p className="text-xs font-bold text-foreground">{variant.mockMetrics.impressions}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                <p className="text-[10px] font-bold text-muted-foreground">Clicks</p>
                <p className="text-xs font-bold text-foreground">{variant.mockMetrics.clicks}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                <p className="text-[10px] font-bold text-muted-foreground">CTR</p>
                <p className="text-xs font-bold text-foreground">{variant.mockMetrics.ctr}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void onApply(variant)}
                className="inline-flex h-9 items-center justify-center rounded-xl bg-foreground text-xs font-bold text-background transition-opacity hover:opacity-90"
              >
                Apply
              </button>
              <button
                type="button"
                disabled
                className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground"
              >
                Saved
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

type StudioEditorProps = {
  forceStartScreen?: boolean;
};

export default function StudioEditor({ forceStartScreen = false }: StudioEditorProps = {}) {
  type HistoryItem = {
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

  type StudioDraftAutosaveState = {
    history: HistoryItem[];
    currentFrameIndex: number;
    title: string | null;
    promptDraft: string;
    agentMemory: AgentMemoryEntry[];
    clarificationData: ClarificationData | null;
    isBrainModeEnabled: boolean;
    attachment: string | null;
    attachmentAssetReference: string | null;
    ownedAssetReferences: string[];
    activeDraftId: string | null;
    signature: string;
  };

  const FULL_FRAME_SOURCE_INSTRUCTION =
    "Keep the entire original source image visible within the target frame. Scale it to fit and do not crop any part of it unless the user explicitly asks for a crop.";
  const GENERIC_HISTORY_TITLES = new Set([
    "blank canvas",
    "uploaded image",
    "template",
    "idea sketch",
    "youtube import",
  ]);

  const { user } = useAuth();
  const { billing, refreshBilling, setBilling } = useBilling();
  const {
    task: studioGenerationTask,
    startGeneration: startBackgroundGeneration,
    completeGeneration: completeBackgroundGeneration,
    failGeneration: failBackgroundGeneration,
    clearGeneration: clearBackgroundGeneration,
  } = useStudioGeneration();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeToolPreset = getCreatorTool(searchParams.get("tool"));
  const [editorState, setEditorState] = useState<EditorState>('start');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<GeminiImageModelOption[]>(FALLBACK_GEMINI_IMAGE_MODELS);
  const [model, setModel] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_GEMINI_IMAGE_MODEL;
    }

    const storedModel = window.localStorage.getItem(MODEL_STORAGE_KEY) ?? undefined;
    return storedModel ? resolveGeminiImageModelId(storedModel) : DEFAULT_GEMINI_IMAGE_MODEL;
  });
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isAutoTitling, setIsAutoTitling] = useState(false);
  const [generationStage, setGenerationStage] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isClarifying, setIsClarifying] = useState(false);
  const [isBrainModeEnabled, setIsBrainModeEnabled] = useState(false);
  const [agentMemory, setAgentMemory] = useState<AgentMemoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = window.localStorage.getItem(AGENT_MEMORY_STORAGE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      // Corrupt or tampered localStorage entry — reset gracefully
      window.localStorage.removeItem(AGENT_MEMORY_STORAGE_KEY);
      return [];
    }
  });
  const [clarificationData, setClarificationData] = useState<ClarificationData | null>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentAssetReference, setAttachmentAssetReference] = useState<string | null>(null);
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [ownedDraftAssetReferences, setOwnedDraftAssetReferences] = useState<string[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<StudioPreviewMode>("image");
  const [selectedOutputFormatId, setSelectedOutputFormatId] = useState<StudioOutputFormatId>(DEFAULT_STUDIO_OUTPUT_FORMAT_ID);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [optimizerTab, setOptimizerTab] = useState<OptimizerTab>("score");
  const [optimizerTitle, setOptimizerTitle] = useState("");
  const [optimizerLoading, setOptimizerLoading] = useState<null | "score" | "pack" | "face" | "pattern">(null);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [ctrEstimate, setCtrEstimate] = useState<CtrEstimate | null>(null);
  const [latestGrowthExperiment, setLatestGrowthExperiment] = useState<GrowthExperiment | null>(null);
  const activeGenerationTask = studioGenerationTask?.status === "running" ? studioGenerationTask : null;
  const isGenerating = Boolean(activeGenerationTask);
  const activeGenerationOperation = activeGenerationTask?.operation;

  // Sync memory to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && !activeDraftId) {
      window.localStorage.setItem(AGENT_MEMORY_STORAGE_KEY, JSON.stringify(agentMemory));
    }
  }, [activeDraftId, agentMemory]);

  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Prevent accidental navigation during generation
  useEffect(() => {
    if (!isGenerating) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isGenerating]);

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPreviewOpen]);

  useEffect(() => {
    if (!currentImage) {
      setIsPreviewOpen(false);
    }
  }, [currentImage]);

  // Handle Labor Illusion / Progress Messages
  useEffect(() => {
    if (!isGenerating) {
      setGenerationStage(0);
      return;
    }

    const interval = setInterval(() => {
      setGenerationStage((prev) => (prev < 3 ? prev + 1 : prev));
    }, 6000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const getProgressMessage = () => {
    if (activeGenerationOperation === "polish" || isPolishing) return "Using Polish tool...";
    if (activeGenerationOperation === "upscale" || isUpscaling) return "Using 4K Upscale tool...";
    if (activeGenerationOperation === "insert-me" || isUploading) return "Using Insert Me tool...";
    if (activeGenerationOperation === "remove-bg") return "Removing background...";
    
    const messages = [
      isBrainModeEnabled ? "Brain mode planned the edit..." : "Starting generation...",
      "Analyzing scene and subjects...",
      "Generating high-res details...",
      "Finalizing composite (almost done)..."
    ];
    return messages[generationStage] || "Working...";
  };

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [isEditRegionMode, setIsEditRegionMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [gridColor, setGridColor] = useState("#00e5ff");
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(50);
  const [brushMode, setBrushMode] = useState<'brush' | 'eraser'>('brush');
  const [isMobileHistorySheetOpen, setIsMobileHistorySheetOpen] = useState(false);
  const [renameModal, setRenameModal] = useState<{ index: number; title: string } | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [quickStartTemplates, setQuickStartTemplates] = useState<TemplateAsset[]>([]);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [isAssetsModalOpen, setIsAssetsModalOpen] = useState(false);
  const [assetsModalMode, setAssetsModalMode] = useState<'insert' | 'replaceSubject'>('insert');
  const initialLaunchResolvedRef = useRef(false);
  const lastForcedStartLocationKeyRef = useRef<string | null>(null);
  const previousForceStartScreenRef = useRef(forceStartScreen);
  const isDraftHydratingRef = useRef(false);
  const pendingExternalLaunchSignatureRef = useRef<string | null>(null);
  const lastPersistedDraftSignatureRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const isPersistingDraftRef = useRef(false);
  const queuedDraftSaveRef = useRef(false);
  const studioDraftStateRef = useRef<StudioDraftAutosaveState | null>(null);
  const persistStudioDraftRef = useRef<(() => Promise<boolean>) | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [modelMenuStyle, setModelMenuStyle] = useState<React.CSSProperties | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const templateCropStyle = { clipPath: "inset(3% 2.5% 3% 2.5% round 18px)" };
  const quickStartTemplatePreviewOptions = {
    width: 360,
    height: 203,
    resize: "cover",
    quality: 72,
  } as const;
  const activeModel = modelOptions.find((option) => option.id === model) || modelOptions[0];
  const generationStatusLabel = isPolishing
    ? "Using Polish tool..."
    : isUpscaling
      ? "Using 4K Upscale tool..."
      : isUploading
        ? "Using Insert Me tool..."
        : getProgressMessage();
  const requiresSourceImage = Boolean(activeToolPreset);
  const hasOpenStudioWorkflow = editorState === "editing" && history.length > 0;

  useEffect(() => {
    if (!hasOpenStudioWorkflow) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const message = "Are you sure you want to leave Studio? Your current workflow is still open.";
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasOpenStudioWorkflow]);

  const sendToBilling = () => {
    navigate("/settings/billing?reason=no-credits");
  };

  const syncBilling = () => {
    void refreshBilling();
  };

  const applyBillingFromPayload = (payload: unknown) => {
    if (!payload || typeof payload !== "object" || !("billing" in payload)) {
      syncBilling();
      return;
    }

    const nextBilling = (payload as { billing?: BillingSnapshot }).billing;

    if (nextBilling) {
      setBilling(nextBilling);
      return;
    }

    syncBilling();
  };

  const handleUsageError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 402) {
      applyBillingFromPayload(error.payload);
      sendToBilling();
      return true;
    }

    return false;
  };

  const clearToolPreset = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("tool");
    setSearchParams(nextParams);
  };

  const showErrorToast = (message: string, title = "Action failed") => {
    showToast({ tone: "error", title, message });
  };

  const showWarningToast = (message: string, title = "Check this first") => {
    showToast({ tone: "warning", title, message });
  };

  const startStudioGeneration = ({
    operation,
    label,
    prompt,
  }: {
    operation: "generate" | "polish" | "upscale" | "remove-bg" | "insert-me";
    label: string;
    prompt: string;
  }) => {
    const taskId = startBackgroundGeneration({ operation, label, prompt });

    if (!taskId) {
      showWarningToast("Wait for the current image generation to finish before starting another one.", "Generation running");
    }

    return taskId;
  };

  const getGenerationErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const clearStudioLaunchParams = ({ preserveDraftId = false }: { preserveDraftId?: boolean } = {}) => {
    const nextParams = new URLSearchParams(searchParams);
    const currentParams = searchParams.toString();
    nextParams.delete("start");
    nextParams.delete("tool");
    nextParams.delete("templateUrl");
    nextParams.delete("assetReference");
    nextParams.delete("generationId");
    nextParams.delete("generationPrompt");
    nextParams.delete("generationTitle");
    nextParams.delete("sourceType");
    nextParams.delete("sourceId");
    nextParams.delete("sourceTitle");

    if (!preserveDraftId) {
      nextParams.delete("draftId");
    }

    if (nextParams.toString() !== currentParams) {
      setSearchParams(nextParams);
    }
  };

  const resetDraftPersistenceSession = () => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setActiveDraftId(null);
    setOwnedDraftAssetReferences([]);
    setAttachmentAssetReference(null);
    pendingExternalLaunchSignatureRef.current = null;
    lastPersistedDraftSignatureRef.current = null;
    queuedDraftSaveRef.current = false;
  };

  const normalizeThumbnailTitle = (value?: string | null) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  };

  const isGenericHistoryTitle = (value?: string | null) => {
    const normalized = normalizeThumbnailTitle(value);
    return !normalized || GENERIC_HISTORY_TITLES.has(normalized.toLowerCase());
  };

  const getHistoryItemTitle = (item?: HistoryItem | null) =>
    normalizeThumbnailTitle(item?.title) ||
    normalizeThumbnailTitle(item?.sourceTitle) ||
    normalizeThumbnailTitle(item?.prompt) ||
    "Untitled thumbnail";

  const deriveGeneratedTitle = (historyPrompt: string) => {
    if (currentFrame?.title && !isGenericHistoryTitle(currentFrame.title)) {
      return currentFrame.title;
    }

    if (currentFrame?.sourceTitle) {
      return currentFrame.sourceTitle;
    }

    if (currentFrame?.prompt && !isGenericHistoryTitle(currentFrame.prompt)) {
      return currentFrame.prompt;
    }

    return historyPrompt;
  };

  const finalizeGeneratedResult = async (
    base64Image: string,
    historyPrompt: string,
    formatId: StudioOutputFormatId = selectedOutputFormatId,
    options: { title?: string | null; preserveFullSourceFrame?: boolean } = {}
  ) => {
    let storedAssetReference: string | null = null;
    const generationTitle = normalizeThumbnailTitle(options.title) || deriveGeneratedTitle(historyPrompt);

    try {
      const fileName = `${user?.uid || "anon"}-${Date.now()}.png`;
      storedAssetReference = await uploadUserBase64Image(base64Image, fileName, user?.uid || "anon");
    } catch (uploadError) {
      console.error("Failed to upload to storage", uploadError);
    }

    const previewUrl = await resolveEditorImageUrl(storedAssetReference || base64Image);
    const generationId = storedAssetReference ? await persistGeneration(historyPrompt, storedAssetReference, generationTitle) : null;

    return {
      url: previewUrl,
      title: generationTitle,
      prompt: historyPrompt,
      formatId,
      generationId: generationId || undefined,
      assetReference: storedAssetReference,
      preserveFullSourceFrame: options.preserveFullSourceFrame ?? currentFrame?.preserveFullSourceFrame,
    } satisfies HistoryItem;
  };

  const applyGeneratedFrame = (frame: HistoryItem) => {
    const nextFormatId = normalizeStudioOutputFormatId(frame.formatId);

    setCurrentImage(frame.url);
    setSelectedOutputFormatId(nextFormatId);
    setEditorState("editing");
    setActiveMenuIndex(null);
    setIsMobileHistorySheetOpen(false);
    setHistory((prev) => {
      if (frame.generationId && prev.some((item) => item.generationId === frame.generationId)) {
        return prev;
      }

      if (frame.assetReference && prev.some((item) => item.assetReference === frame.assetReference)) {
        return prev;
      }

      return [frame, ...prev];
    });
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuIndex(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editorState !== "editing") {
      setIsMobileHistorySheetOpen(false);
      setActiveMenuIndex(null);
    }
  }, [editorState]);

  useEffect(() => {
    if (!isMobileHistorySheetOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileHistorySheetOpen(false);
        setActiveMenuIndex(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileHistorySheetOpen]);

  useEffect(() => {
    if (!isModelDropdownOpen) {
      return;
    }

    const updateModelMenuPosition = () => {
      const triggerRect = modelDropdownRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const horizontalPadding = 8;
      const menuWidth = Math.min(256, window.innerWidth - horizontalPadding * 2);
      const menuItemHeight = 44;
      const menuPadding = 16;
      const estimatedMenuHeight = modelOptions.length * menuItemHeight + menuPadding;
      const openUpward = triggerRect.top > estimatedMenuHeight + 16;
      const left = Math.min(
        window.innerWidth - menuWidth - horizontalPadding,
        Math.max(horizontalPadding, triggerRect.right - menuWidth)
      );

      setModelMenuStyle({
        position: "fixed",
        left,
        top: openUpward ? triggerRect.top - estimatedMenuHeight - 8 : triggerRect.bottom + 8,
        width: menuWidth,
        zIndex: 60,
      });
    };

    updateModelMenuPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (modelDropdownRef.current?.contains(target) || modelMenuRef.current?.contains(target)) {
        return;
      }

      setIsModelDropdownOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateModelMenuPosition);
    window.addEventListener("scroll", updateModelMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateModelMenuPosition);
      window.removeEventListener("scroll", updateModelMenuPosition, true);
    };
  }, [isModelDropdownOpen, modelOptions.length]);

  useEffect(() => {
    async function fetchQuickStartTemplates() {
      try {
        const templates = await listTemplates();
        setQuickStartTemplates(templates);
        setTemplateLoadError(null);
      } catch (error) {
        console.error("Failed to load quick start templates", error);
        setTemplateLoadError("Templates are unavailable right now. You can still start from your own image.");
      }
    }

    fetchQuickStartTemplates();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      try {
        const models = await listGeminiImageModels();
        if (!cancelled && models.length > 0) {
          setModelOptions(models);
        }
      } catch (error) {
        console.error("Failed to load image models", error);
      }
    }

    fetchModels();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, [model]);

  useEffect(() => {
    if (!modelOptions.some((option) => option.id === model)) {
      setModel(NANO_BANANA_2_MODEL);
    }
  }, [model, modelOptions]);

  // Initialize canvas when entering edit mode
  useEffect(() => {
    if (isEditRegionMode && canvasRef.current) {
      const canvas = canvasRef.current;
      // Match canvas size to its display size
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        const context = canvas.getContext("2d");
        if (context) {
          context.lineCap = "round";
          context.lineJoin = "round";
          context.strokeStyle = "rgba(59, 130, 246, 0.5)"; // Blue with 50% opacity
          context.lineWidth = brushSize;
          contextRef.current = context;
        }
      }
    }
  }, [isEditRegionMode, selectedOutputFormatId]);

  // Update brush size
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushSize]);

  // Update brush mode (eraser vs brush)
  useEffect(() => {
    if (contextRef.current) {
      if (brushMode === 'eraser') {
        contextRef.current.globalCompositeOperation = 'destination-out';
        contextRef.current.strokeStyle = "rgba(0,0,0,1)"; // Color doesn't matter for destination-out
      } else {
        contextRef.current.globalCompositeOperation = 'source-over';
        contextRef.current.strokeStyle = "rgba(59, 130, 246, 0.5)";
      }
    }
  }, [brushMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!contextRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;
    
    // Prevent scrolling while drawing on touch devices
    if ('touches' in e) {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    if (!contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!contextRef.current || !canvasRef.current) return;
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  useEffect(() => {
    if (studioGenerationTask?.status !== "completed" || !studioGenerationTask.result) {
      return;
    }

    const { result } = studioGenerationTask;
    applyGeneratedFrame(result.frame);

    if (result.clearPrompt) {
      setPrompt("");
    }

    if (result.agentMemoryEntries?.length) {
      setAgentMemory((prev) => [...prev, ...result.agentMemoryEntries!]);
    }

    if (result.clearEditRegion) {
      clearCanvas();
      setIsEditRegionMode(false);
    }

    syncBilling();
    clearBackgroundGeneration(studioGenerationTask.id);
    showToast({
      tone: "success",
      title: "Generation ready",
      message: "The finished thumbnail is open in Studio.",
    });
  }, [studioGenerationTask?.id, studioGenerationTask?.status]);

  const persistGeneration = async (prompt: string, assetReference: string, title?: string | null) => {
    if (!user) {
      return null;
    }

    const safePrompt = prompt?.trim() || normalizeThumbnailTitle(title) || "Untitled generation";

    if (assetReference.startsWith("data:") || assetReference.length > 500) {
      console.warn("persistGeneration: skipping invalid assetReference", assetReference.substring(0, 80));
      return null;
    }

    const { data, error } = await supabase
      .from("generations")
      .insert({
        user_id: user.uid,
        title: normalizeThumbnailTitle(title) || safePrompt,
        prompt: safePrompt,
        urls: [assetReference],
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to save generation to DB", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        prompt: safePrompt,
        assetRef: assetReference.substring(0, 120),
        userId: user.uid,
      });
      return null;
    }

    return data?.id ?? null;
  };

  const sanitizeAssetLabel = (value: string, fallback: string) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized || fallback;
  };

  const persistImportedAsset = async (base64Image: string, label: string) => {
    if (!user?.uid) {
      throw new Error("You need to be signed in to import into Studio.");
    }

    const storageFileName = `${sanitizeAssetLabel(label, "studio-import")}-${Date.now()}.png`;
    const assetReference = await uploadUserBase64Image(base64Image, storageFileName, user.uid);

    return {
      assetReference,
      previewUrl: await resolveEditorImageUrl(assetReference),
    };
  };

  const applyEditorFrame = (nextFrame: HistoryItem) => {
    const nextFormatId = normalizeStudioOutputFormatId(nextFrame.formatId ?? selectedOutputFormatId);
    const formattedFrame = { ...nextFrame, formatId: nextFormatId };

    setSelectedOutputFormatId(nextFormatId);
    setCurrentImage(formattedFrame.url);
    setHistory([formattedFrame]);
    setEditorState("editing");
    setActiveMenuIndex(null);
    setIsMobileHistorySheetOpen(false);

    if (forceStartScreen && location.pathname === "/create") {
      navigate("/studio", { replace: true });
    }
  };

  const applyIdeaAssistantHandoff = async () => {
    const handoff = consumeIdeaAssistantHandoff();

    if (!handoff) {
      return false;
    }

    resetDraftPersistenceSession();
    setAgentMemory([]);
    setClarificationData(null);
    setIsBrainModeEnabled(false);
    setAttachment(null);
    setAttachmentAssetReference(null);

    let nextFrame: HistoryItem;

    if (handoff.mode === "sketch" && handoff.baseImage) {
      const fittedImage = await fitImageDataUrlToStudioCanvas(handoff.baseImage);
      nextFrame = {
        url: fittedImage,
        title: handoff.ideaLabel || null,
        prompt: handoff.ideaLabel || "Idea sketch",
        preserveFullSourceFrame: true,
      };
    } else {
      nextFrame = {
        url: null,
        title: handoff.ideaLabel || null,
        prompt: handoff.ideaLabel || "Blank Canvas",
        isPlaceholder: true,
      };
    }

    applyEditorFrame(nextFrame);
    setPrompt(handoff.prompt);
    return {
      history: [nextFrame],
      title: handoff.ideaLabel || nextFrame.prompt,
      promptDraft: handoff.prompt,
    };
  };

  const importYoutubeThumbnail = async ({
    url,
    videoId,
    sourceTitle,
  }: {
    url?: string;
    videoId?: string;
    sourceTitle?: string | null;
  }) => {
    const response = await apiFetch<{ base64: string; videoId: string }>("/api/youtube/thumbnail", {
      method: "POST",
      body: url ? { url } : { videoId },
    });
    const fittedImage = await fitImageDataUrlToStudioCanvas(response.base64, "youtube");
    const displayTitle = sourceTitle?.trim() || "YouTube import";
    const { assetReference, previewUrl } = await persistImportedAsset(fittedImage, displayTitle);

    applyEditorFrame({
      url: previewUrl,
      title: displayTitle,
      prompt: displayTitle,
      formatId: "youtube",
      assetReference,
      preserveFullSourceFrame: true,
      sourceType: "youtube",
      sourceId: response.videoId,
      sourceTitle: sourceTitle?.trim() || displayTitle,
    });

    return {
      assetReference,
      previewUrl,
      videoId: response.videoId,
    };
  };

  const deletePersistedHistoryItem = async (item: HistoryItem) => {
    if (!user) {
      return;
    }

    const resolvedAssetReference = item.assetReference ?? item.url;
    const assetPath = resolvedAssetReference ? getUserAssetPath(resolvedAssetReference, user.uid) : null;

    if (assetPath && resolvedAssetReference) {
      try {
        await deleteUserAsset(resolvedAssetReference, user.uid);
      } catch (error) {
        console.error("Failed to delete generated file from storage", error);
      }

      if (item.sourceType === "youtube") {
        const { error: assetDeleteError } = await supabase
          .from("assets")
          .delete()
          .eq("user_id", user.uid)
          .eq("url", assetPath);

        if (assetDeleteError) {
          console.error("Failed to delete imported asset record", assetDeleteError);
        }
      }
    }

    let deleteQuery = supabase.from("generations").delete().eq("user_id", user.uid);

    if (item.generationId) {
      deleteQuery = deleteQuery.eq("id", item.generationId);
    } else if (assetPath) {
      deleteQuery = deleteQuery.contains("urls", [assetPath]);
    } else if (typeof item.assetReference === "string" && item.assetReference.startsWith("data:image/")) {
      deleteQuery = deleteQuery.contains("urls", [item.assetReference]);
    } else {
      return;
    }

    const { error } = await deleteQuery;

    if (error) {
      throw error;
    }
  };

  const handleDeleteHistoryItem = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const deletedItem = history[index];
    const fallbackItem = history[index === 0 ? 1 : 0];
    const resolvedAssetReference = deletedItem?.assetReference ?? deletedItem?.url ?? null;
    const isUserAsset =
      Boolean(user && typeof resolvedAssetReference === "string" && getUserAssetPath(resolvedAssetReference, user.uid));
    setActiveMenuIndex(null);

    if (!deletedItem) {
      return;
    }

    try {
      if (deletedItem.generationId || isUserAsset || deletedItem.assetReference?.startsWith("data:image/")) {
        await deletePersistedHistoryItem(deletedItem);
      }

      if (history.length === 1 && activeDraftId) {
        await deleteStudioDraftRecord(activeDraftId, ownedDraftAssetReferences);
      }
    } catch (error) {
      console.error("Failed to delete history item", error);
      showErrorToast("Failed to delete this saved frame.", "Delete failed");
      return;
    }

    setHistory(prev => prev.filter((_, i) => i !== index));

    if (deletedItem && currentImage === deletedItem.url && history.length > 1) {
      setCurrentImage(fallbackItem?.url ?? null);
    } else if (history.length === 1) {
      setCurrentImage(null);
      setEditorState('start');
      setPrompt("");
      setAgentMemory([]);
      setClarificationData(null);
      setIsBrainModeEnabled(false);
      setAttachment(null);
      setAttachmentAssetReference(null);
      setActiveDraftId(null);
      setOwnedDraftAssetReferences([]);
      pendingExternalLaunchSignatureRef.current = null;
      lastPersistedDraftSignatureRef.current = null;
    }
  };

  const handleDownloadHistoryItem = async (url: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;

    try {
      await downloadFileFromUrl(url, `thumbnail-${Date.now()}.png`);
    } catch (error) {
      console.error("Failed to download history item", error);
      showErrorToast("Failed to download this thumbnail.", "Download failed");
    } finally {
      setActiveMenuIndex(null);
    }
  };

  const handleOpenInEditor = (url: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;
    setCurrentImage(url);
    setActiveMenuIndex(null);
    setIsMobileHistorySheetOpen(false);
  };

  const handleSelectHistoryItem = (url: string | null) => {
    setCurrentImage(url);
    setActiveMenuIndex(null);
    setIsMobileHistorySheetOpen(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertMeRef = useRef<HTMLInputElement>(null);

  const resizePromptInput = () => {
    const textarea = promptInputRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const resolveEditorImageUrl = async (url: string) => {
    if (!url) {
      return url;
    }

    if (getUserAssetPath(url, user?.uid)) {
      return getUserAssetPreviewUrl(url, user?.uid);
    }

    return getPublicImagePreviewUrl(url);
  };

  const resolveGrowthExperimentPreviewUrls = async (experiment: GrowthExperiment): Promise<GrowthExperiment> => ({
    ...experiment,
    variants: await Promise.all(
      experiment.variants.map(async (variant) => ({
        ...variant,
        imageUrl: await resolveEditorImageUrl(variant.imageUrl),
      }))
    ),
  });

  const refreshHistoryPreview = async (index: number) => {
    const item = history[index];

    if (!item || !item.url) {
      return;
    }

    const assetReference = item.assetReference ?? item.url;
    const refreshedUrl = await resolveEditorImageUrl(assetReference);

    if (!refreshedUrl || refreshedUrl === item.url) {
      return;
    }

    setHistory((prev) =>
      prev.map((entry, entryIndex) => (entryIndex === index ? { ...entry, url: refreshedUrl } : entry))
    );

    if (currentImage === item.url) {
      setCurrentImage(refreshedUrl);
    }
  };

  const handleCanvasImageError = () => {
    if (currentFrameIndex >= 0) {
      void refreshHistoryPreview(currentFrameIndex);
    }
  };

  const copyThumbnailLink = async () => {
    if (!currentImage) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentImage);
      showToast({
        tone: "success",
        title: "Thumbnail link copied",
        message: "The current preview image link is ready to paste.",
      });
    } catch (error) {
      console.error("Failed to copy thumbnail link", error);
      showErrorToast("Could not copy this thumbnail link.", "Copy failed");
    }
  };

  const getBase64 = async (urlOrBase64: string): Promise<string> => {
    if (urlOrBase64.startsWith('data:image')) {
      if (urlOrBase64.includes(';base64,')) {
        return urlOrBase64;
      }

      try {
        const res = await fetch(urlOrBase64);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Failed to normalize image data URL", e);
        throw new Error("Failed to prepare the current image for generation.");
      }
    }

    try {
      const res = await fetch(urlOrBase64);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to convert image to base64", e);
      throw new Error("Failed to load the current image. It might be blocked by CORS.");
    }
  };

  const ensurePaidOptimizerAccess = () => {
    if (isPaidPlan(billing?.planKey || "hobby")) {
      return true;
    }

    showWarningToast("Growth optimization is available on paid plans and does not consume credits.", "Upgrade required");
    navigate("/settings/billing?reason=growth-lab");
    return false;
  };

  const getCurrentOptimizerImage = async () => {
    if (!currentImage) {
      throw new Error("Open or generate a thumbnail before using the optimizer.");
    }

    return getBase64(currentImage);
  };

  const handleCtrScore = async () => {
    if (!ensurePaidOptimizerAccess() || optimizerLoading) return;

    setOptimizerLoading("score");
    setOptimizerError(null);
    try {
      const imageUrl = await getCurrentOptimizerImage();
      const response = await scoreThumbnailCtr({
        imageUrl,
        title: optimizerTitle || currentFrameTitle,
      });
      setCtrEstimate(response.estimate);
      setOptimizerTab("score");
    } catch (error) {
      console.error("CTR estimate failed", error);
      setOptimizerError(error instanceof Error ? error.message : "Failed to estimate expected performance.");
    } finally {
      setOptimizerLoading(null);
    }
  };

  const handleOptimizationPack = async () => {
    if (!ensurePaidOptimizerAccess() || optimizerLoading) return;

    const title = (optimizerTitle || currentFrameTitle).trim();
    if (!title) {
      setOptimizerError("Enter a video title before generating title and thumbnail variants.");
      return;
    }

    setOptimizerLoading("pack");
    setOptimizerError(null);
    try {
      const imageUrl = currentImage ? await getCurrentOptimizerImage() : undefined;
      const response = await generateOptimizationPack({ title, imageUrl });
      setLatestGrowthExperiment(await resolveGrowthExperimentPreviewUrls(response.experiment));
      setOptimizerTab("ab");
      showToast({
        tone: "success",
        title: "Optimization pack ready",
        message: "Three title and thumbnail variants were saved to Growth Lab.",
      });
    } catch (error) {
      console.error("Optimization pack failed", error);
      setOptimizerError(error instanceof Error ? error.message : "Failed to generate optimization pack.");
    } finally {
      setOptimizerLoading(null);
    }
  };

  const handleFaceOptimization = async () => {
    if (!ensurePaidOptimizerAccess() || optimizerLoading) return;

    setOptimizerLoading("face");
    setOptimizerError(null);
    try {
      const imageUrl = await getCurrentOptimizerImage();
      const response = await optimizeThumbnailFace({
        imageUrl,
        title: optimizerTitle || currentFrameTitle,
      });
      setLatestGrowthExperiment(await resolveGrowthExperimentPreviewUrls(response.experiment));
      setCtrEstimate(response.variant.ctrEstimate);
      setOptimizerTab("face");
      showToast({
        tone: "success",
        title: "Face optimization ready",
        message: "A smart face variant was saved to Growth Lab.",
      });
    } catch (error) {
      console.error("Face optimization failed", error);
      setOptimizerError(error instanceof Error ? error.message : "Failed to optimize the face.");
    } finally {
      setOptimizerLoading(null);
    }
  };

  const handleViralPattern = async (patternKey: GrowthPatternKey) => {
    if (!ensurePaidOptimizerAccess() || optimizerLoading) return;

    setOptimizerLoading("pattern");
    setOptimizerError(null);
    try {
      const imageUrl = await getCurrentOptimizerImage();
      const response = await applyViralPattern({
        imageUrl,
        title: optimizerTitle || currentFrameTitle,
        patternKey,
      });
      setLatestGrowthExperiment(await resolveGrowthExperimentPreviewUrls(response.experiment));
      setCtrEstimate(response.variant.ctrEstimate);
      setOptimizerTab("patterns");
      showToast({
        tone: "success",
        title: "Pattern variant ready",
        message: "The viral pattern variant was saved to Growth Lab.",
      });
    } catch (error) {
      console.error("Viral pattern failed", error);
      setOptimizerError(error instanceof Error ? error.message : "Failed to apply viral pattern.");
    } finally {
      setOptimizerLoading(null);
    }
  };

  const applyGrowthVariantToCanvas = async (variant: GrowthVariant) => {
    if (!variant.imageUrl) return;

    try {
      const previewUrl = await resolveEditorImageUrl(variant.imageUrl);
      setCurrentImage(previewUrl);
      setHistory((prev) => [
        {
          url: previewUrl,
          title: variant.title,
          prompt: variant.prompt,
          formatId: activeOutputFormat.id,
          assetReference: variant.imageUrl,
          preserveFullSourceFrame: true,
        },
        ...prev,
      ]);
      setEditorState("editing");
      setIsOptimizerOpen(false);
      showToast({
        tone: "success",
        title: "Variant applied",
        message: "The selected Growth Lab variant is now on the Studio canvas.",
      });
    } catch (error) {
      console.error("Failed to apply growth variant", error);
      setOptimizerError(error instanceof Error ? error.message : "Failed to apply this variant.");
    }
  };

  const readBlobAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });

  const fitImageDataUrlToStudioCanvas = async (
    originalDataUrl: string,
    formatId: StudioOutputFormatId = selectedOutputFormatId
  ) => {
    const image = await loadImage(originalDataUrl);
    const sourceAspectRatio = image.naturalWidth / image.naturalHeight;
    const targetFormat = getStudioOutputFormat(formatId);
    const targetCanvasWidth = targetFormat.canvasWidth;
    const targetCanvasHeight = targetFormat.canvasHeight;
    const targetAspectRatio = targetCanvasWidth / targetCanvasHeight;

    if (Math.abs(sourceAspectRatio - targetAspectRatio) < 0.01) {
      return originalDataUrl;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetCanvasWidth;
    canvas.height = targetCanvasHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return originalDataUrl;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const coverScale = Math.max(
      targetCanvasWidth / image.naturalWidth,
      targetCanvasHeight / image.naturalHeight
    );
    const coverWidth = image.naturalWidth * coverScale;
    const coverHeight = image.naturalHeight * coverScale;
    const coverX = (targetCanvasWidth - coverWidth) / 2;
    const coverY = (targetCanvasHeight - coverHeight) / 2;

    context.save();
    context.filter = "blur(40px) saturate(1.05)";
    context.drawImage(image, coverX, coverY, coverWidth, coverHeight);
    context.restore();

    context.fillStyle = "rgba(0, 0, 0, 0.22)";
    context.fillRect(0, 0, targetCanvasWidth, targetCanvasHeight);

    const containScale = Math.min(
      targetCanvasWidth / image.naturalWidth,
      targetCanvasHeight / image.naturalHeight
    );
    const containWidth = image.naturalWidth * containScale;
    const containHeight = image.naturalHeight * containScale;
    const containX = (targetCanvasWidth - containWidth) / 2;
    const containY = (targetCanvasHeight - containHeight) / 2;

    context.drawImage(image, containX, containY, containWidth, containHeight);

    return canvas.toDataURL("image/png");
  };

  const fitUploadToStudioCanvas = async (file: File) => {
    const originalDataUrl = await readBlobAsDataUrl(file);
    return fitImageDataUrlToStudioCanvas(originalDataUrl);
  };

  const normalizeOwnedDraftReferences = (references: string[]) =>
    [...new Set(references.filter((reference) => typeof reference === "string" && reference.trim()))];

  const buildHistoryItemDraftSnapshot = (item: Pick<
    HistoryItem | StudioDraftHistoryItem,
    | "url"
    | "title"
    | "prompt"
    | "formatId"
    | "isPlaceholder"
    | "generationId"
    | "assetReference"
    | "preserveFullSourceFrame"
    | "sourceType"
    | "sourceId"
    | "sourceTitle"
  >): StudioDraftHistoryItem => {
    const stableUserAssetReference =
      typeof item.assetReference === "string" && item.assetReference.trim()
        ? item.assetReference
        : typeof item.url === "string"
          ? getUserAssetPath(item.url, user?.uid) ?? null
          : null;
    const stableUrl = stableUserAssetReference ?? item.url ?? null;

    return {
      url: stableUrl,
      title: normalizeThumbnailTitle(item.title),
      prompt: item.prompt,
      formatId: normalizeStudioOutputFormatId(item.formatId),
      isPlaceholder: item.isPlaceholder === true,
      generationId: item.generationId ?? null,
      assetReference: stableUserAssetReference,
      preserveFullSourceFrame: item.preserveFullSourceFrame === true,
      sourceType: item.sourceType === "youtube" ? "youtube" : null,
      sourceId: item.sourceId ?? null,
      sourceTitle: normalizeThumbnailTitle(item.sourceTitle),
    };
  };

  const buildStudioDraftAutosaveSignature = ({
    history,
    currentFrameIndex,
    title,
    promptDraft,
    agentMemory: nextAgentMemory,
    clarificationData: nextClarificationData,
    isBrainModeEnabled: nextBrainModeEnabled,
    attachment: nextAttachment,
    attachmentAssetReference: nextAttachmentAssetReference,
    ownedAssetReferences,
  }: {
    history: Array<HistoryItem | StudioDraftHistoryItem>;
    currentFrameIndex: number;
    title: string | null;
    promptDraft: string;
    agentMemory: AgentMemoryEntry[];
    clarificationData: ClarificationData | null;
    isBrainModeEnabled: boolean;
    attachment: string | null;
    attachmentAssetReference: string | null;
    ownedAssetReferences: string[];
  }) =>
    JSON.stringify({
      title: normalizeThumbnailTitle(title),
      currentFrameIndex: history.length ? Math.max(0, Math.min(currentFrameIndex, history.length - 1)) : 0,
      promptDraft,
      history: history.map((item) => buildHistoryItemDraftSnapshot(item)),
      agentMemory: nextAgentMemory,
      clarificationData: nextClarificationData,
      isBrainModeEnabled: nextBrainModeEnabled,
      attachmentReference:
        nextAttachmentAssetReference ??
        (typeof nextAttachment === "string" ? getUserAssetPath(nextAttachment, user?.uid) ?? nextAttachment : null),
      ownedAssetReferences: normalizeOwnedDraftReferences(ownedAssetReferences).sort(),
    });

  const buildStudioDraftPayload = ({
    history,
    currentFrameIndex,
    title,
    promptDraft,
    agentMemory: nextAgentMemory,
    clarificationData: nextClarificationData,
    isBrainModeEnabled: nextBrainModeEnabled,
    attachmentAssetReference: nextAttachmentAssetReference,
    ownedAssetReferences,
  }: {
    history: HistoryItem[];
    currentFrameIndex: number;
    title: string | null;
    promptDraft: string;
    agentMemory: AgentMemoryEntry[];
    clarificationData: ClarificationData | null;
    isBrainModeEnabled: boolean;
    attachmentAssetReference: string | null;
    ownedAssetReferences: string[];
  }): StudioEditorDraftData => ({
    kind: STUDIO_EDITOR_DRAFT_KIND,
    version: STUDIO_EDITOR_DRAFT_VERSION,
    title: normalizeThumbnailTitle(title),
    history: history.map((item) => {
      const snapshot = buildHistoryItemDraftSnapshot(item);
      return {
        url: snapshot.url,
        title: snapshot.title,
        prompt: snapshot.prompt,
        formatId: snapshot.formatId,
        isPlaceholder: snapshot.isPlaceholder,
        generationId: snapshot.generationId ?? undefined,
        assetReference: snapshot.assetReference,
        preserveFullSourceFrame: snapshot.preserveFullSourceFrame,
        sourceType: snapshot.sourceType,
        sourceId: snapshot.sourceId,
        sourceTitle: snapshot.sourceTitle,
      };
    }),
    currentFrameIndex: history.length ? Math.max(0, Math.min(currentFrameIndex, history.length - 1)) : 0,
    promptDraft,
    agentMemory: nextAgentMemory,
    clarificationData: nextClarificationData,
    isBrainModeEnabled: nextBrainModeEnabled,
    attachmentAssetReference: nextAttachmentAssetReference,
    ownedAssetReferences: normalizeOwnedDraftReferences(ownedAssetReferences),
  });

  const uploadOwnedDraftMedia = async (reference: string, label: string) => {
    if (!user?.uid) {
      throw new Error("You need to be signed in to save this Studio project.");
    }

    const existingAssetReference = getUserAssetPath(reference, user.uid);
    if (existingAssetReference) {
      return {
        assetReference: existingAssetReference,
        previewUrl: await resolveEditorImageUrl(existingAssetReference),
        owned: false,
      };
    }

    if (!reference.startsWith("data:image") && !reference.startsWith("blob:")) {
      return {
        assetReference: reference,
        previewUrl: await resolveEditorImageUrl(reference),
        owned: false,
      };
    }

    const base64Data = reference.startsWith("data:image") ? reference : await getBase64(reference);
    const assetReference = await uploadUserBase64Image(
      base64Data,
      `${sanitizeAssetLabel(label, "studio-draft")}-${Date.now()}.png`,
      user.uid
    );

    return {
      assetReference,
      previewUrl: await resolveEditorImageUrl(assetReference),
      owned: true,
    };
  };

  const hydrateStudioDraftRecord = async (draft: StudioEditorDraftRecord) => {
    isDraftHydratingRef.current = true;

    try {
      const hydratedHistory = await Promise.all(
        draft.data.history.map(async (item) => {
          const stableUserAssetReference =
            item.assetReference || (typeof item.url === "string" ? getUserAssetPath(item.url, user?.uid) : null);
          const previewReference = stableUserAssetReference ?? item.url;

          return {
            url: previewReference ? await resolveEditorImageUrl(previewReference) : null,
            title: normalizeThumbnailTitle(item.title),
            prompt: item.prompt,
            formatId: normalizeStudioOutputFormatId(item.formatId),
            isPlaceholder: item.isPlaceholder,
            generationId: item.generationId,
            assetReference: stableUserAssetReference,
            preserveFullSourceFrame: item.preserveFullSourceFrame,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            sourceTitle: normalizeThumbnailTitle(item.sourceTitle),
          } satisfies HistoryItem;
        })
      );
      const boundedCurrentFrameIndex = hydratedHistory.length
        ? Math.max(0, Math.min(draft.data.currentFrameIndex, hydratedHistory.length - 1))
        : -1;
      const attachmentReference = draft.data.attachmentAssetReference;

      setHistory(hydratedHistory);
      setCurrentImage(boundedCurrentFrameIndex >= 0 ? hydratedHistory[boundedCurrentFrameIndex]?.url ?? null : null);
      setSelectedOutputFormatId(
        normalizeStudioOutputFormatId(
          boundedCurrentFrameIndex >= 0 ? hydratedHistory[boundedCurrentFrameIndex]?.formatId : undefined
        )
      );
      setEditorState(hydratedHistory.length > 0 ? "editing" : "start");
      setPrompt(draft.data.promptDraft);
      setAgentMemory(draft.data.agentMemory);
      setClarificationData(draft.data.clarificationData);
      setIsBrainModeEnabled(draft.data.isBrainModeEnabled);
      setAttachment(attachmentReference ? await resolveEditorImageUrl(attachmentReference) : null);
      setAttachmentAssetReference(attachmentReference);
      setOwnedDraftAssetReferences(normalizeOwnedDraftReferences(draft.data.ownedAssetReferences));
      setActiveDraftId(draft.id);
      setActiveMenuIndex(null);
      setIsMobileHistorySheetOpen(false);
      setIsPreviewOpen(false);
      pendingExternalLaunchSignatureRef.current = null;
      lastPersistedDraftSignatureRef.current = buildStudioDraftAutosaveSignature({
        history: draft.data.history,
        currentFrameIndex: boundedCurrentFrameIndex >= 0 ? boundedCurrentFrameIndex : 0,
        title: draft.title ?? draft.data.title ?? null,
        promptDraft: draft.data.promptDraft,
        agentMemory: draft.data.agentMemory,
        clarificationData: draft.data.clarificationData,
        isBrainModeEnabled: draft.data.isBrainModeEnabled,
        attachment: draft.data.attachmentAssetReference,
        attachmentAssetReference: draft.data.attachmentAssetReference,
        ownedAssetReferences: draft.data.ownedAssetReferences,
      });
    } finally {
      isDraftHydratingRef.current = false;
    }
  };

  const loadStudioDraftById = async (draftId: string) => {
    if (!user?.uid) {
      return false;
    }

    const { data, error } = await supabase
      .from("drafts")
      .select("id, title, data, created_at, updated_at")
      .eq("id", draftId)
      .eq("user_id", user.uid)
      .maybeSingle();

    if (error) {
      console.error("Failed to load Studio draft", error);
      return false;
    }

    const draft = normalizeStudioEditorDraftRecord(data);
    if (!draft) {
      return false;
    }

    await hydrateStudioDraftRecord(draft);
    return true;
  };

  const loadLatestStudioDraft = async () => {
    if (!user?.uid) {
      return false;
    }

    const { data, error } = await supabase
      .from("drafts")
      .select("id, title, data, created_at, updated_at")
      .eq("user_id", user.uid)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed to load latest Studio draft", error);
      return false;
    }

    const draft = (data ?? [])
      .map((row) => normalizeStudioEditorDraftRecord(row))
      .find((entry): entry is StudioEditorDraftRecord => Boolean(entry));

    if (!draft) {
      return false;
    }

    await hydrateStudioDraftRecord(draft);
    return true;
  };

  const deleteStudioDraftRecord = async (draftId: string, ownedReferences: string[]) => {
    if (!user?.uid) {
      return;
    }

    await Promise.all(
      normalizeOwnedDraftReferences(ownedReferences).map((assetReference) =>
        deleteUserAsset(assetReference, user.uid).catch((error) => {
          console.error("Failed to remove owned Studio draft asset", error);
          return false;
        })
      )
    );

    const { error } = await supabase.from("drafts").delete().eq("id", draftId).eq("user_id", user.uid);
    if (error) {
      throw error;
    }
  };

  useEffect(() => {
    initialLaunchResolvedRef.current = false;
    lastForcedStartLocationKeyRef.current = null;
    previousForceStartScreenRef.current = forceStartScreen;
    pendingExternalLaunchSignatureRef.current = null;
    lastPersistedDraftSignatureRef.current = null;
  }, [user?.uid]);

  useEffect(() => {
    if (!forceStartScreen || !user?.uid || lastForcedStartLocationKeyRef.current === location.key) {
      return;
    }

    lastForcedStartLocationKeyRef.current = location.key;
    initialLaunchResolvedRef.current = true;
    handleOpenStartScreen();
  }, [forceStartScreen, location.key, user?.uid]);

  useEffect(() => {
    const wasForcedStartScreen = previousForceStartScreenRef.current;
    previousForceStartScreenRef.current = forceStartScreen;

    if (wasForcedStartScreen && !forceStartScreen && editorState === "start" && history.length === 0) {
      initialLaunchResolvedRef.current = false;
    }
  }, [editorState, forceStartScreen, history.length]);

  useEffect(() => {
    let cancelled = false;

    async function resolveInitialStudioLaunch() {
      if (forceStartScreen || !user?.uid || initialLaunchResolvedRef.current) {
        return;
      }

      const startMode = searchParams.get("start");
      const draftId = searchParams.get("draftId");
      const toolId = searchParams.get("tool");
      const templateUrl = searchParams.get("templateUrl");
      const assetReference = searchParams.get("assetReference");
      const generationId = searchParams.get("generationId");
      const generationPrompt = searchParams.get("generationPrompt");
      const generationTitle = searchParams.get("generationTitle");
      const sourceType = searchParams.get("sourceType");
      const sourceId = searchParams.get("sourceId");
      const sourceTitle = searchParams.get("sourceTitle");

      if (startMode === "agent") {
        initialLaunchResolvedRef.current = true;
        handleStartAgent();
        clearStudioLaunchParams();
        return;
      }

      if (startMode === "new") {
        initialLaunchResolvedRef.current = true;
        handleOpenStartScreen();
        clearStudioLaunchParams();
        return;
      }

      if (startMode === "fresh") {
        initialLaunchResolvedRef.current = true;
        handleStartBlank();
        clearStudioLaunchParams();
        return;
      }

      if (draftId) {
        initialLaunchResolvedRef.current = true;
        const loaded = await loadStudioDraftById(draftId);
        if (!loaded) {
          initialLaunchResolvedRef.current = false;
          clearStudioLaunchParams();
        }
        return;
      }

      if (sourceType === "youtube" && (sourceId || templateUrl)) {
        initialLaunchResolvedRef.current = true;
        resetDraftPersistenceSession();
        setPrompt("");
        setAgentMemory([]);
        setClarificationData(null);
        setIsBrainModeEnabled(false);
        setAttachment(null);
        setAttachmentAssetReference(null);

        try {
          const imported = await importYoutubeThumbnail({
            videoId: sourceId || undefined,
            url: sourceId ? undefined : templateUrl || undefined,
            sourceTitle,
          });

          if (cancelled) {
            return;
          }

          pendingExternalLaunchSignatureRef.current = buildStudioDraftAutosaveSignature({
            history: [
              {
                url: imported.assetReference,
                title: sourceTitle?.trim() || "YouTube import",
                prompt: sourceTitle?.trim() || "YouTube import",
                formatId: "youtube",
                assetReference: imported.assetReference,
                preserveFullSourceFrame: true,
                sourceType: "youtube",
                sourceId: imported.videoId,
                sourceTitle: sourceTitle?.trim() || "YouTube import",
              },
            ],
            currentFrameIndex: 0,
            title: sourceTitle?.trim() || "YouTube import",
            promptDraft: "",
            agentMemory: [],
            clarificationData: null,
            isBrainModeEnabled: false,
            attachment: null,
            attachmentAssetReference: null,
            ownedAssetReferences: [],
          });
          clearStudioLaunchParams();
        } catch (error) {
          console.error("Failed to import YouTube thumbnail", error);
          if (!cancelled) {
            showErrorToast(
              error instanceof Error ? error.message : "Failed to import the selected YouTube thumbnail.",
              "Import failed"
            );
          }
        }

        return;
      }

      if (templateUrl) {
        initialLaunchResolvedRef.current = true;
        resetDraftPersistenceSession();
        setPrompt("");
        setAgentMemory([]);
        setClarificationData(null);
        setIsBrainModeEnabled(false);
        setAttachment(null);
        setAttachmentAssetReference(null);

        const resolvedAssetReference = assetReference || getUserAssetPath(templateUrl, user.uid) || null;
        const resolvedUrl = await resolveEditorImageUrl(resolvedAssetReference || templateUrl);

        if (cancelled) {
          return;
        }

        applyEditorFrame({
          url: resolvedUrl,
          title: generationTitle,
          prompt: generationPrompt || "Template",
          generationId: generationId || undefined,
          assetReference: resolvedAssetReference,
          preserveFullSourceFrame: true,
        });
        pendingExternalLaunchSignatureRef.current = buildStudioDraftAutosaveSignature({
          history: [
            {
              url: resolvedAssetReference || templateUrl,
              title: generationTitle,
              prompt: generationPrompt || "Template",
              generationId: generationId || undefined,
              assetReference: resolvedAssetReference,
              preserveFullSourceFrame: true,
            },
          ],
          currentFrameIndex: 0,
          title: generationTitle || generationPrompt || "Template",
          promptDraft: "",
          agentMemory: [],
          clarificationData: null,
          isBrainModeEnabled: false,
          attachment: null,
          attachmentAssetReference: null,
          ownedAssetReferences: [],
        });
        clearStudioLaunchParams();
        return;
      }

      if (toolId) {
        initialLaunchResolvedRef.current = true;
        return;
      }

      initialLaunchResolvedRef.current = true;

      try {
        const appliedHandoff = await applyIdeaAssistantHandoff();

        if (cancelled) {
          return;
        }

        if (appliedHandoff) {
          pendingExternalLaunchSignatureRef.current = buildStudioDraftAutosaveSignature({
            history: appliedHandoff.history,
            currentFrameIndex: 0,
            title: appliedHandoff.title,
            promptDraft: appliedHandoff.promptDraft,
            agentMemory: [],
            clarificationData: null,
            isBrainModeEnabled: false,
            attachment: null,
            attachmentAssetReference: null,
            ownedAssetReferences: [],
          });
          return;
        }

        await loadLatestStudioDraft();
      } catch (error) {
        console.error("Failed to hydrate Studio launch", error);
        if (!cancelled) {
          showErrorToast(error instanceof Error ? error.message : "Failed to open Studio.", "Studio failed to open");
        }
      }
    }

    void resolveInitialStudioLaunch();

    return () => {
      cancelled = true;
    };
  }, [forceStartScreen, searchParams, user?.uid]);

  useEffect(() => {
    resizePromptInput();
  }, [prompt]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showWarningToast("Image is too large. Please upload an image under 10MB.", "Upload too large");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      try {
        const fittedImage = await fitUploadToStudioCanvas(file);
        const inferredTitle = file.name.replace(/\.[^.]+$/, "").trim();
        resetDraftPersistenceSession();
        clearStudioLaunchParams();
        setPrompt("");
        setAgentMemory([]);
        setClarificationData(null);
        setIsBrainModeEnabled(false);
        setAttachment(null);
        setAttachmentAssetReference(null);
        applyEditorFrame({
          url: fittedImage,
          title: inferredTitle || null,
          prompt: "Uploaded Image",
          preserveFullSourceFrame: true,
        });
      } catch (error) {
        console.error("Failed to prepare uploaded image", error);
        showErrorToast("Failed to load this image. Please try another file.", "Upload failed");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleStartBlank = () => {
    resetDraftPersistenceSession();
    clearStudioLaunchParams();
    setPrompt("");
    setAgentMemory([]);
    setClarificationData(null);
    setIsBrainModeEnabled(false);
    setAttachment(null);
    setAttachmentAssetReference(null);
    const blankFrame: HistoryItem = {
      url: null,
      prompt: "Blank Canvas",
      isPlaceholder: true,
      title: null,
      formatId: selectedOutputFormatId,
    };
    applyEditorFrame(blankFrame);
    pendingExternalLaunchSignatureRef.current = buildStudioDraftAutosaveSignature({
      history: [blankFrame],
      currentFrameIndex: 0,
      title: "Blank Canvas",
      promptDraft: "",
      agentMemory: [],
      clarificationData: null,
      isBrainModeEnabled: false,
      attachment: null,
      attachmentAssetReference: null,
      ownedAssetReferences: [],
    });
  };

  const handleOpenStartScreen = () => {
    resetDraftPersistenceSession();
    clearStudioLaunchParams();
    setCurrentImage(null);
    setHistory([]);
    setEditorState('start');
    setPrompt("");
    setAgentMemory([]);
    setClarificationData(null);
    setIsBrainModeEnabled(false);
    setAttachment(null);
    setAttachmentAssetReference(null);
    setActiveMenuIndex(null);
    setIsMobileHistorySheetOpen(false);
    setIsEditRegionMode(false);
    setIsPreviewOpen(false);
    setShowYoutubeInput(false);
    setYoutubeUrl("");
    setIsFetchingYoutube(false);
    pendingExternalLaunchSignatureRef.current = null;
    lastPersistedDraftSignatureRef.current = null;
  };

  const handleUseTemplate = (templateUrl: string) => {
    resetDraftPersistenceSession();
    clearStudioLaunchParams();
    setPrompt("");
    setAgentMemory([]);
    setClarificationData(null);
    setIsBrainModeEnabled(false);
    setAttachment(null);
    setAttachmentAssetReference(null);
    applyEditorFrame({ url: templateUrl, prompt: "Template", title: null, formatId: "youtube", preserveFullSourceFrame: true });
  };

  const resetAgent = () => {
    setModel(NANO_BANANA_2_MODEL);
    setPrompt("");
    setAgentMemory([]);
    setIsBrainModeEnabled(true);
  };

  const handleStartAgent = () => {
    resetAgent();
    handleStartBlank();
    setIsBrainModeEnabled(true);
    const blankFrame: HistoryItem = {
      url: null,
      prompt: "Blank Canvas",
      isPlaceholder: true,
      title: null,
      formatId: selectedOutputFormatId,
    };
    pendingExternalLaunchSignatureRef.current = buildStudioDraftAutosaveSignature({
      history: [blankFrame],
      currentFrameIndex: 0,
      title: "Blank Canvas",
      promptDraft: "",
      agentMemory: [],
      clarificationData: null,
      isBrainModeEnabled: true,
      attachment: null,
      attachmentAssetReference: null,
      ownedAssetReferences: [],
    });
  };

  const attachReferenceImageFile = (file: File | null | undefined) => {
    if (!file) {
      return false;
    }

    if (!file.type.startsWith("image/")) {
      showWarningToast("Drop an image file to attach it to the agent.", "Unsupported file");
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      showWarningToast("Reference image is too large. Please upload an image under 5MB.", "Reference too large");
      return false;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachment(reader.result as string);
      setAttachmentAssetReference(null);
    };
    reader.onerror = () => {
      showErrorToast("Failed to load this reference image.", "Attachment failed");
    };
    reader.readAsDataURL(file);
    return true;
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    attachReferenceImageFile(e.target.files?.[0]);
    // Reset input so the same file can be uploaded again if needed
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const handleAttachmentDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsAttachmentDragActive(true);
  };

  const handleAttachmentDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsAttachmentDragActive(true);
  };

  const handleAttachmentDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsAttachmentDragActive(false);
  };

  const handleAttachmentDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsAttachmentDragActive(false);

    let imageFile: File | null = null;
    for (let index = 0; index < event.dataTransfer.files.length; index += 1) {
      const file = event.dataTransfer.files.item(index);
      if (file?.type.startsWith("image/")) {
        imageFile = file;
        break;
      }
    }

    if (!imageFile) {
      showWarningToast("Drop an image file to attach it to the agent.", "No image found");
      return;
    }

    attachReferenceImageFile(imageFile);
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentAssetReference(null);
  };

  const handleGenerate = async (skipClarification = false) => {
    let effectivePrompt = skipClarification && clarificationData?.optimizedPrompt ? clarificationData.optimizedPrompt : prompt.trim();

    if (!effectivePrompt.trim() || isGenerating) return;

    const baseImageBase64 = currentImage ? await getBase64(currentImage) : undefined;
    const hasPendingClarification = clarificationData?.status === "needs_clarification";
    const shouldUseAssistant =
      !skipClarification &&
      (isBrainModeEnabled || hasPendingClarification || shouldUseAssistantGuard(effectivePrompt, Boolean(baseImageBase64)));

    if (shouldUseAssistant) {
      setIsClarifying(true);
      try {
        const response = await clarifyPrompt(effectivePrompt, baseImageBase64, agentMemory, {
          aspectRatio: activeOutputFormat.aspectRatio,
          targetPlatform: activeOutputFormat.targetPlatform,
          targetFormat: activeOutputFormat.promptLabel,
        });
        const nextClarification: ClarificationData = {
          ...response,
          question: response.question.trim(),
          optimizedPrompt: response.optimizedPrompt.trim(),
          source: isBrainModeEnabled ? "brain" : "assistant",
        };

        if (response.status === "needs_clarification") {
          setClarificationData(nextClarification);
          setAgentMemory((prev) => [
            ...prev,
            { role: "user", text: effectivePrompt },
            { role: "model", text: nextClarification.question },
          ]);
          if (!nextClarification.optimizedPrompt && nextClarification.source === "assistant") {
            setPrompt("");
          }
          return;
        }

        effectivePrompt = nextClarification.optimizedPrompt || effectivePrompt;
        setClarificationData(null);
        setAgentMemory((prev) => [
          ...prev,
          { role: "user", text: prompt.trim() },
          { role: "model", text: `Optimized prompt: ${effectivePrompt}` },
        ]);
      } catch (error) {
        console.error("Clarification failed", error);
        // Fallback to direct generation if clarification fails
      } finally {
        setIsClarifying(false);
      }
    }

    if (billing && !billing.canGenerate) {
      sendToBilling();
      return;
    }

    const taskId = startStudioGeneration({
      operation: "generate",
      label: "Generating thumbnail",
      prompt: effectivePrompt,
    });

    if (!taskId) {
      return;
    }

    setClarificationData(null);
    try {
      const generationFormat = activeOutputFormat;
      const generationTitle = deriveGeneratedTitle(effectivePrompt);
      const preserveFullSourceFrame = currentFrame?.preserveFullSourceFrame;
      const allowVisibleText = promptRequestsVisibleText(effectivePrompt);
      const generationIntent: GenerationIntent =
        baseImageBase64
          ? "edit"
          : promptIsBackgroundOnlyRequest(effectivePrompt)
            ? "background_only"
            : "create";
      
      // Get mask from canvas if in Edit Region mode
      let maskImageBase64 = undefined;
      if (isEditRegionMode && canvasRef.current) {
        maskImageBase64 = canvasRef.current.toDataURL("image/png");
      }

      const generationInstructions = [
        `Output format: ${generationFormat.promptLabel}. Use a ${generationFormat.aspectRatio} canvas at ${generationFormat.dimensions}.`,
        currentFrame?.preserveFullSourceFrame ? FULL_FRAME_SOURCE_INSTRUCTION : undefined,
        isEditRegionMode && maskImageBase64
          ? "Focus edits only on the areas highlighted by the provided mask."
          : undefined,
      ]
        .filter(Boolean)
        .join(" ");

      const base64Images = await generateThumbnails({
        prompt: effectivePrompt,
        baseImage: baseImageBase64,
        referenceImage: attachment || maskImageBase64,
        referenceImagePurpose: attachment ? "subject" : (maskImageBase64 ? "mask" : undefined),
        imageSize: "1K",
        aspectRatio: generationFormat.aspectRatio,
        targetPlatform: generationFormat.targetPlatform,
        targetFormat: generationFormat.promptLabel,
        model: model,
        intent: generationIntent,
        allowVisibleText,
        instructions: generationInstructions || undefined,
      });
      const generatedFrame = await finalizeGeneratedResult(base64Images[0], effectivePrompt, generationFormat.id, {
        title: generationTitle,
        preserveFullSourceFrame,
      });

      completeBackgroundGeneration(taskId, {
        frame: generatedFrame,
        clearPrompt: true,
        clearEditRegion: isEditRegionMode,
        agentMemoryEntries: [
          { role: "user", text: effectivePrompt },
          { role: "model", text: "Generated result: " + effectivePrompt },
        ],
      });

      syncBilling();
    } catch (error: any) {
      console.error("Generation failed", error);
      const errorMessage = getGenerationErrorMessage(error, "An error occurred during generation");
      failBackgroundGeneration(taskId, errorMessage);
      if (handleUsageError(error)) {
        return;
      }
      showErrorToast(errorMessage, "Generation failed");
    }
  };

  const downloadImage = async () => {
    if (!currentImage) return;

    try {
      await downloadFileFromUrl(currentImage, `thumbnail-${Date.now()}.png`);
    } catch (error) {
      console.error("Failed to download current image", error);
      showErrorToast("Failed to download the current image.", "Download failed");
    }
  };

  const resolveReferenceImageForGeneration = async (reference: string) => {
    if (!reference) {
      throw new Error("Missing reference image.");
    }

    if (reference.startsWith("data:image")) {
      return getBase64(reference);
    }

    const resolvedReferenceUrl = reference.includes("://") ? reference : await resolveEditorImageUrl(reference);
    return getBase64(resolvedReferenceUrl);
  };

  const handlePolish = async () => {
    if (!currentImage || isGenerating || isPolishing) return;

    if (billing && !billing.canGenerate) {
      sendToBilling();
      return;
    }

    const taskId = startStudioGeneration({
      operation: "polish",
      label: "Polishing thumbnail",
      prompt: "Polish / Enhance",
    });

    if (!taskId) {
      return;
    }

    setIsPolishing(true);
    try {
      const generationFormat = activeOutputFormat;
      const generationTitle = deriveGeneratedTitle("Polish / Enhance");
      const preserveFullSourceFrame = currentFrame?.preserveFullSourceFrame;
      const baseImageBase64 = await getBase64(currentImage);
      
      const base64Images = await generateThumbnails({
        prompt: "Polish this image. Enhance the lighting, colors, and overall quality to make it look like a highly professional, click-worthy thumbnail. Do not change the core subject matter, just improve the visual fidelity.",
        baseImage: baseImageBase64,
        imageSize: "1K",
        aspectRatio: generationFormat.aspectRatio,
        targetPlatform: generationFormat.targetPlatform,
        targetFormat: generationFormat.promptLabel,
        model: model,
        instructions: [
          `Output format: ${generationFormat.promptLabel}. Use a ${generationFormat.aspectRatio} canvas at ${generationFormat.dimensions}.`,
          currentFrame?.preserveFullSourceFrame ? FULL_FRAME_SOURCE_INSTRUCTION : undefined,
        ].filter(Boolean).join(" ") || undefined,
      });
      const generatedFrame = await finalizeGeneratedResult(base64Images[0], "Polish / Enhance", generationFormat.id, {
        title: generationTitle,
        preserveFullSourceFrame,
      });

      completeBackgroundGeneration(taskId, { frame: generatedFrame });

      syncBilling();
    } catch (error: any) {
      console.error("Polish failed", error);
      const errorMessage = getGenerationErrorMessage(error, "An error occurred during polishing");
      failBackgroundGeneration(taskId, errorMessage);
      if (handleUsageError(error)) {
        return;
      }
      showErrorToast(errorMessage, "Polish failed");
    } finally {
      setIsPolishing(false);
    }
  };

  const handleUpscale = async () => {
    if (!currentImage || isGenerating || isUpscaling) return;

    if (!isPaidPlan(billing?.planKey || "hobby")) {
      sendToBilling();
      return;
    }

    if (billing && !billing.canGenerate) {
      sendToBilling();
      return;
    }

    const taskId = startStudioGeneration({
      operation: "upscale",
      label: "Upscaling thumbnail",
      prompt: "Upscale 4K",
    });

    if (!taskId) {
      return;
    }

    setIsUpscaling(true);
    try {
      const generationFormat = activeOutputFormat;
      const generationTitle = deriveGeneratedTitle("Upscale 4K");
      const preserveFullSourceFrame = currentFrame?.preserveFullSourceFrame;
      const baseImageBase64 = await getBase64(currentImage);
      
      const base64Images = await generateThumbnails({
        prompt: "Enhance this image to 4K resolution. Improve every detail, sharpen edges, remove noise, and maximize visual quality for a professional high-fidelity finish. Keep the scene exactly as it is but at ultra-high resolution.",
        baseImage: baseImageBase64,
        imageSize: "4K",
        aspectRatio: generationFormat.aspectRatio,
        targetPlatform: generationFormat.targetPlatform,
        targetFormat: generationFormat.promptLabel,
        model: model,
        instructions: [
          `Output format: ${generationFormat.promptLabel}. Use a ${generationFormat.aspectRatio} canvas at ${generationFormat.dimensions}.`,
          currentFrame?.preserveFullSourceFrame ? FULL_FRAME_SOURCE_INSTRUCTION : undefined,
        ].filter(Boolean).join(" ") || undefined,
      });
      const generatedFrame = await finalizeGeneratedResult(base64Images[0], "Upscale 4K", generationFormat.id, {
        title: generationTitle,
        preserveFullSourceFrame,
      });

      completeBackgroundGeneration(taskId, { frame: generatedFrame });

      syncBilling();
    } catch (error: any) {
      console.error("Upscale failed", error);
      const errorMessage = getGenerationErrorMessage(error, "An error occurred during enhancement");
      failBackgroundGeneration(taskId, errorMessage);
      if (handleUsageError(error)) {
        return;
      }
      showErrorToast(errorMessage, "Upscale failed");
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!currentImage || isGenerating) return;

    if (billing && !billing.canGenerate) {
      sendToBilling();
      return;
    }

    const taskId = startStudioGeneration({
      operation: "remove-bg",
      label: "Removing background",
      prompt: "Remove Background",
    });

    if (!taskId) {
      return;
    }

    try {
      const generationFormat = activeOutputFormat;
      const generationTitle = deriveGeneratedTitle("Remove Background");
      const preserveFullSourceFrame = currentFrame?.preserveFullSourceFrame;
      const baseImageBase64 = await getBase64(currentImage);
      
      // Get mask from canvas if in Edit Region mode
      let maskImageBase64 = undefined;
      if (isEditRegionMode && canvasRef.current) {
        maskImageBase64 = canvasRef.current.toDataURL("image/png");
      }

      const base64Images = await generateThumbnails({
        prompt:
          "Identify all primary foreground subjects (people, animals, objects) and isolate them perfectly. Remove the entire background and make it transparent. Keep the subjects ENTIRELY intact from top to bottom—do not crop or cut off parts of the subjects. Ensure edges are sharp, natural, and highly detailed. If a mask is provided, focus on keeping the element within the masked area and removing everything else.",
        baseImage: baseImageBase64,
        referenceImage: maskImageBase64,
        referenceImagePurpose: maskImageBase64 ? "mask" : undefined,
        imageSize: "1K",
        aspectRatio: generationFormat.aspectRatio,
        targetPlatform: generationFormat.targetPlatform,
        targetFormat: generationFormat.promptLabel,
        model: model,
        background: "transparent",
        instructions: [
          `Output format: ${generationFormat.promptLabel}. Use a ${generationFormat.aspectRatio} canvas at ${generationFormat.dimensions}.`,
          currentFrame?.preserveFullSourceFrame ? FULL_FRAME_SOURCE_INSTRUCTION : undefined,
        ].filter(Boolean).join(" ") || undefined,
      });

      const generatedFrame = await finalizeGeneratedResult(base64Images[0], "Remove Background", generationFormat.id, {
        title: generationTitle,
        preserveFullSourceFrame,
      });

      completeBackgroundGeneration(taskId, {
        frame: generatedFrame,
        clearEditRegion: isEditRegionMode && Boolean(maskImageBase64),
      });

      syncBilling();
    } catch (error: any) {
      console.error("Background removal failed", error);
      const errorMessage = getGenerationErrorMessage(error, "An error occurred while removing the background");
      failBackgroundGeneration(taskId, errorMessage);
      if (handleUsageError(error)) {
        return;
      }
      showErrorToast(errorMessage, "Background removal failed");
    }
  };

  const handleInsertMe = async (faceImage: string) => {
    if (!currentImage) return;
    if (billing && !billing.canGenerate) {
      sendToBilling();
      return;
    }

    const taskId = startStudioGeneration({
      operation: "insert-me",
      label: "Inserting person",
      prompt: "Inserted Person",
    });

    if (!taskId) {
      return;
    }

    setIsUploading(true);
    try {
      const generationFormat = activeOutputFormat;
      const generationTitle = deriveGeneratedTitle("Inserted Person");
      const preserveFullSourceFrame = currentFrame?.preserveFullSourceFrame;
      const baseImageBase64 = await getBase64(currentImage);
      const referenceImageBase64 = await resolveReferenceImageForGeneration(faceImage);
      
      const base64Images = await generateThumbnails({
        prompt:
          "Insert the exact person from the reference image into this scene. If only a face is provided, generate a matching body that fits the scene naturally, but keep the face, hair, skin tone, age, and identity recognizably the same person. Do not substitute a different model or generic character. Make the result look like a seamless thumbnail.",
        baseImage: baseImageBase64,
        referenceImage: referenceImageBase64,
        referenceImagePurpose: "subject",
        imageSize: "1K",
        aspectRatio: generationFormat.aspectRatio,
        targetPlatform: generationFormat.targetPlatform,
        targetFormat: generationFormat.promptLabel,
        model: model,
        instructions: [
          `Output format: ${generationFormat.promptLabel}. Use a ${generationFormat.aspectRatio} canvas at ${generationFormat.dimensions}.`,
          currentFrame?.preserveFullSourceFrame ? FULL_FRAME_SOURCE_INSTRUCTION : undefined,
        ].filter(Boolean).join(" ") || undefined,
      });

      const generatedFrame = await finalizeGeneratedResult(base64Images[0], "Inserted Person", generationFormat.id, {
        title: generationTitle,
        preserveFullSourceFrame,
      });

      completeBackgroundGeneration(taskId, { frame: generatedFrame });
      syncBilling();
    } catch (error: any) {
      console.error("Insert failed", error);
      const errorMessage = getGenerationErrorMessage(error, "An error occurred during insertion");
      failBackgroundGeneration(taskId, errorMessage);
      if (handleUsageError(error)) {
        return;
      }
      showErrorToast(errorMessage, "Insert failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleInsertMeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showWarningToast("Reference image is too large. Please upload an image under 5MB.", "Reference too large");
      if (insertMeRef.current) insertMeRef.current.value = "";
      return;
    }

    try {
      const faceImage = await readBlobAsDataUrl(file);
      await handleInsertMe(faceImage);
    } catch (error) {
      console.error("Failed to prepare Insert Me reference", error);
      showErrorToast("Failed to load this reference image. Please try another file.", "Reference failed to load");
    } finally {
      if (insertMeRef.current) insertMeRef.current.value = "";
    }
  };


  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isFetchingYoutube, setIsFetchingYoutube] = useState(false);

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl) return;
    setIsFetchingYoutube(true);
    try {
      await importYoutubeThumbnail({
        url: youtubeUrl,
        sourceTitle: "YouTube Remix",
      });
    } catch (err: any) {
      showErrorToast(err.message || "Failed to fetch thumbnail", "Import failed");
    } finally {
      setIsFetchingYoutube(false);
      setShowYoutubeInput(false);
      setYoutubeUrl("");
    }
  };

  const handleRunToolPreset = async () => {
    if (!activeToolPreset) {
      return;
    }

    if (activeToolPreset.id === "remove-bg") {
      await handleRemoveBackground();
      return;
    }

    if (activeToolPreset.id === "upscale") {
      await handleUpscale();
      return;
    }

    await handlePolish();
  };

  const handleModalCreatorTool = async (toolId: "remove-bg" | "upscale" | "polish") => {
    setIsToolsModalOpen(false);

    if (editorState === "editing" && currentImage) {
      if (toolId === "remove-bg") {
        await handleRemoveBackground();
        return;
      }

      if (toolId === "upscale") {
        await handleUpscale();
        return;
      }

      await handlePolish();
      return;
    }

    navigate(buildCreatorToolEditorUrl(toolId));
  };

  const startScreenTitle = activeToolPreset ? activeToolPreset.title : "Create New Thumbnail";
  const startScreenDescription = activeToolPreset
    ? "Choose an image source, open it in the editor, and run the preset when you're ready."
    : "How do you want to start?";

  const currentFrame =
    history.find((item) => item.url === currentImage) ??
    (currentImage === null ? history.find((item) => item.isPlaceholder) : undefined) ??
    history[0];
  const currentFrameIndex = currentFrame ? history.indexOf(currentFrame) : -1;
  const activeOutputFormat = getStudioOutputFormat(currentFrame?.formatId ?? selectedOutputFormatId);
  const ActiveOutputIcon = activeOutputFormat.Icon;
  const activeOutputAspectClass = getOutputAspectClass(activeOutputFormat.id);
  const currentFrameTitle = currentFrame ? getHistoryItemTitle(currentFrame) : activeToolPreset ? activeToolPreset.title : "New Composition";
  const currentFramePrompt = normalizeThumbnailTitle(currentFrame?.prompt);
  const shouldShowCurrentFramePrompt =
    Boolean(currentFramePrompt) && currentFramePrompt !== normalizeThumbnailTitle(currentFrameTitle);

  useEffect(() => {
    if (currentFrame) {
      const nextFormatId = normalizeStudioOutputFormatId(currentFrame.formatId);
      setSelectedOutputFormatId(nextFormatId);
      setPreviewMode((mode) => (mode === "image" ? mode : nextFormatId));
    }
  }, [currentFrame?.formatId, currentFrameIndex]);

  const handleOutputFormatChange = (formatId: StudioOutputFormatId) => {
    const nextFormatId = normalizeStudioOutputFormatId(formatId);

    setSelectedOutputFormatId(nextFormatId);
    setPreviewMode((mode) => (mode === "image" ? mode : nextFormatId));

    if (currentFrameIndex >= 0) {
      setHistory((prev) =>
        prev.map((entry, index) => (index === currentFrameIndex ? { ...entry, formatId: nextFormatId } : entry))
      );
    }
  };

  useEffect(() => {
    if (isOptimizerOpen) {
      setOptimizerTitle((current) => current || currentFrameTitle);
    }
  }, [currentFrameTitle, isOptimizerOpen]);

  const handleAutoTitle = async () => {
    const targetIndex = currentFrameIndex;
    const targetFrame = history[targetIndex];

    if (!currentImage || !targetFrame || targetIndex < 0 || isAutoTitling || isGenerating) {
      return;
    }

    setIsAutoTitling(true);
    try {
      const imageUrl = await getBase64(currentImage);
      const { title } = await generateAutoThumbnailTitle({
        imageUrl,
        currentTitle: currentFrameTitle,
        prompt: currentFramePrompt || targetFrame.prompt || prompt,
      });
      const nextTitle = normalizeThumbnailTitle(title);

      if (!nextTitle) {
        throw new Error("AI did not return a usable title.");
      }

      if (user?.uid && targetFrame.generationId) {
        const { error } = await supabase
          .from("generations")
          .update({ title: nextTitle })
          .eq("id", targetFrame.generationId)
          .eq("user_id", user.uid);

        if (error) {
          throw error;
        }
      }

      if (user?.uid && targetFrame.assetReference) {
        const assetPath = getUserAssetPath(targetFrame.assetReference, user.uid);

        if (assetPath) {
          const { error } = await supabase
            .from("assets")
            .update({ file_name: `${nextTitle}.png` })
            .eq("user_id", user.uid)
            .eq("url", assetPath);

          if (error) {
            console.error("Failed to rename asset record from Auto AI title", error);
          }
        }
      }

      setHistory((prev) =>
        prev.map((entry, index) =>
          index === targetIndex
            ? {
                ...entry,
                title: nextTitle,
                sourceTitle: entry.sourceType === "youtube" ? nextTitle : entry.sourceTitle,
              }
            : entry
        )
      );
      setOptimizerTitle(nextTitle);
      showToast({
        tone: "success",
        title: "Auto title ready",
        message: "AI generated a title and placed it above the thumbnail.",
      });
    } catch (error) {
      console.error("Auto title failed", error);
      showErrorToast(error instanceof Error ? error.message : "Failed to generate an AI title.", "Auto title failed");
    } finally {
      setIsAutoTitling(false);
    }
  };

  const renderYoutubePreview = () => {
    const sidebarItems = ["All", "Subscriptions", "Library", "History", "Your Videos", "Watch Later"];
    const topics = ["All", "Thumbnails", "AI", "Creator", "Editing", "Gaming", "Tech", "Live", "Tutorials"];
    const skeletonCards = Array.from({ length: 8 });

    return (
      <div className="overflow-hidden bg-[#0f0f0f] text-white">
        <div className="flex h-14 items-center gap-4 border-b border-white/10 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
            <span className="block h-0.5 w-5 rounded-full bg-white shadow-[0_6px_0_white,0_-6px_0_white]" />
          </div>
          <div className="flex items-center gap-2 font-semibold">
            <Youtube className="h-6 w-6 fill-red-600 text-red-600" />
            <span>YouTube</span>
          </div>
          <div className="mx-auto hidden h-10 max-w-xl flex-1 items-center rounded-full border border-white/15 bg-[#121212] pl-5 text-sm text-white/45 sm:flex">
            Search
            <div className="ml-auto flex h-full w-14 items-center justify-center border-l border-white/15 bg-white/5">
              <Search className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="h-9 w-9 rounded-full bg-white/15" />
        </div>

        <div className="flex max-h-[75vh] min-h-[520px]">
          <aside className="hidden w-[220px] shrink-0 border-r border-white/5 px-3 py-4 lg:block">
            {sidebarItems.map((item, index) => (
              <div
                key={item}
                className={cn(
                  "mb-1 flex h-11 items-center rounded-xl px-4 text-sm font-medium",
                  index === 0 ? "bg-white/15 text-white" : "text-white/85"
                )}
              >
                {item}
              </div>
            ))}
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="no-scrollbar mb-6 flex gap-3 overflow-x-auto">
              {topics.map((topic, index) => (
                <span
                  key={topic}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-sm font-semibold",
                    index === 0 ? "bg-white text-black" : "bg-white/15 text-white"
                  )}
                >
                  {topic}
                </span>
              ))}
            </div>

            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
              <article>
                <div className="aspect-video overflow-hidden rounded-xl bg-[#222]">
                  <img
                    src={currentImage || ""}
                    alt={currentFrameTitle}
                    className="h-full w-full object-cover"
                    onError={handleCanvasImageError}
                  />
                </div>
                <div className="mt-3 flex gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-red-600 to-zinc-700" />
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white">{currentFrameTitle}</h3>
                    <p className="mt-1 text-xs text-white/55">Thumora AI</p>
                    <p className="text-xs text-white/55">124K views • 2 hours ago</p>
                  </div>
                </div>
              </article>

              {skeletonCards.map((_, index) => (
                <article key={index} aria-hidden="true">
                  <div className="aspect-video rounded-xl bg-white/20" />
                  <div className="mt-3 flex gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-white/15" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-4/5 rounded bg-white/18" />
                      <div className="h-3 w-3/5 rounded bg-white/12" />
                      <div className="h-3 w-2/5 rounded bg-white/12" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  };

  const renderTikTokPreview = () => (
    <div className="flex min-h-[520px] items-center justify-center overflow-hidden bg-[#050505] px-4 py-6 text-white">
      <div className="relative aspect-[9/16] h-[72vh] min-h-[420px] max-h-[680px] overflow-hidden rounded-[34px] border border-white/15 bg-black shadow-2xl">
        <img
          src={currentImage || ""}
          alt={currentFrameTitle}
          className="h-full w-full object-cover"
          onError={handleCanvasImageError}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/65" />
        <div className="absolute left-0 right-0 top-0 flex items-center justify-center gap-5 px-5 pt-5 text-sm font-bold">
          <span className="text-white/65">Following</span>
          <span className="border-b-2 border-white pb-1">For You</span>
        </div>
        <div className="absolute bottom-6 left-4 right-16">
          <p className="text-sm font-bold">@thumora</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{currentFrameTitle}</p>
          <p className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">Original sound</p>
        </div>
        <div className="absolute bottom-8 right-4 flex flex-col items-center gap-4">
          {["", "", ""].map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div className="h-11 w-11 rounded-full bg-white/20 backdrop-blur" />
              <span className="text-[10px] font-bold">{index === 0 ? "12K" : index === 1 ? "348" : "Share"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderInstagramPreview = (format: StudioOutputFormatOption) => {
    if (format.aspectRatio === "1:1") {
      return (
        <div className="flex min-h-[520px] items-center justify-center overflow-hidden bg-[#efefef] px-4 py-8 text-black">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" />
              <div className="min-w-0">
                <p className="text-sm font-bold">thumora.ai</p>
                <p className="text-xs text-black/55">{format.label}</p>
              </div>
            </div>
            <div className="aspect-square bg-black">
              <img
                src={currentImage || ""}
                alt={currentFrameTitle}
                className="h-full w-full object-cover"
                onError={handleCanvasImageError}
              />
            </div>
            <div className="space-y-2 px-4 py-3">
              <div className="flex gap-3">
                <div className="h-5 w-5 rounded-full border-2 border-black" />
                <div className="h-5 w-5 rounded-full border-2 border-black" />
                <div className="h-5 w-5 rounded-full border-2 border-black" />
              </div>
              <p className="text-sm font-bold">8,421 likes</p>
              <p className="line-clamp-2 text-sm">
                <span className="font-bold">thumora.ai</span> {currentFrameTitle}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[520px] items-center justify-center overflow-hidden bg-[#111] px-4 py-6 text-white">
        <div className="relative aspect-[9/16] h-[72vh] min-h-[420px] max-h-[680px] overflow-hidden rounded-[34px] border border-white/15 bg-black shadow-2xl">
          <img
            src={currentImage || ""}
            alt={currentFrameTitle}
            className="h-full w-full object-cover"
            onError={handleCanvasImageError}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/65" />
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-5 pt-5 text-sm font-bold">
            <span>Reels</span>
            <Instagram className="h-5 w-5" />
          </div>
          <div className="absolute bottom-6 left-4 right-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" />
              <p className="text-sm font-bold">thumora.ai</p>
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{currentFrameTitle}</p>
          </div>
          <div className="absolute bottom-8 right-4 flex flex-col items-center gap-4">
            {["", "", ""].map((_, index) => (
              <div key={index} className="h-10 w-10 rounded-full bg-white/18 backdrop-blur" />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSocialPreview = (format: StudioOutputFormatOption) => {
    if (format.id === "youtube") {
      return renderYoutubePreview();
    }

    if (format.id === "tiktok") {
      return renderTikTokPreview();
    }

    return renderInstagramPreview(format);
  };

  const renderOutputFormatSelector = () => (
    <div
      className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-background p-1"
      role="radiogroup"
      aria-label="Output format"
    >
      {STUDIO_OUTPUT_FORMATS.map((format) => {
        const Icon = format.Icon;
        const isActive = activeOutputFormat.id === format.id;

        return (
          <button
            key={format.id}
            type="button"
            onClick={() => handleOutputFormatChange(format.id)}
            disabled={isGenerating}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              isActive ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={`${format.label} - ${format.dimensions}`}
            aria-checked={isActive}
            role="radio"
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{format.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );

  const openRenameModal = (index: number) => {
    const item = history[index];

    if (!item) {
      return;
    }

    const title = getHistoryItemTitle(item);
    setRenameModal({ index, title });
    setDraftTitle(title);
    setActiveMenuIndex(null);
    setIsMobileHistorySheetOpen(false);
  };

  const currentDraftAutosaveSignature = buildStudioDraftAutosaveSignature({
    history,
    currentFrameIndex: currentFrameIndex >= 0 ? currentFrameIndex : 0,
    title: currentFrameTitle,
    promptDraft: prompt,
    agentMemory,
    clarificationData,
    isBrainModeEnabled,
    attachment,
    attachmentAssetReference,
    ownedAssetReferences: ownedDraftAssetReferences,
  });

  studioDraftStateRef.current = {
    history,
    currentFrameIndex: currentFrameIndex >= 0 ? currentFrameIndex : 0,
    title: normalizeThumbnailTitle(currentFrameTitle),
    promptDraft: prompt,
    agentMemory,
    clarificationData,
    isBrainModeEnabled,
    attachment,
    attachmentAssetReference,
    ownedAssetReferences: ownedDraftAssetReferences,
    activeDraftId,
    signature: currentDraftAutosaveSignature,
  };

  persistStudioDraftRef.current = async () => {
    if (isPersistingDraftRef.current) {
      queuedDraftSaveRef.current = true;
      return false;
    }

    isPersistingDraftRef.current = true;
    let didPersistDraft = false;

    try {
      do {
        queuedDraftSaveRef.current = false;

        const state = studioDraftStateRef.current;
        if (!state || !user?.uid || isDraftHydratingRef.current) {
          continue;
        }

        let nextHistory = [...state.history];
        let nextOwnedReferences = normalizeOwnedDraftReferences(state.ownedAssetReferences);
        let normalizedHistory = false;

        for (let index = 0; index < nextHistory.length; index += 1) {
          const item = nextHistory[index];
          const resolvedAssetReference =
            item.assetReference || (typeof item.url === "string" ? getUserAssetPath(item.url, user.uid) : null);

          if (resolvedAssetReference) {
            if (item.assetReference !== resolvedAssetReference) {
              nextHistory[index] = {
                ...item,
                assetReference: resolvedAssetReference,
              };
              normalizedHistory = true;
            }
            continue;
          }

          if (!item.url || item.isPlaceholder) {
            continue;
          }

          if (!item.url.startsWith("data:image") && !item.url.startsWith("blob:")) {
            continue;
          }

          const uploadedAsset = await uploadOwnedDraftMedia(item.url, item.title || item.prompt || "studio-frame");
          nextHistory[index] = {
            ...item,
            url: uploadedAsset.previewUrl,
            assetReference: uploadedAsset.assetReference,
          };
          if (uploadedAsset.owned) {
            nextOwnedReferences = normalizeOwnedDraftReferences([...nextOwnedReferences, uploadedAsset.assetReference]);
          }
          normalizedHistory = true;
        }

        let nextAttachment = state.attachment;
        let nextAttachmentAssetReference =
          state.attachmentAssetReference ||
          (typeof state.attachment === "string" ? getUserAssetPath(state.attachment, user.uid) : null);
        let normalizedAttachment = false;

        if (!nextAttachmentAssetReference && state.attachment) {
          if (state.attachment.startsWith("data:image") || state.attachment.startsWith("blob:")) {
            const uploadedAttachment = await uploadOwnedDraftMedia(state.attachment, "studio-reference");
            nextAttachment = uploadedAttachment.previewUrl;
            nextAttachmentAssetReference = uploadedAttachment.assetReference;
            if (uploadedAttachment.owned) {
              nextOwnedReferences = normalizeOwnedDraftReferences([
                ...nextOwnedReferences,
                uploadedAttachment.assetReference,
              ]);
            }
            normalizedAttachment = true;
          }
        } else if (nextAttachmentAssetReference) {
          const resolvedAttachmentUrl = await resolveEditorImageUrl(nextAttachmentAssetReference);
          if (resolvedAttachmentUrl !== nextAttachment) {
            nextAttachment = resolvedAttachmentUrl;
            normalizedAttachment = true;
          }
        }

        const boundedCurrentFrameIndex = nextHistory.length
          ? Math.max(0, Math.min(state.currentFrameIndex, nextHistory.length - 1))
          : 0;
        const normalizedOwnedReferences = normalizeOwnedDraftReferences(nextOwnedReferences);
        const payload = buildStudioDraftPayload({
          history: nextHistory,
          currentFrameIndex: boundedCurrentFrameIndex,
          title: state.title,
          promptDraft: state.promptDraft,
          agentMemory: state.agentMemory,
          clarificationData: state.clarificationData,
          isBrainModeEnabled: state.isBrainModeEnabled,
          attachmentAssetReference: nextAttachmentAssetReference,
          ownedAssetReferences: normalizedOwnedReferences,
        });
        const nextSignature = buildStudioDraftAutosaveSignature({
          history: payload.history,
          currentFrameIndex: payload.currentFrameIndex,
          title: state.title,
          promptDraft: state.promptDraft,
          agentMemory: state.agentMemory,
          clarificationData: state.clarificationData,
          isBrainModeEnabled: state.isBrainModeEnabled,
          attachment: nextAttachmentAssetReference ?? nextAttachment,
          attachmentAssetReference: nextAttachmentAssetReference,
          ownedAssetReferences: normalizedOwnedReferences,
        });

        if (normalizedHistory) {
          setHistory(nextHistory);
          setCurrentImage(nextHistory[boundedCurrentFrameIndex]?.url ?? null);
        }

        if (normalizedAttachment) {
          setAttachment(nextAttachment);
        }

        if (normalizedAttachment || state.attachmentAssetReference !== nextAttachmentAssetReference) {
          setAttachmentAssetReference(nextAttachmentAssetReference);
        }

        if (state.ownedAssetReferences.join("|") !== normalizedOwnedReferences.join("|")) {
          setOwnedDraftAssetReferences(normalizedOwnedReferences);
        }

        if (state.activeDraftId && lastPersistedDraftSignatureRef.current === nextSignature) {
          pendingExternalLaunchSignatureRef.current = null;
          continue;
        }

        const now = new Date().toISOString();
        const draftTitleValue = normalizeThumbnailTitle(state.title) || "Untitled draft";
        const query = state.activeDraftId
          ? supabase
              .from("drafts")
              .update({
                title: draftTitleValue,
                data: payload,
                updated_at: now,
              })
              .eq("id", state.activeDraftId)
              .eq("user_id", user.uid)
          : supabase.from("drafts").insert({
              user_id: user.uid,
              title: draftTitleValue,
              data: payload,
              updated_at: now,
            });

        const { data, error } = await query.select("id, title, data, created_at, updated_at").single();

        if (error) {
          throw error;
        }

        const normalizedDraft = normalizeStudioEditorDraftRecord(data);
        if (normalizedDraft?.id && normalizedDraft.id !== state.activeDraftId) {
          setActiveDraftId(normalizedDraft.id);
        }

        lastPersistedDraftSignatureRef.current = nextSignature;
        pendingExternalLaunchSignatureRef.current = null;
        didPersistDraft = true;
      } while (queuedDraftSaveRef.current);
    } catch (error) {
      console.error("Failed to autosave Studio draft", error);
      return false;
    } finally {
      isPersistingDraftRef.current = false;
    }

    return didPersistDraft || lastPersistedDraftSignatureRef.current === studioDraftStateRef.current?.signature;
  };

  useEffect(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (!user?.uid || editorState !== "editing" || history.length === 0 || isDraftHydratingRef.current) {
      return;
    }

    if (!activeDraftId && pendingExternalLaunchSignatureRef.current === currentDraftAutosaveSignature) {
      return;
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistStudioDraftRef.current?.();
    }, 1000);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [activeDraftId, currentDraftAutosaveSignature, editorState, history.length, user?.uid]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSaveDraft = async () => {
    if (!user?.uid || editorState !== "editing" || history.length === 0 || isPersistingDraftRef.current) {
      return;
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setSaveStatus('saving');
    try {
      const didSave = await persistStudioDraftRef.current?.();
      if (didSave) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (e) {
      console.error("Failed to save draft", e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleRenameHistoryItem = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!renameModal) {
      return;
    }

    const item = history[renameModal.index];
    const nextTitle = normalizeThumbnailTitle(draftTitle);

    if (!item || !nextTitle) {
      return;
    }

    try {
      if (user?.uid) {
        if (item.generationId) {
          const { error } = await supabase
            .from("generations")
            .update({ title: nextTitle })
            .eq("id", item.generationId)
            .eq("user_id", user.uid);

          if (error) {
            throw error;
          }
        }
      }

      if (user?.uid && item.assetReference) {
        const assetPath = getUserAssetPath(item.assetReference, user.uid);

        if (assetPath) {
          const { error } = await supabase
            .from("assets")
            .update({ file_name: `${nextTitle}.png` })
            .eq("user_id", user.uid)
            .eq("url", assetPath);

          if (error) {
            console.error("Failed to rename imported asset record", error);
          }
        }
      }

      setHistory((prev) =>
        prev.map((entry, index) =>
          index === renameModal.index
            ? {
                ...entry,
                title: nextTitle,
                sourceTitle: entry.sourceType === "youtube" ? nextTitle : entry.sourceTitle,
              }
            : entry
        )
      );
      setRenameModal(null);
      setDraftTitle("");
    } catch (error) {
      console.error("Failed to rename thumbnail", error);
      showErrorToast("Failed to rename this thumbnail.", "Rename failed");
    }
  };

  const renderOptimizerDrawer = () => {
    const paid = isPaidPlan(billing?.planKey || "hobby");
    const latestVariants = latestGrowthExperiment?.variants || [];
    const tabButtonClass = (tab: OptimizerTab) =>
      cn(
        "shrink-0 rounded-lg px-3 py-2 text-xs font-bold capitalize transition-colors",
        optimizerTab === tab
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      );

    return (
      <AnimatePresence>
        {isOptimizerOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[130] bg-black/30 backdrop-blur-[1px]"
              onClick={() => setIsOptimizerOpen(false)}
            />
            <motion.aside
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.18 }}
              className="fixed bottom-0 right-0 top-0 z-[140] flex w-full max-w-[440px] flex-col border-l border-border bg-background shadow-2xl"
              aria-label="Growth optimizer"
            >
              <div className="border-b border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Growth Optimizer</p>
                    <h2 className="mt-1 text-xl font-bold text-foreground">Expected performance tools</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOptimizerOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close optimizer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Video title
                    <input
                      value={optimizerTitle}
                      onChange={(event) => setOptimizerTitle(event.target.value)}
                      placeholder="Paste the working video title"
                      className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-accent"
                    />
                  </label>
                </div>

                <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-card p-1 no-scrollbar">
                  {OPTIMIZER_TABS.map((tab) => (
                    <button key={tab} type="button" onClick={() => setOptimizerTab(tab)} className={tabButtonClass(tab)}>
                      {tab === "ab" ? "A/B" : tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {!paid ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <p className="text-sm font-bold text-foreground">Paid plans include Growth Optimizer</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      CTR estimates, title packs, face optimization, and viral patterns are included for paid plans without using generation credits.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/settings/billing?reason=growth-lab")}
                      className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      Upgrade
                    </button>
                  </div>
                ) : null}

                {optimizerError ? (
                  <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
                    {optimizerError}
                  </div>
                ) : null}

                {optimizerTab === "score" ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => void handleCtrScore()}
                      disabled={!paid || !currentImage || optimizerLoading !== null}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {optimizerLoading === "score" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
                      Run AI CTR estimate
                    </button>
                    {ctrEstimate ? (
                      <div className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">AI CTR estimate</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">Expected performance: {ctrEstimate.performanceLabel}</p>
                          </div>
                          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-foreground text-2xl font-black text-background">
                            {ctrEstimate.score}
                          </div>
                        </div>
                        <div className="mt-5 space-y-3">
                          {ctrEstimate.factors.map((factor) => (
                            <div key={factor.key}>
                              <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                                <span className="text-foreground">{factor.label}</span>
                                <span className="text-muted-foreground">{factor.score}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-accent" style={{ width: `${factor.score}%` }} />
                              </div>
                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{factor.detail}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 rounded-xl bg-muted/50 p-3">
                          <p className="text-xs font-bold text-foreground">Recommendations</p>
                          <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                            {ctrEstimate.recommendations.map((recommendation) => (
                              <li key={recommendation}>{recommendation}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <EmptyOptimizerState icon={Target} title="Score the current thumbnail" body="Run a structured estimate for faces, contrast, composition, readability, lighting, and niche fit." />
                    )}
                  </div>
                ) : null}

                {optimizerTab === "titles" ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => void handleOptimizationPack()}
                      disabled={!paid || optimizerLoading !== null || !(optimizerTitle || currentFrameTitle).trim()}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {optimizerLoading === "pack" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                      Generate 3 title + thumbnail matches
                    </button>
                    {latestVariants.length ? (
                      <VariantList variants={latestVariants} onApply={applyGrowthVariantToCanvas} />
                    ) : (
                      <EmptyOptimizerState icon={Sparkles} title="Generate matched variants" body="The pack creates three improved titles and three matching thumbnail variants, then saves them to Growth Lab." />
                    )}
                  </div>
                ) : null}

                {optimizerTab === "ab" ? (
                  <div className="space-y-4">
                    {latestGrowthExperiment ? (
                      <>
                        <div className="rounded-2xl border border-border bg-card p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">A/B experiment</p>
                          <h3 className="mt-2 text-lg font-bold text-foreground">{latestGrowthExperiment.title}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Mock metrics are saved now with API-ready fields for future YouTube Analytics sync.
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate("/tools/growth")}
                            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                          >
                            Open in Growth Lab
                          </button>
                        </div>
                        <VariantList variants={latestVariants} onApply={applyGrowthVariantToCanvas} />
                      </>
                    ) : (
                      <EmptyOptimizerState icon={BarChart3} title="No A/B variants yet" body="Generate a title pack, face pass, or viral pattern. Saved variants appear here with mock impressions, clicks, and CTR." />
                    )}
                  </div>
                ) : null}

                {optimizerTab === "face" ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => void handleFaceOptimization()}
                      disabled={!paid || !currentImage || optimizerLoading !== null}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {optimizerLoading === "face" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
                      Smart face optimization
                    </button>
                    <div className="grid gap-3">
                      {["Facial expression intensity", "Eye direction toward focal point", "Lighting consistency"].map((item) => (
                        <div key={item} className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground">
                          {item}
                        </div>
                      ))}
                    </div>
                    <VariantList variants={latestGrowthExperiment?.experimentType === "face_optimize" ? latestVariants : []} onApply={applyGrowthVariantToCanvas} />
                  </div>
                ) : null}

                {optimizerTab === "patterns" ? (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      {GROWTH_PATTERN_OPTIONS.map((pattern) => (
                        <button
                          key={pattern.key}
                          type="button"
                          onClick={() => void handleViralPattern(pattern.key)}
                          disabled={!paid || !currentImage || optimizerLoading !== null}
                          className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-bold text-foreground">{pattern.label}</p>
                            {optimizerLoading === "pattern" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <TrendingUp className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{pattern.description}</p>
                        </button>
                      ))}
                    </div>
                    <VariantList variants={latestGrowthExperiment?.experimentType === "viral_pattern" ? latestVariants : []} onApply={applyGrowthVariantToCanvas} />
                  </div>
                ) : null}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    );
  };

  const renderToolbar = () => {
    const dockButtonClass =
      "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl transition-colors";
    const dockIconClass = "h-4.5 w-4.5";

    if (isEditRegionMode) {
      return (
        <div className="mx-auto flex w-full max-w-full items-center gap-2 overflow-x-auto rounded-[24px] border border-border bg-card/95 p-2 shadow-2xl no-scrollbar lg:w-auto lg:max-w-none lg:rounded-2xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBrushMode('brush')}
              className={cn(
                dockButtonClass,
                brushMode === 'brush' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title="Brush"
            >
              <Brush className={dockIconClass} />
            </button>
            <button
              type="button"
              onClick={() => setBrushMode('eraser')}
              className={cn(
                dockButtonClass,
                brushMode === 'eraser' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title="Eraser"
            >
              <Eraser className={dockIconClass} />
            </button>
            <div className="h-7 w-px bg-border" />
            <button
              type="button"
              onClick={() => setBrushSize(Math.max(10, brushSize - 10))}
              className={cn(dockButtonClass, "text-muted-foreground hover:text-foreground")}
              title="Decrease brush size"
            >
              <Minus className={dockIconClass} />
            </button>
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-muted/60 px-3 py-2">
              <div className="h-3 w-3 rounded-full bg-foreground" style={{ transform: `scale(${brushSize / 50})` }} />
              <span className="w-10 text-center text-xs font-medium text-foreground">{brushSize}px</span>
            </div>
            <button
              type="button"
              onClick={() => setBrushSize(Math.min(150, brushSize + 10))}
              className={cn(dockButtonClass, "text-muted-foreground hover:text-foreground")}
              title="Increase brush size"
            >
              <Plus className={dockIconClass} />
            </button>
            <div className="h-7 w-px bg-border" />
            <button
              type="button"
              onClick={clearCanvas}
              className={cn(dockButtonClass, "text-muted-foreground hover:bg-muted hover:text-foreground")}
              title="Clear mask"
            >
              <Trash2 className={dockIconClass} />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditRegionMode(false);
                clearCanvas();
              }}
              className={cn(dockButtonClass, "text-muted-foreground hover:bg-muted hover:text-foreground")}
              title="Exit edit mode"
            >
              <X className={dockIconClass} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-full items-center gap-2 overflow-x-auto rounded-[24px] border border-border bg-card/95 p-2 shadow-2xl no-scrollbar lg:w-auto lg:max-w-none lg:rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditRegionMode(true)}
            className={cn(dockButtonClass, "bg-muted text-foreground hover:bg-muted/80")}
            title="Edit region"
          >
            <Brush className={dockIconClass} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(dockButtonClass, "text-muted-foreground hover:bg-muted hover:text-foreground")}
            title="Upload image"
          >
            <ImagePlus className={dockIconClass} />
          </button>
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={cn(
              dockButtonClass,
              showGrid ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title="Toggle grid"
          >
            <Grid className={dockIconClass} />
          </button>
          {showGrid ? (
            <label className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-muted/60 px-3 text-xs font-medium text-foreground">
              <span className="h-3.5 w-3.5 rounded-full border border-border" style={{ backgroundColor: gridColor }} />
              <span>Grid</span>
              <input
                type="color"
                value={gridColor}
                onChange={(event) => setGridColor(event.target.value)}
                className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
                aria-label="Pick grid color"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOptimizerTitle((current) => current || currentFrameTitle);
              setIsOptimizerOpen(true);
            }}
            className={cn(
              dockButtonClass,
              isOptimizerOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title="Open Growth Optimizer"
          >
            <Target className={dockIconClass} />
          </button>
          <button
            type="button"
            onClick={() => {
              setAssetsModalMode('replaceSubject');
              setIsAssetsModalOpen(true);
            }}
            className={cn(dockButtonClass, "relative text-muted-foreground hover:bg-muted hover:text-foreground")}
            title="Insert subject"
          >
            <ScanFace className={dockIconClass} />
            {isUploading ? (
              <span className="absolute right-1.5 top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-foreground text-background">
                <X className="h-1.5 w-1.5" />
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setAssetsModalMode('insert');
              setIsAssetsModalOpen(true);
            }}
            className={cn(dockButtonClass, "text-muted-foreground hover:bg-muted hover:text-foreground")}
            title="Asset library"
          >
            <Layers className={dockIconClass} />
          </button>

          <button
            type="button"
            onClick={() => navigate("/templates")}
            className={cn(dockButtonClass, "text-muted-foreground hover:bg-muted hover:text-foreground")}
            title="Open templates"
          >
            <Puzzle className={dockIconClass} />
          </button>



          <button
            type="button"
            onClick={handleRemoveBackground}
            disabled={isGenerating}
            className={cn(
              dockButtonClass,
              activeToolPreset?.id === "remove-bg"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            title="Remove background"
          >
            <Scissors className={dockIconClass} />
          </button>
          <button
            type="button"
            onClick={handlePolish}
            disabled={isGenerating}
            className={cn(
              dockButtonClass,
              activeToolPreset?.id === "polish"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            title="Polish image"
          >
            <Stamp className={dockIconClass} />
          </button>
          <button
            type="button"
            onClick={handleUpscale}
            disabled={isGenerating}
            className={cn(
              dockButtonClass,
              isPaidPlan(billing?.planKey || "hobby")
                ? activeToolPreset?.id === "upscale"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                : "text-amber-500/60 hover:bg-amber-500/10 hover:text-amber-500",
              "disabled:cursor-not-allowed disabled:opacity-50 relative"
            )}
            title={isPaidPlan(billing?.planKey || "hobby") ? "Enhance Quality (4K)" : "Enhance Quality (Pro Only)"}
          >
            <Maximize2 className={dockIconClass} />
            {!isPaidPlan(billing?.planKey || "hobby") && (
              <span className="absolute -right-1 -top-1 block h-2 w-2 rounded-full bg-amber-500" />
            )}
          </button>
        </div>

        <div className="h-8 w-px bg-border" />

        <div ref={modelDropdownRef} className="relative overflow-visible">
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-muted px-4 text-sm font-medium transition-colors hover:bg-muted/80"
            aria-haspopup="listbox"
            aria-expanded={isModelDropdownOpen}
          >
            <span className="max-w-[132px] truncate">{activeModel.label}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {typeof document !== "undefined" && isModelDropdownOpen && modelMenuStyle
            ? createPortal(
                <AnimatePresence>
                  <motion.div
                    ref={modelMenuRef}
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    className="overflow-hidden rounded-xl border border-border bg-background py-1 shadow-xl sm:py-2"
                    style={modelMenuStyle}
                    role="listbox"
                  >
                    {modelOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setModel(option.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted sm:px-4 sm:py-2.5"
                      >
                        <span className={model === option.id ? "font-medium text-foreground" : "text-muted-foreground"}>
                          {option.label}
                        </span>
                        {model === option.id ? <div className="h-1.5 w-1.5 rounded-full bg-foreground" /> : null}
                      </button>
                    ))}
                  </motion.div>
                </AnimatePresence>,
                document.body
              )
            : null}
        </div>

        <button
          type="button"
          onClick={() => void downloadImage()}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-opacity hover:opacity-90"
          title="Export"
        >
          <Download className={dockIconClass} />
        </button>
      </div>
    );
  };

  const renderPromptComposer = () => {
    const isOutOfCredits = billing ? !billing.canGenerate : false;
    const toolLabels = [
      activeToolPreset?.title,
      attachment ? "Reference image" : null,
      isEditRegionMode ? "Masked edit" : null,
    ].filter(Boolean);
    const liveComposerStatus = isClarifying
      ? (isBrainModeEnabled ? "Brain mode is thinking..." : "Agent is thinking...")
      : isGenerating
        ? getProgressMessage()
        : null;
    const clarificationLabel = clarificationData?.source === "brain" ? "Brain question" : "Agent reply";
    const iconButtonClass =
      "relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-7 lg:w-7";

    return (
      <div className={cn(
        "relative rounded-[18px] border px-2.5 py-2 transition-colors lg:px-2 lg:py-1.5",
        isOutOfCredits ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card",
        isAttachmentDragActive ? "border-indigo-400 bg-indigo-500/10" : ""
      )}
        onDragEnter={handleAttachmentDragEnter}
        onDragOver={handleAttachmentDragOver}
        onDragLeave={handleAttachmentDragLeave}
        onDrop={handleAttachmentDrop}
      >
        {isAttachmentDragActive ? (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[18px] border border-indigo-400 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background shadow-lg">
              <ImagePlus className="h-3.5 w-3.5" />
              Reference image
            </div>
          </div>
        ) : null}

        {clarificationData?.status === "needs_clarification" ? (
          <div className="mb-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{clarificationLabel}</p>
                <p className="mt-1 text-xs leading-5 text-foreground">{clarificationData.question}</p>
              </div>
              <button
                type="button"
                onClick={() => setClarificationData(null)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Dismiss question"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleGenerate(false)}
                disabled={isClarifying || isGenerating || !prompt.trim()}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Reply
              </button>
              {clarificationData.optimizedPrompt.trim() ? (
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={isClarifying || isGenerating}
                  className="rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Use draft
                </button>
              ) : null}
            </div>
          </div>
        ) : liveComposerStatus ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-30" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground" />
            </span>
            <span>{liveComposerStatus}</span>
          </motion.div>
        ) : toolLabels.length > 0 ? (
          <div className="mb-1.5 truncate px-1 text-[11px] text-muted-foreground">
            Using {toolLabels.join(" + ")}
          </div>
        ) : null}

        <textarea
          ref={promptInputRef}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            resizePromptInput();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (isOutOfCredits) {
                sendToBilling();
              } else {
                handleGenerate();
              }
            }
          }}
          disabled={isOutOfCredits}
          placeholder={
            isOutOfCredits 
              ? "Upgrade to continue." 
              : isEditRegionMode 
                ? "Describe what to generate inside the masked area..." 
                : "Ask for an edit or a new thumbnail..."
          }
          className={cn(
            "no-scrollbar min-h-[34px] max-h-24 w-full resize-none overflow-hidden bg-transparent px-1 py-0.5 text-[13px] leading-5 text-foreground outline-none lg:h-7 lg:min-h-0 lg:max-h-20 lg:px-0.5 lg:py-0 lg:text-xs",
            isOutOfCredits ? "placeholder:text-amber-500/50 cursor-not-allowed" : "placeholder:text-muted-foreground"
          )}
          rows={1}
        />

        {attachment && (
          <div className="mb-2 mt-1 relative inline-block">
            <div className="relative h-12 w-16 overflow-hidden rounded-lg border border-border bg-muted">
              <img src={attachment} alt="Attachment" className="h-full w-full object-cover" decoding="async" />
              <button
                type="button"
                onClick={removeAttachment}
                className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background/60 text-foreground hover:bg-background"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between gap-2 lg:mt-1 lg:gap-1.5">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                setIsBrainModeEnabled((current) => !current);
                if (isBrainModeEnabled && clarificationData?.source === "brain") {
                  setClarificationData(null);
                }
              }}
              className={cn(
                iconButtonClass,
                isBrainModeEnabled ? "bg-muted text-foreground" : ""
              )}
              title={isBrainModeEnabled ? "Brain mode on" : "Brain mode off"}
              aria-pressed={isBrainModeEnabled}
            >
              <Brain className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
              {isBrainModeEnabled ? (
                <span className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-foreground text-background">
                  <Check className="h-2 w-2" />
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className={cn(
                iconButtonClass,
                attachment ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title="Attach reference image"
            >
              <Paperclip className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={isOutOfCredits ? sendToBilling : () => handleGenerate()}
            disabled={isGenerating || isClarifying || (!isOutOfCredits && !prompt.trim())}
            className={cn(
              "flex h-8 items-center justify-center rounded-full transition-all lg:h-7",
              isOutOfCredits
                ? "bg-amber-500 text-black px-4 text-xs font-bold hover:bg-amber-400"
                : prompt.trim() && !isGenerating && !isClarifying
                  ? "bg-foreground text-background w-8 lg:w-7 hover:opacity-90"
                  : "bg-muted text-muted-foreground/35 w-8 lg:w-7"
            )}
            title={isOutOfCredits ? "Upgrade to generate" : "Generate"}
          >
            {isGenerating || isClarifying ? (
              <Loader2 className="h-4 w-4 animate-spin lg:h-3 lg:w-3" />
            ) : isOutOfCredits ? (
              <span className="whitespace-nowrap">Upgrade</span>
            ) : (
              <ArrowUp className="h-4 w-4 lg:h-3 lg:w-3" />
            )}
          </button>
        </div>
      </div>
    );
  };
  const renderHistoryPanelContent = (mobile: boolean) => {
    const actionButtonVisibility = mobile ? "opacity-100" : "opacity-0 transition-all group-hover:opacity-100";
    const currentPanelFrameClass = cn(
      "relative mx-auto overflow-hidden rounded-2xl border border-border bg-muted",
      activeOutputAspectClass,
      activeOutputFormat.aspectRatio === "9:16"
        ? "w-32"
        : activeOutputFormat.aspectRatio === "1:1"
          ? "w-44 max-w-full"
          : "w-full"
    );

    return (
      <div className={cn("flex min-h-0 flex-1 flex-col", mobile ? "mobile-history-sheet" : "")}>
        {mobile ? (
          <div className="px-4 pb-4 pt-3">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">History</p>
                <p className="mt-1 text-xs text-muted-foreground">Jump between current and recent frames without leaving the canvas.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMobileHistorySheetOpen(false);
                  setActiveMenuIndex(null);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-center px-4 pt-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Main
            </span>
          </div>
        )}

        <div className={cn("flex-1 overflow-y-auto px-4", mobile ? "pb-4" : "pb-5")}>
          <div className="rounded-[22px] border border-border bg-card p-3">
            <div className="group w-full text-left">
              <button
                type="button"
                onClick={() => handleSelectHistoryItem(currentFrame?.url ?? null)}
                className="block w-full text-left"
              >
                <div className={currentPanelFrameClass}>
                  {currentFrame?.url ? (
                    <img
                      src={currentFrame.url}
                      alt={getHistoryItemTitle(currentFrame)}
                      className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                      decoding="async"
                      sizes={mobile ? "100vw" : "340px"}
                      onError={() => void refreshHistoryPreview(currentFrameIndex)}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                      <div className={cn("flex w-full items-center justify-center rounded-2xl border border-dashed border-border bg-transparent", activeOutputAspectClass)}>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Blank Canvas</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Empty frame only</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </button>
              <div className="mt-3 flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectHistoryItem(currentFrame?.url ?? null)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current Frame</p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{currentFrame ? getHistoryItemTitle(currentFrame) : "Main canvas"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{activeOutputFormat.label}</p>
                  {currentFrame && shouldShowCurrentFramePrompt ? (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{currentFrame.prompt}</p>
                  ) : null}
                  {currentFrame?.sourceType === "youtube" ? (
                    <p className="mt-1 text-[11px] text-red-400">Imported from YouTube</p>
                  ) : null}
                </button>
                {currentFrameIndex >= 0 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveMenuIndex(activeMenuIndex === currentFrameIndex ? null : currentFrameIndex);
                    }}
                    className={cn(
                      "rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground",
                      actionButtonVisibility
                    )}
                    aria-label="Open current frame actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent Frames</p>
              <span className="text-[11px] text-muted-foreground/60">{history.length}</span>
            </div>

            <div className="space-y-3">
              {history.slice(0, 6).map((item, i) => (
                <div
                  key={`${item.url ?? "blank"}-${i}`}
                  className={cn(
                    "group relative rounded-2xl border border-border bg-card p-2 transition-colors",
                    currentImage === item.url ? "border-primary/50" : "hover:border-border"
                  )}
                >
                  <button type="button" onClick={() => handleSelectHistoryItem(item.url)} className="flex w-full items-center gap-3 text-left">
                    <div className="h-16 w-24 overflow-hidden rounded-xl border border-border bg-muted">
                      {item.url ? (
                        <img
                          src={item.url}
                          alt={getHistoryItemTitle(item)}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                          sizes="96px"
                          onError={() => void refreshHistoryPreview(i)}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-background px-2 text-center">
                          <span className="text-[10px] font-medium text-muted-foreground">Blank Canvas</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{getHistoryItemTitle(item)}</p>
                      {normalizeThumbnailTitle(item.prompt) !== normalizeThumbnailTitle(getHistoryItemTitle(item)) ? (
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.prompt}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.sourceType === "youtube"
                          ? "YouTube import"
                          : `${getStudioOutputFormat(item.formatId).shortLabel} - ${i === 0 ? "Latest" : `Version ${history.length - i}`}`}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuIndex(activeMenuIndex === i ? null : i);
                    }}
                    className={cn(
                      "absolute right-3 top-3 rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                      actionButtonVisibility
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  <AnimatePresence>
                    {activeMenuIndex === i ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-3 top-11 z-50 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openRenameModal(i)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                        >
                          <Edit2 className="h-3 w-3" /> Rename
                        </button>
                        <button
                          onClick={(e) => handleOpenInEditor(item.url, e)}
                          disabled={!item.url}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted disabled:opacity-40"
                        >
                          <Edit2 className="h-3 w-3" /> Open
                        </button>
                        <button
                          onClick={(e) => void handleDownloadHistoryItem(item.url, e)}
                          disabled={!item.url}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted disabled:opacity-40"
                        >
                          <Download className="h-3 w-3" /> Download
                        </button>
                        <div className="h-px bg-border" />
                        <button
                          onClick={(e) => handleDeleteHistoryItem(i, e)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-muted"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const assetsModal = (
    <AssetsModal
      isOpen={isAssetsModalOpen}
      onClose={() => setIsAssetsModalOpen(false)}
      onAction={async (url) => {
        setIsAssetsModalOpen(false);
        if (assetsModalMode === 'insert') {
            const resolvedUrl = await resolveEditorImageUrl(url);
            const fittedImage = await fitImageDataUrlToStudioCanvas(resolvedUrl);
            resetDraftPersistenceSession();
            clearStudioLaunchParams();
            setPrompt("");
            setAgentMemory([]);
            setClarificationData(null);
            setIsBrainModeEnabled(false);
            setAttachment(null);
            setAttachmentAssetReference(null);
            applyEditorFrame({
                url: fittedImage,
                prompt: "Inserted Asset",
                title: "Inserted Asset",
                preserveFullSourceFrame: true,
            });
        } else {
            await handleInsertMe(url);
        }
      }}
    />
  );

  const toolsModal = (
    <StudioToolsModal
      isOpen={isToolsModalOpen}
      isYoutubeImporting={isFetchingYoutube}
      onClose={() => setIsToolsModalOpen(false)}
      onLaunchAgent={() => {
        setIsToolsModalOpen(false);
        handleStartAgent();
      }}
      onOpenIdeas={() => {
        setIsToolsModalOpen(false);
        navigate(buildIdeaAssistantUrl());
      }}
      onOpenYoutubeLibrary={() => {
        setIsToolsModalOpen(false);
        navigate(buildYoutubeImportUrl());
      }}
      onRunCreatorTool={(toolId) => {
        void handleModalCreatorTool(toolId);
      }}
      onImportYoutubeUrl={async (url) => {
        setIsFetchingYoutube(true);
        try {
          await importYoutubeThumbnail({
            url,
            sourceTitle: "YouTube import",
          });
          setIsToolsModalOpen(false);
        } catch (error) {
          showErrorToast(
            error instanceof Error ? error.message : "Failed to import the selected YouTube thumbnail.",
            "Import failed"
          );
        } finally {
          setIsFetchingYoutube(false);
        }
      }}
    />
  );

  if (editorState === 'start') {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-background text-foreground" dir="ltr">
        {toolsModal}
        {assetsModal}
        <div className="mx-auto flex w-full max-w-5xl flex-col items-stretch overflow-x-hidden px-3 py-5 sm:px-8 sm:py-10">
          <div className="mb-6 flex flex-col gap-3 sm:mb-10 sm:items-center sm:text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{startScreenTitle}</h1>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{startScreenDescription}</p>
              {activeToolPreset ? (
                <>
                  <p className="max-w-2xl text-sm text-muted-foreground sm:mx-auto">{activeToolPreset.description}</p>
                  <button
                    onClick={() => navigate("/tools")}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Back to creator tools
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate("/templates")}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Need a quick start? Browse templates
                </button>
              )}
            </div>
            {!activeToolPreset ? (
              <div className="mt-2 flex justify-start sm:justify-center">
                {renderOutputFormatSelector()}
              </div>
            ) : null}
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group flex w-full flex-col items-start rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-accent/50 sm:p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                <ImageIcon className="h-5 w-5 text-foreground" />
              </div>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-lg font-bold sm:text-xl">From Image</h3>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">Upload one image and move straight into the editor.</p>
            </button>

            {showYoutubeInput ? (
              <form onSubmit={handleYoutubeSubmit} className="group flex w-full flex-col items-start rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-left sm:p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                  <Youtube className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold sm:text-xl mb-2 text-foreground">Paste YouTube URL</h3>
                <input 
                  type="url" 
                  autoFocus
                  required
                  placeholder="https://youtube.com/watch?v=..." 
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:border-red-500 outline-none mb-3"
                />
              <div className="mt-auto flex w-full gap-2">
                  <button type="button" onClick={() => setShowYoutubeInput(false)} className="flex-1 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 transition-colors text-foreground rounded-xl">Cancel</button>
                  <button type="submit" disabled={isFetchingYoutube || !youtubeUrl} className="flex-1 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 transition-colors text-white rounded-xl disabled:opacity-50">
                    {isFetchingYoutube ? "Fetching..." : "Get Image"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowYoutubeInput(true)}
                className="group flex w-full flex-col items-start rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-red-500/50 sm:p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-red-500/10">
                  <Youtube className="h-5 w-5 text-foreground group-hover:text-red-500 transition-colors" />
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-lg font-bold sm:text-xl">From YouTube</h3>
                </div>
                <p className="text-xs text-muted-foreground sm:text-sm">Paste a video link to grab the highest quality thumbnail directly.</p>
              </button>
            )}

            {!requiresSourceImage ? (
              <button
                onClick={handleStartAgent}
                className="group flex w-full flex-col items-start rounded-2xl border border-orange-500/30 bg-card p-5 text-left transition-colors hover:border-orange-500/50 hover:bg-orange-500/5 sm:p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-300 transition-colors group-hover:bg-orange-500/20">
                  <PenTool className="h-5 w-5" />
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground sm:text-xl">Prompt Canvas</h3>
                </div>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Start with a clean {activeOutputFormat.shortLabel} frame and use the compact composer at the bottom.
                </p>
              </button>
            ) : null}

            <button
              onClick={() => navigate("/templates")}
              className="group flex w-full flex-col items-start rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-accent/50 sm:p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                <Layers className="h-5 w-5 text-foreground" />
              </div>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-lg font-bold sm:text-xl">Thumbnail Sets</h3>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">Open the stored template library and start from a reusable layout.</p>
            </button>
          </div>

          <div className="mt-6 w-full sm:mt-10">
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-start sm:justify-center">
                <span className="bg-background pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:px-4">Quick Start</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3 overflow-x-auto pb-2 no-scrollbar md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
              {quickStartTemplates.slice(0, 4).map((template, i) => (
                <button
                  key={template.id}
                  onClick={() => handleUseTemplate(template.url)}
                  className="group relative aspect-video w-[168px] shrink-0 overflow-hidden rounded-xl border border-border bg-muted transition-colors hover:border-accent md:w-auto"
                >
                  <img
                    src={getPublicImagePreviewUrl(template.url, quickStartTemplatePreviewOptions)}
                    alt={`Template ${i + 1}`}
                    className="h-full w-full object-cover scale-[1.12]"
                    style={templateCropStyle}
                    loading="lazy"
                    decoding="async"
                    sizes="168px"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallbackApplied === "true") {
                        return;
                      }

                      event.currentTarget.dataset.fallbackApplied = "true";
                      event.currentTarget.src = template.url;
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="h-8 w-8 text-white" />
                  </div>
                </button>
              ))}
              {!requiresSourceImage ? (
                <button
                  onClick={handleStartBlank}
                  className="flex aspect-video w-[168px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-accent hover:text-foreground md:w-auto"
                >
                  <div className="h-6 w-6 rounded-sm border-2 border-current" />
                  <span className="text-xs font-medium">{activeOutputFormat.shortLabel} Canvas</span>
                </button>
              ) : null}
            </div>

            {templateLoadError ? <p className="mt-4 text-xs text-muted-foreground">{templateLoadError}</p> : null}

            <div className="mt-4 flex w-full justify-end">
              <button
                onClick={() => navigate("/templates")}
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                See All Templates <span className="text-lg leading-none">{">"}</span>
              </button>
            </div>
          </div>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)_auto]"
      dir="ltr"
    >
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      {toolsModal}
      {assetsModal}
      {renderOptimizerDrawer()}
      <AnimatePresence>

        {renameModal ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Rename Thumbnail</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Choose the name Studio should show for this thumbnail.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRenameModal(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleRenameHistoryItem} className="space-y-4 px-5 py-5">
                <label className="block text-sm font-medium text-foreground">
                  Thumbnail name
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    autoFocus
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-foreground/20"
                    placeholder="Enter thumbnail name"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRenameModal(null)}
                    className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      <div className="flex min-h-0 flex-1 flex-col lg:row-span-2">
        <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-3 sm:gap-4 sm:px-6 lg:border-none">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="min-w-0 flex-1 truncate text-sm font-bold sm:max-w-[24rem] sm:flex-none xl:max-w-[36rem]">
                {currentFrameTitle}
              </span>
              {currentFrameIndex >= 0 ? (
                <button
                  type="button"
                  onClick={() => openRenameModal(currentFrameIndex)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-background/60 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  title="Rename thumbnail"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {currentFrame?.sourceType === "youtube" ? (
                <span className="hidden rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-400 sm:inline-flex">
                  YouTube Import
                </span>
              ) : null}
              <span className="hidden rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:inline-flex">
                {activeOutputFormat.shortLabel} - {activeOutputFormat.dimensions}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">just now</span>
            </div>
            {shouldShowCurrentFramePrompt ? (
              <p className="mt-1 hidden truncate text-xs text-muted-foreground sm:block">{currentFramePrompt}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">

            <button
              type="button"
              onClick={() => setIsMobileHistorySheetOpen(true)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background/60 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 sm:w-auto sm:gap-2 sm:px-3 lg:hidden"
              title="Open history"
              aria-expanded={isMobileHistorySheetOpen}
              >
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">History</span>
                <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground sm:static sm:min-w-5 sm:px-1.5">
                  {history.length}
                </span>
              </button>
              <button
                type="button"
                onClick={handleOpenStartScreen}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
                title="Start new project"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Start New</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOptimizerTitle((current) => current || currentFrameTitle);
                  setIsOptimizerOpen(true);
                }}
                disabled={!currentImage}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                title="Open optimizer"
              >
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Optimize</span>
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saveStatus === 'saving' || editorState !== 'editing' || history.length === 0}
                className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all disabled:opacity-50",
                saveStatus === 'saved'
                  ? "bg-emerald-500 text-white"
                  : saveStatus === 'error'
                    ? "bg-red-500 text-white"
                    : "bg-foreground text-background hover:opacity-90"
              )}
              title="Save draft now"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {saveStatus === 'saving' ? 'Saving Draft...' : saveStatus === 'saved' ? 'Draft Saved' : saveStatus === 'error' ? 'Save Failed' : 'Save Draft'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentImage) {
                  setPreviewMode(activeOutputFormat.id);
                  setIsPreviewOpen(true);
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background/60 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              title="Maximize"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col">
              <div className="flex-1 px-3 pb-4 pt-3 sm:px-6 sm:pt-6 lg:flex lg:items-center lg:px-8 lg:pb-6">
                <div className="mx-auto w-full max-w-6xl">
                  {activeToolPreset ? (
                    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tool Preset</p>
                        <h2 className="mt-1 text-lg font-bold text-foreground">{activeToolPreset.title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{activeToolPreset.description}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => void handleRunToolPreset()}
                          disabled={!currentImage || isGenerating}
                          className="inline-flex h-11 items-center justify-center rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {activeToolPreset.actionLabel}
                        </button>
                        <button
                          type="button"
                          onClick={clearToolPreset}
                          className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                          Clear Preset
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {editorState === "editing" ? (
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Title</p>
                        <h2 className="mt-1 line-clamp-2 text-lg font-black tracking-tight text-foreground sm:text-2xl">
                          {currentFrameTitle}
                        </h2>
                      </div>
                      <div className="flex max-w-full flex-col gap-2 sm:items-end">
                        {renderOutputFormatSelector()}
                        <button
                          type="button"
                          onClick={() => void handleAutoTitle()}
                          disabled={!currentImage || isAutoTitling || isGenerating}
                          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          title="Generate AI title"
                        >
                          {isAutoTitling ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <WandSparkles className="h-4 w-4" />
                          )}
                          {isAutoTitling ? "Writing..." : "Auto AI"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className={cn(
                    "relative mx-auto w-full overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:rounded-[28px] lg:rounded-[20px]",
                    activeOutputAspectClass,
                    activeOutputFormat.aspectRatio === "9:16"
                      ? "max-w-[420px]"
                      : activeOutputFormat.aspectRatio === "1:1"
                        ? "max-w-[720px]"
                        : "max-w-6xl"
                  )}>

                    {isGenerating && <ProcessingOverlay />}
                    {currentImage ? (

                      <img
                        src={currentImage}
                        alt="Canvas"
                        className="h-full w-full object-contain"
                        decoding="async"
                        onError={handleCanvasImageError}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <div className={cn("flex w-[84%] items-center justify-center rounded-[28px] border border-dashed border-border bg-transparent", activeOutputAspectClass)}>
                          <div className="px-4 text-center">
                            <p className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">Blank Canvas</p>
                            <p className="mt-2 text-xs text-muted-foreground sm:mt-3 sm:text-sm">
                              Start from an empty {activeOutputFormat.promptLabel}. AI will not use this placeholder as image input.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {showGrid ? (
                      <div className="pointer-events-none absolute inset-0 z-[60] flex flex-col">
                        <div className="absolute left-0 right-0 top-1/3 h-px opacity-80" style={{ backgroundColor: gridColor }} />
                        <div className="absolute left-0 right-0 top-2/3 h-px opacity-80" style={{ backgroundColor: gridColor }} />
                        <div className="absolute bottom-0 left-1/3 top-0 w-px opacity-80" style={{ backgroundColor: gridColor }} />
                        <div className="absolute bottom-0 left-2/3 top-0 w-px opacity-80" style={{ backgroundColor: gridColor }} />
                      </div>
                    ) : null}

                    {isEditRegionMode ? (
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="absolute inset-0 z-30 h-full w-full cursor-crosshair touch-none"
                      />
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        setAssetsModalMode('replaceSubject');
                        setIsAssetsModalOpen(true);
                      }}
                      className="absolute left-2 top-2 z-40 flex h-10 items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 text-[11px] font-bold text-foreground shadow-lg transition-colors hover:bg-muted sm:left-4 sm:top-4 sm:h-auto sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
                    >
                      <ScanFace className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Insert Me</span>
                      <span className="sm:hidden">Insert</span>
                    </button>

                    <AnimatePresence>
                      {isGenerating ? (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-2 top-2 z-40 flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-xl backdrop-blur-md sm:right-4 sm:top-4 sm:gap-3 sm:px-4 sm:py-2 sm:text-sm"
                        >
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted sm:h-6 sm:w-6">
                            {isPolishing ? (
                              <Stamp className="h-3 w-3 text-foreground sm:h-3.5 sm:w-3.5" />
                            ) : isUpscaling ? (
                              <Maximize2 className="h-3 w-3 text-foreground sm:h-3.5 sm:w-3.5" />
                            ) : (
                              <Clapperboard className="h-3 w-3 text-foreground sm:h-3.5 sm:w-3.5" />
                            )}
                          </div>
                          {generationStatusLabel}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border/70 bg-background/95 backdrop-blur-md lg:border-t-0 lg:bg-transparent lg:backdrop-blur-0">
            <div className="px-3 pb-3 pt-3 lg:px-4 lg:pb-4">
              {renderToolbar()}
            </div>
          </div>
        </div>
      </div>

      <aside className="hidden min-h-0 flex-col border-l border-border bg-card lg:flex">
        {renderHistoryPanelContent(false)}
      </aside>

      <div className="mobile-editor-bottom border-t border-border/70 bg-background/95 px-3 pt-3 backdrop-blur-md lg:border-l lg:border-t lg:border-border lg:bg-card lg:px-4 lg:pt-3 lg:backdrop-blur-0">
        {isEditRegionMode ? (
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <Brush className="h-4 w-4 text-blue-500 dark:text-blue-300" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-100">Edit Region active</span>
            </div>
            <button type="button" onClick={() => setIsEditRegionMode(false)} className="text-blue-700/80 hover:text-blue-900 dark:text-blue-200/80 dark:hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {renderPromptComposer()}
      </div>

      <AnimatePresence>
        {isMobileHistorySheetOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm lg:hidden"
              onClick={() => {
                setIsMobileHistorySheetOpen(false);
                setActiveMenuIndex(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 32 }}
              className="fixed inset-x-0 bottom-0 z-[100] rounded-t-[28px] border border-b-0 border-border bg-card shadow-2xl lg:hidden"
            >
              <div className="flex max-h-[78vh] flex-col">
                {renderHistoryPanelContent(true)}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isPreviewOpen && currentImage ? (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPreviewOpen(false)}
              className="absolute inset-0 bg-background/85 backdrop-blur-sm"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="studio-preview-title"
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
              className="relative z-[1] w-full max-w-6xl overflow-hidden rounded-[28px] border border-border bg-background shadow-[0_40px_120px_rgba(0,0,0,0.38)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 id="studio-preview-title" className="truncate text-lg font-bold text-foreground sm:text-xl">
                    {currentFrameTitle}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    {previewMode === "image"
                      ? "Preview stays inside Studio."
                      : `Previewed as ${getStudioOutputFormat(previewMode).label}.`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden rounded-xl border border-border bg-muted/40 p-1 sm:flex">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("image")}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors",
                        previewMode === "image" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode(activeOutputFormat.id)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors",
                        previewMode === activeOutputFormat.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ActiveOutputIcon className="h-3.5 w-3.5" />
                      {activeOutputFormat.shortLabel}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyThumbnailLink()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:px-4"
                    title="Copy thumbnail image link"
                  >
                    <Copy className="h-4 w-4" />
                    <span className="hidden lg:inline">Copy link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadImage()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-muted"
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="bg-background p-0">
                <div className="border-b border-border px-4 py-3 sm:hidden">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("image")}
                      className={cn(
                        "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border text-xs font-bold",
                        previewMode === "image" ? "bg-foreground text-background" : "bg-background text-foreground"
                      )}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode(activeOutputFormat.id)}
                      className={cn(
                        "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border text-xs font-bold",
                        previewMode === activeOutputFormat.id ? "bg-foreground text-background" : "bg-background text-foreground"
                      )}
                    >
                      <ActiveOutputIcon className="h-3.5 w-3.5" />
                      {activeOutputFormat.shortLabel}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-b border-border px-4 py-3 text-xs sm:px-6">
                  <span className="shrink-0 font-semibold text-muted-foreground">Thumbnail image link</span>
                  <span className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-muted-foreground">
                    {currentImage}
                  </span>
                </div>

                {previewMode === "image" ? (
                  <div className="flex min-h-[240px] max-h-[75vh] items-center justify-center overflow-hidden bg-muted/10">
                    <img
                      src={currentImage}
                      alt={currentFrameTitle}
                      className="max-h-[75vh] w-full object-contain"
                      onError={handleCanvasImageError}
                    />
                  </div>
                ) : (
                  renderSocialPreview(getStudioOutputFormat(previewMode))
                )}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
      <input type="file" ref={insertMeRef} onChange={handleInsertMeUpload} accept="image/*" className="hidden" />
      <input type="file" ref={attachmentInputRef} onChange={handleAttachmentUpload} accept="image/*" className="hidden" />
    </div>
  );
}




