import { useState, useEffect, useRef } from 'react';
import { Upload, User, Image as ImageIcon, Layers, Layout, Clock, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from '../../lib/firebase';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setAssets([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "assets"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Asset[];
      setAssets(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching assets:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise((resolve) => (reader.onload = resolve));
      const base64 = reader.result as string;

      // Upload to S3 via API
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          fileName: `${user.uid}-asset-${Date.now()}-${file.name}`,
        }),
      });

      if (!response.ok) throw new Error("Failed to upload to S3");
      const data = await response.json();

      // Save to Firestore
      await addDoc(collection(db, "assets"), {
        userId: user.uid,
        url: data.url,
        fileName: file.name,
        type: file.type,
        createdAt: serverTimestamp(),
      });

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
      await deleteDoc(doc(db, "assets", id));
    } catch (error) {
      console.error("Failed to delete asset", error);
      alert("Failed to delete asset.");
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto" dir="ltr">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Asset Library</h1>
          <p className="text-sm text-muted-foreground">{assets.length} assets • Reusable across all studios</p>
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
          className="px-4 py-2 bg-muted/50 hover:bg-muted border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border overflow-x-auto max-w-full">
          <Link to="/assets" className="px-4 py-1.5 bg-blue-500/10 text-blue-500 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap cursor-pointer">
            <User className="w-4 h-4" /> People <span className="bg-blue-500/20 px-1.5 rounded text-xs">{assets.length}</span>
          </Link>
          <Link to="/studio" className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer">
            <ImageIcon className="w-4 h-4" /> Images
          </Link>
          <Link to="/templates" className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer">
            <Layers className="w-4 h-4" /> Thumbnail Sets
          </Link>
          <button className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer">
            <Layout className="w-4 h-4" /> Social Formats
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/30 border border-border rounded-lg p-1">
            <button className="px-3 py-1 bg-muted rounded text-foreground text-sm flex items-center gap-2 cursor-pointer">
              <Clock className="w-4 h-4" /> Newest
            </button>
            <button className="px-3 py-1 text-muted-foreground hover:text-foreground text-sm flex items-center gap-2 transition-colors cursor-pointer">
              Oldest
            </button>
          </div>
          <button className="px-4 py-1.5 bg-muted/30 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
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
          <User className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-sm font-medium text-foreground">Drop or click</span>
          <span className="text-[10px] text-muted-foreground">PNG, JPG, WEBP • Max 30MB</span>
        </button>

        {loading ? (
          <div className="col-span-full py-10 text-center text-muted-foreground">Loading assets...</div>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} className="aspect-square rounded-xl border border-border overflow-hidden relative group cursor-pointer">
              <img src={asset.url} alt={asset.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button 
                  onClick={() => handleDelete(asset.id)}
                  className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
