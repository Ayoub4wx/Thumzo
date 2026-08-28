import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  FlaskConical,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBilling } from "../../context/BillingContext";
import { isPaidPlan } from "../../lib/billingPlans";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { getUserAssetPreviewUrl } from "../../services/storageService";
import type { GrowthExperiment, GrowthPatternKey, GrowthVariant } from "../../server/types";

const patternLabels: Record<GrowthPatternKey, string> = {
  high_stakes_challenge: "High-Stakes Challenge",
  ai_authority: "AI Authority",
  finance_signal: "Finance Signal",
};

const GROWTH_SCHEMA_SETUP_MESSAGE =
  "Growth Lab database tables are not installed. Run the Growth Lab section of schema.sql in Supabase, then retry.";

type GrowthExperimentRow = {
  id: string;
  title: string;
  source_title: string;
  source_image_url: string | null;
  experiment_type: GrowthExperiment["experimentType"];
  status: GrowthExperiment["status"];
  metrics_source: GrowthExperiment["metricsSource"];
  external_video_id: string | null;
  analysis: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type GrowthVariantRow = {
  id: string;
  experiment_id: string;
  title: string;
  prompt: string;
  image_url: string;
  ctr_estimate: GrowthVariant["ctrEstimate"];
  mock_metrics: GrowthVariant["mockMetrics"];
  metrics_source: GrowthVariant["metricsSource"];
  external_video_id: string | null;
  pattern_key: GrowthPatternKey | null;
  status: GrowthVariant["status"];
  created_at: string;
};

function mapVariant(row: GrowthVariantRow, previewUrl: string): GrowthVariant {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    title: row.title,
    prompt: row.prompt,
    imageUrl: previewUrl,
    ctrEstimate: row.ctr_estimate,
    mockMetrics: row.mock_metrics,
    metricsSource: row.metrics_source || "mock",
    externalVideoId: row.external_video_id,
    patternKey: row.pattern_key,
    status: row.status || "draft",
    createdAt: row.created_at,
  };
}

function mapExperiment(row: GrowthExperimentRow, variants: GrowthVariant[]): GrowthExperiment {
  return {
    id: row.id,
    title: row.title,
    sourceTitle: row.source_title,
    sourceImageUrl: row.source_image_url,
    experimentType: row.experiment_type,
    status: row.status || "draft",
    metricsSource: row.metrics_source || "mock",
    externalVideoId: row.external_video_id,
    analysis: row.analysis || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants,
  };
}

function formatDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Recently";
  return new Date(parsed).toLocaleDateString([], { month: "short", day: "numeric" });
}

function getBestVariant(experiment: GrowthExperiment) {
  return [...experiment.variants].sort((a, b) => b.ctrEstimate.score - a.ctrEstimate.score)[0] || null;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, notation: "compact" }).format(value);
}

function formatCtr(value: number) {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function getExperimentTypeLabel(type: GrowthExperiment["experimentType"]) {
  if (type === "face_optimize") return "Face optimization";
  if (type === "viral_pattern") return "Pattern variant";
  return "Optimization pack";
}

function getAverageBestScore(experiments: GrowthExperiment[]) {
  if (experiments.length === 0) return 0;
  const total = experiments.reduce((sum, experiment) => sum + (getBestVariant(experiment)?.ctrEstimate.score ?? 0), 0);
  return Math.round(total / experiments.length);
}

function isGrowthSchemaError(error: unknown) {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message =
    typeof candidate.message === "string"
      ? candidate.message
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  const normalizedMessage = message.toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    (
      (normalizedMessage.includes("growth_experiments") || normalizedMessage.includes("growth_variants")) &&
      (
        normalizedMessage.includes("does not exist") ||
        normalizedMessage.includes("could not find") ||
        normalizedMessage.includes("schema cache")
      )
    )
  );
}

export default function GrowthLabDashboard() {
  const { user } = useAuth();
  const { billing, startCheckout } = useBilling();
  const [experiments, setExperiments] = useState<GrowthExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [updatingWinnerId, setUpdatingWinnerId] = useState<string | null>(null);
  const paid = isPaidPlan(billing?.planKey || "hobby");

  const selectedExperiment = useMemo(
    () => experiments.find((experiment) => experiment.id === selectedExperimentId) || experiments[0] || null,
    [experiments, selectedExperimentId],
  );
  const bestVariant = selectedExperiment ? getBestVariant(selectedExperiment) : null;
  const totalVariants = useMemo(
    () => experiments.reduce((count, experiment) => count + experiment.variants.length, 0),
    [experiments],
  );
  const averageBestScore = useMemo(() => getAverageBestScore(experiments), [experiments]);

  async function loadExperiments() {
    if (!user?.uid) {
      setExperiments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSchemaMissing(false);
      const { data: experimentRows, error: experimentError } = await supabase
        .from("growth_experiments")
        .select("*")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: false });

      if (experimentError) throw experimentError;

      const ids = (experimentRows || []).map((row: GrowthExperimentRow) => row.id);
      let variantRows: GrowthVariantRow[] = [];

      if (ids.length) {
        const { data, error: variantError } = await supabase
          .from("growth_variants")
          .select("*")
          .in("experiment_id", ids)
          .order("created_at", { ascending: true });

        if (variantError) throw variantError;
        variantRows = data || [];
      }

      const variantsByExperiment = new Map<string, GrowthVariant[]>();

      await Promise.all(
        variantRows.map(async (variant) => {
          const previewUrl = await getUserAssetPreviewUrl(variant.image_url, user.uid, { expiresIn: 3600 });
          const mapped = mapVariant(variant, previewUrl);
          const list = variantsByExperiment.get(variant.experiment_id) || [];
          list.push(mapped);
          variantsByExperiment.set(variant.experiment_id, list);
        }),
      );

      const mappedExperiments = (experimentRows || []).map((row: GrowthExperimentRow) =>
        mapExperiment(row, variantsByExperiment.get(row.id) || []),
      );

      setExperiments(mappedExperiments);
      setSelectedExperimentId((current) =>
        current && mappedExperiments.some((experiment) => experiment.id === current)
          ? current
          : mappedExperiments[0]?.id || null,
      );
    } catch (loadError) {
      console.error("Failed to load growth experiments", loadError);
      if (isGrowthSchemaError(loadError)) {
        setSchemaMissing(true);
        setExperiments([]);
        setSelectedExperimentId(null);
        setError(null);
      } else {
        setError(loadError instanceof Error ? loadError.message : "Failed to load Growth Lab experiments.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExperiments();
  }, [user?.uid]);

  async function markWinner(variant: GrowthVariant) {
    if (!user?.uid || !variant.id || !variant.experimentId) return;

    try {
      setUpdatingWinnerId(variant.id);
      await supabase
        .from("growth_variants")
        .update({ status: "draft" })
        .eq("experiment_id", variant.experimentId)
        .eq("user_id", user.uid);
      const { error: winnerError } = await supabase
        .from("growth_variants")
        .update({ status: "winner" })
        .eq("id", variant.id)
        .eq("user_id", user.uid);

      if (winnerError) throw winnerError;

      await supabase
        .from("growth_experiments")
        .update({ status: "completed" })
        .eq("id", variant.experimentId)
        .eq("user_id", user.uid);

      await loadExperiments();
    } catch (updateError) {
      console.error("Failed to mark winner", updateError);
      if (isGrowthSchemaError(updateError)) {
        setSchemaMissing(true);
        setError(null);
      } else {
        setError(updateError instanceof Error ? updateError.message : "Failed to update winner.");
      }
    } finally {
      setUpdatingWinnerId(null);
    }
  }

  if (!paid) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 overflow-x-hidden p-3 pb-5 sm:gap-8 sm:p-8" dir="ltr">
        <section className="rounded-[28px] bg-amber-500/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-500">Growth Lab</p>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Paid optimization workspace</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              CTR estimates, A/B variants, face optimization, and viral pattern presets are available on paid plans and do not consume generation credits.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-3">
              <button
                type="button"
                onClick={() => void startCheckout("creator")}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-black text-accent-foreground shadow-[0_14px_34px_rgba(255,77,28,0.28)] transition-transform hover:-translate-y-0.5"
              >
                Upgrade to Creator
              </button>
              <Link
                to="/pricing"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-background/75 px-5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
              >
                Compare plans
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 overflow-x-hidden px-3 py-4 pb-8 sm:px-6 sm:py-6 lg:px-8" dir="ltr">
      <section className="rounded-[30px] bg-card/55 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_70px_rgba(0,0,0,0.2)] sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Growth Lab</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Expected performance experiments
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Review saved title and thumbnail variants, compare mock metrics, and keep experiments ready for a future YouTube Analytics sync.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[560px]">
            <div className="grid grid-cols-3 gap-2">
              <HeaderStat label="Experiments" value={String(experiments.length)} />
              <HeaderStat label="Variants" value={String(totalVariants)} />
              <HeaderStat label="Avg. best" value={averageBestScore ? String(averageBestScore) : "-"} />
            </div>
            <div className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-2">
              <button
                type="button"
                onClick={() => void loadExperiments()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-background/70 px-4 text-sm font-bold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <Link
                to="/studio"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-black text-accent-foreground shadow-[0_14px_34px_rgba(255,77,28,0.28)] transition-transform hover:-translate-y-0.5"
              >
                <Sparkles className="h-4 w-4" />
                Optimize in Studio
              </Link>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-400">
          {error}
        </div>
      ) : null}

      {schemaMissing ? (
        <section className="rounded-[28px] bg-amber-500/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">Setup required</p>
            <h2 className="mt-3 text-2xl font-bold text-foreground">Growth Lab tables are missing</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {GROWTH_SCHEMA_SETUP_MESSAGE}
            </p>
            <div className="mt-5 rounded-2xl bg-background/70 p-4 font-mono text-xs leading-6 text-foreground">
              schema.sql section: growth_experiments and growth_variants
            </div>
          </div>
        </section>
      ) : loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-[30px] bg-card/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : experiments.length === 0 ? (
        <section className="rounded-[30px] bg-card/55 p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_70px_rgba(0,0,0,0.18)] sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-background/70 text-muted-foreground">
            <FlaskConical className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-foreground">No experiments yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
            Open Studio, use the Optimize drawer, and generated title or thumbnail variants will appear here with mock metrics and API-ready tracking fields.
          </p>
          <Link
            to="/studio"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-black text-accent-foreground shadow-[0_14px_34px_rgba(255,77,28,0.28)] transition-transform hover:-translate-y-0.5"
          >
            Open Studio
          </Link>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="min-h-0 rounded-[28px] bg-card/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-2 flex items-center justify-between px-3 py-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Experiments</p>
              <span className="rounded-full bg-background/75 px-2.5 py-1 text-xs font-black text-foreground">
                {experiments.length}
              </span>
            </div>
            <div className="space-y-1">
              {experiments.map((experiment) => {
                const best = getBestVariant(experiment);
                const active = selectedExperiment?.id === experiment.id;

                return (
                  <button
                    key={experiment.id}
                    type="button"
                    onClick={() => setSelectedExperimentId(experiment.id)}
                    className={cn(
                      "group w-full rounded-[20px] p-4 text-left transition-all",
                      active
                        ? "bg-background text-foreground shadow-[inset_4px_0_0_#ff4d1c,0_18px_44px_rgba(0,0,0,0.2)]"
                        : "text-muted-foreground hover:bg-background/45 hover:text-foreground",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-black leading-6">{experiment.title}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-black",
                          active ? "bg-accent text-accent-foreground" : "bg-background/70 text-foreground",
                        )}
                      >
                        {best?.ctrEstimate.score ?? 0}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                      <span>{formatDate(experiment.createdAt)} - {experiment.variants.length} variants</span>
                      <span className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground group-hover:text-foreground sm:inline">
                        {getExperimentTypeLabel(experiment.experimentType)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {selectedExperiment ? (
            <main className="space-y-5">
              <section className="rounded-[30px] bg-card/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_70px_rgba(0,0,0,0.18)] sm:p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                      <span>Experiment</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                      <span>{getExperimentTypeLabel(selectedExperiment.experimentType)}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
                      {selectedExperiment.title}
                    </h2>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      Source title: {selectedExperiment.sourceTitle}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center lg:min-w-[380px]">
                    <MetricCard icon={Target} label="Best estimate" value={`${bestVariant?.ctrEstimate.score ?? 0}`} />
                    <MetricCard icon={BarChart3} label="Metrics" value={selectedExperiment.metricsSource === "mock" ? "Mock" : "YouTube"} />
                    <MetricCard icon={FileText} label="Status" value={selectedExperiment.status} />
                  </div>
                </div>

                {selectedExperiment.metricsSource === "mock" ? (
                  <div className="mt-6 flex gap-3 rounded-2xl bg-background/55 px-4 py-3 text-xs leading-6 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      Mock metrics are stored with the same fields a future YouTube Analytics sync can replace: impressions, clicks, CTR, watch-time lift, external video ID, and metrics source.
                    </span>
                  </div>
                ) : null}
              </section>

              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {selectedExperiment.variants.map((variant) => (
                  <article
                    key={variant.id || variant.title}
                    className={cn(
                      "overflow-hidden rounded-[26px] bg-card/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_22px_58px_rgba(0,0,0,0.2)]",
                      variant.status === "winner" && "shadow-[inset_0_0_0_1px_rgba(16,185,129,0.28),0_22px_58px_rgba(0,0,0,0.2)]",
                    )}
                  >
                    <div className="relative aspect-video bg-muted">
                      <img src={variant.imageUrl} alt={variant.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      {variant.status === "winner" ? (
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(16,185,129,0.3)]">
                          <CheckCircle2 className="h-3 w-3" />
                          Winner
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-4 p-4 sm:p-5">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-base font-black leading-6 text-foreground">{variant.title}</h3>
                          <span className="rounded-2xl bg-accent px-3 py-1.5 text-sm font-black text-accent-foreground shadow-[0_12px_28px_rgba(255,77,28,0.24)]">
                            {variant.ctrEstimate.score}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                          <span className="text-emerald-400">{variant.ctrEstimate.performanceLabel}</span>
                          {variant.patternKey ? (
                            <>
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                              <span className="text-muted-foreground">{patternLabels[variant.patternKey]}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <MiniMetric label="Impr." value={formatCompactNumber(variant.mockMetrics.impressions)} />
                        <MiniMetric label="Clicks" value={formatCompactNumber(variant.mockMetrics.clicks)} />
                        <MiniMetric label="CTR" value={formatCtr(variant.mockMetrics.ctr)} />
                      </div>

                      <div className="space-y-2.5">
                        {variant.ctrEstimate.factors.slice(0, 3).map((factor) => (
                          <div key={factor.key}>
                            <div className="mb-1.5 flex justify-between text-[11px] font-bold text-muted-foreground">
                              <span>{factor.label}</span>
                              <span>{factor.score}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-background/80">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${factor.score}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => void markWinner(variant)}
                        disabled={updatingWinnerId === variant.id || variant.status === "winner"}
                        className={cn(
                          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                          variant.status === "winner"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-background/75 text-foreground hover:bg-muted",
                        )}
                      >
                        {updatingWinnerId === variant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                        {variant.status === "winner" ? "Selected winner" : "Mark winner"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </main>
          ) : null}
        </div>
      )}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-background/45 px-3 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-black text-foreground">{value}</p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-background/60 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-black capitalize text-foreground">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-background/55 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-foreground">{value}</p>
    </div>
  );
}
