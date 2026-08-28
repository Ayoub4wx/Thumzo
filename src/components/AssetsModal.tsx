import { useEffect, useState, type ChangeEvent, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X, Upload, Plus, Search, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { uploadUserImage, getUserAssetPreviewUrl } from "../services/storageService";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

type AssetsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAction: (url: string) => void;
};

type Asset = {
  id: string;
  url: string;
  file_name: string;
  previewUrl: string;
};

type ThemeOptions = {
  dark: string;
  light: string;
};

type SVGLAsset = {
  id: number;
  title: string;
  category: string | string[];
  route: string | ThemeOptions;
  url: string;
  wordmark?: string | ThemeOptions;
  brandUrl?: string;
};

export default function AssetsModal({ isOpen, onClose, onAction }: AssetsModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'assets' | 'upload' | 'svgl'>('assets');
  const [assets, setAssets] = useState<Asset[]>([]);
  
  // SVGL State
  const [svglAssets, setSvglAssets] = useState<SVGLAsset[]>([]);
  const [svglSearch, setSvglSearch] = useState("");
  const [loadingSvgl, setLoadingSvgl] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      if (activeTab === 'assets') {
        fetchAssets();
      } else if (activeTab === 'svgl' && svglAssets.length === 0) {
        fetchSvglAssets();
      }
    }
  }, [isOpen, user, activeTab]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (activeTab === 'svgl') {
        fetchSvglAssets(svglSearch);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [svglSearch, activeTab]);

  async function fetchSvglAssets(query: string = "") {
    setLoadingSvgl(true);
    try {
      const url = query.trim() 
        ? `https://api.svgl.app?search=${encodeURIComponent(query)}`
        : `https://api.svgl.app?limit=100`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch SVGL");
      const data = await res.json();
      setSvglAssets(data);
    } catch (error) {
      console.error("Error fetching SVGL assets:", error);
    } finally {
      setLoadingSvgl(false);
    }
  }

  async function fetchAssets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("assets")
      .select("id, url, file_name")
      .eq("user_id", user?.uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching assets:", error);
    } else {
      const assetsWithPreviews = await Promise.all(
        (data || []).map(async (asset) => ({
          ...asset,
          previewUrl: await getUserAssetPreviewUrl(asset.url, user?.uid),
        }))
      );
      setAssets(assetsWithPreviews);
    }
    setLoading(false);
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const assetPath = await uploadUserImage(file, fileName, user.uid);
      
      const { data: assetData, error } = await supabase.from("assets").insert({
        user_id: user.uid,
        url: assetPath,
        file_name: file.name,
        type: file.type,
      }).select("id, url, file_name").single();

      if (error) throw error;
      
      const assetWithPreview: Asset = {
        ...assetData,
        previewUrl: await getUserAssetPreviewUrl(assetData.url, user.uid),
      };
      
      setAssets([assetWithPreview, ...assets]);
      setActiveTab('assets');
    } catch (error) {
      console.error("Error uploading file:", error);
      showToast({
        tone: "error",
        title: "Upload failed",
        message: "Failed to upload the selected file.",
      });
    } finally {
      setUploading(false);
    }
  };

  const getSvglUrl = (asset: SVGLAsset) => {
    if (typeof asset.route === "string") {
      return asset.route;
    }
    return asset.route.light || asset.route.dark;
  };

  if (typeof document === "undefined" || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative z-[1] w-full max-w-2xl flex flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-bold">Assets</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex border-b border-border">
            <button
              className={cn("px-6 py-3 text-sm font-medium", activeTab === 'assets' ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground")}
              onClick={() => setActiveTab('assets')}
            >
              My Assets
            </button>
            <button
              className={cn("px-6 py-3 text-sm font-medium", activeTab === 'svgl' ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground")}
              onClick={() => setActiveTab('svgl')}
            >
              Icons & Logos
            </button>
            <button
              className={cn("px-6 py-3 text-sm font-medium", activeTab === 'upload' ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground")}
              onClick={() => setActiveTab('upload')}
            >
              Upload New
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[60vh] min-h-[300px]">
            {activeTab === 'assets' ? (
              loading ? (
                <div className="flex justify-center items-center h-full min-h-[200px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : assets.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {assets.map(asset => (
                    <button key={asset.id} onClick={() => onAction(asset.url)} className="aspect-square rounded-xl overflow-hidden border border-border">
                      <img src={asset.previewUrl} alt={asset.file_name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
                  <p>No assets found.</p>
                </div>
              )
            ) : activeTab === 'svgl' ? (
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search for logos or icons..."
                    value={svglSearch}
                    onChange={(e) => setSvglSearch(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm outline-none focus:border-accent"
                  />
                </div>
                
                {loadingSvgl ? (
                  <div className="flex justify-center items-center min-h-[200px]">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : svglAssets.length > 0 ? (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                    {svglAssets.map(asset => {
                      const svgUrl = getSvglUrl(asset);
                      return (
                        <button 
                          key={asset.id} 
                          onClick={() => onAction(svgUrl)}
                          title={asset.title}
                          className="aspect-square flex items-center justify-center rounded-xl overflow-hidden border border-border bg-muted/30 hover:bg-muted p-3 transition-colors"
                        >
                          <img src={svgUrl} alt={asset.title} className="w-full h-full object-contain" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex justify-center items-center min-h-[200px] text-muted-foreground">
                    <p>No matching icons found.</p>
                  </div>
                )}
                
                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Powered by <a href="https://svgl.app/" target="_blank" rel="noreferrer" className="text-foreground hover:underline">SVGL</a>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 p-10 border-2 border-dashed border-border rounded-xl">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <label className="cursor-pointer bg-foreground text-background px-4 py-2 rounded-lg font-medium">
                  {uploading ? "Uploading..." : "Select File"}
                  <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                </label>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
