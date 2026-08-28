import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, RefreshCw, Upload } from "lucide-react";

interface StorageItem {
  key: string;
  size: number;
  lastModified: string | null;
  url: string | null;
}

function isLocalHost() {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

async function readFileAsBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminStoragePage() {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [bucket, setBucket] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const localOnly = useMemo(() => isLocalHost(), []);
  const visibleItems = useMemo(
    () => items.filter((item) => !item.key.toLowerCase().startsWith("avatars/")),
    [items]
  );

  async function loadItems() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/storage/objects");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load storage objects.");
      }

      setBucket(payload.bucket || "");
      setItems(payload.items || []);
      setRenameDrafts(
        Object.fromEntries((payload.items || []).map((item: StorageItem) => [item.key, item.key])),
      );
    } catch (fetchError: any) {
      setError(fetchError.message || "Failed to load storage objects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!localOnly) {
      setLoading(false);
      return;
    }

    void loadItems();
  }, [localOnly]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!uploadFile) {
      setError("Choose an image file first.");
      return;
    }

    try {
      setBusyKey("upload");
      setError(null);
      setStatus(null);
      const fileName = uploadName.trim() || uploadFile.name;
      const dataBase64 = await readFileAsBase64(uploadFile);

      const response = await fetch("/api/admin/storage/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          contentType: uploadFile.type,
          dataBase64,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to upload thumbnail.");
      }

      setStatus(`Uploaded ${payload.key}`);
      setUploadFile(null);
      setUploadName("");
      await loadItems();
    } catch (uploadError: any) {
      setError(uploadError.message || "Failed to upload thumbnail.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRename(fromKey: string) {
    const toKey = (renameDrafts[fromKey] || "").trim();

    if (!toKey) {
      setError("Enter a new file name before renaming.");
      return;
    }

    try {
      setBusyKey(fromKey);
      setError(null);
      setStatus(null);

      const response = await fetch("/api/admin/storage/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromKey, toKey }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to rename thumbnail.");
      }

      setStatus(`Renamed ${fromKey} to ${payload.key}`);
      await loadItems();
    } catch (renameError: any) {
      setError(renameError.message || "Failed to rename thumbnail.");
    } finally {
      setBusyKey(null);
    }
  }

  if (!localOnly) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h1 className="text-2xl font-bold text-foreground">Localhost Only</h1>
          <p className="mt-3 text-muted-foreground">
            This admin storage panel is only available from <code>localhost</code>.
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
          <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">Supabase Thumbnail Manager</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Upload thumbnails and rename existing bucket files. This panel is blocked outside localhost.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/admin/templates"
              className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"
            >
              Template titles
            </Link>
            <Link
              to="/admin/storage"
              className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
            >
              Storage files
            </Link>
          </div>
          {bucket ? <p className="mt-2 text-xs text-muted-foreground">Bucket: {bucket}</p> : null}
        </div>

        <button
          onClick={() => void loadItems()}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <form onSubmit={handleUpload} className="mb-8 rounded-3xl border border-border bg-card p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            Thumbnail file
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setUploadFile(file);
                setUploadName(file?.name || "");
              }}
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            File name in bucket
            <input
              type="text"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              placeholder="example-thumbnail.png"
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground"
            />
          </label>

          <button
            type="submit"
            disabled={!uploadFile || busyKey === "upload"}
            className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {busyKey === "upload" ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>

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
        <div className="rounded-3xl border border-border bg-card px-6 py-16 text-center text-muted-foreground">
          Loading bucket objects...
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <div key={item.key} className="rounded-3xl border border-border bg-card p-4">
              <div className="mb-4 aspect-video overflow-hidden rounded-2xl border border-border bg-muted/20">
                {item.url ? (
                  <img src={item.url} alt={item.key} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Preview unavailable</div>
                )}
              </div>

              <div className="mb-3">
                <p className="truncate text-sm font-semibold text-foreground">{item.key}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatBytes(item.size)}
                  {item.lastModified ? ` - ${new Date(item.lastModified).toLocaleString()}` : ""}
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={renameDrafts[item.key] || item.key}
                  onChange={(event) =>
                    setRenameDrafts((current) => ({
                      ...current,
                      [item.key]: event.target.value,
                    }))
                  }
                  className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => void handleRename(item.key)}
                  disabled={busyKey === item.key}
                  className="rounded-2xl border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyKey === item.key ? "Saving..." : "Rename"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
