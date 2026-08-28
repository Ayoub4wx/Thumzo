import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Lightbulb,
  type LucideIcon,
  Maximize2,
  Scissors,
  Sparkles,
  Wand2,
  X,
  Youtube,
} from "lucide-react";
import { CREATOR_TOOLS, type CreatorToolId } from "../lib/studioMetadata";

type StudioToolsModalProps = {
  isOpen: boolean;
  isYoutubeImporting?: boolean;
  onClose: () => void;
  onLaunchAgent: () => void;
  onOpenIdeas: () => void;
  onOpenYoutubeLibrary: () => void;
  onRunCreatorTool: (toolId: CreatorToolId) => void;
  onImportYoutubeUrl: (url: string) => Promise<void> | void;
};

const CREATOR_TOOL_ICONS: Record<CreatorToolId, LucideIcon> = {
  "remove-bg": Scissors,
  upscale: Maximize2,
  polish: Wand2,
};

export default function StudioToolsModal({
  isOpen,
  isYoutubeImporting = false,
  onClose,
  onLaunchAgent,
  onOpenIdeas,
  onOpenYoutubeLibrary,
  onRunCreatorTool,
  onImportYoutubeUrl,
}: StudioToolsModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setYoutubeUrl("");
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleYoutubeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUrl = youtubeUrl.trim();
    if (!trimmedUrl || isYoutubeImporting) {
      return;
    }

    await onImportYoutubeUrl(trimmedUrl);
    setYoutubeUrl("");
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="relative z-[1] flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_40px_120px_rgba(0,0,0,0.35)]"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 text-foreground transition-colors hover:bg-muted"
              aria-label="Close tools"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-border px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Studio tools</p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">Launch the current Studio workflow without leaving the canvas</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Start a blank composer, open the Idea Assistant, run a creator tool, or import a YouTube thumbnail from one place.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <button
                  type="button"
                  onClick={onLaunchAgent}
                  className="rounded-[24px] border border-indigo-500/25 bg-indigo-500/5 p-5 text-left transition-colors hover:border-indigo-400/40 hover:bg-indigo-500/10"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-500 dark:text-indigo-300">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-lg font-semibold text-foreground">Prompt Canvas</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Open a clean canvas with the compact composer ready at the bottom.</p>
                </button>

                <button
                  type="button"
                  onClick={onOpenIdeas}
                  className="rounded-[24px] border border-border bg-background p-5 text-left transition-colors hover:border-foreground/20 hover:bg-muted/20"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-lg font-semibold text-foreground">Idea Assistant</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Turn a topic into a few thumbnail directions, then push the selected prompt into Studio.</p>
                </button>
              </div>

              <div className="mt-6 rounded-[24px] border border-border bg-background p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">Creator tools</p>
                    <p className="mt-1 text-sm text-muted-foreground">Run the current utility tools directly from this popup.</p>
                  </div>
                  <div className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    {CREATOR_TOOLS.length} tools
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {CREATOR_TOOLS.map((tool) => {
                    const Icon = CREATOR_TOOL_ICONS[tool.id];

                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => onRunCreatorTool(tool.id)}
                        className="rounded-[20px] border border-border bg-card/50 p-4 text-left transition-colors hover:border-foreground/15 hover:bg-card"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {tool.note}
                          </span>
                        </div>
                        <p className="mt-4 text-base font-semibold text-foreground">{tool.title}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{tool.description}</p>
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {tool.actionLabel}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-red-500/20 bg-red-500/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">YouTube import</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Paste a YouTube URL for a direct import, or open the channel browser when you need to pull from your connected uploads.
                    </p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                    <Youtube className="h-5 w-5" />
                  </div>
                </div>

                <form onSubmit={handleYoutubeSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-500/40"
                  />
                  <button
                    type="submit"
                    disabled={!youtubeUrl.trim() || isYoutubeImporting}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isYoutubeImporting ? "Importing..." : "Import URL"}
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onOpenYoutubeLibrary}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    <Sparkles className="h-4 w-4" />
                    Open channel imports
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
