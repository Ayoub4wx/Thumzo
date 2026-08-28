import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useBilling } from "../context/BillingContext";
import { isPaidPlan, publicPricingPlans, type BillingPlanDefinition } from "../lib/billingPlans";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

type PricingSectionProps = {
  showHeader?: boolean;
  compactHeader?: boolean;
};

export function PricingSection({ showHeader = true, compactHeader = false }: PricingSectionProps) {
  const { user } = useAuth();
  const { billing, checkoutPending, startCheckout } = useBilling();
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const checkoutStatus = searchParams.get("status");

  return (
    <>
      {showHeader ? (
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-4 py-1 text-sm font-semibold text-accent">
            Credits are enforced inside the studio
          </span>
          <h1
            className={`mt-6 font-bold tracking-tight text-foreground ${compactHeader ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl md:text-6xl"}`}
          >
            Pricing
          </h1>
          <p
            className={`mt-4 leading-relaxed text-muted-foreground ${compactHeader ? "text-base sm:text-lg" : "text-lg sm:text-xl"}`}
          >
            Start with Hobby, then move to a paid plan when thumbnail generation becomes a weekly workflow.
          </p>
          {user && billing ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Current plan: <span className="font-semibold text-foreground">{billing.planName}</span> with{" "}
              <span className="font-semibold text-foreground">{billing.creditsRemaining}</span> credits remaining.
            </p>
          ) : null}
          {checkoutStatus === "success" ? (
            <p className="mt-4 text-sm font-medium text-emerald-600">
              Payment completed. Your billing state is refreshing now.
            </p>
          ) : null}
          {checkoutStatus === "error" ? (
            <p className="mt-4 text-sm font-medium text-destructive">
              Payment authorization was interrupted. Open checkout again to retry.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={showHeader ? "mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4" : "grid gap-6 md:grid-cols-2 xl:grid-cols-4"}>
        {publicPricingPlans.map((plan, index) => (
          <motion.article
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: index * 0.08 }}
            className={`relative overflow-hidden rounded-3xl border p-8 transition-transform duration-300 hover:-translate-y-1 ${
              plan.highlight
                ? "border-accent bg-accent/10 shadow-[0_0_40px_rgba(255,77,28,0.10)]"
                : "border-border bg-card"
            }`}
          >
            {plan.highlight ? (
              <div className="absolute right-4 top-4 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
                Most Popular
              </div>
            ) : null}

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">{plan.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>

              <div className="mt-6 flex items-end gap-3">
                <span className="text-4xl font-bold tracking-tight text-foreground">{plan.priceLabel}</span>
              </div>

              {plan.annualPrice ? <p className="mt-2 text-sm text-muted-foreground">{plan.annualPrice}</p> : null}
              <p className="mt-2 text-sm text-muted-foreground">{plan.monthlyCredits} AI credits included</p>
            </div>

            <ul className="mb-8 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-foreground">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20">
                    <Check className="h-3 w-3 text-accent" />
                  </div>
                  <span className="leading-6">{feature}</span>
                </li>
              ))}
            </ul>

            <PricingCardCta
              billingPlan={plan}
              isAuthenticated={Boolean(user)}
              isCurrentPlan={billing?.planKey === plan.key}
              isPending={checkoutPending === plan.key}
              onCheckout={() => void startCheckout(plan.key)}
            />
          </motion.article>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Need extra room between renewals? Buy a one-time top-up pack from Billing after you sign in.
      </p>
    </>
  );
}

export default function PricingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { billing } = useBilling();
  const isResolvingAuth = loading && !user && !billing;

  useEffect(() => {
    if (user && !loading) {
      navigate("/settings/billing", { replace: true });
    }
  }, [user, loading, navigate]);

  useDocumentMetadata({
    title: "AI Thumbnail Maker Pricing | Thumora AI",
    description: "Compare Hobby, Creator, Creator+, and Ultra pricing for the Thumora AI thumbnail maker and YouTube thumbnail editor.",
    canonicalPath: "/pricing",
  });

  return (
    <div className="px-4 py-20 sm:py-24" dir="ltr">
      <div className="mx-auto max-w-7xl">
        {isResolvingAuth ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {publicPricingPlans.map((plan) => (
              <div key={plan.name} className="h-[440px] rounded-3xl border border-border bg-card animate-pulse" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <PricingSection />
        )}
      </div>
    </div>
  );
}

function PricingCardCta({
  billingPlan,
  isAuthenticated,
  isCurrentPlan,
  isPending,
  onCheckout,
}: {
  billingPlan: BillingPlanDefinition;
  isAuthenticated: boolean;
  isCurrentPlan: boolean;
  isPending: boolean;
  onCheckout: () => void;
}) {
  const buttonClass = `inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-center text-sm font-bold transition-colors ${
    billingPlan.highlight
      ? "bg-accent text-white hover:bg-accent/90"
      : "bg-foreground text-background hover:opacity-90"
  }`;

  if (isCurrentPlan) {
    return (
      <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/60 px-4 py-4 text-center text-sm font-bold text-foreground">
        Current Plan
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link to="/signup" className={buttonClass}>
        {billingPlan.ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  if (!isPaidPlan(billingPlan.key)) {
    return (
      <Link to="/projects" className={buttonClass}>
        Open My Projects
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onCheckout} disabled={isPending} className={buttonClass}>
      {isPending ? "Loading checkout..." : billingPlan.ctaLabel}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}
