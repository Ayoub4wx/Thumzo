export type TemplateCategory =
  | "vlog"
  | "how-to"
  | "gaming"
  | "sports"
  | "entertainment"
  | "education"
  | "tech"
  | "business"
  | "reaction"
  | "podcast"
  | "travel"
  | "news"
  | "other";

export type CreatorToolId = "remove-bg" | "upscale" | "polish";
export type StudioToolLauncherId = CreatorToolId | "agent" | "ideas" | "youtube";

type CategoryOption = {
  id: TemplateCategory;
  label: string;
};

export type CreatorToolOption = {
  id: CreatorToolId;
  title: string;
  actionLabel: string;
  description: string;
  note: string;
};

export type StudioToolLauncherOption = {
  id: StudioToolLauncherId;
  title: string;
  actionLabel: string;
  description: string;
  note: string;
};

export const TEMPLATE_CATEGORY_OPTIONS: CategoryOption[] = [
  { id: "business", label: "Business" },
  { id: "tech", label: "Tech" },
  { id: "education", label: "Education" },
  { id: "vlog", label: "Vlog" },
  { id: "how-to", label: "How-To" },
  { id: "gaming", label: "Gaming" },
  { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Entertainment" },
  { id: "reaction", label: "Reaction" },
  { id: "podcast", label: "Podcast" },
  { id: "travel", label: "Travel" },
  { id: "news", label: "News" },
  { id: "other", label: "Other" },
];

export const DEFAULT_TEMPLATE_CATEGORY: TemplateCategory = "other";

const LEGACY_CATEGORY_ALIASES: Record<string, TemplateCategory> = {
  blog: "vlog",
  blogs: "vlog",
  business: "business",
  education: "education",
  educational: "education",
  entertainment: "entertainment",
  entertainments: "entertainment",
  finance: "business",
  game: "gaming",
  gamer: "gaming",
  gamers: "gaming",
  gaming: "gaming",
  general: "other",
  guide: "how-to",
  guides: "how-to",
  "how to": "how-to",
  "how-to": "how-to",
  howto: "how-to",
  interview: "podcast",
  interviews: "podcast",
  news: "news",
  podcast: "podcast",
  podcasts: "podcast",
  reaction: "reaction",
  reactions: "reaction",
  sport: "sports",
  sports: "sports",
  tech: "tech",
  technology: "tech",
  tools: "tech",
  travel: "travel",
  trip: "travel",
  trips: "travel",
  tutorial: "how-to",
  tutorials: "how-to",
  vlog: "vlog",
  vlogs: "vlog",
};

export const CREATOR_TOOLS: CreatorToolOption[] = [
  {
    id: "remove-bg",
    title: "Remove Background",
    actionLabel: "Run Background Cutout",
    description: "Cleanly isolate the subject, keep the edges natural, and prep the image for compositing.",
    note: "Clean cutout",
  },
  {
    id: "upscale",
    title: "Upscale 4K",
    actionLabel: "Run 4K Upscale",
    description: "Sharpen details, reduce noise, and export a cleaner high-resolution image for publishing.",
    note: "Paid plan",
  },
  {
    id: "polish",
    title: "Polish / Enhance",
    actionLabel: "Run Polish Pass",
    description: "Improve lighting, color, clarity, and overall finish without changing the core composition.",
    note: "Polish pass",
  },
];

export const STUDIO_TOOL_LAUNCHERS: StudioToolLauncherOption[] = [
  {
    id: "agent",
    title: "Prompt Canvas",
    actionLabel: "Open Composer",
    description: "Open a clean Studio canvas with the compact composer ready at the bottom.",
    note: "Composer",
  },
  {
    id: "ideas",
    title: "Idea Assistant",
    actionLabel: "Open Idea Assistant",
    description: "Turn a topic into a few thumbnail directions, then hand the selected prompt into Studio.",
    note: "Planning",
  },
  {
    id: "youtube",
    title: "YouTube Import",
    actionLabel: "Open YouTube Import",
    description: "Paste a YouTube URL or browse your connected channel and bring a thumbnail into Studio.",
    note: "Import",
  },
  ...CREATOR_TOOLS,
];

export function normalizeTemplateCategory(value: string | null | undefined): TemplateCategory {
  if (!value) {
    return DEFAULT_TEMPLATE_CATEGORY;
  }

  const normalized = value.trim().toLowerCase();
  return LEGACY_CATEGORY_ALIASES[normalized] ?? DEFAULT_TEMPLATE_CATEGORY;
}

export function getTemplateCategoryLabel(category: string | null | undefined) {
  const normalized = normalizeTemplateCategory(category);
  return TEMPLATE_CATEGORY_OPTIONS.find((option) => option.id === normalized)?.label ?? "Other";
}

export function getCreatorTool(toolId: string | null | undefined) {
  if (!toolId) {
    return null;
  }

  return CREATOR_TOOLS.find((tool) => tool.id === toolId) ?? null;
}

export function getStudioToolLauncher(toolId: string | null | undefined) {
  if (!toolId) {
    return null;
  }

  return STUDIO_TOOL_LAUNCHERS.find((tool) => tool.id === toolId) ?? null;
}

export function buildCreatorToolEditorUrl(toolId: CreatorToolId) {
  return `/studio?tool=${toolId}`;
}

export function buildStudioAgentUrl() {
  return "/studio?start=agent";
}

export function buildIdeaAssistantUrl() {
  return "/tools/ideas";
}

export function buildYoutubeImportUrl() {
  return "/tools#youtube-import";
}
