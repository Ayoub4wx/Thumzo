import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Play, Search, TrendingUp, Sparkles, Star, LayoutGrid, X } from "lucide-react";

interface Template {
  key: string;
  url: string;
  lastModified: string;
  category?: string;
  isNew?: boolean;
  isTrending?: boolean;
  title?: string;
}

const categories = [
  { id: 'request', label: 'Request', icon: null },
  { id: 'drops', label: 'Drops', icon: null },
  { id: 'all', label: 'All', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'education', label: 'Education', icon: null },
  { id: 'how-to', label: 'How To', icon: null },
  { id: 'blogs', label: 'Blogs', icon: null },
  { id: 'tech', label: 'Tech', icon: null },
  { id: 'gaming', label: 'Gaming', icon: null },
  { id: 'entertainment', label: 'Entertainment', icon: null },
  { id: 'sports', label: 'Sports', icon: null },
  { id: 'travel', label: 'Travel', icon: null },
  { id: 'tools', label: 'Tools', icon: null },
];

const templateTitles = [
  "EXPOSED: $5,000+ AI Websites in 5 Minutes?!",
  "Day Trading for Beginners: My SECRET to Start FAST!",
  "Twitch or YouTube? One Choice Will Ruin Your Channel",
  "How I Used AI to Make $10,000 as a Complete Beginner",
  "My $10K App SECRET: AI + NO CODING!",
  "How 10 videos changed my life and why you must start",
  "Stop before it's too late: YouTube BANNED these niches",
  "13 Yrs of NO BS Productivity: DITCH The Fluff (67 Mins)",
  "How This 1 Hook Formula Will Blow Up Your Channel",
  "This 1 thumbnail secret will blow up your content",
  "23 ChatGPT Hacks So UNFAIR It's Cheating!",
  "Every New Fortnite Collab Just Leaked (Mind-Blowing)",
  "This Challenge Could KILL ME For $500,000!",
  "Why the Black Ops 7 Beta is a complete disaster",
  "The Most Shameless Valorant Gameplay You Will Ever See",
  "AI Money HACK: ZERO Effort, Literally!",
  "How to FINALLY Change Your Life (The Ultimate Guide)",
  "I Tried AI Side Hustles for 30 Days (The Results)",
  "The TRUTH About Making Money on YouTube in 2026",
  "Stop Wasting Time: Do THIS Instead for 10x Growth",
  "I Built a $100,000 Business in 24 Hours (No Money)",
  "Why 99% of Creators Fail (And How to Be the 1%)",
  "The Secret to Viral Content (It's Not What You Think)",
  "How to Master Any Skill in 100 Hours (Proven Method)"
];

export default function TemplatesDashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch("/api/templates");
        if (!response.ok) throw new Error("Failed to fetch templates");
        const data = await response.json();
        
        // Map templates to hardcoded titles based on index to ensure consistency
        const enrichedData = data.map((t: any, i: number) => ({
          ...t,
          category: categories[Math.floor(Math.random() * (categories.length - 3)) + 3].id,
          isNew: i % 3 === 0,
          isTrending: i % 2 === 0,
          title: templateTitles[i % templateTitles.length]
        }));
        
        setTemplates(enrichedData);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  const handleUseStyle = (url: string) => {
    navigate(`/studio/editor?templateUrl=${encodeURIComponent(url)}`);
  };

  const filteredTemplates = templates.filter(t => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (activeTab === 'new' && !t.isNew) return false;
    if (activeTab === 'trending' && !t.isTrending) return false;
    if (searchQuery && !t.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-[1600px] mx-auto" dir="ltr">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-sm">Thumbnail designs our users are requesting, added daily.</p>
          <span className="px-2 py-1 bg-muted/50 border border-border rounded-md text-xs font-medium text-foreground">✓ Use & sell freely</span>
        </div>
        
        <div className="relative w-full md:w-[400px]">
          <div className={`flex items-center bg-[#1A1A1A] border rounded-xl overflow-hidden transition-colors ${isSearchFocused ? 'border-blue-500' : 'border-white/10'}`}>
            <div className="pl-4 pr-2 text-muted-foreground">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              placeholder="Search thumbnail templates" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full bg-transparent border-none outline-none py-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="pr-4 pl-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {isSearchFocused && !searchQuery && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-3">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-muted-foreground tracking-wider uppercase">
                    <TrendingUp className="w-3 h-3" /> Popular
                  </div>
                  {['education', 'tutorial', 'clickbait', 'dramatic', 'minimalist', 'ai', 'productivity', 'how-to'].map((term) => (
                    <button 
                      key={term}
                      onClick={() => setSearchQuery(term)}
                      className="w-full text-left px-3 py-2.5 text-sm font-medium text-white hover:bg-white/5 rounded-lg flex items-center gap-3 transition-colors"
                    >
                      <Search className="w-4 h-4 text-muted-foreground" /> {term}
                    </button>
                  ))}
                </div>
                <div className="bg-[#0A0A0A] border-t border-white/5 p-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><span className="border border-white/10 rounded px-1.5 py-0.5">↑↓</span> Navigate</div>
                  <div className="flex items-center gap-1"><span className="border border-white/10 rounded px-1.5 py-0.5">↵</span> Select</div>
                  <div className="flex items-center gap-1"><span className="border border-white/10 rounded px-1.5 py-0.5">Esc</span> Close</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id 
                ? 'bg-foreground text-background' 
                : 'bg-muted/30 border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Featured Banner */}
      <div className="relative rounded-3xl overflow-hidden mb-12 bg-gradient-to-r from-[#1a0b0b] to-[#3a1515] border border-red-900/30">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=2000&auto=format&fit=crop')] opacity-20 mix-blend-overlay"></div>
        <div className="relative z-10 p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 text-orange-500 rounded-full text-xs font-bold mb-6">
              <TrendingUp className="w-3 h-3" /> TRENDING #1
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              I made thumbnails in 5, 15, and 30 minutes
            </h1>
            <div className="flex gap-2 mb-8">
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white">Howto</span>
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white">design</span>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => handleUseStyle('https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=800&auto=format&fit=crop')}
                className="px-6 py-3 bg-white text-black rounded-xl font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors"
              >
                <Play className="w-4 h-4 fill-black" /> Use Template
              </button>
              <button className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors">
                View Details
              </button>
            </div>
          </div>
          <div className="flex-1 flex justify-end">
            <div className="w-full max-w-md aspect-video rounded-xl overflow-hidden border-4 border-white/10 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
              <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=800&auto=format&fit=crop" alt="Featured" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border">
          <button 
            onClick={() => setActiveTab('new')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
              activeTab === 'new' ? 'bg-blue-500 text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-4 h-4" /> New
          </button>
          <button 
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
              activeTab === 'trending' ? 'bg-blue-500 text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Trending
          </button>
          <button 
            onClick={() => setActiveTab('popular')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
              activeTab === 'popular' ? 'bg-blue-500 text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className="w-4 h-4" /> Popular
          </button>
        </div>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          See all <span className="text-lg leading-none">›</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-muted-foreground">Loading templates...</div>
        ) : filteredTemplates.length > 0 ? (
          filteredTemplates.map((template, index) => (
            <div key={template.key} className="group cursor-pointer">
              <div className="aspect-video rounded-xl overflow-hidden mb-3 relative border border-border group-hover:border-accent transition-colors">
                <img src={template.url} alt="Template" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => handleUseStyle(template.url)}
                    className="px-4 py-2 bg-white text-black rounded-lg font-bold text-sm flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-black" /> Use
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-foreground text-sm mb-1 line-clamp-2">{template.title}</h3>
              <p className="text-xs text-muted-foreground">{template.category || 'youtube'} • {new Date(template.lastModified).toLocaleDateString()}</p>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
            <p className="text-muted-foreground text-lg">No templates found for this filter.</p>
            <button 
              onClick={() => { setActiveCategory('all'); setActiveTab('popular'); }}
              className="mt-4 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
