import React from 'react';
import { Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { AlertTriangle, CheckCircle2, Folder, Settings, User as UserIcon, LogOut, Sun, Moon, PenTool, PanelLeft, BarChart3, ChevronDown, Clapperboard, History, TrendingUp, Layers, LayoutGrid, Zap, Menu, X, SquarePlus, Loader2 } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useBilling } from '../BillingContext';
import { useStudioGeneration } from '../StudioGenerationContext';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/apiClient';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { billing, refreshBilling } = useBilling();
  const { task: studioGenerationTask, clearGeneration } = useStudioGeneration();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const usageTriggerRef = React.useRef<HTMLDivElement>(null);
  const usagePopoverRef = React.useRef<HTMLDivElement>(null);
  
  // Usage Popover state
  const [showUsagePopover, setShowUsagePopover] = React.useState(false);
  const [usageHistory, setUsageHistory] = React.useState<any[]>([]);
  const [usageLoading, setUsageLoading] = React.useState(false);

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.photoURL]);

  React.useEffect(() => {
    setShowUsagePopover(false);
    setShowUserMenu(false);
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!isMobileDrawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileDrawerOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileDrawerOpen]);

  React.useEffect(() => {
    if (!showUsagePopover) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (usageTriggerRef.current?.contains(target) || usagePopoverRef.current?.contains(target)) {
        return;
      }

      setShowUsagePopover(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showUsagePopover]);

  const loadUsageHistory = async () => {
    if (!user || usageLoading) return;
    try {
      setUsageLoading(true);
      const data = await apiFetch<any>("/api/billing/usage");
      setUsageHistory(data?.history || []);
    } catch (error) {
      console.error("Failed to load usage history", error);
    } finally {
      setUsageLoading(false);
    }
  };

  const totalSpent = React.useMemo(() => {
    return usageHistory.reduce((acc, curr) => {
      const val = parseFloat(curr.cost.replace('$', ''));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }, [usageHistory]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (!user && location.pathname !== '/templates') {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const navItems = [
    { icon: SquarePlus, path: '/create', label: 'Create' },
    { icon: Clapperboard, path: '/studio', label: 'Studio' },
    { icon: LayoutGrid, path: '/projects', label: 'My Projects' },
    { icon: History, path: '/drafts', label: 'Drafts' },
    { icon: Layers, path: '/templates', label: 'Templates' },
    { icon: PenTool, path: '/tools', label: 'Tools' },
    { icon: TrendingUp, path: '/tools/growth', label: 'Growth' },
    { icon: Folder, path: '/assets', label: 'Assets' },
  ];

  const secondaryNavItems = [
    { icon: BarChart3, path: '/settings/usage', label: 'Usage' },
    { icon: Zap, path: '/pricing', label: 'Pricing' },
    { icon: Settings, path: '/settings/billing', label: 'Settings' },
  ];
  const isStudioEditorRoute =
    location.pathname === '/studio' ||
    location.pathname === '/cdo' ||
    location.pathname === '/projects/editor' ||
    location.pathname === '/studio/editor';
  const isStudioWorkspaceRoute = isStudioEditorRoute || location.pathname === '/create';

  const userInitial = user?.displayName?.trim().charAt(0).toUpperCase() || user?.email?.trim().charAt(0).toUpperCase() || 'U';
  const isNavItemActive = (path: string) => {
    if (path === '/projects') return location.pathname === '/projects';
    if (path === '/drafts') return location.pathname === '/drafts';
    if (path === '/create') return location.pathname === '/create';
    if (path === '/studio') return isStudioEditorRoute;
    if (path === '/tools') return location.pathname === '/tools' || location.pathname === '/tools/ideas';
    if (path === '/tools/growth') return location.pathname === '/tools/growth';
    if (path === '/settings/billing') return location.pathname.startsWith('/settings');
    if (path === '/pricing') return location.pathname === '/pricing';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const generationStatusText =
    studioGenerationTask?.status === 'running'
      ? studioGenerationTask.label
      : studioGenerationTask?.status === 'completed'
        ? 'Generation ready'
        : studioGenerationTask?.status === 'failed'
          ? 'Generation failed'
          : null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300" dir="ltr">
      {/* Sidebar (Desktop) */}
      <aside className={cn(
        "hidden md:flex shrink-0 border-r border-border bg-card text-foreground z-20 transition-all duration-300 ease-in-out",
        isSidebarOpen ? "w-[248px]" : "w-20"
      )}>
        <div className="flex h-full w-full flex-col px-3 py-6">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const active = isNavItemActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={!isSidebarOpen ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-medium transition-all",
                    active
                      ? "bg-muted text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    !isSidebarOpen && "justify-center px-0"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-colors",
                      active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {isSidebarOpen && <span>{item.label}</span>}
                  {isSidebarOpen && active ? <span className="ml-auto h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.85)]" /> : null}
                </Link>
              );
            })}
          </nav>

          <nav className="mt-auto flex flex-col gap-2 border-t border-border pt-5">
            {secondaryNavItems.map((item) => {
              const active = isNavItemActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={!isSidebarOpen ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-medium transition-all",
                    active
                      ? "bg-muted text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    !isSidebarOpen && "justify-center px-0"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-colors",
                      active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {isSidebarOpen && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className="relative flex flex-1 flex-col overflow-hidden"
      >
        {/* Top Header */}
        <header
          className={cn(
            "flex items-center justify-between border-b border-border bg-background transition-colors duration-300",
            isStudioWorkspaceRoute ? "z-[120]" : "z-10",
            isStudioWorkspaceRoute ? "h-14 px-3 sm:px-6" : "h-16 px-4 sm:px-6"
          )}
        >
          <div className={cn("flex items-center", isStudioWorkspaceRoute ? "gap-2" : "gap-3")}>
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
              aria-label="Open dashboard navigation"
              aria-controls="mobile-dashboard-drawer"
              aria-expanded={isMobileDrawerOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border bg-muted/30 hover:bg-muted"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div
              ref={usageTriggerRef}
              className={cn(
                "group relative flex items-center rounded-lg border border-border bg-muted/50 transition-colors duration-300",
                isStudioWorkspaceRoute ? "cursor-pointer" : "cursor-help",
                isStudioWorkspaceRoute ? "gap-1.5 px-2 py-1" : "gap-2 px-2 py-1.5 sm:px-3"
              )}
              onMouseEnter={() => {
                if (isStudioWorkspaceRoute) {
                  return;
                }
                setShowUsagePopover(true);
                loadUsageHistory();
              }}
              onMouseLeave={() => {
                if (isStudioWorkspaceRoute) {
                  return;
                }
                setShowUsagePopover(false);
              }}
              onClick={() => {
                if (!isStudioWorkspaceRoute) {
                  return;
                }

                setShowUsagePopover((current) => {
                  const next = !current;
                  if (next) {
                    void loadUsageHistory();
                  }
                  return next;
                });
              }}
            >
              <span className="text-xs sm:text-sm font-medium">{billing?.planName || 'Hobby'}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />

              {showUsagePopover && (
                <div
                  ref={usagePopoverRef}
                  className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-2xl z-[140] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Usage</span>
                      <span className="text-sm font-bold text-foreground">${totalSpent.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Lifetime generation spend</p>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {usageLoading && usageHistory.length === 0 ? (
                      <div className="p-8 flex justify-center">
                        <BarChart3 className="w-5 h-5 animate-pulse text-muted-foreground" />
                      </div>
                    ) : usageHistory.length > 0 ? (
                      <div className="divide-y divide-border/50">
                        {usageHistory.slice(0, 10).map((item) => (
                          <div key={item.id} className="p-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-foreground">{item.type}</span>
                              <span className="text-xs font-bold text-foreground">{item.cost}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">{item.model}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-[10px] text-muted-foreground">
                        No usage history found.
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-border bg-muted/20 text-center">
                    <button 
                      onClick={() => navigate('/settings/usage')}
                      className="text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View all history
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 relative">
            {studioGenerationTask && generationStatusText ? (
              <div
                className={cn(
                  "hidden h-10 max-w-[16rem] items-center gap-2 rounded-full border px-3 text-xs font-semibold shadow-sm min-[520px]:inline-flex",
                  studioGenerationTask.status === 'running'
                    ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300"
                    : studioGenerationTask.status === 'completed'
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                      : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300"
                )}
              >
                {studioGenerationTask.status === 'running' ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : studioGenerationTask.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => navigate('/studio')}
                  className="min-w-0 truncate text-left"
                  title={studioGenerationTask.errorMessage || generationStatusText}
                >
                  {generationStatusText}
                </button>
                {studioGenerationTask.status === 'failed' ? (
                  <button
                    type="button"
                    onClick={() => clearGeneration(studioGenerationTask.id)}
                    className="ml-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-red-500/10"
                    aria-label="Dismiss generation status"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full border border-border bg-muted/30 hover:bg-muted"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <>
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer rounded-full"
                  aria-label="Open user menu"
                  aria-expanded={showUserMenu}
                >
                  {user.photoURL && !avatarLoadFailed ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName ? `${user.displayName} profile` : 'User profile'}
                      className="w-8 h-8 rounded-full border border-border object-cover bg-muted"
                      referrerPolicy="no-referrer"
                      decoding="async"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border overflow-hidden">
                      {userInitial ? (
                        <span className="text-xs font-semibold text-foreground">{userInitial}</span>
                      ) : (
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </button>

                {showUserMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowUserMenu(false)}
                    ></div>
                    <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-bold truncate">{user.displayName || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Link 
                        to="/pricing" 
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Zap className="w-4 h-4" /> Pricing
                      </Link>
                      <Link 
                        to="/settings/billing" 
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Settings className="w-4 h-4" /> Settings
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <Link to="/login" className="text-sm font-bold bg-foreground text-background px-4 py-2 rounded-full hover:opacity-90 transition-opacity">
                Log in
              </Link>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background transition-colors duration-300">
          {children}
        </main>
      </div>

      {isMobileDrawerOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[180] bg-black/60 backdrop-blur-sm md:hidden"
            aria-label="Close dashboard navigation"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <aside
            id="mobile-dashboard-drawer"
            className="fixed bottom-0 left-0 top-0 z-[190] flex w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-border bg-card shadow-2xl md:hidden"
            aria-label="Dashboard navigation"
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">Thumora AI</p>
                <p className="truncate text-xs text-muted-foreground">{billing?.planName || 'Hobby'} plan</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close dashboard navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <nav className="flex flex-col gap-1.5">
                {navItems.map((item) => {
                  const active = isNavItemActive(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/55 hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("h-5 w-5 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <nav className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
                {secondaryNavItems.map((item) => {
                  const active = isNavItemActive(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/55 hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("h-5 w-5 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {user ? (
              <div className="border-t border-border p-3">
                <div className="mb-3 min-w-0 rounded-2xl bg-background px-4 py-3">
                  <p className="truncate text-sm font-bold text-foreground">{user.displayName || 'User'}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    void handleLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}
