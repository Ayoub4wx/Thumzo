import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Folder,
  LayoutGrid,
  List,
  Play,
  Mail,
  Monitor,
  Layers,
  Image as ImageIcon,
  Archive,
  Download,
  Maximize2,
  MoreHorizontal,
  X,
  Trash2,
  Edit2
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  db,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc
} from "../../lib/firebase";

interface Generation {
  id: string;
  prompt: string;
  urls: string[];
  createdAt: any;
}

export default function StudioDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "generations", id));
      setActiveMenuId(null);
    } catch (error) {
      console.error("Error deleting generation:", error);
      alert("Failed to delete generation.");
    }
  };

  const handleDownload = (url: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = url;
    link.download = `thumbnail-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setActiveMenuId(null);
  };

  const handleOpenInEditor = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/studio/editor?templateUrl=${encodeURIComponent(url)}`);
    setActiveMenuId(null);
  };

  useEffect(() => {
    if (!user) {
      setGenerations([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "generations"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Generation[];
        setGenerations(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching generations:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto" dir="ltr">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border overflow-x-auto max-w-full">
          <Link to="/studio" className="px-4 py-1.5 bg-muted text-foreground text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap cursor-pointer">
            <Monitor className="w-4 h-4" /> Home
          </Link>
          <Link to="/templates" className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer">
            <Layers className="w-4 h-4" /> Thumbnail Sets
          </Link>
          <Link to="/studio/editor" className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer">
            <ImageIcon className="w-4 h-4" /> Composites
          </Link>
          <button className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer">
            <Archive className="w-4 h-4" /> Archive{" "}
            <span className="bg-muted px-1.5 rounded text-xs">0</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 bg-muted/30 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <Folder className="w-4 h-4" />
          </button>
          <Link
            to="/templates"
            className="px-4 py-2 bg-muted/30 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4" /> Templates
          </Link>
          <button className="px-4 py-2 bg-muted/30 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            Select
          </button>
          <div className="flex items-center bg-muted/30 border border-border rounded-lg p-1">
            <button className="p-1 bg-muted rounded text-foreground cursor-pointer">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <List className="w-4 h-4" />
            </button>
          </div>
          <Link
            to="/studio/editor"
            className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create
          </Link>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* New Thumbnail Card */}
        <Link to="/studio/editor" className="group block">
          <div className="aspect-video bg-muted/20 border border-border rounded-xl mb-3 flex items-center justify-center group-hover:border-accent transition-colors">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-white transition-colors" />
            </div>
          </div>
          <h3 className="font-medium text-foreground text-sm">New Thumbnail</h3>
          <p className="text-xs text-muted-foreground">Start with any image</p>
        </Link>

        {/* Getting Started Video */}
        <div className="group cursor-pointer" onClick={() => setShowVideoModal(true)}>
          <div className="aspect-video bg-muted/20 border border-border rounded-xl mb-3 relative overflow-hidden group-hover:border-accent transition-colors">
            <img
              src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=800&auto=format&fit=crop"
              alt="Tutorial"
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            </div>
          </div>
          <h3 className="font-medium text-accent text-sm">Getting Started</h3>
          <p className="text-xs text-muted-foreground">Watch intro video</p>
        </div>

        {/* Stay in the loop */}
        <div className="group cursor-pointer" onClick={() => alert('Subscribed to newsletter!')}>
          <div className="aspect-video bg-muted/20 border border-border rounded-xl mb-3 flex flex-col items-center justify-center gap-3 group-hover:border-accent transition-colors relative">
            <div className="absolute top-4 right-4 w-8 h-4 bg-muted rounded-full flex items-center p-0.5">
              <div className="w-3 h-3 bg-foreground rounded-full ml-auto"></div>
            </div>
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-foreground">
              Never miss a thumbnail drop ;)
            </p>
          </div>
          <h3 className="font-medium text-foreground text-sm">
            Stay in the loop
          </h3>
          <p className="text-xs text-muted-foreground">
            Get new templates and major feature launches by email.
          </p>
        </div>

        {/* User Generations */}
        {!loading &&
          generations.map((gen) => (
            <div key={gen.id} className="group cursor-pointer">
              <div className="aspect-video rounded-xl overflow-hidden mb-3 relative border border-border group-hover:border-accent transition-colors">
                <img
                  src={gen.urls[0]}
                  alt="Thumbnail"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = document.createElement("a");
                      link.href = gen.urls[0];
                      link.download = `thumbnail-${gen.id}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(gen.urls[0], '_blank');
                    }}
                    className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === gen.id ? null : gen.id);
                    }}
                    className="p-1.5 bg-black/50 text-white rounded-md hover:bg-black/80 transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {activeMenuId === gen.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-8 right-0 w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button 
                          onClick={(e) => handleOpenInEditor(gen.urls[0], e)}
                          className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" /> Open in Editor
                        </button>
                        <button 
                          onClick={(e) => handleDownload(gen.urls[0], gen.id, e)}
                          className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                        <div className="w-full h-px bg-white/10"></div>
                        <button 
                          onClick={(e) => handleDelete(gen.id, e)}
                          className="w-full text-left px-3 py-2.5 text-sm text-red-500 hover:bg-white/10 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <h3 className="font-bold text-foreground text-sm mb-1 line-clamp-1">
                {gen.prompt}
              </h3>
              <p className="text-xs text-muted-foreground">
                {gen.createdAt?.toDate
                  ? gen.createdAt.toDate().toLocaleDateString()
                  : "Just now"}
              </p>
            </div>
          ))}
      </div>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold text-lg">Getting Started with Thumzo</h3>
              <button 
                onClick={() => setShowVideoModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
