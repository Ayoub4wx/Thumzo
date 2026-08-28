import { motion } from "motion/react";
import { Sparkles, Bug, Rocket } from "lucide-react";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

type ChangeType = "feature" | "fix" | "improvement";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  description: string;
  changes: {
    type: ChangeType;
    text: string;
  }[];
}

const changelogData: ChangelogEntry[] = [
  {
    version: "v1.2.0",
    date: "April 12, 2026",
    title: "Enhanced Privacy & Account Controls",
    description: "We've rolled out major updates to give you more control over your data and how you interact with the studio.",
    changes: [
      { type: "feature", text: "Added comprehensive Privacy & Data tab in Settings." },
      { type: "feature", text: "New Data Export functionality to download your account history." },
      { type: "improvement", text: "Added explicit AI Training Opt-in toggle." },
      { type: "fix", text: "Fixed an issue where session state could desync during checkout." }
    ]
  },
  {
    version: "v1.1.0",
    date: "March 28, 2026",
    title: "Faster AI Generation & Whop Integration",
    description: "We've upgraded our core inference infrastructure to return generated thumbnails up to 40% faster.",
    changes: [
      { type: "feature", text: "Launched full integration with Whop for seamless subscriptions." },
      { type: "improvement", text: "Server-side generation now uses optimized parallel processing." },
      { type: "improvement", text: "Added low credit warnings before generation attempts." }
    ]
  },
  {
    version: "v1.0.0",
    date: "March 15, 2026",
    title: "Thumora AI is Live!",
    description: "Welcome to the future of thumbnail creation. We've officially launched the studio.",
    changes: [
      { type: "rocket" as ChangeType, text: "Initial release of the AI Thumbnail Editor." },
      { type: "rocket" as ChangeType, text: "Smart background removal and asset layering." },
      { type: "rocket" as ChangeType, text: "Launched Free Hobby tiers for new creators." }
    ]
  }
];

function ChangeIcon({ type }: { type: ChangeType | string }) {
  switch (type) {
    case "feature":
      return <Sparkles className="h-4 w-4 text-emerald-500" />;
    case "fix":
      return <Bug className="h-4 w-4 text-amber-500" />;
    case "improvement":
      return <div className="h-2 w-2 rounded-full bg-blue-500 ml-1 mr-1" />;
    case "rocket":
      return <Rocket className="h-4 w-4 text-accent" />;
    default:
      return <div className="h-2 w-2 rounded-full bg-muted-foreground ml-1 mr-1" />;
  }
}

function ChangeBadge({ type }: { type: ChangeType | string }) {
  switch (type) {
    case "feature":
      return <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">Feature</span>;
    case "fix":
      return <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">Fix</span>;
    case "improvement":
      return <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20">Improvement</span>;
    case "rocket":
      return <span className="inline-flex items-center rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20">Launch</span>;
    default:
      return null;
  }
}

export default function ChangelogPage() {
  useDocumentMetadata({
    title: "Changelog | Thumora AI",
    description: "See the latest updates, features, and fixes we've made to Thumora AI.",
    canonicalPath: "/changelog",
  });

  return (
    <div className="relative min-h-screen pt-20 pb-24 overflow-hidden" dir="ltr">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-4">Updates</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">
            Changelog
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            New updates and improvements to Thumora AI.
          </p>
        </motion.div>

        <div className="space-y-16">
          {changelogData.map((entry, index) => (
            <motion.div
              key={entry.version}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative pl-8 sm:pl-0"
            >
              <div className="sm:flex sm:gap-8">
                {/* Desktop Date Column */}
                <div className="hidden sm:block w-48 flex-shrink-0 pt-1">
                  <p className="text-sm font-medium text-muted-foreground">{entry.date}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">{entry.version}</span>
                  </div>
                </div>

                {/* Timeline Line (Desktop only) */}
                <div className="hidden sm:block relative w-px bg-border flex-shrink-0 ml-4 mr-8">
                  <div className="absolute top-2 -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-background bg-accent ring-4 ring-background" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  {/* Mobile Date Header */}
                  <div className="sm:hidden mb-4 relative">
                    <div className="absolute top-2 -left-10 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent ring-4 ring-background" />
                    <div className="absolute top-5 bottom-[-4rem] -left-[35px] w-px bg-border" />
                    <p className="text-sm font-medium text-muted-foreground">{entry.date}</p>
                    <span className="inline-block mt-1 text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">{entry.version}</span>
                  </div>

                  <h2 className="text-2xl font-bold text-foreground mb-3">{entry.title}</h2>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {entry.description}
                  </p>

                  <ul className="space-y-4">
                    {entry.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="mt-1 flex-shrink-0">
                          <ChangeIcon type={change.type} />
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <ChangeBadge type={change.type} />
                          <span className="text-sm text-foreground">{change.text}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
