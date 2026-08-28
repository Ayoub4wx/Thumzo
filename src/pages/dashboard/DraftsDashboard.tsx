import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Bot, Clock3, FilePlus2, FolderOpen, History, Layers, Sparkles, Trash2 } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../lib/supabase";
import {
  getIdeaAssistantDraftPreviewReference,
  getIdeaAssistantDraftTitle,
  getStudioDraftPreviewReference,
  getStudioDraftTitle,
  isIdeaAssistantDraftRecord,
  normalizeAppDraftRecord,
  type AppDraftRecord,
} from "../../lib/studioDrafts";
import { cn } from "../../lib/utils";
import { deleteUserAsset, getPublicImagePreviewUrl, getUserAssetPath, getUserAssetPreviewUrl } from "../../services/storageService";

type DraftCardRecord = AppDraftRecord & {
  previewUrl: string | null;
};

const DRAFT_PREVIEW_OPTIONS = {
  width: 720,
  height: 405,
  resize: "cover",
  quality: 72,
} as const;

function formatUpdatedAt(value: string) {
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

function getDraftTitle(draft: AppDraftRecord) {
  return isIdeaAssistantDraftRecord(draft) ? getIdeaAssistantDraftTitle(draft) : getStudioDraftTitle(draft);
}

function getDraftPreviewReference(draft: AppDraftRecord) {
  return isIdeaAssistantDraftRecord(draft)
    ? getIdeaAssistantDraftPreviewReference(draft.data)
    : getStudioDraftPreviewReference(draft.data);
}

function getDraftRoute(draft: AppDraftRecord) {
  return isIdeaAssistantDraftRecord(draft) ? `/tools/ideas?draftId=${draft.id}` : `/studio?draftId=${draft.id}`;
}

function getDraftKindLabel(draft: AppDraftRecord) {
  return isIdeaAssistantDraftRecord(draft) ? "Idea Assistant" : "Studio";
}

function getDraftCountLabel(draft: AppDraftRecord) {
  if (isIdeaAssistantDraftRecord(draft)) {
    const ideaCount = draft.data.response?.ideas.length ?? 0;
    return `${ideaCount} idea${ideaCount === 1 ? "" : "s"}`;
  }

  const frameCount = draft.data.history.length;
  return `${frameCount} frame${frameCount === 1 ? "" : "s"}`;
}

function getDraftDescription(draft: AppDraftRecord) {
  if (isIdeaAssistantDraftRecord(draft)) {
    return (
      draft.data.response?.summary ||
      draft.data.selectedIdeaLabel ||
      draft.data.submittedBrief?.topic ||
      draft.data.topic ||
      "Resume the saved brief and returned directions."
    );
  }

  return (
    draft.data.promptDraft.trim() || "Resume the draft to continue editing the thumbnail and agent session."
  );
}

function getDraftPrimaryActionLabel(draft: AppDraftRecord) {
  return isIdeaAssistantDraftRecord(draft) ? "Resume Session" : "Continue Editing";
}

export default function DraftsDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<DraftCardRecord | null>(null);

  useEffect(() => {
    if (!user) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    const resolveDraftPreviewUrl = async (draft: AppDraftRecord) => {
      const previewReference = getDraftPreviewReference(draft);

      if (!previewReference) {
        return null;
      }

      if (getUserAssetPath(previewReference, user.uid)) {
        return getUserAssetPreviewUrl(previewReference, user.uid, DRAFT_PREVIEW_OPTIONS);
      }

      return getPublicImagePreviewUrl(previewReference, DRAFT_PREVIEW_OPTIONS);
    };

    const fetchDrafts = async () => {
      const { data, error } = await supabase
        .from("drafts")
        .select("id, title, data, created_at, updated_at")
        .eq("user_id", user.uid)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Failed to load drafts", error);
        setDrafts([]);
        setLoading(false);
        return;
      }

      const normalizedDrafts = (data ?? [])
        .map((row) => normalizeAppDraftRecord(row))
        .filter((draft): draft is AppDraftRecord => Boolean(draft));
      const draftsWithPreviews = await Promise.all(
        normalizedDrafts.map(async (draft) => ({
          ...draft,
          previewUrl: await resolveDraftPreviewUrl(draft),
        })),
      );
      setDrafts(draftsWithPreviews);
      setLoading(false);
    };

    void fetchDrafts();

    const subscription = supabase
      .channel("studio_drafts_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drafts",
          filter: `user_id=eq.${user.uid}`,
        },
        () => {
          void fetchDrafts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const hasDrafts = useMemo(() => drafts.length > 0, [drafts]);

  const handleDeleteDraft = async () => {
    if (!user || deletingDraftId || !draftToDelete) {
      return;
    }

    setDeletingDraftId(draftToDelete.id);

    try {
      await Promise.all(
        draftToDelete.data.ownedAssetReferences.map((assetReference) =>
          deleteUserAsset(assetReference, user.uid).catch((error) => {
            console.error("Failed to remove owned draft asset", error);
            return false;
          }),
        ),
      );

      const { error } = await supabase.from("drafts").delete().eq("id", draftToDelete.id).eq("user_id", user.uid);
      if (error) {
        throw error;
      }

      setDrafts((current) => current.filter((item) => item.id !== draftToDelete.id));
      setDraftToDelete(null);
      showToast({
        tone: "success",
        title: "Draft removed",
        message: `"${getDraftTitle(draftToDelete)}" was removed from drafts.`,
      });
    } catch (error) {
      console.error("Failed to delete draft", error);
      showToast({
        tone: "error",
        title: "Delete failed",
        message: "Failed to remove this draft.",
      });
    } finally {
      setDeletingDraftId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] overflow-x-hidden p-3 pb-5 sm:p-8" dir="ltr">
      <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="no-scrollbar flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-muted/35 p-1 sm:w-auto">
          <Link
            to="/projects"
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground sm:px-4"
          >
            <FolderOpen className="h-4 w-4" /> My Projects
          </Link>
          <Link
            to="/drafts"
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-background px-3 text-sm font-semibold text-foreground shadow-sm dark:bg-muted sm:px-4"
          >
            <History className="h-4 w-4" /> Drafts
          </Link>
          <Link
            to="/templates"
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground sm:px-4"
          >
            <Layers className="h-4 w-4" /> Templates
          </Link>
        </div>

        <button
          type="button"
          onClick={() => navigate("/create")}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:w-auto"
        >
          <FilePlus2 className="h-4 w-4" />
          Start New Project
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Drafts</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your saved Studio and Idea Assistant sessions appear here. Reopen any draft and continue from the exact state you left.
        </p>
      </div>

      {loading ? (
        <div className="rounded-[2rem] bg-card/35 px-6 py-16 text-center text-muted-foreground">Loading drafts...</div>
      ) : hasDrafts ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {drafts.map((draft) => {
            const draftTitle = getDraftTitle(draft);
            const draftRoute = getDraftRoute(draft);
            const isIdeaDraft = isIdeaAssistantDraftRecord(draft);

            return (
              <motion.article
                key={draft.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-[24px] border border-border bg-card/60 sm:rounded-[28px]"
              >
                <button type="button" onClick={() => navigate(draftRoute)} className="block w-full text-left">
                  <div className="aspect-video overflow-hidden bg-muted/20">
                    {draft.previewUrl ? (
                      <img
                        src={draft.previewUrl}
                        alt={draftTitle}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-muted/30">
                        <div className="rounded-2xl border border-dashed border-border px-6 py-4 text-center">
                          {isIdeaDraft ? (
                            <>
                              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-foreground">
                                <Bot className="h-5 w-5" />
                              </div>
                              <p className="mt-3 text-sm font-semibold text-foreground">Idea session</p>
                              <p className="mt-1 text-xs text-muted-foreground">No reference image saved</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-foreground">Blank canvas</p>
                              <p className="mt-1 text-xs text-muted-foreground">No preview frame yet</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </button>

                <div className="space-y-4 p-4 sm:p-5">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {getDraftKindLabel(draft)}
                          </span>
                          {isIdeaDraft ? (
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              <Sparkles className="mr-1 inline h-3 w-3" />
                              Planning
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-2 truncate text-lg font-bold text-foreground">{draftTitle}</h2>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatUpdatedAt(draft.updatedAt)}
                        </p>
                      </div>
                      <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {getDraftCountLabel(draft)}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-sm text-muted-foreground">{getDraftDescription(draft)}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(draftRoute)}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      <FolderOpen className="h-4 w-4" />
                      {getDraftPrimaryActionLabel(draft)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftToDelete(draft)}
                      disabled={deletingDraftId === draft.id}
                      className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/15",
                        deletingDraftId === draft.id && "cursor-not-allowed opacity-60",
                      )}
                      title="Remove draft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[2rem] bg-card/35 px-6 py-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <History className="h-8 w-8 opacity-30" />
          </div>
          <h2 className="text-xl font-bold text-foreground">No drafts yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your saved Studio and Idea Assistant sessions will appear here. Start a project or generate your first idea pack to create a draft.
          </p>
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-6 text-sm font-bold text-background transition-opacity hover:opacity-90"
          >
            <FilePlus2 className="h-4 w-4" />
            Start New Project
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(draftToDelete)}
        title="Remove this draft?"
        description={draftToDelete ? `This will permanently remove "${getDraftTitle(draftToDelete)}" from drafts.` : ""}
        confirmLabel="Remove draft"
        tone="danger"
        isLoading={Boolean(deletingDraftId)}
        onClose={() => {
          if (!deletingDraftId) {
            setDraftToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleDeleteDraft();
        }}
      />
    </div>
  );
}
