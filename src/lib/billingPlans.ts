export type BillingPlanKey = "hobby" | "creator" | "creator_plus" | "ultra" | "top_up";

export interface BillingPlanDefinition {
  key: BillingPlanKey;
  name: string;
  description: string;
  priceLabel: string;
  previousPrice?: string;
  annualPrice?: string;
  highlight?: boolean;
  monthlyCredits: number;
  ctaLabel: string;
  features: string[];
  kind: "free" | "subscription" | "top_up";
}

export const HOBBY_MONTHLY_CREDITS = 3;

export const billingPlans: Record<BillingPlanKey, BillingPlanDefinition> = {
  hobby: {
    key: "hobby",
    name: "Hobby",
    description: "For creators testing the studio before they commit to a paid workflow.",
    priceLabel: "Free",
    monthlyCredits: HOBBY_MONTHLY_CREDITS,
    ctaLabel: "Start Free",
    kind: "free",
    features: [
      "3 AI credits every 30 days",
      "Studio editor access",
      "Templates and asset library",
      "No credit card required",
    ],
  },
  creator: {
    key: "creator",
    name: "Creator",
    description: "For weekly creators who want a reliable thumbnail workflow.",
    priceLabel: "$10/mo",
    highlight: true,
    monthlyCredits: 20,
    annualPrice: "Annual billing available in Whop",
    ctaLabel: "Get Creator",
    kind: "subscription",
    features: [
      "20 AI credits every month",
      "Fast editing and generation",
      "Priority access to new studio improvements",
      "Top up credits any time",
    ],
  },
  creator_plus: {
    key: "creator_plus",
    name: "Creator+",
    description: "For power users who need more room to iterate and publish.",
    priceLabel: "$30/mo",
    monthlyCredits: 60,
    ctaLabel: "Get Creator+",
    kind: "subscription",
    features: [
      "60 AI credits every month",
      "More room for weekly iteration",
      "Priority support queue",
      "Top up credits any time",
    ],
  },
  ultra: {
    key: "ultra",
    name: "Ultra",
    description: "For agencies and creators shipping thumbnails every day.",
    priceLabel: "$100/mo",
    monthlyCredits: 400,
    ctaLabel: "Get Ultra",
    kind: "subscription",
    features: [
      "400 AI credits every month",
      "Built for high-volume workflows",
      "Fastest path for teams and agencies",
      "Top up credits any time",
    ],
  },
  top_up: {
    key: "top_up",
    name: "Top-Up Pack",
    description: "Extra credits for paid users who need more room before renewal.",
    priceLabel: "$15",
    monthlyCredits: 25,
    ctaLabel: "Buy Top-Up",
    kind: "top_up",
    features: [
      "25 one-time AI credits",
      "Keeps your workflow moving",
      "Credits do not auto-renew",
      "Available from billing settings",
    ],
  },
};

export const publicPricingPlans: BillingPlanDefinition[] = [
  billingPlans.hobby,
  billingPlans.creator,
  billingPlans.creator_plus,
  billingPlans.ultra,
];

export function getPlanDefinition(planKey: BillingPlanKey | string | null | undefined) {
  if (!planKey) {
    return billingPlans.hobby;
  }

  return billingPlans[planKey as BillingPlanKey] ?? billingPlans.hobby;
}

export function isPaidPlan(planKey: BillingPlanKey | string | null | undefined) {
  const plan = getPlanDefinition(planKey);
  return plan.kind === "subscription";
}
