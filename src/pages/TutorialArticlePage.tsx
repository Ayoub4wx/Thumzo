import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTutorialBySlug } from "../lib/seoContent";
import { buildAbsoluteUrl } from "../lib/siteMetadata";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

interface TutorialArticlePageProps {
  slug: string;
}

export default function TutorialArticlePage({ slug }: TutorialArticlePageProps) {
  const { user } = useAuth();
  const tutorial = getTutorialBySlug(slug);

  if (!tutorial) {
    return <Navigate to="/tutorials" replace />;
  }

  const primaryHref = user ? "/studio" : "/signup";
  const primaryLabel = user ? "Open Studio" : "Try it free";

  useDocumentMetadata({
    title: tutorial.seoTitle,
    description: tutorial.description,
    canonicalPath: tutorial.path,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: tutorial.title,
        description: tutorial.description,
        url: buildAbsoluteUrl(tutorial.path),
        step: tutorial.steps.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: step.title,
          text: step.description,
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: tutorial.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  });

  return (
    <div className="relative min-h-screen overflow-hidden pb-24 pt-16" dir="ltr">
      <section className="border-b border-border/80">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)] lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-3xl"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Tutorial</p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {tutorial.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{tutorial.intro}</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{tutorial.watchSummary}</p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {tutorial.bestFor.map((item) => (
                <span key={item} className="rounded-lg border border-border bg-background px-3 py-2">
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={primaryHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/tutorials"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Back to tutorials
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="space-y-5"
          >
            <div className="overflow-hidden border border-border bg-black shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <video
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
                src={tutorial.videoUrl}
              />
            </div>
            <div className="border border-border bg-card/50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What you will do</p>
              <div className="mt-4 grid gap-4">
                {tutorial.steps.map((step, index) => (
                  <div key={step.title} className="grid gap-1 border-t border-border pt-4 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <PlayCircle className="h-4 w-4 text-accent" />
                      <span>Step {index + 1}</span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{step.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-14 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="space-y-5"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step by step</p>
              <div className="mt-6 grid gap-5">
                {tutorial.steps.map((step, index) => (
                  <div key={step.title} className="grid gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Step {index + 1}
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">{step.title}</h2>
                    <p className="text-base leading-7 text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="space-y-8"
          >
            <div className="border border-border bg-card/40 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">FAQ</p>
              <div className="mt-5 grid gap-5">
                {tutorial.faq.map((item) => (
                  <div key={item.question} className="grid gap-2 border-t border-border pt-5 first:border-t-0 first:pt-0">
                    <h2 className="text-base font-semibold text-foreground">{item.question}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border bg-card/40 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Related pages</p>
              <div className="mt-5 grid gap-3">
                {tutorial.relatedLinks.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="inline-flex items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground transition-colors hover:text-foreground first:border-t-0 first:pt-0"
                  >
                    <span>{item.label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
          </motion.aside>
        </div>
      </section>
    </div>
  );
}
