import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, Menu, X, LogOut, User as UserIcon, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navLinks = [
    { name: "Tools", path: "/studio" },
    { name: "How it works", path: "/#how-it-works" },
    { name: "Pricing", path: "/#pricing" },
  ];

  const handleLinkClick = (path: string) => {
    setIsOpen(false);
    if (path.startsWith('/#')) {
      if (location.pathname !== '/') {
        navigate('/');
        setTimeout(() => {
          const element = document.getElementById(path.substring(2));
          if (element) element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        const element = document.getElementById(path.substring(2));
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(path);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border transition-colors duration-300" dir="ltr">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-foreground rounded-md flex items-center justify-center relative overflow-hidden flex-shrink-0 transition-colors duration-300">
              {/* Blocky face representation */}
              <div className="absolute top-2.5 left-2 w-1.5 h-1.5 bg-background rounded-sm transition-colors duration-300"></div>
              <div className="absolute top-2.5 right-2 w-1.5 h-1.5 bg-background rounded-sm transition-colors duration-300"></div>
              <div className="absolute bottom-2.5 left-2.5 w-4 h-1.5 bg-background rounded-sm transition-colors duration-300"></div>
              <div className="absolute -right-1 top-4 w-2 h-2 bg-background rounded-sm transition-colors duration-300"></div>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[22px] font-bold leading-none tracking-tight text-foreground mb-1 transition-colors duration-300">Thumzo</span>
              <span className="text-[9px] font-bold text-muted-foreground tracking-[0.2em] leading-none transition-colors duration-300">AI THUMBNAIL EDITOR</span>
            </div>
          </Link>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => handleLinkClick(link.path)}
                className={cn(
                  "text-sm font-bold transition-colors hover:text-foreground",
                  (location.pathname === link.path || location.hash === link.path.substring(1)) ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {link.name}
              </button>
            ))}
          </div>

          {/* Right Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {user ? (
              <div className="flex items-center gap-4">
                <Link 
                  to="/studio"
                  className="px-6 py-2.5 text-sm font-bold text-background bg-foreground rounded-full hover:opacity-90 transition-opacity"
                >
                  Open Studio
                </Link>
                <button 
                  onClick={logout}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={login}
                  className="px-6 py-2.5 text-sm font-bold text-foreground bg-transparent border border-border rounded-full hover:bg-muted transition-colors"
                >
                  Log in
                </button>
                <button 
                  onClick={login}
                  className="px-6 py-2.5 text-sm font-bold text-background bg-foreground rounded-full hover:opacity-90 transition-opacity"
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-muted-foreground hover:text-foreground">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-background border-b border-border px-4 py-6 space-y-4 transition-colors duration-300">
          {navLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => handleLinkClick(link.path)}
              className={cn(
                "block w-full text-left text-lg font-bold transition-colors duration-300",
                (location.pathname === link.path || location.hash === link.path.substring(1)) ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {link.name}
            </button>
          ))}
          <div className="pt-4 flex flex-col gap-3">
            {user ? (
              <div className="flex flex-col gap-3">
                <Link 
                  to="/studio"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 bg-foreground text-background px-6 py-3 rounded-xl font-bold transition-colors duration-300"
                >
                  Open Studio
                </Link>
                <button 
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-muted text-foreground px-6 py-3 rounded-xl font-bold transition-colors duration-300"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => { login(); setIsOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-transparent border border-border text-foreground px-6 py-3 rounded-xl font-bold transition-colors duration-300"
                >
                  Log in
                </button>
                <button 
                  onClick={() => { login(); setIsOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-foreground text-background px-6 py-3 rounded-xl font-bold transition-colors duration-300"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
