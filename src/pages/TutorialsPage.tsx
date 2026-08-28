import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Link2, PlayCircle, Scissors, UserRoundPlus, Youtube } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { tutorialLibrary, useCaseLibrary } from "../lib/seoContent";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

const insertMeVideoUrl =
  "https://fncjyuuxqpnydgnugmqz.supabase.co/storage/v1/object/public/logos%20company/0420.mp4";
const youtubeUrlVideoUrl =
  "https://fncjyuuxqpnydgnugmqz.supabase.co/storage/v1/object/public/logos%20company/0420%20(1).mp4";
const youtubeChannelUrl = "https://www.youtube.com/@thumorai";

const insertMeSteps = [
  {
    title: "Start from a thumbnail",
    description: "Open an existing thumbnail or draft so the scene, framing, and text are already in place.",
    icon: <PlayCircle className="h-5 w-5 text-accent" />,
  },
  {
    title: "Open Insert Me",
    description: "Use the Insert Me action inside Studio to prepare the scene for a subject swap.",
    icon: <UserRoundPlus className="h-5 w-5 text-accent" />,
  },
  {
    title: "Upload your reference",
    description: "Add a face photo or reference image so Thumora can keep the person recognizable in the final result.",
    icon: <Scissors className="h-5 w-5 text-accent" />,
  },
  {
    title: "Generate and compare",
    description: "Run the edit, then compare the new frame against the original before you save or keep iterating.",
    icon: <CheckCircle2 className="h-5 w-5 text-accent" />,
  },
];

const youtubeUrlSteps = [
  {
    title: "Copy the video link",
    description: "Start from a public YouTube URL when you want to pull the thumbnail into Studio without downloading files manually.",
    icon: <Link2 className="h-5 w-5 text-accent" />,
  },
  {
    title: "Paste it into the import flow",
    description: "Use the YouTube URL entry point so Thumora can fetch the thumbnail from the video for you.",
    icon: <Youtube className="h-5 w-5 text-accent" />,
  },
  {
    title: "Open the imported frame",
    description: "Bring the thumbnail into Studio and keep the original scene as the starting point for edits or remakes.",
    icon: <PlayCircle className="h-5 w-5 text-accent" />,
  },
  {
    title: "Edit and iterate",
    description: "Run your next pass from a real YouTube thumbnail instead of rebuilding the whole concept from scratch.",
    icon: <CheckCircle2 className="h-5 w-5 text-accent" />,
  },
];

export default function TutorialsPage() {
  const { user } = useAuth();

  useDocumentMetadata({
    title: "YouTube Thumbnail Tutorials | Thumora AI",
    description: "Watch YouTube thumbnail tutorials for Thumora AI, including Insert Me and YouTube URL import workflows for faster thumbnail editing.",
    canonicalPath: "/tutorials",
  });

  const primaryHref = user ? "/studio" : "/signup";
  const primaryLabel = user ? "Open Studio" : "Try it free";

  return (
    <div className="relative min-h-screen overflow-hidden pt-16 pb-24" dir="ltr">
      <section className="border-b border-border/80">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-3xl"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Tutorials</p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Learn the workflow before you open the editor.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Short walkthroughs for creator tools inside Thumora AI. Start with Insert Me, then use the YouTube URL
              flow to pull real thumbnails straight into the editor.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="rounded-lg border border-border bg-background px-3 py-2">{tutorialLibrary.length} tutorials live</span>
              <span className="rounded-lg border border-border bg-background px-3 py-2">Insert Me</span>
              <span className="rounded-lg border border-border bg-background px-3 py-2">YouTube URL import</span>
              <span className="rounded-lg border border-border bg-background px-3 py-2">Short walkthroughs</span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={primaryHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#insert-me-tutorial"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Insert Me tutorial
              </a>
              <a
                href="#youtube-url-tutorial"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                YouTube URL tutorial
              </a>
              <a
                href={youtubeChannelUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Watch on YouTube
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="grid gap-5 self-end"
          >
            <div className="overflow-hidden border border-border bg-black shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <video
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
                src={insertMeVideoUrl}
              />
            </div>

            <div className="grid gap-3 border border-border bg-card/50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tutorial library</p>
              {tutorialLibrary.map((tutorial, index) => (
                <div
                  key={tutorial.slug}
                  className={`grid gap-2 ${index < tutorialLibrary.length - 1 ? "border-b border-border pb-3" : "pt-1"}`}
                >
                  <a href={tutorial.slug === "insert-me-thumbnail" ? "#insert-me-tutorial" : "#youtube-url-tutorial"} className="grid gap-1">
                    <div className="text-sm font-semibold text-foreground">{tutorial.title}</div>
                    <p className="text-sm leading-6 text-muted-foreground">{tutorial.description}</p>
                  </a>
                  <Link to={tutorial.path} className="text-sm font-medium text-accent transition-opacity hover:opacity-80">
                    Read the full guide
                  </Link>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="insert-me-tutorial" className="py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tutorial 1</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">How to use Insert Me</h2>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  Insert Me is for creators who already have a thumbnail direction and want to swap the subject for
                  themselves without rebuilding the design from scratch.
                </p>
              </div>

              <div className="grid gap-3 border-t border-border pt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Best for</p>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="rounded-lg border border-border bg-background px-3 py-2">Thumbnail remakes</span>
                  <span className="rounded-lg border border-border bg-background px-3 py-2">Personal branding</span>
                  <span className="rounded-lg border border-border bg-background px-3 py-2">Fast subject swaps</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-border pt-6">
                <Link
                  to={primaryHref}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  View pricing
                </Link>
                <Link
                  to="/tutorials/insert-me-thumbnail"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Read full guide
                </Link>
                <a
                  href={youtubeChannelUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Visit channel
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="grid gap-8"
            >
              <div className="grid gap-5">
                {insertMeSteps.map((step, index) => (
                  <div key={step.title} className="grid gap-2 border-t border-border pt-5 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Step {index + 1}
                      </span>
                      <div className="shrink-0">{step.icon}</div>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                Watch the full walkthrough above, then open the Studio and run the same flow on one of your existing
                thumbnails.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="youtube-url-tutorial" className="border-t border-border/80 py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="grid gap-6"
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tutorial 2</p>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    How to use a YouTube URL
                  </h2>
                </div>
                <span className="hidden text-sm text-muted-foreground sm:inline">Pull the thumbnail in first, then edit.</span>
              </div>

              <div className="overflow-hidden border border-border bg-black shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full bg-black object-cover"
                  src={youtubeUrlVideoUrl}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="grid gap-8"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">About this workflow</p>
                <p className="mt-4 text-base leading-7 text-muted-foreground">
                  This is the fast path for creators who already have a public YouTube video and want to start from the
                  existing thumbnail instead of downloading files by hand.
                </p>
              </div>

              <div className="grid gap-5">
                {youtubeUrlSteps.map((step, index) => (
                  <div key={step.title} className="grid gap-2 border-t border-border pt-5 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Step {index + 1}
                      </span>
                      <div className="shrink-0">{step.icon}</div>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 border-t border-border pt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Best for</p>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="rounded-lg border border-border bg-background px-3 py-2">Thumbnail remixes</span>
                  <span className="rounded-lg border border-border bg-background px-3 py-2">YouTube imports</span>
                  <span className="rounded-lg border border-border bg-background px-3 py-2">Fast iteration</span>
                </div>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                Start from a real thumbnail that is already live on YouTube, then move straight into edits, variations,
                or a full remake inside Studio.
              </p>

              <div className="flex flex-wrap gap-3 border-t border-border pt-6">
                <Link
                  to="/tutorials/youtube-url-thumbnail-import"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Read full guide
                </Link>
                <Link
                  to="/thumbnail-maker-from-youtube-url"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  URL workflow page
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/80 py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">More workflows</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Browse the pages built around the searches creators actually make.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              These pages go deeper on remakes, thumbnail ideas, and YouTube-import workflows so visitors can land on a page that matches the job they already have.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {useCaseLibrary.map((item) => (
              <Link
                key={item.slug}
                to={item.path}
                className="group grid gap-3 border border-border bg-card/40 p-5 transition-colors hover:border-foreground/20"
              >
                <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-accent">{item.title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{item.intro}</p>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-accent">
                  Open page
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
