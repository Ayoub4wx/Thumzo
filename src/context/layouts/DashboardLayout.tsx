import React from 'react';
import { Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Monitor, Store, Layers, Folder, ArrowUpCircle, Settings, HelpCircle, Search, User as UserIcon, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
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
    { icon: Monitor, path: '/studio', label: 'Studio' },
    { icon: Store, path: '/templates', label: 'Templates' },
    { icon: Layers, path: '/bulk-edits', label: 'Bulk Edits' },
    { icon: Folder, path: '/assets', label: 'Assets' },
  ];

  const bottomNavItems = [
    { icon: ArrowUpCircle, path: '/settings/plans', label: 'Upgrade' },
    { icon: Settings, path: '/settings', label: 'Settings' },
    { icon: HelpCircle, path: '/help', label: 'Help' },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-300" dir="ltr">
      {/* Sidebar */}
      <aside className="w-16 border-r border-border flex flex-col items-center py-4 bg-card z-20 transition-colors duration-300">
        <Link to="/" className="mb-8">
          <div className="w-8 h-8 bg-foreground rounded-md flex items-center justify-center relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-2 left-1.5 w-1 h-1 bg-background rounded-sm transition-colors duration-300"></div>
            <div className="absolute top-2 right-1.5 w-1 h-1 bg-background rounded-sm transition-colors duration-300"></div>
            <div className="absolute bottom-2 left-2 w-3 h-1 bg-background rounded-sm transition-colors duration-300"></div>
          </div>
        </Link>

        <nav className="flex-1 flex flex-col gap-4 w-full px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path + '/') && item.path !== '/studio');
            // Special case for /studio to match /studio/editor
            const isStudioActive = item.path === '/studio' && location.pathname.startsWith('/studio');
            const active = isActive || isStudioActive;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "p-3 rounded-xl flex items-center justify-center transition-colors group relative",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title={item.label}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>

        <nav className="flex flex-col gap-4 w-full px-3 mt-auto">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "p-3 rounded-xl flex items-center justify-center transition-colors group relative",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title={item.label}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background z-10 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border rounded-lg transition-colors duration-300">
              <span className="text-sm font-medium">Solo Sandbox</span>
              <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">OWNER</span>
            </div>
          </div>

          <div className="flex-1 max-w-xl px-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-muted/30 border border-border rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent text-foreground placeholder:text-muted-foreground transition-colors duration-300"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-border" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
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
                    <p className="text-sm font-bold truncate">{user?.displayName || 'User'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <Link 
                    to="/settings" 
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
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background transition-colors duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}
