import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  Clock3,
  Download,
  Edit2,
  FilePlus2,
  Folder,
  History,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Sparkles,
  PenTool,
  Maximize2,
  Monitor,
  MoreHorizontal,
  Play,
  Plus,
  Layers,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "../../components/ConfirmDialog";
import { deleteUserAsset, downloadFileFromUrl, getPublicImagePreviewUrl, getUserAssetPath, getUserAssetPreviewUrl } from "../../services/storageService";
import { useToast } from "../../context/ToastContext";
import {
  ARCHIVE_STATE_DRAFT_KIND,
  ARCHIVE_STATE_DRAFT_TITLE,
  getIdeaAssistantDraftPreviewReference,
  getIdeaAssistantDraftTitle,
  getStudioDraftPreviewReference,
  getStudioDraftTitle,
  normalizeIdeaAssistantDraftRecord,
  normalizeStudioEditorDraftRecord,
  type IdeaAssistantDraftRecord,
  type StudioEditorDraftRecord,
} from "../../lib/studioDrafts";
import { cn } from "../../lib/utils";
import WelcomeModal from "../../components/WelcomeModal";

interface GenerationRecord {
  id: string;
  title: string | null;
  prompt: string;
  urls: string[];
  assetReferences: string[];
  created_at: string;
  archived_at: string | null;
}

type StudioDraftCardRecord = StudioEditorDraftRecord & {
  previewUrl: string | null;
};

type IdeaDraftCardRecord = IdeaAssistantDraftRecord & {
  previewUrl: string | null;
};

type ViewMode = "grid" | "list";

const ARCHIVE_STORAGE_PREFIX = "thumora:archived-generations";
const PROJECT_PREVIEW_OPTIONS = {
  width: 640,
  height: 360,
  resize: "cover",
  quality: 72,
} as const;

function getArchiveStorageKey(userId: string) {
  return `${ARCHIVE_STORAGE_PREFIX}:${userId}`;
}

function readArchivedIds(userId: string) {
  try {
    const raw = window.localStorage.getItem(getArchiveStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch (error) {
    console.error("Failed to read archived generations from storage.", error);
    return [];
  }
}

function writeArchivedIds(userId: string, ids: string[]) {
  try {
    window.localStorage.setItem(getArchiveStorageKey(userId), JSON.stringify(ids));
  } catch (error) {
    console.error("Failed to persist archived generations to storage.", error);
  }
}

function mergeIds(current: string[], ids: string[]) {
  return [...new Set([...current, ...ids])];
}

function mergeIdGroups(...groups: string[][]) {
  return [...new Set(groups.flat())];
}

function removeIds(current: string[], ids: string[]) {
  return current.filter((id) => !ids.includes(id));
}

function readArchivedIdsFromDraftData(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const candidate = (value as { archivedGenerationIds?: unknown }).archivedGenerationIds;
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter((entry): entry is string => typeof entry === "string");
}

function normalizeGeneration(row: any): GenerationRecord {
  const assetReferences = Array.isArray(row.urls) ? row.urls.filter((value: unknown): value is string => typeof value === "string") : [];

  return {
    id: row.id,
    title: typeof row.title === "string" ? row.title : null,
    prompt: row.prompt,
    urls: assetReferences,
    assetReferences,
    created_at: row.created_at || row.createdAt || new Date().toISOString(),
    archived_at: typeof row.archived_at === "string" ? row.archived_at : null,
  };
}

function formatGenerationDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "Just now";
  }

  return new Date(parsed).toLocaleDateString();
}

function getGenerationTitle(generation: Pick<GenerationRecord, "title" | "prompt">) {
  const normalizedTitle = generation.title?.trim();
  return normalizedTitle || generation.prompt || "Untitled thumbnail";
}

function formatDraftUpdatedAt(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "Updated just now";
  }

  const diffMs = Date.now() - parsed;
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 24) {
    return `Updated ${diffHours}h ago`;
  }

  if (diffDays < 7) {
    return `Updated ${diffDays}d ago`;
  }

  return `Updated ${new Date(parsed).toLocaleDateString()}`;
}

function isArchivedGeneration(generation: GenerationRecord, archivedFallbackIds: string[]) {
  return archivedFallbackIds.includes(generation.id);
}

export default function StudioDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState<{ id: string; title: string } | null>(null);
  const [newPrompt, setNewPrompt] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archivedFallbackIds, setArchivedFallbackIds] = useState<string[]>([]);
  const [archiveStateDraftId, setArchiveStateDraftId] = useState<string | null>(null);
  const [latestDraft, setLatestDraft] = useState<StudioDraftCardRecord | null>(null);
  const [latestIdeaDraft, setLatestIdeaDraft] = useState<IdeaDraftCardRecord | null>(null);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [previewGenerationId, setPreviewGenerationId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    ids: string[];
    title: string;
    description: string;
    confirmLabel: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const previewGeneration = useMemo(
    () => generations.find((generation) => generation.id === previewGenerationId) ?? null,
    [generations, previewGenerationId]
  );

  useEffect(() => {
    if (!previewGenerationId || previewGeneration) {
      return;
    }

    setPreviewGenerationId(null);
  }, [previewGeneration, previewGenerationId]);

  useEffect(() => {
    if (!previewGeneration) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewGenerationId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewGeneration]);

  useEffect(() => {
    if (!user) {
      setLatestDraft(null);
      setLatestIdeaDraft(null);
      setArchivedFallbackIds([]);
      setArchiveStateDraftId(null);
      return;
    }

    setArchivedFallbackIds(readArchivedIds(user.uid));
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    writeArchivedIds(user.uid, archivedFallbackIds);
  }, [archivedFallbackIds, user]);

  useEffect(() => {
    if (!user) {
      setGenerations([]);
      setLatestDraft(null);
      setLatestIdeaDraft(null);
      setLoading(false);
      return;
    }

    const resolveDraftPreviewUrl = async (previewReference: string | null) => {
      if (!previewReference) {
        return null;
      }

      if (getUserAssetPath(previewReference, user.uid)) {
        return getUserAssetPreviewUrl(previewReference, user.uid, PROJECT_PREVIEW_OPTIONS);
      }

      return getPublicImagePreviewUrl(previewReference, PROJECT_PREVIEW_OPTIONS);
    };

    const fetchDashboardData = async () => {
      const [generationsResult, draftsResult] = await Promise.all([
        supabase
          .from("generations")
          .select("*")
          .eq("user_id", user.uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("drafts")
          .select("id, title, data, created_at, updated_at")
          .eq("user_id", user.uid)
          .order("updated_at", { ascending: false })
          .limit(100),
      ]);

      const { data, error } = generationsResult;
      const draftRows = draftsResult.data ?? [];
      const archiveStateRow = draftRows.find((row: any) => row?.title === ARCHIVE_STATE_DRAFT_TITLE);
      const localIds = readArchivedIds(user.uid);
      const draftIds = readArchivedIdsFromDraftData(archiveStateRow?.data);
      const studioDrafts = draftRows
        .map((row: any) => normalizeStudioEditorDraftRecord(row))
        .filter((draft): draft is StudioEditorDraftRecord => Boolean(draft))
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
      const ideaDrafts = draftRows
        .map((row: any) => normalizeIdeaAssistantDraftRecord(row))
        .filter((draft): draft is IdeaAssistantDraftRecord => Boolean(draft))
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
      const studioDraftsWithPreviews = await Promise.all(
        studioDrafts.map(async (draft) => ({
          ...draft,
          previewUrl: await resolveDraftPreviewUrl(getStudioDraftPreviewReference(draft.data)),
        })),
      );
      const ideaDraftsWithPreviews = await Promise.all(
        ideaDrafts.map(async (draft) => ({
          ...draft,
          previewUrl: await resolveDraftPreviewUrl(getIdeaAssistantDraftPreviewReference(draft.data)),
        })),
      );
      const newestDraft = studioDraftsWithPreviews[0] ?? null;
      const newestIdeaDraft = ideaDraftsWithPreviews[0] ?? null;

      if (archiveStateRow?.id) {
        setArchiveStateDraftId(archiveStateRow.id);
      } else {
        setArchiveStateDraftId(null);
      }

      setLatestDraft(newestDraft);
      setLatestIdeaDraft(newestIdeaDraft);

      if (!error && data) {
        const normalizedGenerations = await Promise.all(
          data.map(async (row: any) => {
            const generation = normalizeGeneration(row);
            const previewUrls = await Promise.all(
              generation.urls.map((url) => getUserAssetPreviewUrl(url, user.uid, PROJECT_PREVIEW_OPTIONS))
            );

            return {
              ...generation,
              urls: previewUrls,
            };
          })
        );

        setGenerations(normalizedGenerations);
        setArchivedFallbackIds(
          archiveStateRow
            ? draftIds
            : mergeIdGroups(
                localIds,
                normalizedGenerations
                  .filter((generation) => Boolean(generation.archived_at))
                  .map((generation) => generation.id)
              )
        );
      }

      setLoading(false);
    };

    void fetchDashboardData();

    const subscription = supabase
      .channel("studio_dashboard_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generations",
          filter: `user_id=eq.${user.uid}`,
        },
        () => {
          void fetchDashboardData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drafts",
          filter: `user_id=eq.${user.uid}`,
        },
        () => {
          void fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const archivedCount = useMemo(() => {
    return generations.filter((generation) => isArchivedGeneration(generation, archivedFallbackIds)).length;
  }, [archivedFallbackIds, generations]);

  const visibleGenerations = useMemo(() => {
    return generations.filter((generation) =>
      showArchivedOnly
        ? isArchivedGeneration(generation, archivedFallbackIds)
        : !isArchivedGeneration(generation, archivedFallbackIds)
    );
  }, [archivedFallbackIds, generations, showArchivedOnly]);

  const clearSelection = () => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const toggleSelectedId = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const updateArchiveState = async (ids: string[], archived: boolean) => {
    if (!user || ids.length === 0) {
      return;
    }

    const archivedAt = archived ? new Date().toISOString() : null;
    const nextArchivedIds = archived ? mergeIds(archivedFallbackIds, ids) : removeIds(archivedFallbackIds, ids);
    setArchivedFallbackIds(nextArchivedIds);
    setGenerations((current) =>
      current.map((item) => (ids.includes(item.id) ? { ...item, archived_at: archivedAt } : item))
    );
    setSelectedIds([]);
    setActiveMenuId(null);

    try {
      if (archiveStateDraftId) {
        const { error } = await supabase
          .from("drafts")
          .update({
            data: {
              kind: ARCHIVE_STATE_DRAFT_KIND,
              archivedGenerationIds: nextArchivedIds,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", archiveStateDraftId)
          .eq("user_id", user.uid);

        if (error) {
          throw error;
        }
      } else {
        const { data: insertedDraft, error } = await supabase
          .from("drafts")
          .insert({
            user_id: user.uid,
            title: ARCHIVE_STATE_DRAFT_TITLE,
            data: {
              kind: ARCHIVE_STATE_DRAFT_KIND,
              archivedGenerationIds: nextArchivedIds,
            },
          })
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        setArchiveStateDraftId(insertedDraft?.id ?? null);
      }
    } catch (error) {
      console.warn("Failed to persist archive state in drafts table, using local fallback.", error);
    }

    try {
      await Promise.all(
        ids.map(async (id) => {
          const { error } = await supabase
            .from("generations")
            .update({ archived_at: archivedAt })
            .eq("user_id", user.uid)
            .eq("id", id);

          if (error) {
            throw error;
          }
        })
      );
    } catch (error) {
      console.warn(`Failed to persist ${archived ? "archive" : "restore"} state to DB, using local fallback.`, error);
    }

    if (!archived && previewGenerationId && ids.includes(previewGenerationId)) {
      setPreviewGenerationId(null);
    }
  };

  const deleteIds = async (ids: string[]) => {
    if (!user || ids.length === 0) {
      return false;
    }

    const previousGenerations = generations;
    const previousArchivedFallbackIds = archivedFallbackIds;
    const previousSelectedIds = selectedIds;
    const previousPreviewGenerationId = previewGenerationId;
    const removedGenerations = generations.filter((item) => ids.includes(item.id));
    const nextArchivedIds = removeIds(archivedFallbackIds, ids);

    // Remove immediately from the UI, then finish persistence work.
    setGenerations((current) => current.filter((item) => !ids.includes(item.id)));
    setArchivedFallbackIds(nextArchivedIds);
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setActiveMenuId(null);
    if (previewGenerationId && ids.includes(previewGenerationId)) {
      setPreviewGenerationId(null);
    }

    try {
      setIsDeleting(true);

      await Promise.all(
        ids.map(async (id) => {
          const { error } = await supabase.from("generations").delete().eq("user_id", user.uid).eq("id", id);
          if (error) throw error;
        })
      );

      if (archiveStateDraftId) {
        const { error } = await supabase
          .from("drafts")
          .update({
            data: {
              kind: ARCHIVE_STATE_DRAFT_KIND,
              archivedGenerationIds: nextArchivedIds,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", archiveStateDraftId)
          .eq("user_id", user.uid);

        if (error) {
          console.warn("Failed to update archive state after deletion.", error);
        }
      }

      void Promise.allSettled(
        removedGenerations.flatMap((generation) =>
          generation.assetReferences.map((assetReference) =>
            deleteUserAsset(assetReference, user.uid).catch((error) => {
              console.error("Failed to delete generated file from storage", error);
              return false;
            })
          )
        )
      );
      return true;
    } catch (error) {
      console.error("Error deleting generation:", error);
      setGenerations(previousGenerations);
      setArchivedFallbackIds(previousArchivedFallbackIds);
      setSelectedIds(previousSelectedIds);
      setPreviewGenerationId(previousPreviewGenerationId);
      showToast({
        tone: "error",
        title: "Delete failed",
        message:
          ids.length === 1
            ? "Failed to remove this project."
            : "Failed to remove the selected projects.",
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    if (ids.length === 1) {
      const generation = generations.find((item) => item.id === ids[0]);
      const imageCount = generation?.assetReferences.length || generation?.urls.length || 1;
      setDeleteDialog({
        ids,
        title: imageCount > 1 ? "Remove this project?" : "Remove this image?",
        description:
          imageCount > 1
            ? `This project and its ${imageCount} saved images will be removed from My Projects.`
            : "This image will be removed from My Projects.",
        confirmLabel: imageCount > 1 ? "Remove project" : "Remove image",
      });
      return;
    }

    setDeleteDialog({
      ids,
      title: `Remove ${ids.length} selected project${ids.length === 1 ? "" : "s"}?`,
      description: "These selected projects will be removed from My Projects.",
      confirmLabel: "Remove selected",
    });
  };

  const handleDelete = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    openDeleteDialog([id]);
  };

  const handleArchiveToggle = async (generation: GenerationRecord, event?: React.MouseEvent) => {
    event?.stopPropagation();
    await updateArchiveState([generation.id], !isArchivedGeneration(generation, archivedFallbackIds));
  };

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextTitle = newPrompt.trim();
    if (!user || !renameModal || !nextTitle) return;

    const previousGenerations = generations;
    setGenerations((current) =>
      current.map((generation) =>
        generation.id === renameModal.id ? { ...generation, title: nextTitle } : generation
      )
    );
    setRenameModal(null);
    setNewPrompt("");

    const { error } = await supabase
      .from("generations")
      .update({ title: nextTitle })
      .eq("user_id", user.uid)
      .eq("id", renameModal.id);

    if (error) {
      console.error("Failed to rename generation", error);
      setGenerations(previousGenerations);
      showToast({
        tone: "error",
        title: "Rename failed",
        message: "Failed to rename this project.",
      });
    }
  };

  const downloadGenerationImage = async (url: string, id: string) => {
    await downloadFileFromUrl(url, `thumbnail-${id}.png`);
  };

  const handleDownload = async (url: string, id: string, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      await downloadGenerationImage(url, id);
    } catch (error) {
      console.error("Failed to download generation", error);
      showToast({
        tone: "error",
        title: "Download failed",
        message: "Failed to download this thumbnail.",
      });
    } finally {
      setActiveMenuId(null);
    }
  };

  const buildGenerationEditorUrl = (generation: GenerationRecord) => {
    const primaryUrl = generation.urls[0];

    if (!primaryUrl) {
      return null;
    }

    const params = new URLSearchParams({
      templateUrl: primaryUrl,
      generationId: generation.id,
      generationPrompt: generation.prompt,
    });

    if (generation.assetReferences[0]) {
      params.set("assetReference", generation.assetReferences[0]);
    }

    if (generation.title) {
      params.set("generationTitle", generation.title);
    }

    return `/studio?${params.toString()}`;
  };

  const handleOpenGenerationInEditor = (generation: GenerationRecord, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const editorUrl = buildGenerationEditorUrl(generation);

    if (!editorUrl) {
      return;
    }

    navigate(editorUrl);
    setActiveMenuId(null);
  };

  const handleOpenPreview = (generation: GenerationRecord, event?: React.MouseEvent) => {
    event?.stopPropagation();

    if (!generation.urls[0]) {
      return;
    }

    setPreviewGenerationId(generation.id);
    setActiveMenuId(null);
  };

  const handleCardClick = (generation: GenerationRecord) => {
    if (isSelectionMode) {
      toggleSelectedId(generation.id);
      return;
    }

    const editorUrl = buildGenerationEditorUrl(generation);

    if (editorUrl) {
      navigate(editorUrl);
    }
  };

  const renderSelectionCheckbox = (generationId: string) => (
    <button
      onClick={(event) => {
        event.stopPropagation();
        toggleSelectedId(generationId);
      }}
      className={cn(
        "absolute top-3 left-3 z-20 h-5 w-5 rounded transition-colors",
        selectedIds.includes(generationId)
          ? "bg-foreground"
          : "bg-background/80 backdrop-blur-sm ring-1 ring-border"
      )}
      aria-label="Select thumbnail"
    />
  );

  const handleGenerationImageError = async (generationId: string, imageIndex: number, failedUrl: string) => {
    if (!user) {
      return;
    }

    const generation = generations.find((item) => item.id === generationId);
    const assetReference = generation?.assetReferences[imageIndex];

    if (!assetReference) {
      return;
    }

    const refreshedUrl = await getUserAssetPreviewUrl(assetReference, user.uid, PROJECT_PREVIEW_OPTIONS);

    if (!refreshedUrl || refreshedUrl === failedUrl) {
      return;
    }

    setGenerations((current) =>
      current.map((item) => {
        if (item.id !== generationId) {
          return item;
        }

        const nextUrls = [...item.urls];
        nextUrls[imageIndex] = refreshedUrl;
        return { ...item, urls: nextUrls };
      })
    );
  };

  const renderGenerationGridCard = (generation: GenerationRecord) => {
    const primaryUrl = generation.urls[0];
    const isArchived = isArchivedGeneration(generation, archivedFallbackIds);

    return (
      <div key={generation.id} className="group cursor-pointer" onClick={() => handleCardClick(generation)}>
        <div className="relative mb-3">
          <div className="aspect-video rounded-2xl overflow-hidden relative bg-muted/20">
            {primaryUrl ? (
              <img
                src={primaryUrl}
                alt={getGenerationTitle(generation)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                decoding="async"
                sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                onError={(event) => {
                  void handleGenerationImageError(generation.id, 0, event.currentTarget.currentSrc);
                }}
              />
            ) : (
              <div className="w-full h-full bg-muted/30" />
            )}

            {isSelectionMode && renderSelectionCheckbox(generation.id)}

            {!isSelectionMode && (
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <button
                  onClick={(event) => {
                    if (primaryUrl) {
                      void handleDownload(primaryUrl, generation.id, event);
                    }
                  }}
                  disabled={!primaryUrl}
                  className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform disabled:opacity-40"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={(event) => handleOpenPreview(generation, event)}
                  disabled={!primaryUrl}
                  className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform disabled:opacity-40"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {!isSelectionMode && (
            <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveMenuId(activeMenuId === generation.id ? null : generation.id);
                }}
                className="p-1.5 bg-background/80 text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {activeMenuId === generation.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute top-8 right-0 w-44 bg-background rounded-xl shadow-xl overflow-hidden z-50 ring-1 ring-border/60"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setRenameModal({ id: generation.id, title: getGenerationTitle(generation) });
                        setNewPrompt(getGenerationTitle(generation));
                        setActiveMenuId(null);
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" /> Rename
                    </button>
                    <button
                      onClick={(event) => handleOpenGenerationInEditor(generation, event)}
                      disabled={!primaryUrl}
                      className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40"
                    >
                      <Play className="w-4 h-4" /> Open in Editor
                    </button>
                    <button
                      onClick={(event) => {
                        if (primaryUrl) {
                          void handleDownload(primaryUrl, generation.id, event);
                        }
                      }}
                      disabled={!primaryUrl}
                      className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors disabled:opacity-40"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button
                      onClick={(event) => {
                        void handleArchiveToggle(generation, event);
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                    >
                      <Archive className="w-4 h-4" /> {isArchived ? "Restore" : "Archive"}
                    </button>
                    <div className="w-full h-px bg-border" />
                    <button
                      onClick={(event) => handleDelete(generation.id, event)}
                      className="w-full text-left px-3 py-2.5 text-sm text-red-500 hover:bg-white/10 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Remove Image
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        <h3 className="font-bold text-foreground text-sm mb-1 line-clamp-1">{getGenerationTitle(generation)}</h3>
        <p className="text-xs text-muted-foreground">{formatGenerationDate(generation.created_at)}</p>
      </div>
    );
  };

  const renderGenerationListRow = (generation: GenerationRecord) => {
    const primaryUrl = generation.urls[0];
    const isArchived = isArchivedGeneration(generation, archivedFallbackIds);

    return (
      <div
        key={generation.id}
        className="flex items-center gap-3 rounded-2xl bg-card/50 p-2.5 transition-colors hover:bg-muted/30 cursor-pointer sm:gap-4 sm:p-3"
        onClick={() => handleCardClick(generation)}
      >
        {isSelectionMode && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              toggleSelectedId(generation.id);
            }}
            className={cn(
              "h-5 w-5 rounded transition-colors flex-shrink-0",
              selectedIds.includes(generation.id) ? "bg-foreground" : "bg-background ring-1 ring-border"
            )}
            aria-label="Select thumbnail"
          />
        )}
        <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-muted/20 sm:h-20 sm:w-36">
          {primaryUrl ? (
            <img
              src={primaryUrl}
              alt={getGenerationTitle(generation)}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              sizes="144px"
              onError={(event) => {
                void handleGenerationImageError(generation.id, 0, event.currentTarget.currentSrc);
              }}
            />
          ) : (
            <div className="w-full h-full bg-muted/30" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground line-clamp-1">{getGenerationTitle(generation)}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatGenerationDate(generation.created_at)}</p>
        </div>
        {!isSelectionMode && (
          <div className="hidden items-center gap-2 sm:flex">
            <button
              onClick={(event) => handleOpenGenerationInEditor(generation, event)}
              disabled={!primaryUrl}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <Play className="w-4 h-4" />
            </button>
            <button
              onClick={(event) => handleOpenPreview(generation, event)}
              disabled={!primaryUrl}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={(event) => {
                if (primaryUrl) {
                  void handleDownload(primaryUrl, generation.id, event);
                }
              }}
              disabled={!primaryUrl}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={(event) => {
                void handleArchiveToggle(generation, event);
              }}
              title={isArchived ? "Restore image" : "Archive image"}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={(event) => handleDelete(generation.id, event)}
              title="Remove image"
              className="p-2 text-red-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const latestDraftTitle = latestDraft ? getStudioDraftTitle(latestDraft) : null;
  const latestIdeaDraftTitle = latestIdeaDraft ? getIdeaAssistantDraftTitle(latestIdeaDraft) : null;

  return (
    <div className="mx-auto max-w-[1600px] overflow-x-hidden p-3 pb-5 sm:p-8" dir="ltr">
      <WelcomeModal />
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:mb-8 sm:flex-row sm:items-center sm:gap-4">
        <div className="no-scrollbar flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-muted/35 p-1 sm:w-auto">
          <Link
            to="/projects"
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-background px-3 text-sm font-semibold text-foreground shadow-sm dark:bg-muted sm:px-4"
          >
            <Monitor className="w-4 h-4" /> My Projects
          </Link>
          <Link
            to="/drafts"
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground sm:px-4"
          >
            <History className="w-4 h-4" /> Drafts
          </Link>
          <Link
            to="/templates"
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground sm:px-4"
          >
            <Layers className="w-4 h-4" /> Templates
          </Link>
          <Link
            to="/tools"
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground sm:px-4"
          >
            <PenTool className="w-4 h-4" /> Tools
          </Link>
          <button
            onClick={() => setShowArchivedOnly((current) => !current)}
            className={cn(
              "flex h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition-colors sm:px-4",
              showArchivedOnly
                ? "bg-background text-foreground shadow-sm dark:bg-muted"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            <Archive className="w-4 h-4" /> Archive <span className="bg-muted px-1.5 rounded text-xs">{archivedCount}</span>
          </button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="inline-flex h-10 min-w-[9.5rem] flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:flex-none"
          >
            <FilePlus2 className="h-4 w-4" />
            Start New Project
          </button>
          <button
            onClick={() => navigate("/assets")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/35 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Open assets"
          >
            <Folder className="w-4 h-4" />
          </button>
          <Link
            to="/templates"
            className="flex h-10 min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-xl bg-muted/35 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:flex-none"
          >
            <LayoutGrid className="w-4 h-4" /> Templates
          </Link>
          <button
            onClick={() => {
              if (isSelectionMode) {
                clearSelection();
              } else {
                setIsSelectionMode(true);
              }
            }}
            className={cn(
              "h-9 rounded-xl px-4 text-sm font-medium transition-colors",
              isSelectionMode
                ? "bg-muted text-foreground"
                : "bg-muted/35 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {isSelectionMode ? "Cancel Select" : "Select"}
          </button>
          <div className="flex h-9 items-center rounded-xl bg-muted/35 p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-lg p-1 transition-colors",
                viewMode === "grid" ? "bg-background text-foreground shadow-sm dark:bg-muted" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-lg p-1 transition-colors",
                viewMode === "list" ? "bg-background text-foreground shadow-sm dark:bg-muted" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isSelectionMode && visibleGenerations.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-card/60 p-4">
          <div className="text-sm text-foreground">
            {selectedIds.length > 0
              ? `${selectedIds.length} item${selectedIds.length === 1 ? "" : "s"} selected`
              : "Select items to archive, restore, or remove"}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!showArchivedOnly ? (
              <button
                onClick={() => void updateArchiveState(selectedIds, true)}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 rounded-xl bg-muted/40 text-sm text-foreground disabled:opacity-50"
              >
                Archive Selected
              </button>
            ) : (
              <button
                onClick={() => void updateArchiveState(selectedIds, false)}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 rounded-xl bg-muted/40 text-sm text-foreground disabled:opacity-50"
              >
                Restore Selected
              </button>
            )}
            <button
              onClick={() => {
                if (selectedIds.length === 0) {
                  return;
                }

                openDeleteDialog(selectedIds);
              }}
              disabled={selectedIds.length === 0}
              className="px-4 py-2 rounded-xl bg-background text-sm text-foreground disabled:opacity-50"
            >
              Remove Selected
            </button>
          </div>
        </div>
      )}

      {!showArchivedOnly && latestDraft && latestDraftTitle ? (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 overflow-hidden rounded-[24px] border border-border bg-card/70 sm:mb-8 sm:rounded-[32px]"
        >
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <button
              type="button"
              onClick={() => navigate(`/studio?draftId=${latestDraft.id}`)}
              className="block w-full text-left"
            >
              <div className="aspect-video overflow-hidden bg-muted/20">
                {latestDraft.previewUrl ? (
                  <img
                    src={latestDraft.previewUrl}
                    alt={latestDraftTitle}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted/30">
                    <div className="rounded-[28px] border border-dashed border-border px-8 py-6 text-center">
                      <p className="text-lg font-bold text-foreground">Blank canvas</p>
                      <p className="mt-2 text-sm text-muted-foreground">Your latest draft has no preview frame yet.</p>
                    </div>
                  </div>
                )}
              </div>
            </button>

            <div className="flex flex-col justify-between gap-5 p-5 sm:p-8">
              <div>
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span className="truncate">Continue working last project</span>
                </div>
                <h2 className="mt-4 break-words text-xl font-bold tracking-tight text-foreground sm:text-3xl">{latestDraftTitle}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{formatDraftUpdatedAt(latestDraft.updatedAt)}</p>
                <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                  {latestDraft.data.promptDraft.trim() ||
                    "Resume the latest Studio draft with its thumbnail state, prompt draft, and agent conversation intact."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/studio?draftId=${latestDraft.id}`)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 min-[380px]:col-span-2 sm:col-span-1"
                >
                  <Play className="h-4 w-4" />
                  Continue Working
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/create")}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:px-5"
                >
                  <FilePlus2 className="h-4 w-4" />
                  Start New Project
                </button>
                <Link
                  to="/drafts"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:px-5"
                >
                  <History className="h-4 w-4" />
                  Older Drafts
                </Link>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      {!showArchivedOnly && latestIdeaDraft && latestIdeaDraftTitle ? (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 overflow-hidden rounded-[24px] border border-border bg-card/60 sm:mb-8 sm:rounded-[28px]"
        >
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <button
              type="button"
              onClick={() => navigate(`/tools/ideas?draftId=${latestIdeaDraft.id}`)}
              className="block w-full text-left"
            >
              <div className="aspect-video overflow-hidden bg-muted/20">
                {latestIdeaDraft.previewUrl ? (
                  <img
                    src={latestIdeaDraft.previewUrl}
                    alt={latestIdeaDraftTitle}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#f5f1df,transparent_45%),linear-gradient(135deg,#111111,#1c1c1c)]">
                    <div className="rounded-[28px] border border-white/10 bg-black/20 px-8 py-6 text-center backdrop-blur-sm">
                      <Sparkles className="mx-auto h-7 w-7 text-white/80" />
                      <p className="mt-3 text-lg font-bold text-white">Idea session</p>
                      <p className="mt-2 text-sm text-white/70">Saved directions ready to reopen</p>
                    </div>
                  </div>
                )}
              </div>
            </button>

            <div className="flex flex-col justify-between gap-5 p-5 sm:p-8">
              <div>
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px] sm:tracking-[0.18em]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="truncate">Resume latest idea session</span>
                </div>
                <h2 className="mt-4 break-words text-xl font-bold tracking-tight text-foreground sm:text-3xl">{latestIdeaDraftTitle}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{formatDraftUpdatedAt(latestIdeaDraft.updatedAt)}</p>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                  {latestIdeaDraft.data.response?.summary ||
                    latestIdeaDraft.data.selectedIdeaLabel ||
                    latestIdeaDraft.data.topic ||
                    "Resume the saved brief, idea pack, and pinned direction inside Idea Assistant."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/tools/ideas?draftId=${latestIdeaDraft.id}`)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 min-[380px]:col-span-2 sm:col-span-1"
                >
                  <Sparkles className="h-4 w-4" />
                  Open Idea Assistant
                </button>
                <Link
                  to="/drafts"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:px-5"
                >
                  <History className="h-4 w-4" />
                  All Drafts
                </Link>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
          {loading ? (
            <div className="col-span-full py-10 text-center text-muted-foreground">Loading projects...</div>
          ) : visibleGenerations.length > 0 ? (
            visibleGenerations.map(renderGenerationGridCard)
          ) : showArchivedOnly ? (
            <div className="col-span-full py-16 text-center rounded-[28px] bg-muted/20">
              <p className="text-foreground font-semibold mb-2">No archived projects yet</p>
            </div>
          ) : (
            <div className="col-span-full py-20 text-center flex flex-col items-center justify-center rounded-[2.5rem] bg-card/35">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-6">
                <ImageIcon className="h-8 w-8 opacity-20" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No projects yet</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Open the Studio page from the sidebar to create your first thumbnail. It will show up here once it is saved.
              </p>
              <Link
                to="/studio"
                className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground px-8 text-sm font-bold text-background transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Open Studio
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Loading projects...</div>
          ) : visibleGenerations.length > 0 ? (
            visibleGenerations.map(renderGenerationListRow)
          ) : showArchivedOnly ? (
            <div className="py-16 text-center rounded-2xl bg-muted/20">
              <p className="text-foreground font-semibold mb-2">No archived projects yet</p>
            </div>
          ) : (
            <div className="rounded-[2rem] bg-card/35 px-6 py-16 text-center">
              <p className="text-lg font-semibold text-foreground">No projects yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Use the Studio page in the sidebar to create something new, then come back here to manage it.
              </p>
              <Link
                to="/studio"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-foreground px-6 text-sm font-bold text-background transition-opacity hover:opacity-90"
              >
                Open Studio
              </Link>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {previewGeneration && previewGeneration.urls[0] && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/85 backdrop-blur-sm"
              onClick={() => setPreviewGenerationId(null)}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-preview-title"
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
              className="relative z-[1] w-full max-w-6xl overflow-hidden rounded-[28px] border border-border bg-background shadow-[0_40px_120px_rgba(0,0,0,0.38)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 id="project-preview-title" className="truncate text-lg font-bold text-foreground sm:text-xl">
                    {getGenerationTitle(previewGeneration)}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Preview stays inside the website.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void updateArchiveState([previewGeneration.id], !isArchivedGeneration(previewGeneration, archivedFallbackIds));
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <Archive className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {isArchivedGeneration(previewGeneration, archivedFallbackIds) ? "Restore" : "Archive"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenGenerationInEditor(previewGeneration)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <Play className="h-4 w-4" />
                    <span className="hidden sm:inline">Open in Studio</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void downloadGenerationImage(previewGeneration.urls[0], previewGeneration.id).catch((error) => {
                        console.error("Failed to download generation from preview", error);
                        showToast({
                          tone: "error",
                          title: "Download failed",
                          message: "Failed to download this thumbnail.",
                        });
                      });
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(previewGeneration.id);
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/15"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Remove Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewGenerationId(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-muted"
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="bg-background p-0">
                <div className="flex min-h-[240px] max-h-[75vh] items-center justify-center overflow-hidden bg-muted/10">
                  <img
                    src={previewGeneration.urls[0]}
                    alt={getGenerationTitle(previewGeneration)}
                    className="max-h-[75vh] w-full object-contain"
                    onError={(event) => {
                      void handleGenerationImageError(previewGeneration.id, 0, event.currentTarget.currentSrc);
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {renameModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-background rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Rename Thumbnail</h3>
                <button
                  onClick={() => setRenameModal(null)}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleRename} className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">New Title</label>
                  <input
                    type="text"
                    value={newPrompt}
                    onChange={(event) => setNewPrompt(event.target.value)}
                    autoFocus
                    className="w-full bg-background rounded-xl px-4 py-3 text-foreground outline-none ring-1 ring-border transition-colors focus:ring-foreground/20"
                    placeholder="Enter new title..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRenameModal(null)}
                    className="flex-1 px-4 py-3 bg-background hover:bg-muted text-foreground rounded-xl font-bold transition-colors ring-1 ring-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-foreground hover:opacity-90 text-background rounded-xl font-bold transition-opacity"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={Boolean(deleteDialog)}
        title={deleteDialog?.title || "Remove project?"}
        description={deleteDialog?.description || ""}
        confirmLabel={deleteDialog?.confirmLabel || "Remove"}
        tone="danger"
        isLoading={isDeleting}
        onClose={() => {
          if (!isDeleting) {
            setDeleteDialog(null);
          }
        }}
        onConfirm={() => {
          if (!deleteDialog) {
            return;
          }

          void (async () => {
            const success = await deleteIds(deleteDialog.ids);

            if (success) {
              showToast({
                tone: "success",
                title: deleteDialog.ids.length === 1 ? "Project removed" : "Projects removed",
                message:
                  deleteDialog.ids.length === 1
                    ? "The selected project was removed from My Projects."
                    : `${deleteDialog.ids.length} projects were removed from My Projects.`,
              });
              setDeleteDialog(null);
            }
          })();
        }}
      />
    </div>
  );
}
