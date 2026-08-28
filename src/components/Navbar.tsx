import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import BrandLogo from "./BrandLogo";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";
  const isResolvingAuth = loading && !user;

  const pricingPath = user ? "/settings/billing" : "/pricing";
  const navLinks = [
    { name: "Tools", path: "/#tools" },
    { name: "Tutorials", path: "/tutorials" },
    { name: "How it works", path: "/#how-it-works" },
    { name: "Pricing", path: pricingPath },
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
        <div className={cn("flex items-center justify-between", isAuthPage ? "h-20" : "h-24")}>
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <BrandLogo size="md" />
          </Link>

          {/* Center Links */}
          <div className={cn("hidden items-center gap-8 md:flex", isAuthPage && "md:hidden")}>
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

            {isAuthPage ? (
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to site
              </Link>
            ) : isResolvingAuth ? (
              <div
                aria-hidden="true"
                className="h-10 w-[172px] rounded-full bg-muted/80 animate-pulse"
              />
            ) : user ? (
              <div className="flex items-center gap-4">
                <Link 
                  to="/projects"
                  className="px-6 py-2.5 text-sm font-bold text-background bg-foreground rounded-full hover:opacity-90 transition-opacity"
                >
                  My Projects
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
                <Link
                  to="/login"
                  className="px-6 py-2.5 text-sm font-bold text-foreground bg-transparent border border-border rounded-full hover:bg-muted transition-colors"
                >
                  Log in
                </Link>
                <Link 
                  to="/signup"
                  className="px-6 py-2.5 text-sm font-bold text-background bg-foreground rounded-full hover:opacity-90 transition-opacity"
                >
                  Sign up
                </Link>
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
            {isAuthPage ? (
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            ) : isResolvingAuth ? null : (
              <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-muted-foreground hover:text-foreground">
                {isOpen ? <X /> : <Menu />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && !isAuthPage && !isResolvingAuth && (
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
                  to="/projects"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 bg-foreground text-background px-6 py-3 rounded-xl font-bold transition-colors duration-300"
                >
                  My Projects
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
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 bg-transparent border border-border text-foreground px-6 py-3 rounded-xl font-bold transition-colors duration-300"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 bg-foreground text-background px-6 py-3 rounded-xl font-bold transition-colors duration-300"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
