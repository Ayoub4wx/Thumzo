import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wand2, ImagePlus, Zap, X } from "lucide-react";

export default function WelcomeModal() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has seen the welcome modal
    const hasSeenWelcome = localStorage.getItem("thumora-welcome-seen");
    if (!hasSeenWelcome) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem("thumora-welcome-seen", "true");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl"
          >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Wand2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Welcome to Thumora AI</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your thumbnail-first creator studio is ready. Here is how to get started:
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" /> Upload a base image
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Drop in an existing thumbnail, a raw photo, or any creator image you want to clean up.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Wand2 className="h-4 w-4" /> Describe what you want
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use the AI tools to remove backgrounds, polish the image, upscale it, or reshoot the entire concept.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent" /> Export in seconds
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Download a ready-to-publish asset in seconds, whether it is a thumbnail or a cleaned-up creator image.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="mt-8 w-full rounded-2xl bg-foreground px-6 py-4 text-base font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              Let's create something
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
