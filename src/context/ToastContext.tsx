import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";

type ToastInput = {
  title?: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastRecord = Required<Pick<ToastInput, "duration" | "tone">> &
  Omit<ToastInput, "duration" | "tone"> & {
    id: string;
  };

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const DEFAULT_DURATION_MS = 4200;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function getToastIcon(tone: ToastTone) {
  if (tone === "success") {
    return CheckCircle2;
  }

  if (tone === "error") {
    return AlertTriangle;
  }

  if (tone === "warning") {
    return AlertTriangle;
  }

  return Info;
}

function getToastToneClasses(tone: ToastTone) {
  if (tone === "success") {
    return {
      accent: "text-emerald-500",
      iconWrap: "bg-emerald-500/12 text-emerald-500",
      bar: "bg-emerald-500",
    };
  }

  if (tone === "error") {
    return {
      accent: "text-red-500",
      iconWrap: "bg-red-500/12 text-red-500",
      bar: "bg-red-500",
    };
  }

  if (tone === "warning") {
    return {
      accent: "text-amber-500",
      iconWrap: "bg-amber-500/12 text-amber-500",
      bar: "bg-amber-500",
    };
  }

  return {
    accent: "text-sky-500",
    iconWrap: "bg-sky-500/12 text-sky-500",
    bar: "bg-sky-500",
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    const timerId = timersRef.current[id];
    if (typeof timerId === "number") {
      window.clearTimeout(timerId);
      delete timersRef.current[id];
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ duration = DEFAULT_DURATION_MS, tone = "info", ...toast }: ToastInput) => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setToasts((current) => [...current, { id, duration, tone, ...toast }]);

      if (duration > 0) {
        timersRef.current[id] = window.setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  useEffect(() => {
    return () => {
      (Object.values(timersRef.current) as number[]).forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = {};
    };
  }, []);

  const value = useMemo(
    () => ({
      showToast,
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[220] flex w-[min(100vw-2rem,24rem)] flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = getToastIcon(toast.tone);
            const toneClasses = getToastToneClasses(toast.tone);

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 32, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.97 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="pointer-events-auto overflow-hidden rounded-[1.35rem] border border-border bg-background/95 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-start gap-3 p-4">
                  <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", toneClasses.iconWrap)}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {toast.title ? <p className="text-sm font-semibold text-foreground">{toast.title}</p> : null}
                    <p className={cn("text-sm leading-6", toast.title ? "mt-1 text-muted-foreground" : "text-foreground")}>
                      {toast.message}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className={cn("h-1 w-full", toneClasses.bar)} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
