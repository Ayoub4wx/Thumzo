import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, User, Image as ImageIcon, Layers, Layout, Clock, Loader2, Trash2, Music, Film } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { uploadUserImage } from '../../services/storageService';

interface Asset {
  id: string;
  url: string;
  fileName: string;
  type: string;
  createdAt: any;
}

export default function AssetsDashboard() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setAssets(data);
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

  const filteredAssets = assets.filter(asset => {
    if (activeTab === 'all') return true;
    if (activeTab === 'people') return asset.type.includes('image') && asset.fileName.toLowerCase().includes('person');
    if (activeTab === 'media') return asset.type.includes('image') || asset.type.includes('video') || asset.type.includes('audio');
    return true;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // Upload to Supabase Storage
      const fileName = `${user.uid}-asset-${Date.now()}-${file.name}`;
      const publicUrl = await uploadUserImage(file, fileName, user.uid);

      // Save to Supabase
      const { error: dbError } = await supabase
        .from("assets")
        .insert({
          user_id: user.uid,
          url: publicUrl,
          file_name: file.name,
          type: file.type
        });

      if (dbError) throw dbError;

    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload asset.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;
    try {
      const { error } = await supabase
        .from("assets")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    } catch (error) {
      console.error("Failed to delete asset", error);
      alert("Failed to delete asset.");
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto" dir="ltr">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Asset Library</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{assets.length} assets • Reusable across all studios</p>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*,video/*,audio/*" 
          className="hidden" 
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full sm:w-auto px-4 py-2.5 bg-muted/50 hover:bg-muted border border-border text-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isUploading ? 'Uploading...' : 'Upload Asset'}
        </button>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border overflow-x-auto max-w-full no-scrollbar">
          <button 
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors",
              activeTab === 'all' ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ImageIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> All <span className={cn("px-1.5 rounded text-[10px] sm:text-xs", activeTab === 'all' ? "bg-blue-500/20" : "bg-muted")}>{assets.length}</span>
          </button>
          <button 
            onClick={() => setActiveTab('people')}
            className={cn(
              "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors",
              activeTab === 'people' ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> People
          </button>
          <button 
            onClick={() => setActiveTab('media')}
            className={cn(
              "px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors",
              activeTab === 'media' ? "bg-blue-500/10 text-blue-500" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Film className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Media
          </button>
          <button className="px-3 sm:px-4 py-1.5 text-muted-foreground hover:text-foreground text-xs sm:text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer">
            <Layers className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Thumbnail Sets
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <div className="flex items-center bg-muted/30 border border-border rounded-lg p-1">
            <button className="px-3 py-1 bg-muted rounded text-foreground text-xs sm:text-sm flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Newest
            </button>
            <button className="px-3 py-1 text-muted-foreground hover:text-foreground text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap">
              Oldest
            </button>
          </div>
          <button className="px-4 py-1.5 bg-muted/30 border border-border rounded-lg text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap">
            Select
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {/* New Look */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border border-dashed border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10 flex flex-col items-center justify-center gap-2 transition-colors group"
        >
          <User className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-purple-400">New Look</span>
        </button>

        {/* Drop or click */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square rounded-xl border border-dashed border-border bg-muted/10 hover:bg-muted/30 flex flex-col items-center justify-center gap-2 transition-colors group"
        >
          <ImageIcon className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-sm font-medium text-foreground">Drop or click</span>
          <span className="text-[10px] text-muted-foreground">Images, Video, Audio • Max 30MB</span>
        </button>

        {loading ? (
          <div className="col-span-full py-10 text-center text-muted-foreground">Loading assets...</div>
        ) : filteredAssets.length > 0 ? (
          filteredAssets.map((asset) => {
            const isVideo = asset.type?.startsWith('video/') || asset.fileName.match(/\.(mp4|webm|ogg|mov)$/i);
            const isAudio = asset.type?.startsWith('audio/') || asset.fileName.match(/\.(mp3|wav|m4a)$/i);

            return (
            <div key={asset.id} className="aspect-square rounded-xl border border-border overflow-hidden relative group cursor-pointer bg-muted/10 flex items-center justify-center">
              {isVideo ? (
                <video src={asset.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" autoPlay muted loop playsInline />
              ) : isAudio ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground group-hover:scale-105 transition-transform duration-500 p-2 text-center">
                  <Music className="w-8 h-8" />
                  <span className="text-[10px] font-medium truncate w-full">{asset.fileName}</span>
                </div>
              ) : (
                <img src={asset.url} alt={asset.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button 
                  onClick={() => handleDelete(asset.id)}
                  className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )})
        ) : (
          <div className="col-span-full py-20 text-center bg-muted/10 rounded-2xl border border-dashed border-border">
            <p className="text-muted-foreground">No assets found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
