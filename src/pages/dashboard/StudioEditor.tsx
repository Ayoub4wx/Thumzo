import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Image as ImageIcon, Layers, Puzzle, Play, 
  Wrench, Brush, Grid, ScanFace, Clapperboard, Stamp, Plus, Download,
  ChevronDown, ArrowUp, SlidersHorizontal, ImagePlus, Eye, Loader2, X, MoreHorizontal, Trash2, Edit2, Eraser, Minus
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { generateThumbnails } from "../../services/geminiService";
import { uploadUserBase64Image } from "../../services/storageService";
import { supabase } from "../../lib/supabase";

type EditorState = 'start' | 'editing';

const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => (
  <div className="relative group flex items-center justify-center">
    {children}
    <div className="absolute bottom-full mb-3 bg-[#2A2A2A] text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap border border-white/10 shadow-xl transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-50">
      {text}
    </div>
  </div>
);

export default function StudioEditor() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editorState, setEditorState] = useState<EditorState>('start');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [model, setModel] = useState("Google Flash 2.5");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [history, setHistory] = useState<{url: string, prompt: string}[]>([]);
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [isEditRegionMode, setIsEditRegionMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(50);
  const [brushMode, setBrushMode] = useState<'brush' | 'eraser'>('brush');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuIndex(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Initialize canvas when entering edit mode
  useEffect(() => {
    if (isEditRegionMode && canvasRef.current) {
      const canvas = canvasRef.current;
      // Match canvas size to its display size
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        const context = canvas.getContext("2d");
        if (context) {
          context.lineCap = "round";
          context.lineJoin = "round";
          context.strokeStyle = "rgba(59, 130, 246, 0.5)"; // Blue with 50% opacity
          context.lineWidth = brushSize;
          contextRef.current = context;
        }
      }
    }
  }, [isEditRegionMode]);

  // Update brush size
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushSize]);

  // Update brush mode (eraser vs brush)
  useEffect(() => {
    if (contextRef.current) {
      if (brushMode === 'eraser') {
        contextRef.current.globalCompositeOperation = 'destination-out';
        contextRef.current.strokeStyle = "rgba(0,0,0,1)"; // Color doesn't matter for destination-out
      } else {
        contextRef.current.globalCompositeOperation = 'source-over';
        contextRef.current.strokeStyle = "rgba(59, 130, 246, 0.5)";
      }
    }
  }, [brushMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!contextRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;
    
    // Prevent scrolling while drawing on touch devices
    if ('touches' in e) {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    if (!contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!contextRef.current || !canvasRef.current) return;
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleDeleteHistoryItem = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter((_, i) => i !== index));
    setActiveMenuIndex(null);
    if (currentImage === history[index].url && history.length > 1) {
      setCurrentImage(history[index === 0 ? 1 : 0].url);
    } else if (history.length === 1) {
      setCurrentImage(null);
      setEditorState('start');
    }
  };

  const handleDownloadHistoryItem = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = url;
    link.download = `thumbnail-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setActiveMenuIndex(null);
  };

  const handleOpenInEditor = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImage(url);
    setActiveMenuIndex(null);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertMeRef = useRef<HTMLInputElement>(null);

  const getBase64 = async (urlOrBase64: string): Promise<string> => {
    if (urlOrBase64.startsWith('data:image')) return urlOrBase64;
    try {
      const res = await fetch(urlOrBase64);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to convert image to base64", e);
      throw new Error("Failed to load the current image. It might be blocked by CORS.");
    }
  };

  useEffect(() => {
    const templateUrl = searchParams.get("templateUrl");
    if (templateUrl) {
      setCurrentImage(templateUrl);
      setHistory([{ url: templateUrl, prompt: "Template" }]);
      setEditorState('editing');
      // Clear param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("templateUrl");
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCurrentImage(result);
        setHistory([{ url: result, prompt: "Uploaded Image" }]);
        setEditorState('editing');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartBlank = () => {
    const blankUrl = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1200&auto=format&fit=crop";
    setCurrentImage(blankUrl);
    setHistory([{ url: blankUrl, prompt: "Blank Canvas" }]);
    setEditorState('editing');
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    // Check for API key selection for high-quality image models
    // @ts-ignore - window.aistudio is injected by the environment
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        // Assume successful and proceed (race condition mitigation)
      }
    }

    setIsGenerating(true);
    try {
      const baseImageBase64 = currentImage ? await getBase64(currentImage) : undefined;
      
      // Get mask from canvas if in Edit Region mode
      let maskImageBase64 = undefined;
      if (isEditRegionMode && canvasRef.current) {
        maskImageBase64 = canvasRef.current.toDataURL("image/png");
      }
      
      const generationPrompt = isEditRegionMode && maskImageBase64 
        ? `Edit the image based on this prompt: "${prompt}". Focus the edits ONLY on the areas highlighted by the blue mask in the reference image.`
        : prompt;

      const base64Images = await generateThumbnails({
        prompt: generationPrompt,
        baseImage: baseImageBase64,
        referenceImage: maskImageBase64, // Pass mask as reference image
        imageSize: "1K",
        aspectRatio: "16:9",
        model: model,
      });
      
      // Upload to Supabase Storage
      let finalUrl = base64Images[0];
      try {
        const fileName = `${user?.uid || 'anon'}-${Date.now()}.png`;
        finalUrl = await uploadUserBase64Image(base64Images[0], fileName, user?.uid || 'anon');
      } catch (uploadError) {
        console.error("Failed to upload to storage", uploadError);
      }
      
      setCurrentImage(finalUrl);
      setHistory(prev => [{ url: finalUrl, prompt }, ...prev]);
      setPrompt("");
      
      // Clear canvas and exit edit mode after successful generation
      if (isEditRegionMode) {
        clearCanvas();
        setIsEditRegionMode(false);
      }
      
      if (user) {
        const { error: dbError } = await supabase
          .from("generations")
          .insert({
            user_id: user.uid,
            prompt: prompt,
            urls: [finalUrl]
          });
        
        if (dbError) console.error("Failed to save generation to DB", dbError);
      }
      
    } catch (error: any) {
      console.error("Generation failed", error);
      if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED") || error.message?.includes("permission")) {
        // @ts-ignore
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
          // @ts-ignore
          await window.aistudio.openSelectKey();
          alert("Please select a valid API key with access to this model and try again.");
          return;
        }
      }
      alert(error instanceof Error ? error.message : "An error occurred during generation");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!currentImage) return;
    const link = document.createElement("a");
    link.href = currentImage;
    link.download = `thumbnail-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePolish = async () => {
    if (!currentImage || isGenerating || isPolishing) return;

    // Check for API key selection
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
    }

    setIsPolishing(true);
    setIsGenerating(true);
    try {
      const baseImageBase64 = await getBase64(currentImage);
      
      const base64Images = await generateThumbnails({
        prompt: "Polish this image. Enhance the lighting, colors, and overall quality to make it look like a highly professional, click-worthy YouTube thumbnail. Do not change the core subject matter, just improve the visual fidelity.",
        baseImage: baseImageBase64,
        imageSize: "1K",
        aspectRatio: "16:9",
        model: model,
      });
      
      // Upload to Supabase Storage
      let finalUrl = base64Images[0];
      try {
        const fileName = `${user?.uid || 'anon'}-${Date.now()}.png`;
        finalUrl = await uploadUserBase64Image(base64Images[0], fileName, user?.uid || 'anon');
      } catch (uploadError) {
        console.error("Failed to upload to storage", uploadError);
      }
      
      setCurrentImage(finalUrl);
      setHistory(prev => [{ url: finalUrl, prompt: "Polished Image" }, ...prev]);
      
      if (user) {
        const { error: dbError } = await supabase
          .from("generations")
          .insert({
            user_id: user.uid,
            prompt: "Polished Image",
            urls: [finalUrl]
          });
        
        if (dbError) console.error("Failed to save generation to DB", dbError);
      }
      
    } catch (error: any) {
      console.error("Polish failed", error);
      if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED") || error.message?.includes("permission")) {
        // @ts-ignore
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
          // @ts-ignore
          await window.aistudio.openSelectKey();
          alert("Please select a valid API key with access to this model and try again.");
          return;
        }
      }
      alert(error instanceof Error ? error.message : "An error occurred during polishing");
    } finally {
      setIsGenerating(false);
      setIsPolishing(false);
    }
  };

  const handleInsertMe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentImage) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const faceImage = reader.result as string;
      setUploadPreview(faceImage);
      setIsUploading(true);
      
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
        }
      }

      setIsGenerating(true);
      try {
        const baseImageBase64 = await getBase64(currentImage);
        const base64Images = await generateThumbnails({
          prompt: "Insert the person from the second image into this scene. If only a face is provided, generate a matching body with hands that fits the scene perfectly. If a full body is provided, integrate them naturally into the environment. Make it look like a seamless YouTube thumbnail.",
          baseImage: baseImageBase64,
          referenceImage: faceImage,
          imageSize: "1K",
          aspectRatio: "16:9",
          model: model,
        });
        
        // Upload to Supabase Storage
        let finalUrl = base64Images[0];
        try {
          const fileName = `${user?.uid || 'anon'}-${Date.now()}-insert.png`;
          finalUrl = await uploadUserBase64Image(base64Images[0], fileName, user?.uid || 'anon');
        } catch (uploadError) {
          console.error("Failed to upload to storage", uploadError);
        }
        
        setCurrentImage(finalUrl);
        setHistory(prev => [{ url: finalUrl, prompt: "Inserted Person" }, ...prev]);
        
        if (user) {
          const { error: dbError } = await supabase
            .from("generations")
            .insert({
              user_id: user.uid,
              prompt: "Inserted Person",
              urls: [finalUrl]
            });
          
          if (dbError) console.error("Failed to save generation to DB", dbError);
        }
      } catch (error: any) {
        console.error("Insert failed", error);
        if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED") || error.message?.includes("permission")) {
          // @ts-ignore
          if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            // @ts-ignore
            await window.aistudio.openSelectKey();
            alert("Please select a valid API key with access to this model and try again.");
            return;
          }
        }
        alert(error instanceof Error ? error.message : "An error occurred during insertion");
      } finally {
        setIsGenerating(false);
        setIsUploading(false);
        setUploadPreview(null);
        if (insertMeRef.current) insertMeRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  if (editorState === 'start') {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-background text-foreground" dir="ltr">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex flex-col items-center">
          <h1 className="text-xl sm:text-2xl font-bold mb-8 sm:mb-16">Create New Thumbnail</h1>
          
          <div className="text-center mb-8">
            <p className="text-muted-foreground mb-2">How do you want to start?</p>
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              New to Thumio? Watch the full walkthrough →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full mb-6">
            {/* From Image */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-start p-5 sm:p-6 rounded-2xl bg-card border border-border hover:border-accent/50 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                <ImageIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg sm:text-xl font-bold">From Image</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-500">1 Thumbnail</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Upload, paste YouTube URL, or pick from your asset library</p>
            </button>

            {/* Thumbnail Sets */}
            <button className="flex flex-col items-start p-5 sm:p-6 rounded-2xl bg-card border border-border hover:border-accent/50 transition-colors text-left group">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                <Layers className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg sm:text-xl font-bold">Thumbnail Sets</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-500">3+</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">BETA</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Describe your thumbnail and we'll generate options for you</p>
            </button>
          </div>

          {/* Composition */}
          <button className="flex flex-col items-start p-5 sm:p-6 rounded-2xl bg-card border border-border hover:border-accent/50 transition-colors text-left w-full mb-8 sm:mb-12 group">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
              <Puzzle className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg sm:text-xl font-bold">Composition</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500">Reusable Template</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Upload a reference thumbnail and swap out people, text, and elements</p>
          </button>

          {/* Quick Start */}
          <div className="w-full relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-background text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Start</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full mt-8">
            {[1, 2, 3, 4].map((i) => (
              <button key={i} onClick={handleStartBlank} className="aspect-video rounded-xl bg-muted overflow-hidden border border-border hover:border-accent transition-colors relative group">
                <img src={`https://picsum.photos/seed/${i * 10}/400/225`} alt="Template" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-8 h-8 text-white" />
                </div>
              </button>
            ))}
            <button onClick={handleStartBlank} className="aspect-video rounded-xl bg-card border border-dashed border-border hover:border-accent transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
              <div className="w-6 h-6 border-2 border-current rounded-sm"></div>
              <span className="text-xs font-medium">Blank Canvas</span>
            </button>
          </div>
          
          <div className="w-full flex justify-end mt-4">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              See All Templates <span className="text-lg leading-none">›</span>
            </button>
          </div>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-[#0a0a0a] text-white" dir="ltr">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Bar inside editor */}
        <div className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-white/5 lg:border-none">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold truncate max-w-[120px] sm:max-w-none">New Composition</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">just now</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 bg-[#1a1a1a] rounded-full p-1 border border-white/5">
            <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-[#2a2a2a] rounded-full text-[10px] sm:text-xs font-medium">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500"></div>
              Main <span className="text-muted-foreground">({history.length})</span>
            </button>
            <button className="hidden sm:flex items-center gap-2 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-white transition-colors">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Branch <span className="text-muted-foreground">(1)</span>
            </button>
            <button 
              onClick={() => currentImage && window.open(currentImage, '_blank')}
              className="p-1.5 text-muted-foreground hover:text-white transition-colors ml-1"
              title="Maximize"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
          <div className="flex lg:hidden">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-muted-foreground hover:text-white"
            >
              <Layers className="w-5 h-5" />
            </button>
          </div>
          <div className="hidden lg:block w-[150px]"></div> {/* Spacer to balance */}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden">
            {/* Main Image Container */}
          <div className="relative max-w-full max-h-full aspect-video rounded-lg shadow-2xl overflow-hidden bg-[#111]">
            <img src={currentImage || ""} alt="Canvas" className="w-full h-full object-contain rounded-lg" />
            
            {/* Grid Overlay */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none z-20 flex flex-col">
                {/* Horizontal lines */}
                <div className="absolute top-1/3 left-0 right-0 h-px bg-blue-400/50"></div>
                <div className="absolute top-2/3 left-0 right-0 h-px bg-blue-400/50"></div>
                {/* Vertical lines */}
                <div className="absolute top-0 bottom-0 left-1/3 w-px bg-blue-400/50"></div>
                <div className="absolute top-0 bottom-0 left-2/3 w-px bg-blue-400/50"></div>
              </div>
            )}

            {/* Drawing Canvas for Edit Region */}
            {isEditRegionMode && (
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="absolute inset-0 w-full h-full cursor-crosshair z-30 touch-none"
              />
            )}

            {/* Floating Insert Button */}
            <button 
              onClick={() => insertMeRef.current?.click()}
              className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-purple-500 hover:bg-purple-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 shadow-lg transition-colors z-40"
            >
              <ScanFace className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> <span className="hidden sm:inline">Insert Me</span><span className="sm:hidden">Insert</span>
            </button>

            {/* Generating Indicator Pill */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-[#1A1A1A]/90 backdrop-blur-md border border-white/10 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-sm font-medium flex items-center gap-2 sm:gap-3 shadow-xl z-50"
                >
                  <div className={cn(
                    "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center",
                    isPolishing ? "bg-amber-500/20" : "bg-orange-500/20"
                  )}>
                    {isPolishing ? (
                      <Stamp className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-500" />
                    ) : (
                      <Clapperboard className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-orange-500" />
                    )}
                  </div>
                  {isPolishing ? "Polishing..." : "Reshooting..."}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Floating Toolbar */}
        <div className="px-4 pb-4">
          {isEditRegionMode ? (
            <div className="mx-auto flex items-center gap-1 sm:gap-2 bg-[#1a1a1a] p-1.5 sm:p-2 rounded-2xl border border-white/10 shadow-2xl z-50 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2">
                <button 
                  onClick={() => setBrushMode('brush')}
                  className={cn(
                    "p-2 sm:p-2.5 rounded-xl transition-colors",
                    brushMode === 'brush' ? "bg-blue-500/20 text-blue-500" : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  <Brush className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
                <button 
                  onClick={() => setBrushMode('eraser')}
                  className={cn(
                    "p-2 sm:p-2.5 rounded-xl transition-colors",
                    brushMode === 'eraser' ? "bg-blue-500/20 text-blue-500" : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  <Eraser className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
                <div className="w-px h-5 sm:h-6 bg-white/10 mx-1 sm:mx-2"></div>
                <button 
                  onClick={() => setBrushSize(Math.max(10, brushSize - 10))}
                  className="p-1.5 sm:p-2 text-muted-foreground hover:text-white transition-colors"
                >
                  <Minus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                </button>
                <div className="flex items-center gap-1.5 sm:gap-2 px-1 sm:px-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full" style={{ transform: `scale(${brushSize / 50})` }}></div>
                  <span className="text-[10px] sm:text-xs font-medium text-white w-6 sm:w-8 text-center">{brushSize}px</span>
                </div>
                <button 
                  onClick={() => setBrushSize(Math.min(150, brushSize + 10))}
                  className="p-1.5 sm:p-2 text-muted-foreground hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                </button>
                <div className="w-px h-5 sm:h-6 bg-white/10 mx-1 sm:mx-2"></div>
                <button 
                  onClick={clearCanvas}
                  className="p-2 sm:p-2.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
                <button 
                  onClick={() => {
                    setIsEditRegionMode(false);
                    clearCanvas();
                  }}
                  className="p-2 sm:p-2.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex items-center gap-1 sm:gap-2 bg-[#1a1a1a] p-1.5 sm:p-2 rounded-2xl border border-white/10 shadow-2xl z-50 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2">
                <button className="p-2 sm:p-2.5 bg-blue-500/20 text-blue-500 rounded-xl hover:bg-blue-500/30 transition-colors">
                  <Wrench className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
                <button 
                  onClick={() => setIsEditRegionMode(true)}
                  className="p-2 sm:p-2.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  <Brush className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
                <button 
                  onClick={() => setShowGrid(!showGrid)}
                  className={cn(
                    "p-2 sm:p-2.5 rounded-xl transition-colors",
                    showGrid ? "bg-blue-500/20 text-blue-500" : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  <Grid className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
                <button 
                  onClick={() => insertMeRef.current?.click()}
                  className="p-2 sm:p-2.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl transition-colors relative"
                >
                  <ScanFace className="w-4 sm:w-5 h-4 sm:h-5" />
                  {isUploading && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center border border-[#1A1A1A]">
                      <X className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}
                </button>
                <button 
                  onClick={handlePolish}
                  disabled={isGenerating}
                  className="p-2 sm:p-2.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Stamp className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
                <div className="w-px h-6 sm:h-8 bg-white/10 mx-1"></div>
                <button className="p-2 sm:p-2.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl transition-colors border border-dashed border-white/20 ml-0.5 sm:ml-1">
                  <Plus className="w-4 sm:w-5 h-4 sm:h-5" />
                </button>
              </div>

              <div className="w-px h-6 sm:h-8 bg-white/10 mx-1 sm:mx-2"></div>

              <div className="relative">
                <button 
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#2a2a2a] hover:bg-[#333] rounded-xl text-[10px] sm:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <span className="max-w-[60px] sm:max-w-none truncate">{model}</span> <ChevronDown className="w-3 sm:w-4 h-3 sm:h-4 text-muted-foreground" />
                </button>
                
                <AnimatePresence>
                  {isModelDropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full mb-2 right-0 w-48 sm:w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 sm:py-2 z-[60]"
                    >
                      {['Google Flash 2.5', 'Google Flash 3.1', 'Google Pro 3', 'GPT Image 1.5'].map((m) => (
                        <button
                          key={m}
                          onClick={() => { setModel(m); setIsModelDropdownOpen(false); }}
                          className="w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-sm hover:bg-white/5 flex items-center justify-between"
                        >
                          <span className={model === m ? "text-white font-medium" : "text-muted-foreground"}>{m}</span>
                          {model === m && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={downloadImage} className="p-2 sm:p-2.5 bg-white text-black rounded-xl hover:bg-gray-200 transition-colors ml-1 sm:ml-2">
                <Download className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Prompt Area - Moved to Main Area */}
        <div className="p-4 border-t border-white/5 bg-[#0a0a0a]">
          {isEditRegionMode && (
            <div className="mb-3 flex items-center justify-between bg-[#1a1a1a] border border-blue-500/30 rounded-xl p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500 rounded-lg">
                  <Brush className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white">Edit Region</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground ml-1 hidden sm:inline">Paint area to edit on image</span>
              </div>
              <button 
                onClick={() => setIsEditRegionMode(false)}
                className="p-1 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="max-w-4xl mx-auto bg-[#1a1a1a] rounded-2xl border border-white/10 p-3 flex flex-col gap-3 focus-within:border-white/30 transition-colors">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="Describe your thumbnail edit..."
              className="w-full bg-transparent resize-none outline-none text-sm min-h-[40px] sm:min-h-[60px] placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button className="p-1.5 text-muted-foreground hover:text-white transition-colors rounded-lg hover:bg-white/5">
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-muted-foreground hover:text-white transition-colors rounded-lg hover:bg-white/5">
                  <Wrench className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-muted-foreground hover:text-white transition-colors rounded-lg hover:bg-white/5">
                  <ImagePlus className="w-4 h-4" />
                </button>
              </div>
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={cn(
                  "p-2 rounded-full transition-colors flex items-center justify-center",
                  prompt.trim() && !isGenerating ? "bg-white text-black hover:bg-gray-200" : "bg-white/10 text-white/30"
                )}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className={cn(
        "fixed inset-y-0 right-0 w-80 bg-[#111] border-l border-white/5 flex flex-col transition-transform duration-300 z-[100] lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Mobile Header for Sidebar */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/5">
          <span className="text-sm font-bold">History & Layers</span>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* History Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Main</span>
            </div>
            
            <div className="space-y-3">
              {history.map((item, i) => (
                <div key={i} className={cn(
                  "relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-colors group",
                  currentImage === item.url ? "border-blue-500" : "border-transparent hover:border-white/20"
                )} onClick={() => setCurrentImage(item.url)}>
                  <img src={item.url} alt="Thumbnail" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[10px] truncate">
                    {item.prompt}
                  </div>

                  {/* Three dots menu button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuIndex(activeMenuIndex === i ? null : i);
                    }}
                    className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4 text-white" />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {activeMenuIndex === i && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-8 right-1 w-36 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button 
                          onClick={(e) => handleOpenInEditor(item.url, e)}
                          className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 flex items-center gap-2"
                        >
                          <Edit2 className="w-3 h-3" /> Open in Editor
                        </button>
                        <button 
                          onClick={(e) => handleDownloadHistoryItem(item.url, e)}
                          className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 flex items-center gap-2"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                        <div className="w-full h-px bg-white/10"></div>
                        <button 
                          onClick={(e) => handleDeleteHistoryItem(i, e)}
                          className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-white/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <input type="file" ref={insertMeRef} onChange={handleInsertMe} accept="image/*" className="hidden" />
    </div>
  );
}
