import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  History,
  ImagePlus,
  Loader2,
  MessageSquare,
  PencilLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { storeIdeaAssistantHandoff, type IdeaAssistantHandoffMode } from "../../lib/ideaAssistant";
import { supabase } from "../../lib/supabase";
import {
  IDEA_ASSISTANT_DRAFT_KIND,
  IDEA_ASSISTANT_DRAFT_VERSION,
  getIdeaAssistantDraftTitle,
  normalizeIdeaAssistantDraftRecord,
  type IdeaAssistantDraftBrief,
  type IdeaAssistantDraftData,
} from "../../lib/studioDrafts";
import { TEMPLATE_CATEGORY_OPTIONS, type TemplateCategory } from "../../lib/studioMetadata";
import { cn } from "../../lib/utils";
import type { ThumbnailIdea, ThumbnailIdeasResponse } from "../../server/types";
import { generateThumbnailIdeas } from "../../services/geminiService";
import { getUserAssetPreviewUrl, uploadUserBase64Image } from "../../services/storageService";

const GOAL_OPTIONS = [
  "Higher CTR",
  "Clearer topic framing",
  "Stronger emotional hook",
  "Cleaner packaging",
  "More authority",
] as const;

const VISUAL_VIBE_OPTIONS = [
  "Clean and modern",
  "Bold and dramatic",
  "High tension",
  "Minimal and sharp",
  "Playful and expressive",
] as const;

const IDEAS_DRAFT_AUTOSAVE_DELAY_MS = 700;

type SubmittedBrief = IdeaAssistantDraftBrief;

type TranscriptMessage = {
  id: string;
  role: "assistant" | "user";
  title: string;
  body: string;
};

function summarizeBrief(brief: SubmittedBrief) {
  const categoryLabel =
    TEMPLATE_CATEGORY_OPTIONS.find((option) => option.id === brief.category)?.label || "Other";
  const modeLabel = brief.startMode === "sketch" ? "Start from sketch" : "Start from blank";

  return [
    `Topic: ${brief.topic}`,
    `Category: ${categoryLabel}`,
    `Goal: ${brief.goal}`,
    `Vibe: ${brief.visualVibe}`,
    `Mode: ${modeLabel}`,
    brief.hasReference ? "Reference: attached" : "Reference: none",
  ].join("\n");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to convert the saved reference image."));
    reader.readAsDataURL(blob);
  });
}

async function urlToDataUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to load the saved reference image.");
  }

  return blobToDataUrl(await response.blob());
}

async function optimizeReferenceImage(file: File) {
  const originalDataUrl = await fileToDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxDimension = 1440;
      const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(originalDataUrl);
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(outputType, 0.92));
    };
    image.onerror = () => reject(new Error("Failed to prepare the reference image."));
    image.src = originalDataUrl;
  });
}

function buildTranscript(
  submittedBrief: SubmittedBrief | null,
  response: ThumbnailIdeasResponse | null,
  error: string | null,
  isLoading: boolean,
  selectedIdeaLabel: string | null,
) {
  const messages: TranscriptMessage[] = [
    {
      id: "assistant-intro",
      role: "assistant",
      title: "Idea Assistant",
      body:
        "Share the topic, category, goal, vibe, and starting mode. I'll return a few thumbnail directions that are ready to open in Studio.",
    },
  ];

  if (submittedBrief) {
    messages.push({
      id: "user-brief",
      role: "user",
      title: "Current brief",
      body: summarizeBrief(submittedBrief),
    });
  }

  if (isLoading) {
    messages.push({
      id: "assistant-loading",
      role: "assistant",
      title: "Building directions",
      body: "Looking for a few strong hooks, thumbnail angles, and generation-ready prompts.",
    });
  } else if (response) {
    const recommendedLabel =
      TEMPLATE_CATEGORY_OPTIONS.find((option) => option.id === response.recommendedCategory)?.label || "Other";

    messages.push({
      id: "assistant-response",
      role: "assistant",
      title: "Idea pack ready",
      body: `${response.summary}\nRecommended category: ${recommendedLabel}`,
    });

    if (selectedIdeaLabel) {
      messages.push({
        id: "assistant-selected",
        role: "assistant",
        title: "Pinned direction",
        body: `${selectedIdeaLabel} is saved as the current direction for the next Studio handoff.`,
      });
    }
  } else if (error && submittedBrief) {
    messages.push({
      id: "assistant-error",
      role: "assistant",
      title: "Needs another pass",
      body: error,
    });
  }

  return messages;
}

function normalizeOwnedDraftReferences(value: string[]) {
  return [...new Set(value.filter((entry) => typeof entry === "string" && entry.length > 0))];
}

function buildIdeaDraftSignature(data: IdeaAssistantDraftData) {
  return JSON.stringify({
    kind: data.kind,
    version: data.version,
    title: data.title,
    topic: data.topic,
    category: data.category,
    goal: data.goal,
    visualVibe: data.visualVibe,
    startMode: data.startMode,
    submittedBrief: data.submittedBrief,
    response: data.response,
    selectedIdeaLabel: data.selectedIdeaLabel,
    referenceImageAssetReference: data.referenceImageAssetReference,
    referenceImageName: data.referenceImageName,
    ownedAssetReferences: data.ownedAssetReferences,
  });
}

function normalizeGoal(value: string | null | undefined): (typeof GOAL_OPTIONS)[number] {
  return GOAL_OPTIONS.find((option) => option === value) ?? GOAL_OPTIONS[0];
}

function normalizeVisualVibe(value: string | null | undefined): (typeof VISUAL_VIBE_OPTIONS)[number] {
  return VISUAL_VIBE_OPTIONS.find((option) => option === value) ?? VISUAL_VIBE_OPTIONS[0];
}

function formatSavedAtLabel(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ToolIdeasDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraftHydratingRef = useRef(false);
  const loadedDraftIdRef = useRef<string | null>(null);
  const lastPersistedDraftSignatureRef = useRef<string | null>(null);
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("other");
  const [goal, setGoal] = useState<(typeof GOAL_OPTIONS)[number]>("Higher CTR");
  const [visualVibe, setVisualVibe] = useState<(typeof VISUAL_VIBE_OPTIONS)[number]>("Clean and modern");
  const [startMode, setStartMode] = useState<IdeaAssistantHandoffMode>("blank");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string | null>(null);
  const [referenceAssetReference, setReferenceAssetReference] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState<string | null>(null);
  const [ownedDraftAssetReferences, setOwnedDraftAssetReferences] = useState<string[]>([]);
  const [submittedBrief, setSubmittedBrief] = useState<SubmittedBrief | null>(null);
  const [response, setResponse] = useState<ThumbnailIdeasResponse | null>(null);
  const [selectedIdeaLabel, setSelectedIdeaLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isHydratingDraft, setIsHydratingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const requestedDraftId = searchParams.get("draftId");

  const transcript = useMemo(
    () => buildTranscript(submittedBrief, response, error, isGeneratingIdeas, selectedIdeaLabel),
    [error, isGeneratingIdeas, response, selectedIdeaLabel, submittedBrief],
  );

  const openInStudioLabel = startMode === "sketch" ? "Open with sketch" : "Open blank";
  const requiresSketch = startMode === "sketch" && !referenceImageDataUrl;

  const createIdeaDraftData = (
    overrides: Partial<{
      topic: string;
      category: TemplateCategory;
      goal: (typeof GOAL_OPTIONS)[number];
      visualVibe: (typeof VISUAL_VIBE_OPTIONS)[number];
      startMode: IdeaAssistantHandoffMode;
      submittedBrief: SubmittedBrief | null;
      response: ThumbnailIdeasResponse | null;
      selectedIdeaLabel: string | null;
      referenceImageAssetReference: string | null;
      referenceImageName: string | null;
      ownedAssetReferences: string[];
    }> = {},
  ): IdeaAssistantDraftData => {
    const nextTopic = (overrides.topic ?? topic).trim();
    const nextCategory = overrides.category ?? category;
    const nextSelectedIdeaLabel = overrides.selectedIdeaLabel ?? selectedIdeaLabel;
    const nextTitle = getIdeaAssistantDraftTitle({
      data: {
        title: null,
        topic: nextTopic,
        category: nextCategory,
        selectedIdeaLabel: nextSelectedIdeaLabel,
      },
    });

    return {
      kind: IDEA_ASSISTANT_DRAFT_KIND,
      version: IDEA_ASSISTANT_DRAFT_VERSION,
      title: nextTitle,
      topic: nextTopic,
      category: nextCategory,
      goal: overrides.goal ?? goal,
      visualVibe: overrides.visualVibe ?? visualVibe,
      startMode: overrides.startMode ?? startMode,
      submittedBrief: overrides.submittedBrief ?? submittedBrief,
      response: overrides.response ?? response,
      selectedIdeaLabel: nextSelectedIdeaLabel,
      referenceImageAssetReference: overrides.referenceImageAssetReference ?? referenceAssetReference,
      referenceImageName: overrides.referenceImageName ?? referenceName,
      ownedAssetReferences: normalizeOwnedDraftReferences(overrides.ownedAssetReferences ?? ownedDraftAssetReferences),
    };
  };

  const autosaveDraftData = useMemo(
    () => createIdeaDraftData(),
    [
      category,
      goal,
      ownedDraftAssetReferences,
      referenceAssetReference,
      referenceName,
      response,
      selectedIdeaLabel,
      startMode,
      submittedBrief,
      topic,
      visualVibe,
    ],
  );

  const autosaveDraftSignature = useMemo(() => buildIdeaDraftSignature(autosaveDraftData), [autosaveDraftData]);
  const hasPersistableIdeaContent = Boolean(
    autosaveDraftData.topic ||
      autosaveDraftData.submittedBrief ||
      autosaveDraftData.response ||
      autosaveDraftData.referenceImageAssetReference ||
      autosaveDraftData.selectedIdeaLabel,
  );
  const saveStatusLabel = useMemo(() => {
    if (isHydratingDraft) {
      return "Loading saved session...";
    }

    if (isSavingDraft) {
      return "Saving to Drafts...";
    }

    if (activeDraftId) {
      const formattedSavedAt = formatSavedAtLabel(lastSavedAt);
      return formattedSavedAt ? `Saved to Drafts at ${formattedSavedAt}` : "Saved to Drafts";
    }

    return "Autosaves to Drafts after your first pass";
  }, [activeDraftId, isHydratingDraft, isSavingDraft, lastSavedAt]);

  const syncDraftIdToUrl = (nextDraftId: string | null) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextDraftId) {
      nextParams.set("draftId", nextDraftId);
    } else {
      nextParams.delete("draftId");
    }

    setSearchParams(nextParams, { replace: true });
  };

  const persistIdeaDraft = async (
    overrides: Partial<{
      topic: string;
      category: TemplateCategory;
      goal: (typeof GOAL_OPTIONS)[number];
      visualVibe: (typeof VISUAL_VIBE_OPTIONS)[number];
      startMode: IdeaAssistantHandoffMode;
      submittedBrief: SubmittedBrief | null;
      response: ThumbnailIdeasResponse | null;
      selectedIdeaLabel: string | null;
      referenceImageAssetReference: string | null;
      referenceImageName: string | null;
      ownedAssetReferences: string[];
    }> = {},
    options: { force?: boolean; silent?: boolean } = {},
  ) => {
    if (!user?.uid) {
      return null;
    }

    const nextDraftData = createIdeaDraftData(overrides);
    const nextDraftSignature = buildIdeaDraftSignature(nextDraftData);
    const shouldPersist =
      nextDraftData.topic ||
      nextDraftData.submittedBrief ||
      nextDraftData.response ||
      nextDraftData.referenceImageAssetReference ||
      nextDraftData.selectedIdeaLabel;

    if (!shouldPersist) {
      return activeDraftId;
    }

    if (!options.force && nextDraftSignature === lastPersistedDraftSignatureRef.current) {
      return activeDraftId;
    }

    setIsSavingDraft(true);

    try {
      const nextUpdatedAt = new Date().toISOString();
      let nextDraftId = activeDraftId;

      if (nextDraftId) {
        const { error: updateError } = await supabase
          .from("drafts")
          .update({
            title: nextDraftData.title,
            data: nextDraftData,
            updated_at: nextUpdatedAt,
          })
          .eq("id", nextDraftId)
          .eq("user_id", user.uid);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { data: insertedDraft, error: insertError } = await supabase
          .from("drafts")
          .insert({
            user_id: user.uid,
            title: nextDraftData.title,
            data: nextDraftData,
          })
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        nextDraftId = insertedDraft?.id ?? null;
      }

      if (nextDraftId && nextDraftId !== activeDraftId) {
        setActiveDraftId(nextDraftId);
        loadedDraftIdRef.current = nextDraftId;
        syncDraftIdToUrl(nextDraftId);
      }

      lastPersistedDraftSignatureRef.current = nextDraftSignature;
      setLastSavedAt(nextUpdatedAt);
      return nextDraftId;
    } catch (saveError) {
      console.error("Failed to persist Idea Assistant draft", saveError);

      if (!options.silent) {
        showToast({
          tone: "error",
          title: "Draft save failed",
          message: "Failed to save this Idea Assistant session.",
        });
      }

      return null;
    } finally {
      setIsSavingDraft(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadRequestedDraft() {
      if (!user?.uid || !requestedDraftId || loadedDraftIdRef.current === requestedDraftId) {
        return;
      }

      isDraftHydratingRef.current = true;
      setIsHydratingDraft(true);

      try {
        const { data, error: loadError } = await supabase
          .from("drafts")
          .select("id, title, data, created_at, updated_at")
          .eq("id", requestedDraftId)
          .eq("user_id", user.uid)
          .maybeSingle();

        if (loadError) {
          throw loadError;
        }

        const draft = normalizeIdeaAssistantDraftRecord(data);
        if (!draft) {
          showToast({
            tone: "error",
            title: "Draft not found",
            message: "This Idea Assistant session could not be opened.",
          });
          if (!cancelled) {
            syncDraftIdToUrl(null);
          }
          return;
        }

        const referencePreviewUrl = draft.data.referenceImageAssetReference
          ? await getUserAssetPreviewUrl(draft.data.referenceImageAssetReference, user.uid)
          : null;
        const referenceDataUrl = referencePreviewUrl ? await urlToDataUrl(referencePreviewUrl) : null;

        if (cancelled) {
          return;
        }

        setTopic(draft.data.topic);
        setCategory(draft.data.category);
        setGoal(normalizeGoal(draft.data.goal));
        setVisualVibe(normalizeVisualVibe(draft.data.visualVibe));
        setStartMode(draft.data.startMode);
        setReferenceImage(referencePreviewUrl);
        setReferenceImageDataUrl(referenceDataUrl);
        setReferenceAssetReference(draft.data.referenceImageAssetReference);
        setReferenceName(draft.data.referenceImageName);
        setOwnedDraftAssetReferences(normalizeOwnedDraftReferences(draft.data.ownedAssetReferences));
        setSubmittedBrief(draft.data.submittedBrief);
        setResponse(draft.data.response);
        setSelectedIdeaLabel(draft.data.selectedIdeaLabel);
        setError(null);
        setActiveDraftId(draft.id);
        setLastSavedAt(draft.updatedAt);
        loadedDraftIdRef.current = draft.id;
        lastPersistedDraftSignatureRef.current = buildIdeaDraftSignature(draft.data);
      } catch (loadError) {
        console.error("Failed to load Idea Assistant draft", loadError);
        if (!cancelled) {
          showToast({
            tone: "error",
            title: "Failed to open draft",
            message: "Try reopening this session from Drafts again.",
          });
          syncDraftIdToUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsHydratingDraft(false);
          isDraftHydratingRef.current = false;
        }
      }
    }

    void loadRequestedDraft();

    return () => {
      cancelled = true;
    };
  }, [requestedDraftId, showToast, user?.uid]);

  useEffect(() => {
    if (!user?.uid || isDraftHydratingRef.current || !hasPersistableIdeaContent) {
      return;
    }

    if (autosaveDraftSignature === lastPersistedDraftSignatureRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistIdeaDraft({}, { silent: true });
    }, IDEAS_DRAFT_AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autosaveDraftSignature, hasPersistableIdeaContent, user?.uid]);

  const handleGenerateIdeas = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTopic = topic.trim();

    if (!trimmedTopic) {
      setError("Add the video topic or working title first.");
      return;
    }

    const nextBrief: SubmittedBrief = {
      topic: trimmedTopic,
      category,
      goal,
      visualVibe,
      startMode,
      hasReference: Boolean(referenceAssetReference),
    };

    setError(null);
    setSubmittedBrief(nextBrief);
    setResponse(null);
    setSelectedIdeaLabel(null);
    setIsGeneratingIdeas(true);

    try {
      const nextResponse = await generateThumbnailIdeas({
        topic: trimmedTopic,
        category,
        goal,
        visualVibe,
        startMode,
        referenceImage: referenceImageDataUrl || undefined,
      });

      setResponse(nextResponse);
      await persistIdeaDraft(
        {
          submittedBrief: nextBrief,
          response: nextResponse,
          selectedIdeaLabel: null,
        },
        { force: true, silent: true },
      );
    } catch (requestError) {
      console.error("Failed to generate thumbnail ideas", requestError);
      setResponse(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to build idea directions.");
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleReferenceSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!user?.uid) {
      setError("You need to be signed in to save a reference image.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Use an image under 8MB for the sketch or reference.");
      event.target.value = "";
      return;
    }

    try {
      setError(null);
      const optimizedReference = await optimizeReferenceImage(file);
      const fileExtension = file.type === "image/png" ? "png" : "jpg";
      const assetReference = await uploadUserBase64Image(
        optimizedReference,
        `idea-reference-${Date.now()}.${fileExtension}`,
        user.uid,
      );
      const previewUrl = await getUserAssetPreviewUrl(assetReference, user.uid);

      setReferenceImage(previewUrl);
      setReferenceImageDataUrl(optimizedReference);
      setReferenceAssetReference(assetReference);
      setReferenceName(file.name);
      setOwnedDraftAssetReferences((current) => normalizeOwnedDraftReferences([...current, assetReference]));
    } catch (uploadError) {
      console.error("Failed to prepare the reference image", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Failed to load the selected image.");
    } finally {
      event.target.value = "";
    }
  };

  const clearReference = () => {
    setReferenceImage(null);
    setReferenceImageDataUrl(null);
    setReferenceAssetReference(null);
    setReferenceName(null);
  };

  const handleOpenIdea = async (idea: ThumbnailIdea) => {
    if (startMode === "sketch" && !referenceImageDataUrl) {
      setError("Upload a sketch or reference image before opening a sketch-based setup in Studio.");
      return;
    }

    setSelectedIdeaLabel(idea.label);
    await persistIdeaDraft(
      {
        selectedIdeaLabel: idea.label,
      },
      { force: true, silent: true },
    );

    storeIdeaAssistantHandoff({
      source: "idea-assistant",
      createdAt: new Date().toISOString(),
      mode: startMode,
      prompt: idea.prompt,
      ideaLabel: idea.label,
      summary: response?.summary,
      baseImage: startMode === "sketch" ? referenceImageDataUrl : null,
    });

    navigate("/studio");
  };

  return (
    <div className="mx-auto max-w-[1600px] overflow-x-hidden p-3 pb-5 sm:p-8" dir="ltr">
      <div className="no-scrollbar mb-5 flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto text-sm text-muted-foreground sm:mb-6 sm:flex-wrap">
        <Link
          to="/tools"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tools
        </Link>
        <Link
          to="/drafts"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 transition-colors hover:bg-muted"
        >
          <History className="h-4 w-4" />
          Open Drafts
        </Link>
      </div>

      <section className="mb-5 grid gap-3 sm:mb-6 sm:gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="rounded-[24px] border border-border bg-card/60 p-5 sm:rounded-[28px] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-muted-foreground">Idea Assistant</p>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {saveStatusLabel}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Build a thumbnail direction before you generate.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Start from a blank idea or bring a rough sketch. The assistant returns a few clean directions, saves the session to Drafts, and hands the one you want into Studio.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background p-5 sm:rounded-[28px] sm:p-6">
          <p className="text-sm font-medium text-foreground">What this does</p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>Turns a topic into a few thumbnail angles with ready-to-use prompts.</p>
            </div>
            <div className="flex items-start gap-3">
              <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>Lets you stay in blank mode or move into Studio with a sketch already loaded.</p>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>Auto-saves the brief, returned directions, selected idea, and reference image into Drafts.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_420px] xl:gap-6">
        <section className="rounded-[24px] border border-border bg-card/50 p-4 sm:rounded-[28px] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Conversation</h2>
              <p className="mt-1 text-sm text-muted-foreground">The brief and the returned idea pack live here.</p>
            </div>
          </div>

          <div className="space-y-4">
            {transcript.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[92%] break-words rounded-3xl border px-4 py-3 sm:px-5 sm:py-4",
                  message.role === "assistant"
                    ? "border-border bg-background"
                    : "ml-auto border-border bg-muted/70",
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">{message.title}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-foreground">{message.body}</p>
              </div>
            ))}
          </div>

          {response ? (
            <div className="mt-6 border-t border-border pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Directions</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Pick one and send it into the editor.</p>
                </div>
                <div className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Recommended:{" "}
                  {TEMPLATE_CATEGORY_OPTIONS.find((option) => option.id === response.recommendedCategory)?.label || "Other"}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {response.ideas.map((idea) => {
                  const isSelected = selectedIdeaLabel === idea.label;

                  return (
                    <article
                      key={idea.label}
                      className={cn(
                        "rounded-[24px] border bg-background p-4 transition-colors sm:p-5",
                        isSelected ? "border-foreground/20 ring-1 ring-foreground/10" : "border-border",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-semibold text-foreground">{idea.label}</h4>
                            {isSelected ? (
                              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
                                Saved
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{idea.hook}</p>
                        </div>
                      </div>

                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="font-medium text-foreground">Title angle</dt>
                          <dd className="mt-1 leading-7 text-muted-foreground">{idea.titleAngle}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-foreground">Visual direction</dt>
                          <dd className="mt-1 leading-7 text-muted-foreground">{idea.visualDirection}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-foreground">Prompt</dt>
                          <dd className="mt-1 break-words rounded-2xl border border-border bg-card/60 px-3 py-3 leading-7 text-foreground">
                            {idea.prompt}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {startMode === "sketch" ? "This will open with your sketch loaded." : "This will open a blank setup in Studio."}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenIdea(idea);
                          }}
                          disabled={requiresSketch}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {openInStudioLabel}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="rounded-[24px] border border-border bg-card/50 p-4 sm:rounded-[28px] sm:p-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Brief</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep it tight. The assistant only needs enough detail to pick a direction.
                </p>
              </div>
              {activeDraftId ? (
                <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {getIdeaAssistantDraftTitle({
                    data: {
                      title: autosaveDraftData.title,
                      topic: autosaveDraftData.topic,
                      category: autosaveDraftData.category,
                      selectedIdeaLabel: autosaveDraftData.selectedIdeaLabel,
                    },
                  })}
                </span>
              ) : null}
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleGenerateIdeas}>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Topic or working title</span>
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                rows={3}
                placeholder="Why most creators quit before 100 videos"
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/20"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as TemplateCategory)}
                  className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/20"
                >
                  {TEMPLATE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Goal</span>
                <select
                  value={goal}
                  onChange={(event) => setGoal(event.target.value as (typeof GOAL_OPTIONS)[number])}
                  className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/20"
                >
                  {GOAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-foreground">Visual vibe</span>
              <select
                value={visualVibe}
                onChange={(event) => setVisualVibe(event.target.value as (typeof VISUAL_VIBE_OPTIONS)[number])}
                className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/20"
              >
                {VISUAL_VIBE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-sm font-medium text-foreground">Starting mode</span>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background p-1">
                {[
                  { id: "blank", label: "Blank" },
                  { id: "sketch", label: "Sketch" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setStartMode(option.id as IdeaAssistantHandoffMode)}
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-[18px] text-sm font-medium transition-colors",
                      startMode === option.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-dashed border-border bg-background/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Sketch or reference</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Optional for idea generation. Required only if you want to open a sketch-based setup in Studio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReferenceSelection}
              />

              {referenceImage ? (
                <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card/50">
                  <div className="aspect-video overflow-hidden bg-muted/20">
                    <img
                      src={referenceImage}
                      alt={referenceName || "Reference"}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="min-w-0 truncate text-sm text-muted-foreground">{referenceName || "Reference image"}</p>
                    <button
                      type="button"
                      onClick={clearReference}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Remove reference image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <button
              type="submit"
              disabled={isGeneratingIdeas || isHydratingDraft}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGeneratingIdeas || isHydratingDraft ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGeneratingIdeas ? "Generating ideas..." : isHydratingDraft ? "Loading session..." : "Generate ideas"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
