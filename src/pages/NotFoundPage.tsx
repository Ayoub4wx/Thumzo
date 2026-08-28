import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

export default function NotFoundPage() {
  useDocumentMetadata({
    title: "404 - Page Not Found - Thumora AI",
    description: "This page doesn't exist, but your next thumbnail still can.",
    canonicalPath: "/404",
    robots: "noindex,nofollow",
  });

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          404
        </div>
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Page not found
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Leet wandered off the trail.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            This page doesn&apos;t exist, but your next viral thumbnail does. Let&apos;s get you back to creating.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Back to home
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Start creating free
          </Link>
        </div>
      </div>

      <div className="w-full max-w-md rounded-[2rem] border border-border bg-card/40 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Tip
          </p>
          <h2 className="text-2xl font-bold text-foreground">Check the URL or try our homepage.</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            If you followed an old or incomplete link, head back home or jump into the studio to keep working.
          </p>
        </div>
      </div>
    </div>
  );
}
