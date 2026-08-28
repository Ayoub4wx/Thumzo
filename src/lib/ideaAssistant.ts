export type IdeaAssistantHandoffMode = "blank" | "sketch";

export interface IdeaAssistantHandoffPayload {
  source: "idea-assistant";
  createdAt: string;
  mode: IdeaAssistantHandoffMode;
  prompt: string;
  ideaLabel: string;
  summary?: string;
  baseImage?: string | null;
}

export const IDEA_ASSISTANT_HANDOFF_KEY = "thumora:idea-assistant-handoff";

export function storeIdeaAssistantHandoff(payload: IdeaAssistantHandoffPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(IDEA_ASSISTANT_HANDOFF_KEY, JSON.stringify(payload));
}

export function consumeIdeaAssistantHandoff() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(IDEA_ASSISTANT_HANDOFF_KEY);

  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(IDEA_ASSISTANT_HANDOFF_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<IdeaAssistantHandoffPayload>;

    if (
      parsed?.source !== "idea-assistant" ||
      (parsed?.mode !== "blank" && parsed?.mode !== "sketch") ||
      typeof parsed?.prompt !== "string" ||
      typeof parsed?.ideaLabel !== "string"
    ) {
      return null;
    }

    return {
      source: "idea-assistant",
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      mode: parsed.mode,
      prompt: parsed.prompt,
      ideaLabel: parsed.ideaLabel,
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      baseImage: typeof parsed.baseImage === "string" ? parsed.baseImage : null,
    } satisfies IdeaAssistantHandoffPayload;
  } catch {
    return null;
  }
}
