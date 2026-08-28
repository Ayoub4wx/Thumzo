import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Upload, User, Image as ImageIcon, Layers, Clock, Loader2, Trash2, Music } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils";
import { deleteUserAsset, getUserAssetPreviewUrl, uploadUserImage } from "../../services/storageService";

interface Asset {
  id: string;
  url: string;
  assetReference: string;
  fileName: string;
  type: string;
  createdAt: string | null;
}

type AssetTab = "all" | "images";

const ASSET_IMAGE_PREVIEW_OPTIONS = {
  width: 360,
  height: 360,
  resize: "contain",
  quality: 72,
} as const;

function normalizeAsset(row: any): Asset {
  const assetReference = typeof row.url === "string" ? row.url : "";

  return {
    id: row.id,
    url: assetReference,
    assetReference,
    fileName: row.file_name || row.fileName || "Untitled asset",
    type: row.type || "",
    createdAt: row.created_at || row.createdAt || null,
  };
}

function getAssetKind(asset: Pick<Asset, "fileName" | "type">) {
  if (asset.type.startsWith("image/") || asset.fileName.match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i)) {
    return "image";
  }

  return "other";
}

export default function AssetsDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<AssetTab>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    ids: string[];
    title: string;
    description: string;
    confirmLabel: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) {
      setAssets([]);
      setLoading(false);
      return;
    }

    const fetchAssets = async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const normalizedAssets = await Promise.all(
          data.map(async (row) => {
            const asset = normalizeAsset(row);
            const previewUrl = await getUserAssetPreviewUrl(
              asset.url,
              user.uid,
              asset.type.startsWith("image/") ? ASSET_IMAGE_PREVIEW_OPTIONS : undefined
            );

            return {
              ...asset,
              url: previewUrl,
            };
          })
        );

        setAssets(normalizedAssets);
      }

      setLoading(false);
    };

    fetchAssets();

    const subscription = supabase
      .channel("assets_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assets",
          filter: `user_id=eq.${user.uid}`,
        },
        () => {
          fetchAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, sortOrder]);

  const filteredAssets = useMemo(() => {
    const nextAssets = assets.filter((asset) => {
      if (activeTab === "all") return true;
      if (activeTab === "images") return getAssetKind(asset) === "image";
      return true;
    });

    nextAssets.sort((a, b) => {
      const aTime = new Date(a.createdAt ?? 0).getTime();
      const bTime = new Date(b.createdAt ?? 0).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

    return nextAssets;
  }, [activeTab, assets, sortOrder]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileName = `${user.uid}-asset-${Date.now()}-${file.name}`;
      const filePath = await uploadUserImage(file, fileName, user.uid);

      const { error: dbError } = await supabase.from("assets").insert({
        user_id: user.uid,
        url: filePath,
        file_name: file.name,
        type: file.type,
      });

      if (dbError) throw dbError;
    } catch (error) {
      console.error("Upload failed", error);
      showToast({
        tone: "error",
        title: "Upload failed",
        message: "Failed to upload the selected asset.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAssets = async (ids: string[]) => {
    if (!user || ids.length === 0) {
      return false;
    }

    try {
      setIsDeleting(true);

      await Promise.all(
        ids.map(async (id) => {
          const asset = assets.find((item) => item.id === id);

          if (asset) {
            await deleteUserAsset(asset.assetReference, user.uid).catch((error) => {
              console.error("Failed to delete asset file from storage", error);
            });
          }

          const { error } = await supabase.from("assets").delete().eq("id", id);
          if (error) throw error;
        })
      );

      setAssets((current) => current.filter((item) => !ids.includes(item.id)));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setIsSelectionMode(false);
      setDeleteDialog(null);
      showToast({
        tone: "success",
        title: ids.length === 1 ? "Asset removed" : "Assets removed",
        message:
          ids.length === 1
            ? "The asset was removed from your library."
            : `${ids.length} assets were removed from your library.`,
      });
      return true;
    } catch (error) {
      console.error("Failed to delete asset", error);
      showToast({
        tone: "error",
        title: "Delete failed",
        message:
          ids.length === 1
            ? "Failed to delete this asset."
            : "Failed to delete the selected assets.",
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    if (ids.length === 1) {
      const asset = assets.find((item) => item.id === ids[0]);
      setDeleteDialog({
        ids,
        title: "Delete this asset?",
        description: asset?.fileName
          ? `"${asset.fileName}" will be removed from your library.`
          : "This asset will be removed from your library.",
        confirmLabel: "Delete asset",
      });
      return;
    }

    setDeleteDialog({
      ids,
      title: `Delete ${ids.length} assets?`,
      description: "These selected assets will be removed from your library.",
      confirmLabel: "Delete selected",
    });
  };

  const toggleSelectedId = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const handleDeleteSelected = () => {
    openDeleteDialog(selectedIds);
  };

  const handleAssetPreviewError = async (assetId: string, failedUrl: string) => {
    if (!user) {
      return;
    }

    const asset = assets.find((item) => item.id === assetId);

    if (!asset?.assetReference) {
      return;
    }

    const refreshedUrl = await getUserAssetPreviewUrl(asset.assetReference, user.uid, ASSET_IMAGE_PREVIEW_OPTIONS);

    if (!refreshedUrl || refreshedUrl === failedUrl) {
      return;
    }

    setAssets((current) =>
      current.map((item) => (item.id === assetId ? { ...item, url: refreshedUrl } : item))
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] overflow-x-hidden p-3 pb-5 sm:p-8" dir="ltr">
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:mb-8 sm:flex-row sm:items-center sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Asset Library</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{assets.length} assets - Reusable across all studios</p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full sm:w-auto px-4 py-2.5 bg-muted/50 hover:bg-muted border border-border text-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isUploading ? "Uploading..." : "Upload Asset"}
        </button>
      </div>

      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:mb-8 lg:flex-row lg:items-center">
        <div className="no-scrollbar flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1 lg:w-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors",
              activeTab === "all" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ImageIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> All
            <span className={cn("px-1.5 rounded text-[10px] sm:text-xs", activeTab === "all" ? "bg-background/20" : "bg-muted")}>
              {assets.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("images")}
            className={cn(
              "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors",
              activeTab === "images" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ImageIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Images
          </button>
          <Link
            to="/templates"
            className="px-3 sm:px-4 py-1.5 text-muted-foreground hover:text-foreground text-xs sm:text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Thumbnail Sets
          </Link>
        </div>

        <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto sm:w-auto">
          <div className="flex items-center bg-muted/30 border border-border rounded-lg p-1">
            <button
              onClick={() => setSortOrder("newest")}
              className={cn(
                "px-3 py-1 rounded text-xs sm:text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap",
                sortOrder === "newest" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Newest
            </button>
            <button
              onClick={() => setSortOrder("oldest")}
              className={cn(
                "px-3 py-1 rounded text-xs sm:text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap",
                sortOrder === "oldest" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Oldest
            </button>
          </div>
          <button
            onClick={() => {
              if (isSelectionMode) {
                setSelectedIds([]);
                setIsSelectionMode(false);
              } else {
                setIsSelectionMode(true);
              }
            }}
            className="px-4 py-1.5 bg-muted/30 border border-border rounded-lg text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
          >
            {isSelectionMode ? "Cancel Select" : "Select"}
          </button>
          {isSelectionMode ? (
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              className="px-4 py-1.5 bg-background border border-border rounded-lg text-xs sm:text-sm font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Delete Selected
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border border-dashed border-border bg-muted/10 hover:bg-muted/30 flex flex-col items-center justify-center gap-2 transition-colors group"
        >
          <User className="w-6 h-6 text-muted-foreground group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-foreground">New Look</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border border-dashed border-border bg-muted/10 hover:bg-muted/30 flex flex-col items-center justify-center gap-2 transition-colors group"
        >
          <ImageIcon className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-sm font-medium text-foreground">Drop or click</span>
          <span className="text-[10px] text-muted-foreground">Images only • Max 30MB</span>
        </button>

        {loading ? (
          <div className="col-span-full py-10 text-center text-muted-foreground">Loading assets...</div>
        ) : filteredAssets.length > 0 ? (
          filteredAssets.map((asset) => {
            const isVideo = asset.type?.startsWith("video/") || asset.fileName.match(/\.(mp4|webm|ogg|mov)$/i);
            const isAudio = asset.type?.startsWith("audio/") || asset.fileName.match(/\.(mp3|wav|m4a)$/i);

            return (
              <div key={asset.id} className="aspect-square rounded-xl border border-border overflow-hidden relative group cursor-pointer bg-muted/10 flex items-center justify-center">
                {isSelectionMode ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSelectedId(asset.id);
                    }}
                    className={cn(
                      "absolute top-2 left-2 z-20 h-5 w-5 rounded border transition-colors",
                      selectedIds.includes(asset.id) ? "border-foreground bg-foreground" : "border-border bg-background/80"
                    )}
                    aria-label="Select asset"
                  />
                ) : null}
                {isVideo ? (
                  <video
                    src={asset.url}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                ) : isAudio ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground group-hover:scale-105 transition-transform duration-500 p-2 text-center">
                    <Music className="w-8 h-8" />
                    <span className="text-[10px] font-medium truncate w-full">{asset.fileName}</span>
                  </div>
                ) : (
                  <img
                    src={asset.url}
                    alt={asset.fileName}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    decoding="async"
                    sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                    onError={(event) => {
                      void handleAssetPreviewError(asset.id, event.currentTarget.currentSrc);
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openDeleteDialog([asset.id]);
                    }}
                    className="p-2 bg-background border border-border text-foreground rounded-full hover:scale-110 transition-transform"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center bg-muted/10 rounded-2xl border border-dashed border-border">
            <p className="text-muted-foreground">No assets found for this filter.</p>
            <button
              onClick={() => navigate("/templates")}
              className="mt-4 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
            >
              Browse Thumbnail Sets
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteDialog)}
        title={deleteDialog?.title || "Delete assets?"}
        description={deleteDialog?.description || ""}
        confirmLabel={deleteDialog?.confirmLabel || "Delete"}
        tone="danger"
        isLoading={isDeleting}
        onClose={() => {
          if (!isDeleting) {
            setDeleteDialog(null);
          }
        }}
        onConfirm={() => {
          if (deleteDialog) {
            void removeAssets(deleteDialog.ids);
          }
        }}
      />
    </div>
  );
}
