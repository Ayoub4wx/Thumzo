import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { LayoutTemplate, Search, Sparkles, Star, TrendingUp, X, type LucideIcon } from "lucide-react";
import {
  getPublicImagePreviewUrl,
  listTemplates,
  type TemplateAsset,
} from "../../services/storageService";
import { cn } from "../../lib/utils";
import {
  getTemplateCategoryLabel,
  TEMPLATE_CATEGORY_OPTIONS,
  type TemplateCategory,
} from "../../lib/studioMetadata";

type CategoryFilter = "all" | TemplateCategory;
type StatusFilter = "all" | "new" | "trending" | "popular";

const STATUS_FILTER_OPTIONS: Array<{ id: StatusFilter; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All", icon: LayoutTemplate },
  { id: "new", label: "New", icon: Sparkles },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "popular", label: "Popular", icon: Star },
];

const TEMPLATE_CARD_PREVIEW_OPTIONS = {
  width: 640,
  height: 360,
  resize: "contain",
  quality: 72,
} as const;

const TEMPLATE_MODAL_PREVIEW_OPTIONS = {
  width: 1280,
  height: 720,
  resize: "contain",
  quality: 82,
} as const;

function getStatusBadge(template: TemplateAsset) {
  if (template.isTrending) return { label: "Trending", icon: TrendingUp };
  if (template.isPopular) return { label: "Popular", icon: Star };
  if (template.isNew) return { label: "New", icon: Sparkles };
  return null;
}

function filterByStatus(templates: TemplateAsset[], statusFilter: StatusFilter) {
  return templates.filter((template) => {
    if (statusFilter === "new") return template.isNew;
    if (statusFilter === "trending") return template.isTrending;
    if (statusFilter === "popular") return template.isPopular;
    return true;
  });
}

function matchesTemplateSearch(template: TemplateAsset, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystacks = [
    template.title,
    template.category,
    getTemplateCategoryLabel(template.category),
    ...(template.tags ?? []),
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase().replace(/-/g, " "));

  return haystacks.some((value) => value.includes(normalizedQuery));
}

type TemplateCardProps = {
  template: TemplateAsset;
  onPreview: (template: TemplateAsset) => void;
  onBroken: (templateId: string) => void;
};

function TemplateCard({ template, onPreview, onBroken }: TemplateCardProps) {
  const statusBadge = getStatusBadge(template);
  const previewUrl = getPublicImagePreviewUrl(template.url, TEMPLATE_CARD_PREVIEW_OPTIONS);

  return (
    <article className="group overflow-hidden rounded-lg border border-border/70 bg-card/40 transition-colors hover:border-foreground/20 hover:bg-card/60">
      <div className="relative aspect-video overflow-hidden bg-muted/10">
        <img
          src={previewUrl}
          alt={template.title}
          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          onError={(event) => {
            if (event.currentTarget.dataset.fallbackApplied === "true") {
              onBroken(template.id);
              return;
            }

            event.currentTarget.dataset.fallbackApplied = "true";
            event.currentTarget.src = template.url;
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onPreview(template)}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background transition-opacity hover:opacity-90"
            aria-label={`Preview and use ${template.title}`}
          >
            Use
          </button>
        </div>
      </div>

      <div className="space-y-2.5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-md border border-border/70 bg-background/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {getTemplateCategoryLabel(template.category)}
          </span>
          {statusBadge ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
              <statusBadge.icon className="h-3 w-3" />
              {statusBadge.label}
            </span>
          ) : null}
        </div>
        <div>
          <h3 className="line-clamp-2 text-base font-semibold text-foreground">{template.title}</h3>
        </div>
      </div>
    </article>
  );
}

type TemplatePreviewPopupProps = {
  template: TemplateAsset | null;
  onClose: () => void;
  onUse: (url: string) => void;
};

function TemplatePreviewPopup({ template, onClose, onUse }: TemplatePreviewPopupProps) {
  useEffect(() => {
    if (!template) return;

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
  }, [template, onClose]);

  const statusBadge = template ? getStatusBadge(template) : null;
  const previewUrl = template ? getPublicImagePreviewUrl(template.url, TEMPLATE_MODAL_PREVIEW_OPTIONS) : "";

  return (
    <AnimatePresence>
      {template ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/85 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-preview-title"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="relative z-[1] w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-background shadow-[0_40px_120px_rgba(0,0,0,0.38)]"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/90 text-foreground transition-colors hover:bg-muted"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-h-[300px] items-center justify-center bg-background">
                <motion.div
                  initial={{ clipPath: "inset(48% 0% 48% 0% round 8px)", scale: 0.98 }}
                  animate={{ clipPath: "inset(0% 0% 0% 0% round 8px)", scale: 1 }}
                  transition={{ duration: 0.38, ease: "easeOut" }}
                  className="aspect-video w-full overflow-hidden"
                >
                  <img
                    src={previewUrl}
                    alt={template.title}
                    className="h-full w-full object-contain"
                    decoding="async"
                    sizes="(min-width: 1024px) 960px, 100vw"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallbackApplied === "true") {
                        return;
                      }

                      event.currentTarget.dataset.fallbackApplied = "true";
                      event.currentTarget.src = template.url;
                    }}
                  />
                </motion.div>
              </div>

              <div className="flex flex-col justify-between border-t border-border bg-card/60 p-5 lg:border-l lg:border-t-0 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2 pr-12 lg:pr-0">
                    <span className="inline-flex rounded-md border border-border/70 bg-background/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      {getTemplateCategoryLabel(template.category)}
                    </span>
                    {statusBadge ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        <statusBadge.icon className="h-3 w-3" />
                        {statusBadge.label}
                      </span>
                    ) : null}
                  </div>

                  <h2 id="template-preview-title" className="mt-4 text-2xl font-bold leading-tight text-foreground">
                    {template.title}
                  </h2>

                  {template.tags?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {template.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="rounded-md bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-2">
                  <button
                    type="button"
                    onClick={() => onUse(template.url)}
                    className="inline-flex h-12 items-center justify-center rounded-lg bg-foreground px-5 text-sm font-bold text-background transition-opacity hover:opacity-90"
                  >
                    Use template
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Keep browsing
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export default function TemplatesDashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [brokenTemplateIds, setBrokenTemplateIds] = useState<string[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateAsset | null>(null);

  async function fetchTemplates() {
    try {
      setLoading(true);
      setError(null);
      const data = await listTemplates();
      setTemplates(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const visibleTemplates = useMemo(() => {
    return templates.filter((template) => !brokenTemplateIds.includes(template.id));
  }, [brokenTemplateIds, templates]);

  const searchFilteredTemplates = useMemo(() => {
    return visibleTemplates.filter((template) => matchesTemplateSearch(template, searchQuery));
  }, [searchQuery, visibleTemplates]);

  const statusFilteredTemplates = useMemo(() => {
    return filterByStatus(searchFilteredTemplates, statusFilter);
  }, [searchFilteredTemplates, statusFilter]);

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === "all") return statusFilteredTemplates;
    return statusFilteredTemplates.filter((template) => template.category === categoryFilter);
  }, [categoryFilter, statusFilteredTemplates]);

  const groupedTemplates = useMemo(() => {
    return TEMPLATE_CATEGORY_OPTIONS.map((category) => ({
      category: category.id,
      label: category.label,
      templates: statusFilteredTemplates.filter((template) => template.category === category.id),
    })).filter((group) => group.templates.length > 0);
  }, [statusFilteredTemplates]);

  const markTemplateAsBroken = (templateId: string) => {
    setBrokenTemplateIds((current) => (current.includes(templateId) ? current : [...current, templateId]));
  };

  const handlePreviewTemplate = (template: TemplateAsset) => {
    setPreviewTemplate(template);
  };

  const handleUseStyle = (url: string) => {
    navigate(`/studio?templateUrl=${encodeURIComponent(url)}`);
  };

  return (
    <div className="mx-auto max-w-[1600px] overflow-x-hidden px-3 py-4 sm:px-8 sm:py-7" dir="ltr">
      <section className="mb-5 border-b border-border/70 pb-4 sm:mb-7 sm:pb-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label className="flex h-11 w-full items-center gap-3 rounded-lg border border-border/70 bg-card/35 px-3 text-sm text-muted-foreground transition-colors focus-within:border-foreground/30 xl:max-w-xl">
            <Search className="h-4 w-4 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search templates"
              className="h-full w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="no-scrollbar flex w-full max-w-full items-center gap-1.5 overflow-x-auto xl:w-auto">
            {STATUS_FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatusFilter(option.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                  statusFilter === option.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/70 bg-card/35 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                )}
              >
                <option.icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "h-9 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors",
              categoryFilter === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border/70 bg-card/35 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            All categories
          </button>
          {TEMPLATE_CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setCategoryFilter(option.id)}
              className={cn(
                "h-9 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors",
                categoryFilter === option.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-card/35 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="animate-pulse overflow-hidden rounded-lg border border-border/70 bg-card/40">
              <div className="aspect-video bg-muted" />
              <div className="space-y-3 p-3">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border/70 bg-card/50 py-12 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={() => void fetchTemplates()} className="mt-4 text-sm font-bold text-foreground underline">
            Try Again
          </button>
        </div>
      ) : categoryFilter === "all" ? (
        <div className="space-y-10">
          {groupedTemplates.map((group) => (
            <section key={group.category}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">{group.label}</h2>
                <span className="text-sm text-muted-foreground">{group.templates.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
                {group.templates.map((template) => (
                  <Fragment key={template.id}>
                    <TemplateCard template={template} onPreview={handlePreviewTemplate} onBroken={markTemplateAsBroken} />
                  </Fragment>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {filteredTemplates.map((template) => (
            <Fragment key={template.id}>
              <TemplateCard template={template} onPreview={handlePreviewTemplate} onBroken={markTemplateAsBroken} />
            </Fragment>
          ))}
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/70 py-20 text-center">
          <p className="text-muted-foreground">No templates found.</p>
        </div>
      )}

      <TemplatePreviewPopup template={previewTemplate} onClose={() => setPreviewTemplate(null)} onUse={handleUseStyle} />
    </div>
  );
}
