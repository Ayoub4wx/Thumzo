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
import type {
  StudioDraftAgentMemoryEntry,
  StudioDraftHistoryItem,
} from "../lib/studioDrafts";

export type StudioGenerationOperation = "generate" | "polish" | "upscale" | "remove-bg" | "insert-me";

export type StudioGenerationResult = {
  frame: StudioDraftHistoryItem;
  clearPrompt?: boolean;
  clearEditRegion?: boolean;
  agentMemoryEntries?: StudioDraftAgentMemoryEntry[];
};

export type StudioGenerationTask = {
  id: string;
  status: "running" | "completed" | "failed";
  operation: StudioGenerationOperation;
  label: string;
  prompt: string;
  startedAt: number;
  updatedAt: number;
  result?: StudioGenerationResult;
  errorMessage?: string;
};

type StudioGenerationContextValue = {
  task: StudioGenerationTask | null;
  startGeneration: (input: {
    operation: StudioGenerationOperation;
    label: string;
    prompt: string;
  }) => string | null;
  completeGeneration: (id: string, result: StudioGenerationResult) => void;
  failGeneration: (id: string, errorMessage: string) => void;
  clearGeneration: (id?: string) => void;
};

const STORAGE_KEY = "thumora-ai:studio-background-generation";

const StudioGenerationContext = createContext<StudioGenerationContextValue | undefined>(undefined);

function createTaskId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `studio-generation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readStoredTask() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const storedTask = JSON.parse(rawValue) as StudioGenerationTask;
    if (storedTask?.status === "completed" && storedTask.result?.frame) {
      return storedTask;
    }
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }

  return null;
}

function persistTask(task: StudioGenerationTask | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (task?.status === "completed" && task.result?.frame) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(task));
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function StudioGenerationProvider({ children }: { children: ReactNode }) {
  const [task, setTask] = useState<StudioGenerationTask | null>(() => readStoredTask());
  const taskRef = useRef<StudioGenerationTask | null>(task);

  useEffect(() => {
    taskRef.current = task;
    persistTask(task);
  }, [task]);

  const startGeneration = useCallback<StudioGenerationContextValue["startGeneration"]>((input) => {
    if (taskRef.current?.status === "running") {
      return null;
    }

    const now = Date.now();
    const nextTask: StudioGenerationTask = {
      id: createTaskId(),
      status: "running",
      operation: input.operation,
      label: input.label,
      prompt: input.prompt,
      startedAt: now,
      updatedAt: now,
    };

    taskRef.current = nextTask;
    setTask(nextTask);
    return nextTask.id;
  }, []);

  const completeGeneration = useCallback<StudioGenerationContextValue["completeGeneration"]>((id, result) => {
    const currentTask = taskRef.current;
    if (!currentTask || currentTask.id !== id || currentTask.status !== "running") {
      return;
    }

    const nextTask: StudioGenerationTask = {
      ...currentTask,
      status: "completed",
      result,
      errorMessage: undefined,
      updatedAt: Date.now(),
    };

    taskRef.current = nextTask;
    setTask(nextTask);
  }, []);

  const failGeneration = useCallback<StudioGenerationContextValue["failGeneration"]>((id, errorMessage) => {
    const currentTask = taskRef.current;
    if (!currentTask || currentTask.id !== id || currentTask.status !== "running") {
      return;
    }

    const nextTask: StudioGenerationTask = {
      ...currentTask,
      status: "failed",
      errorMessage,
      updatedAt: Date.now(),
    };

    taskRef.current = nextTask;
    setTask(nextTask);
  }, []);

  const clearGeneration = useCallback<StudioGenerationContextValue["clearGeneration"]>((id) => {
    const currentTask = taskRef.current;
    if (id && currentTask?.id !== id) {
      return;
    }

    taskRef.current = null;
    setTask(null);
  }, []);

  const value = useMemo(
    () => ({
      task,
      startGeneration,
      completeGeneration,
      failGeneration,
      clearGeneration,
    }),
    [clearGeneration, completeGeneration, failGeneration, startGeneration, task]
  );

  return <StudioGenerationContext.Provider value={value}>{children}</StudioGenerationContext.Provider>;
}

export function useStudioGeneration() {
  const context = useContext(StudioGenerationContext);

  if (!context) {
    throw new Error("useStudioGeneration must be used within a StudioGenerationProvider");
  }

  return context;
}
