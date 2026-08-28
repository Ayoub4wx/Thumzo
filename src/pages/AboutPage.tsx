import { motion } from "motion/react";
import { Users, Zap, Sparkles } from "lucide-react";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

export default function AboutPage() {
  useDocumentMetadata({
    title: "About Thumora AI | AI Thumbnail Maker for YouTube Creators",
    description: "Learn how Thumora AI is building an AI thumbnail maker and YouTube thumbnail editor for creators who care about packaging and speed.",
    canonicalPath: "/about",
  });

  return (
    <div className="relative min-h-screen pt-20 pb-24 overflow-hidden" dir="ltr">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-4">Our Story</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
            We are building the creative engine for YouTube.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Every day, millions of incredible videos go unwatched because of a weak thumbnail. We built Thumora AI to level the playing field, giving every creator the power of a professional design studio in their browser.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-20 grid gap-8 md:grid-cols-3"
        >
          <div className="rounded-[2rem] border border-border bg-card/50 p-8 shadow-lg">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-foreground mb-6">
              <Zap className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Speed matters</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              We believe creators should spend 90% of their time on the video, not the packaging. AI allows us to compress hours of Photoshop work into seconds.
            </p>
          </div>

          <div className="rounded-[2rem] border border-border bg-card/50 p-8 shadow-lg">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-foreground mb-6">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Quality first</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Most AI generators output unpredictable junk. We built our models specifically for the visual language of high-CTR thumbnails: bold faces, clear contrast, and striking compositions.
            </p>
          </div>

          <div className="rounded-[2rem] border border-border bg-card/50 p-8 shadow-lg">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-foreground mb-6">
              <Users className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Creator-centric</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              We are obsessed with creator workflows. Thumora is built to slot perfectly into your existing content pipeline, whether you are a solo YouTuber or a massive media team.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
