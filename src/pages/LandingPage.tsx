import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Check, Star, Wand2, Layers, Zap, PenTool, Image as ImageIcon, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";
import { tutorialLibrary, useCaseLibrary } from "../lib/seoContent";
import { buildAbsoluteUrl, SOCIAL_PROFILES, SITE_NAME, SITE_URL } from "../lib/siteMetadata";
import { getPublicImagePreviewUrl } from "../services/storageService";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const referenceVideoUrl = `https://fncjyuuxqpnydgnugmqz.supabase.co/storage/v1/object/public/thumbnails/Untitled%20folder/Thumio_Point2.mp4`;
const sketchImageUrl = "https://fncjyuuxqpnydgnugmqz.supabase.co/storage/v1/object/public/thumbnails/Untitled%20folder/Screenshot%202026-04-09%20214900.png";
const generatedImageUrl = "https://fncjyuuxqpnydgnugmqz.supabase.co/storage/v1/object/public/thumbnails/Untitled%20folder/Screenshot%202026-04-09%20214931.png";
const heroImagePreviewOptions = {
  width: 640,
  height: 360,
  resize: "cover",
  quality: 74,
} as const;
const featuredUseCases = useCaseLibrary;
const featuredTutorials = tutorialLibrary;

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isResolvingAuth = loading && !user;

  useDocumentMetadata({
    title: "AI Thumbnail Maker for YouTube Creators | Thumora AI",
    description:
      "Thumora AI is an AI thumbnail maker and YouTube thumbnail editor for creators who want faster thumbnail generation, remakes, and creator-focused editing workflows.",
    canonicalPath: "/",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: buildAbsoluteUrl("/logos.png"),
        sameAs: SOCIAL_PROFILES,
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        image: buildAbsoluteUrl("/logos.png"),
        description:
          "AI thumbnail maker and YouTube thumbnail editor with reference images, creator tools, and thumbnail remake workflows.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Hobby plan with 3 AI credits every 30 days.",
        },
      },
    ],
  });

  useEffect(() => {
    if (!loading && user) {
      navigate("/projects", { replace: true });
    }
  }, [loading, user, navigate]);

  return (
    <div className="relative min-h-screen bg-transparent overflow-hidden transition-colors duration-300" dir="ltr">
      {/* Hero Section */}
      <section className="relative pt-10 pb-16 sm:pt-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center lg:min-h-[calc(100vh-280px)]">
          
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              AI Thumbnail Maker For YouTube Creators
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-[72px] font-bold tracking-tight mb-6 leading-[1.02] text-foreground transition-colors duration-300">
              <span className="block whitespace-nowrap">Stop losing views to</span>
              <span className="relative inline-block">
                bad thumbnails.
                <svg className="absolute w-[105%] h-4 -bottom-1 -left-2 text-blue-500" viewBox="0 0 300 20" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <path d="M2 15C50 5 150 2 298 12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed transition-colors duration-300">
              Build thumbnails faster with an AI thumbnail maker built for YouTube workflows, reference images,
              thumbnail remakes, and creator tools for polish passes, background cleanup, and 4K upgrades.
            </p>

            <div className="mb-10 flex flex-wrap items-center gap-4">
              {isResolvingAuth ? (
                <>
                  <div
                    aria-hidden="true"
                    className="h-14 min-w-[320px] rounded-full bg-muted/80 animate-pulse"
                  />
                  <div
                    aria-hidden="true"
                    className="h-14 w-[128px] rounded-full bg-muted/60 animate-pulse"
                  />
                </>
              ) : user ? (
                <Link
                  to="/studio"
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-foreground px-8 py-4 text-base font-bold text-background transition-all hover:opacity-90"
                >
                  Open Studio
                  <ArrowRight className="h-5 w-5" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="inline-flex min-h-14 min-w-[320px] items-center justify-center gap-3 rounded-full bg-foreground px-8 py-4 text-base font-bold text-background shadow-[0_12px_32px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:opacity-90"
                  >
                    Create your first thumbnail
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex min-h-14 min-w-[128px] items-center justify-center rounded-full border border-black/10 bg-white px-8 py-4 text-base font-bold text-black transition-all hover:bg-white/90 dark:border-border dark:bg-card/70 dark:text-foreground dark:hover:bg-card"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>

            <div className="space-y-3 text-sm text-muted-foreground mb-6 transition-colors duration-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-blue-500 fill-blue-500" />
                <span>3 free AI credits every 30 days</span>
              </div>
            </div>

            <a href="#how-it-works" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors">
              See how it works
            </a>
          </motion.div>

          {/* Right Column - Stacked Cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative h-[600px] hidden lg:block perspective-1000"
          >
            {/* Card 3 (Bottom) */}
            <div className="absolute top-20 right-0 w-[450px] h-[350px] bg-card border border-border rounded-2xl transform rotate-12 translate-x-10 opacity-40 shadow-2xl transition-colors duration-300">
               <div className="p-4 h-full flex flex-col gap-4">
                 <div className="h-32 bg-muted rounded-xl w-full"></div>
                 <div className="h-16 bg-muted/50 rounded-xl w-full"></div>
               </div>
            </div>

            {/* Card 2 (Middle) */}
            <div className="absolute top-10 right-10 w-[480px] h-[400px] bg-card border border-border rounded-2xl transform rotate-6 translate-x-5 opacity-70 shadow-2xl transition-colors duration-300">
               <div className="p-4 h-full flex flex-col gap-4">
                 <div className="h-40 bg-muted rounded-xl w-full"></div>
                 <div className="h-20 bg-muted/50 rounded-xl w-full"></div>
               </div>
            </div>

            {/* Card 1 (Top) */}
            <div className="absolute top-0 right-20 w-[500px] bg-card border border-border rounded-2xl transform -rotate-6 shadow-2xl overflow-hidden shadow-black/20 dark:shadow-black/50 transition-colors duration-300">
              <div className="p-5 flex flex-col gap-4">
                {/* Sketch Image */}
                <div className="w-full aspect-video bg-white rounded-xl overflow-hidden relative">
                  <img
                    src={getPublicImagePreviewUrl(sketchImageUrl, heroImagePreviewOptions)}
                    alt="Sketch reference for a YouTube thumbnail remake"
                    className="w-full h-full object-cover opacity-80 mix-blend-multiply"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallbackApplied === "true") {
                        return;
                      }

                      event.currentTarget.dataset.fallbackApplied = "true";
                      event.currentTarget.src = sketchImageUrl;
                    }}
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-gray-300 rounded-xl m-2"></div>
                </div>
                
                {/* Prompt Bubble */}
                <div className="bg-muted p-4 rounded-xl text-sm text-foreground leading-relaxed border border-border relative transition-colors duration-300">
                  Turn this rough sketch into a polished thumbnail. Keep the framing cinematic, sharpen the subject, and make the color contrast feel intentional.
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-muted rotate-45 border-l border-b border-border transition-colors duration-300"></div>
                </div>

                {/* Generated Image */}
                <div className="w-full aspect-video rounded-xl overflow-hidden relative shadow-lg">
                  <img
                    src={getPublicImagePreviewUrl(generatedImageUrl, heroImagePreviewOptions)}
                    alt="Generated YouTube thumbnail example from Thumora AI"
                    className="w-full h-full object-cover"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallbackApplied === "true") {
                        return;
                      }

                      event.currentTarget.dataset.fallbackApplied = "true";
                      event.currentTarget.src = generatedImageUrl;
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <ReferenceImagesSection isLoggedIn={Boolean(user)} isAuthReady={!isResolvingAuth} />
      
      {/* Features Section */}
      <section id="how-it-works" className="py-24 bg-card/30 border-y border-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">What Thumora AI helps you do</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Wand2 className="w-6 h-6 text-accent" />}
              title="AI-first editing"
              description="Upload an existing thumbnail or creator image, ask for the change you want, and let Thumora AI reshoot, restyle, or refine it in seconds."
            />
            <FeatureCard
              icon={<Layers className="w-6 h-6 text-accent" />}
              title="Creator-specific workflows"
              description="Reference-image edits, subject insertion, sketch-to-thumbnail generation, and quick utility tools are all shaped around creator image work."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-accent" />}
              title="Fast publishing loop"
              description="Move from concept to publish-ready thumbnail or cleaned-up creator asset without a heavyweight editor or a long design workflow."
            />
          </div>
        </div>
      </section>

      {/* Guides Section */}
      <section id="tools" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Launch workflow</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GuideCard
              icon={<PenTool className="w-6 h-6 text-blue-500" />}
              title="Open Studio"
              description="Start from a blank canvas or an existing image and move straight into the studio page."
              href={user ? "/studio" : "/signup"}
            />
            <GuideCard
              icon={<ImageIcon className="w-6 h-6 text-purple-500" />}
              title="Browse Templates"
              description="Use starter layouts and saved assets to move faster when you need a clean first pass."
              href="/templates"
            />
            <GuideCard
              icon={<Sparkles className="w-6 h-6 text-green-500" />}
              title="Choose a Plan"
              description="See Hobby, Creator, Creator+, and Ultra pricing before you add more credits or recurring usage."
              href="/pricing"
            />
          </div>
        </div>
      </section>

      <section id="learn" className="py-24 border-t border-border bg-card/20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Learn the workflow</p>
              <h2 className="mt-4 text-3xl md:text-5xl font-bold text-foreground">Open the page that matches the job.</h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                These pages are built around real creator workflows: importing from a YouTube URL, remaking an existing thumbnail, generating thumbnail ideas, and swapping the subject without rebuilding the whole concept.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/tutorials"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-base font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Browse tutorials
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/youtube-thumbnail-maker"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-background px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  YouTube thumbnail maker
                </Link>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="grid gap-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Use cases</p>
                {featuredUseCases.map((item) => (
                  <Link
                    key={item.slug}
                    to={item.path}
                    className="group grid gap-2 rounded-3xl border border-border bg-background/80 p-5 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">{item.title}</h3>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent" />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </Link>
                ))}
              </div>

              <div className="grid gap-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tutorials</p>
                {featuredTutorials.map((item) => (
                  <Link
                    key={item.slug}
                    to={item.path}
                    className="group grid gap-2 rounded-3xl border border-border bg-background/80 p-5 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">{item.title}</h3>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent" />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{item.watchSummary}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-card/30 border-t border-border transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground">Pricing</h2>
          <p className="text-xl text-muted-foreground mb-16">
            Start free, then upgrade when thumbnails and creator image cleanup become part of your weekly growth workflow.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-8 rounded-3xl bg-muted/30 border border-border transition-colors duration-300">
              <h3 className="text-2xl font-bold mb-4 text-foreground">Free to start</h3>
              <p className="text-muted-foreground mb-8">
                Create thumbnails, test AI-assisted creator tools, and explore the editor before you commit.
              </p>
              {isResolvingAuth ? (
                <div
                  aria-hidden="true"
                  className="h-[58px] w-full rounded-xl bg-muted/70 animate-pulse"
                />
              ) : (
                <Link
                  to={user ? "/projects" : "/templates"}
                  className="block w-full py-4 text-center rounded-xl bg-background border border-border hover:bg-muted font-bold transition-colors text-foreground"
                >
                  Get started
                </Link>
              )}
            </div>
            <div className="p-8 rounded-3xl bg-accent/10 border border-accent/20 relative overflow-hidden transition-colors duration-300">
              <div className="absolute top-0 right-0 bg-accent text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
              <h3 className="text-2xl font-bold mb-4 text-accent">Paid plans for recurring work</h3>
              <p className="text-muted-foreground mb-8">
                Upgrade when you need more credits, faster iteration, and a cleaner weekly production workflow.
              </p>
              <Link
                to="/pricing"
                className="block w-full py-4 text-center rounded-xl bg-accent hover:bg-accent/90 text-white font-bold transition-colors"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-8 rounded-3xl bg-muted/20 border border-border hover:border-muted-foreground/30 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function GuideCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link to={href} className="group block p-8 rounded-3xl border border-border hover:border-accent/50 transition-colors bg-card">
      <div className="mb-6">{icon}</div>
      <h3 className="text-xl font-bold mb-3 group-hover:text-accent transition-colors text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </Link>
  );
}

function ReferenceImagesSection({ isLoggedIn, isAuthReady }: { isLoggedIn: boolean; isAuthReady: boolean }) {
  const primaryHref = isLoggedIn ? "/studio" : "/signup";

  return (
    <section id="reference-images" className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            <div className="overflow-hidden rounded-[32px] border border-border shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
              <video
                src={referenceVideoUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Reference image workflow demo"
                className="landing-reference-video aspect-[16/10] w-full object-cover"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.08 }}
            className="max-w-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Reference images
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[4.75rem] lg:leading-[0.95]">
              Drop an image. Done.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Skip the long prompts. Upload any image and the AI matches the style, pose, or vibe you want.
            </p>
            {isAuthReady ? (
              <Link
                to={primaryHref}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-base font-semibold text-background transition-opacity hover:opacity-90"
              >
                Try it free
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <div
                aria-hidden="true"
                className="mt-8 h-12 w-[132px] rounded-full bg-muted/70 animate-pulse"
              />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
