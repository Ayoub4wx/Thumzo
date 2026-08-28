import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "../lib/utils";

type ConfirmDialogTone = "default" | "danger";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoading, isOpen, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  const confirmButtonClass =
    tone === "danger"
      ? "bg-red-500 text-white hover:bg-red-600"
      : "bg-foreground text-background hover:opacity-90";

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isLoading) {
                onClose();
              }
            }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative z-[1] w-full max-w-lg overflow-hidden rounded-[28px] border border-border bg-background shadow-[0_40px_120px_rgba(0,0,0,0.32)]"
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close confirmation"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                    tone === "danger" ? "bg-red-500/12 text-red-500" : "bg-muted text-foreground"
                  )}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>

                <div className="min-w-0 pr-10">
                  <h2 id="confirm-dialog-title" className="text-xl font-bold text-foreground">
                    {title}
                  </h2>
                  <div className="mt-3 text-sm leading-6 text-muted-foreground">{description}</div>
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    confirmButtonClass
                  )}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
