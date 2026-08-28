import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }

    // Listen for custom event to re-open the banner
    const handleOpenBanner = () => setIsVisible(true);
    window.addEventListener("open-cookie-consent", handleOpenBanner);
    return () => window.removeEventListener("open-cookie-consent", handleOpenBanner);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 pointer-events-none"
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-2xl shadow-2xl pointer-events-auto backdrop-blur-sm bg-card/95">
            <div className="text-sm md:text-base text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to provide, protect, and improve our services. By clicking "Accept", you consent to our use of cookies. You can learn more about how we use cookies and manage your preferences in our{" "}
              <Link to="/privacy-policy" className="text-foreground font-medium underline underline-offset-4 hover:text-accent transition-colors">
                Privacy Policy
              </Link>
              .
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button
                onClick={handleDecline}
                className="w-full sm:w-auto px-6 py-3 bg-transparent hover:bg-muted text-foreground font-medium rounded-xl transition-all cursor-pointer whitespace-nowrap border border-transparent hover:border-border"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="w-full sm:w-auto px-8 py-3 bg-accent text-accent-foreground font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-accent/20"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
