import { useState } from "react";
import { motion } from "motion/react";
import { Check, Code2, Copy, Lock, Sparkles, Terminal } from "lucide-react";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

type EndpointCard = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  auth: "Public" | "Session";
  summary: string;
};

const ENDPOINTS: EndpointCard[] = [
  {
    method: "GET",
    path: "/api/health",
    auth: "Public",
    summary: "Basic health check for the app runtime.",
  },
  {
    method: "POST",
    path: "/api/ai/generate",
    auth: "Session",
    summary: "Generate or edit thumbnail images through the Studio workflow.",
  },
  {
    method: "POST",
    path: "/api/ai/analyze",
    auth: "Session",
    summary: "Analyze an image before generation or remix flows.",
  },
  {
    method: "POST",
    path: "/api/ai/clarify",
    auth: "Session",
    summary: "Refine vague prompts and request clarification when needed.",
  },
  {
    method: "POST",
    path: "/api/ai/ideas",
    auth: "Session",
    summary: "Generate thumbnail directions for the Idea Assistant.",
  },
  {
    method: "POST",
    path: "/api/ai/ctr-score",
    auth: "Session",
    summary: "Return a paid-plan AI CTR estimate and factor breakdown for a thumbnail.",
  },
  {
    method: "POST",
    path: "/api/ai/optimization-pack",
    auth: "Session",
    summary: "Generate and save three paid-plan title and thumbnail variants for Growth Lab.",
  },
  {
    method: "POST",
    path: "/api/ai/face-optimize",
    auth: "Session",
    summary: "Create a paid-plan smart face optimization variant without debiting credits.",
  },
  {
    method: "POST",
    path: "/api/ai/viral-pattern",
    auth: "Session",
    summary: "Apply a paid-plan viral layout archetype and save the variant to Growth Lab.",
  },
  {
    method: "GET",
    path: "/api/billing/me",
    auth: "Session",
    summary: "Return the current plan, credit balance, and membership state.",
  },
  {
    method: "GET",
    path: "/api/billing/usage",
    auth: "Session",
    summary: "Return credit usage history and period rollups.",
  },
  {
    method: "POST",
    path: "/api/billing/checkout",
    auth: "Session",
    summary: "Create a checkout session for plan upgrades and top-ups.",
  },
  {
    method: "GET",
    path: "/api/account/export",
    auth: "Session",
    summary: "Export account metadata, billing, assets, drafts, and generations.",
  },
  {
    method: "DELETE",
    path: "/api/account/delete",
    auth: "Session",
    summary: "Delete the authenticated account and related app data.",
  },
];

const codeExample = `curl -X POST https://www.thumoraai.com/api/ai/generate \\
  -H "Authorization: Bearer SUPABASE_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Bold YouTube thumbnail with dramatic lighting and a clean focal subject",
    "baseImage": "data:image/png;base64,..."
  }'`;

function MethodBadge({ method }: { method: EndpointCard["method"] }) {
  const tone =
    method === "GET"
      ? "bg-sky-500/12 text-sky-500"
      : method === "DELETE"
        ? "bg-red-500/12 text-red-500"
        : "bg-emerald-500/12 text-emerald-500";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${tone}`}>{method}</span>;
}

export default function ApiDocsPage() {
  const [copied, setCopied] = useState(false);

  useDocumentMetadata({
    title: "API Docs | Thumora AI",
    description:
      "Reference for the current authenticated Thumora AI app endpoints used by Studio, billing, and account workflows.",
    canonicalPath: "/api-docs",
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen overflow-hidden pb-24 pt-20" dir="ltr">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[2rem] border border-border bg-card/55 p-6 sm:p-8 lg:p-10"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">API Docs</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Current app API surface, documented as it actually exists.
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                Thumora AI does not expose a separate public developer platform with standalone API keys yet.
                This page documents the authenticated app endpoints currently used by Studio, billing, and account flows.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-background/80 p-4 sm:min-w-[260px]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Auth model</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Bearer session token</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Protected endpoints expect the Supabase access token used by the logged-in app session.
              </p>
            </div>
          </div>
        </motion.section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="space-y-6"
          >
            <section className="rounded-[2rem] border border-border bg-background/70 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Authentication</h2>
                  <p className="mt-1 text-sm text-muted-foreground">There is no separate app API key today.</p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-border bg-card/55 p-4">
                <p className="text-sm leading-7 text-muted-foreground">
                  Requests from the browser are authenticated with the same access token created during login. The
                  frontend attaches that token as a Bearer header through the shared API client.
                </p>
                <div className="mt-4 rounded-2xl bg-muted/55 p-4 font-mono text-sm text-foreground">
                  Authorization: Bearer {"<supabase-access-token>"}
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-border bg-background/70 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <Terminal className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Available Endpoints</h2>
                  <p className="mt-1 text-sm text-muted-foreground">These routes are live in the current app codebase.</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {ENDPOINTS.map((endpoint) => (
                  <article key={endpoint.path} className="rounded-[1.5rem] border border-border bg-card/50 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <MethodBadge method={endpoint.method} />
                        <code className="rounded-lg bg-background px-2.5 py-1 text-sm text-foreground">{endpoint.path}</code>
                      </div>
                      <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {endpoint.auth}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{endpoint.summary}</p>
                  </article>
                ))}
              </div>
            </section>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.14 }}
            className="space-y-6"
          >
            <section className="rounded-[2rem] border border-border bg-card/60 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <Code2 className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Example Request</h2>
              </div>

              <div className="relative mt-5">
                <pre className="overflow-x-auto rounded-[1.5rem] border border-border bg-background p-4 text-xs leading-6 text-muted-foreground">
                  {codeExample}
                </pre>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(codeExample)}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Copy code example"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-border bg-card/60 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Important Notes</h2>
              </div>

              <div className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
                <p>The AI routes are app endpoints behind auth and billing checks, not open public generation endpoints.</p>
                <p>Webhook routes and provider callbacks exist, but they are operational internals rather than developer-facing integration products.</p>
                <p>If Thumora launches a real public API later, it should get separate docs, versioning, and key management instead of reusing this app session model.</p>
              </div>
            </section>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
