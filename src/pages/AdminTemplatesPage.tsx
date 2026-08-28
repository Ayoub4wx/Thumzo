import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Database, Loader2, RefreshCw, Save, Trash2, Upload, Wand2 } from "lucide-react";
import { apiFetch, ApiError } from "../lib/apiClient";
import { normalizeTemplateCategory, TEMPLATE_CATEGORY_OPTIONS } from "../lib/studioMetadata";

interface TemplateRecord {
  id: string;
  title: string;
  image_url: string;
  category: string;
  is_trending: boolean;
  is_popular: boolean;
  is_new: boolean;
  tags: string[];
}

function isLocalHost() {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

interface TemplateListResponse {
  templates: TemplateRecord[];
}

interface TemplateUploadResponse {
  template: TemplateRecord;
}

interface TemplateAiSuggestion {
  title?: string;
  category?: string;
  tags?: string[] | string;
  is_new?: boolean;
  is_trending?: boolean;
  is_popular?: boolean;
  raw_text?: string;
}
function normalizeTemplateRecord(template: TemplateRecord): TemplateRecord {
  return {
    ...template,
    category: normalizeTemplateCategory(template.category),
    tags: Array.isArray(template.tags) ? template.tags : [],
  };
}

function sanitizeSuggestionTags(value: TemplateAiSuggestion["tags"]) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
      .filter(Boolean)
      .slice(0, 6);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
  }

  return [];
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const localOnly = useMemo(() => isLocalHost(), []);

  useEffect(() => {
    if (!localOnly) {
      setLoading(false);
      return;
    }

    void fetchTemplates();
  }, [localOnly]);

  async function readFileAsBase64(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);

    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }

    return btoa(binary);
  }

  async function fetchTemplates() {
    try {
      setLoading(true);
      setError(null);
      setStatus(null);
      const payload = await apiFetch<TemplateListResponse>("/api/admin/templates");
      setTemplates((payload.templates || []).map(normalizeTemplateRecord));
    } catch (fetchError: any) {
      console.error(fetchError);
      setError(fetchError.message || "Failed to fetch template records.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setStatus(null);

    try {
      const fileName = `${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const dataBase64 = await readFileAsBase64(file);
      const payload = await apiFetch<TemplateUploadResponse>("/api/admin/templates/upload", {
        method: "POST",
        body: {
          fileName,
          contentType: file.type,
          dataBase64,
          originalName: file.name,
        },
      });

      setTemplates((current) => [normalizeTemplateRecord(payload.template), ...current]);
      setStatus(`Uploaded ${payload.template.title} and added it to Supabase.`);
    } catch (uploadError: any) {
      console.error(uploadError);
      setError(uploadError.message || "Upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSyncStorage() {
    if (!confirm("This will scan the 'thumbnails' bucket and add missing files to the database. Continue?")) return;

    setSyncing(true);
    setError(null);
    setStatus(null);

    try {
      await apiFetch("/api/admin/templates/sync", {
        method: "POST",
      });
      await fetchTemplates();
      setStatus("Synced storage files into the Supabase templates table.");
    } catch (syncError: any) {
      console.error(syncError);
      setError(syncError.message || "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAiSuggest(template: TemplateRecord) {
    setProcessingId(template.id);
    setError(null);
    setStatus(null);

    try {
      const res = await apiFetch<{ analysis: TemplateAiSuggestion }>("/api/ai/analyze", {
        method: "POST",
        body: {
          imageUrl: template.image_url,
          prompt: `Act as a YouTube thumbnail metadata strategist.
Analyze this thumbnail and return ONLY a JSON object with these exact keys:
- title: string
- category: one of [vlog, how-to, gaming, sports, entertainment, education, tech, business, reaction, podcast, travel, news, other]
- tags: array of 3 to 5 short lowercase tags
- is_new: boolean
- is_trending: boolean
- is_popular: boolean

Rules:
- title must be catchy, high-CTR, and max 8 words.
- category must choose the single best fit from the allowed list.
- tags must be short, relevant discovery tags with no hashtags.
- is_new should be true only if the thumbnail feels timely, fresh, or recent.
- is_trending should be true only if the concept looks like a trend-driven or high-momentum topic.
- is_popular should be true only if the concept has broad mainstream or evergreen appeal.
- Return JSON only. No markdown, no commentary.`,
        },
      });

      const analysis = res.analysis || {};
      const suggestedTitle =
        typeof analysis.title === "string" && analysis.title.trim()
          ? analysis.title.trim().replace(/^\"|\"$/g, "")
          : typeof analysis.raw_text === "string" && analysis.raw_text.trim()
            ? analysis.raw_text.trim().replace(/^\"|\"$/g, "")
            : template.title;
      const suggestedCategory = normalizeTemplateCategory(analysis.category || template.category);
      const suggestedTags = sanitizeSuggestionTags(analysis.tags);

      setTemplates((current) =>
        current.map((item) =>
          item.id === template.id
            ? {
                ...item,
                title: suggestedTitle,
                category: suggestedCategory,
                tags: suggestedTags.length > 0 ? suggestedTags : item.tags,
                is_new: typeof analysis.is_new === "boolean" ? analysis.is_new : item.is_new,
                is_trending: typeof analysis.is_trending === "boolean" ? analysis.is_trending : item.is_trending,
                is_popular: typeof analysis.is_popular === "boolean" ? analysis.is_popular : item.is_popular,
              }
            : item,
        ),
      );
      setStatus("Generated AI metadata suggestions. Save Changes to write the title, category, tags, and badges to Supabase.");
    } catch (suggestionError: any) {
      console.error(suggestionError);
      if (suggestionError instanceof ApiError && suggestionError.status === 401) {
        setError("Your session expired. Sign in again to use AI suggestions.");
      } else {
        setError(suggestionError.message || "AI suggestion failed.");
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function handleUpdate(template: TemplateRecord) {
    setProcessingId(template.id);
    setError(null);
    setStatus(null);

    try {
      const payload = await apiFetch<{ template: TemplateRecord }>(`/api/admin/templates/${template.id}`, {
        method: "PATCH",
        body: {
          title: template.title,
          category: template.category,
          is_trending: template.is_trending,
          is_popular: template.is_popular,
          is_new: template.is_new,
          tags: template.tags,
        },
      });

      setTemplates((current) =>
        current.map((item) => (item.id === template.id ? normalizeTemplateRecord(payload.template) : item))
      );
      setStatus(`Saved "${payload.template.title}" to Supabase.`);
    } catch (updateError: any) {
      console.error(updateError);
      setError(updateError.message || "Update failed.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDelete(template: TemplateRecord) {
    if (!confirm("Are you sure? This deletes only the database record. The storage file stays untouched.")) return;

    setError(null);
    setStatus(null);

    try {
      await apiFetch(`/api/admin/templates/${template.id}`, {
        method: "DELETE",
      });
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setStatus(`Removed "${template.title}" from the Supabase templates table.`);
    } catch (deleteError: any) {
      console.error(deleteError);
      setError(deleteError.message || "Delete failed.");
    }
  }

  if (!localOnly) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h1 className="text-2xl font-bold text-foreground">Localhost Only</h1>
          <p className="mt-3 text-muted-foreground">
            This template manager is only available from <code>localhost</code>.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
          >
            Back to site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" dir="ltr">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Local admin</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">Template Manager</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Change titles and metadata in Supabase from localhost only. All mutations go through local server endpoints.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/templates"
              className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
            >
              Template titles
            </Link>
            <Link
              to="/admin/storage"
              className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"
            >
              Storage files
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload Template
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
          </label>
          <button
            onClick={handleSyncStorage}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Sync from Storage
          </button>
          <button
            onClick={() => void fetchTemplates()}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {status ? (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {status}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-pulse text-accent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="group relative aspect-video bg-black">
                <img src={template.image_url} alt={template.title} className="h-full w-full object-contain" loading="lazy" decoding="async" />
                <button
                  onClick={() => void handleDelete(template)}
                  className="absolute right-2 top-2 rounded-lg bg-red-500 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title</label>
                  <textarea
                    value={template.title}
                    onChange={(event) =>
                      setTemplates((current) =>
                        current.map((item) =>
                          item.id === template.id ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                    className="h-20 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent"
                    placeholder="Type a viral title..."
                  />
                </div>

                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                    <select
                      value={template.category}
                      onChange={(event) =>
                        setTemplates((current) =>
                          current.map((item) =>
                            item.id === template.id ? { ...item, category: event.target.value } : item,
                          ),
                        )
                      }
                      className="w-full rounded-xl border border-border bg-background p-2 text-xs outline-none focus:border-accent"
                    >
                      {TEMPLATE_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={template.is_trending}
                        onChange={(event) =>
                          setTemplates((current) =>
                            current.map((item) =>
                              item.id === template.id ? { ...item, is_trending: event.target.checked } : item,
                            ),
                          )
                        }
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      Trending
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={template.is_popular}
                        onChange={(event) =>
                          setTemplates((current) =>
                            current.map((item) =>
                              item.id === template.id ? { ...item, is_popular: event.target.checked } : item,
                            ),
                          )
                        }
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      Popular
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={template.is_new}
                        onChange={(event) =>
                          setTemplates((current) =>
                            current.map((item) =>
                              item.id === template.id ? { ...item, is_new: event.target.checked } : item,
                            ),
                          )
                        }
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      New
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tags</label>
                  <input
                    type="text"
                    value={template.tags.join(", ")}
                    onChange={(event) =>
                      setTemplates((current) =>
                        current.map((item) =>
                          item.id === template.id
                            ? {
                                ...item,
                                tags: event.target.value
                                  .split(",")
                                  .map((tag) => tag.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      )
                    }
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent"
                    placeholder="creator, commentary, challenge"
                  />
                </div>

                <div className="mt-auto flex gap-2 pt-2">
                  <button
                    onClick={() => void handleAiSuggest(template)}
                    disabled={!!processingId}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent/10 py-2.5 text-xs font-bold text-accent transition-all hover:bg-accent/20 disabled:opacity-50"
                  >
                    {processingId === template.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    AI Suggest
                  </button>
                  <button
                    onClick={() => void handleUpdate(template)}
                    disabled={!!processingId}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-xs font-bold text-background transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
