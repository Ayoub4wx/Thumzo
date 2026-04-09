import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Check, Star, Wand2, Layers, Zap, PenTool, Image as ImageIcon, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LandingPage() {
  const { user, login } = useAuth();

  return (
    <div className="relative min-h-screen bg-background overflow-hidden transition-colors duration-300" dir="ltr">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[calc(100vh-160px)]">
          
          {/* Left Column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <h1 className="text-6xl sm:text-7xl lg:text-[80px] font-bold tracking-tight mb-6 leading-[1.05] text-foreground transition-colors duration-300">
              Stop losing views to <br />
              <span className="relative inline-block">
                bad thumbnails.
                <svg className="absolute w-[105%] h-4 -bottom-1 -left-2 text-blue-500" viewBox="0 0 300 20" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <path d="M2 15C50 5 150 2 298 12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed transition-colors duration-300">
              The best way to make YouTube thumbnails with AI. Describe what you want, insert yourself, and test what gets clicks.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-10">
              {user ? (
                <Link
                  to="/studio"
                  className="bg-foreground text-background px-6 py-3.5 rounded-full text-base font-bold flex items-center gap-2 hover:opacity-90 transition-all"
                >
                  Open Studio
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <button
                    onClick={login}
                    className="bg-foreground text-background px-6 py-3.5 rounded-full text-base font-bold flex items-center gap-2 hover:opacity-90 transition-all"
                  >
                    Sign up
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={login}
                    className="bg-card border border-border text-foreground px-8 py-3.5 rounded-full text-base font-bold hover:bg-muted transition-all"
                  >
                    Log in
                  </button>
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
                <span>Used by 25,000+ creators</span>
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
                  <img src="https://picsum.photos/seed/sketch/800/450?grayscale" alt="Sketch" className="w-full h-full object-cover opacity-80 mix-blend-multiply" />
                  <div className="absolute inset-0 border-2 border-dashed border-gray-300 rounded-xl m-2"></div>
                </div>
                
                {/* Prompt Bubble */}
                <div className="bg-muted p-4 rounded-xl text-sm text-foreground leading-relaxed border border-border relative transition-colors duration-300">
                  Create a YouTube thumbnail for me based on the sketch I'm giving you. 16:9 format. I want bright colors.
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-muted rotate-45 border-l border-b border-border transition-colors duration-300"></div>
                </div>

                {/* Generated Image */}
                <div className="w-full aspect-video rounded-xl overflow-hidden relative shadow-lg">
                  <img src="https://picsum.photos/seed/mrbeast/800/450" alt="Generated Thumbnail" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="how-it-works" className="py-24 bg-card/30 border-y border-border transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">What Thumzo helps you do</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Wand2 className="w-6 h-6 text-accent" />}
              title="AI-first editing"
              description="Upload an existing thumbnail, ask for the change you want, and let Thumzo reshoot, restyle, or refine it in seconds."
            />
            <FeatureCard
              icon={<Layers className="w-6 h-6 text-accent" />}
              title="Creator-specific workflows"
              description="Expression changes, background cleanup, sketch-to-design, thumbnail sets, and fast export are all built around YouTube thumbnail work."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-accent" />}
              title="Fast publishing loop"
              description="Move from concept to publish-ready thumbnail without a heavyweight editor or a long design workflow."
            />
          </div>
        </div>
      </section>

      {/* Guides Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Popular creator guides</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GuideCard
              icon={<PenTool className="w-6 h-6 text-blue-500" />}
              title="AI Thumbnail Editor"
              description="See how Thumzo edits existing thumbnails with AI and where it beats general-purpose design tools."
            />
            <GuideCard
              icon={<ImageIcon className="w-6 h-6 text-purple-500" />}
              title="AI Thumbnail Generator"
              description="Learn when to start from a prompt, when to use a reference image, and how to create multiple variations quickly."
            />
            <GuideCard
              icon={<Sparkles className="w-6 h-6 text-green-500" />}
              title="Free Thumbnail Maker"
              description="Understand what creators can do for free, where the limits are, and how to ship thumbnails without design overhead."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-card/30 border-t border-border transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground">Pricing</h2>
          <p className="text-xl text-muted-foreground mb-16">
            Start free, then upgrade when thumbnails become part of your weekly growth workflow.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-8 rounded-3xl bg-muted/30 border border-border transition-colors duration-300">
              <h3 className="text-2xl font-bold mb-4 text-foreground">Free to start</h3>
              <p className="text-muted-foreground mb-8">
                Create thumbnails, test AI-assisted workflows, and explore the editor before you commit.
              </p>
              <Link to="/studio" className="block w-full py-4 text-center rounded-xl bg-background border border-border hover:bg-muted font-bold transition-colors text-foreground">
                Get started
              </Link>
            </div>
            <div className="p-8 rounded-3xl bg-accent/10 border border-accent/20 relative overflow-hidden transition-colors duration-300">
              <div className="absolute top-0 right-0 bg-accent text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
              <h3 className="text-2xl font-bold mb-4 text-accent">Paid for speed</h3>
              <p className="text-muted-foreground mb-8">
                Upgrade when you need more exports, faster iteration, and a smoother weekly publishing workflow.
              </p>
              <Link to="/studio" className="block w-full py-4 text-center rounded-xl bg-accent hover:bg-accent/90 text-white font-bold transition-colors">
                See full pricing in app
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

function GuideCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group p-8 rounded-3xl border border-border hover:border-accent/50 transition-colors cursor-pointer bg-card">
      <div className="mb-6">{icon}</div>
      <h3 className="text-xl font-bold mb-3 group-hover:text-accent transition-colors text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
