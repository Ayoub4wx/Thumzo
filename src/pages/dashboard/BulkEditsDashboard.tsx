import { Search, Plus, Layers, Folder, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BulkEditsDashboard() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto" dir="ltr">
      {/* Top Controls */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border">
          <button className="px-4 py-1.5 bg-blue-500/10 text-blue-500 text-sm font-medium rounded-md flex items-center gap-2">
            <Layers className="w-4 h-4" /> Bulk Edits
          </button>
          <button className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 transition-colors">
            <Folder className="w-4 h-4" /> Projects
          </button>
          <button className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 transition-colors">
            <ImageIcon className="w-4 h-4" /> Assets
          </button>
          <button className="px-4 py-1.5 text-muted-foreground hover:text-foreground text-sm font-medium rounded-md flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Sub-tabs & Search */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/10">
          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-foreground flex items-center gap-2">
              All <span className="bg-muted px-1.5 py-0.5 rounded text-xs">0</span>
            </button>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              Active <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">0</span>
            </button>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              Completed <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">0</span>
            </button>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              Failed <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">0</span>
            </button>
            <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
              Archived <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">0</span>
            </button>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full bg-muted/30 border border-border rounded-lg py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:border-accent text-foreground placeholder:text-muted-foreground transition-colors"
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-6 gap-4 p-4 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/5">
          <div className="col-span-2">Name</div>
          <div>Results</div>
          <div>Status</div>
          <div>Objective</div>
          <div>Spend</div>
          <div>Date</div>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
            <Layers className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No bulk edits yet</h2>
          <p className="text-muted-foreground max-w-sm mb-8">
            Create your first bulk edit to start generating AI thumbnail variations for your videos
          </p>
          <Link 
            to="/studio/editor"
            className="px-6 py-2.5 bg-muted/50 hover:bg-muted border border-border text-foreground rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Bulk Edit
          </Link>
        </div>

        {/* Footer Promo */}
        <div className="p-6 border-t border-border bg-muted/5 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Have a YouTube channel? Connect for CTR reports, data-driven designs & more
          </p>
          <div className="flex items-center gap-2 max-w-md w-full">
            <input
              type="text"
              placeholder="@handle or URL"
              className="flex-1 bg-muted/30 border border-border rounded-lg py-2 px-4 text-sm focus:outline-none focus:border-accent text-foreground placeholder:text-muted-foreground transition-colors"
            />
            <button 
              onClick={() => alert('Channel connection initiated!')}
              className="p-2 bg-muted/30 hover:bg-muted border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
