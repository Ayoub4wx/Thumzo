import type { BillingPlanKey } from "../lib/billingPlans.js";

export interface BillingSnapshot {
  planKey: BillingPlanKey;
  planName: string;
  creditsRemaining: number;
  includedMonthlyCredits: number;
  lowCredit: boolean;
  canGenerate: boolean;
  manageUrl: string | null;
  membershipStatus: string | null;
  renewalPeriodEnd: string | null;
}

export interface BillingCheckoutSession {
  checkoutUrl: string;
  planId: string;
  returnUrl: string;
  sessionId: string;
}

export interface YoutubeChannelSummary {
  id: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
}

export interface YoutubeIntegrationAccountSummary {
  googleAccountId: string | null;
  googleAccountEmail: string | null;
}

export interface YoutubeIntegrationStatus {
  configured: boolean;
  connected: boolean;
  account: YoutubeIntegrationAccountSummary | null;
  selectedChannel: YoutubeChannelSummary | null;
  availableChannels: YoutubeChannelSummary[];
  scopes: string[];
}

export interface YoutubeVideoSummary {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface YoutubeVideosResponse {
  configured: boolean;
  connected: boolean;
  query: string;
  selectedChannel: YoutubeChannelSummary | null;
  videos: YoutubeVideoSummary[];
  nextPageToken: string | null;
  prevPageToken: string | null;
}

export interface ThumbnailIdea {
  label: string;
  hook: string;
  titleAngle: string;
  visualDirection: string;
  prompt: string;
}

export interface ThumbnailIdeasResponse {
  summary: string;
  recommendedCategory: string;
  ideas: ThumbnailIdea[];
}

export type GrowthPatternKey = "high_stakes_challenge" | "ai_authority" | "finance_signal";

export interface CtrFactorScore {
  key: string;
  label: string;
  score: number;
  detail: string;
}

export interface CtrEstimate {
  score: number;
  performanceLabel: string;
  factors: CtrFactorScore[];
  recommendations: string[];
  analysis: Record<string, unknown>;
}

export interface GrowthMockMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  watchTimeLift: number;
}

export interface GrowthVariant {
  id?: string;
  experimentId?: string;
  title: string;
  prompt: string;
  imageUrl: string;
  ctrEstimate: CtrEstimate;
  mockMetrics: GrowthMockMetrics;
  metricsSource: "mock" | "youtube";
  externalVideoId: string | null;
  patternKey: GrowthPatternKey | null;
  status: "draft" | "active" | "winner" | "archived";
  createdAt?: string;
}

export interface GrowthExperiment {
  id: string;
  title: string;
  sourceTitle: string;
  sourceImageUrl: string | null;
  experimentType: "optimization_pack" | "face_optimize" | "viral_pattern";
  status: "draft" | "active" | "completed" | "archived";
  metricsSource: "mock" | "youtube";
  externalVideoId: string | null;
  analysis: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  variants: GrowthVariant[];
}

export interface OptimizationPackResponse {
  experiment: GrowthExperiment;
}

export interface AccountExportPayload {
  exportedAt: string;
  profile: Record<string, unknown> | null;
  billingSnapshot: BillingSnapshot | null;
  billingMemberships: Record<string, unknown>[];
  creditLedger: Record<string, unknown>[];
  assets: Record<string, unknown>[];
  generations: Record<string, unknown>[];
  drafts: Record<string, unknown>[];
  youtubeIntegration: {
    connected: boolean;
    googleAccountId: string | null;
    googleAccountEmail: string | null;
    scopes: string[];
    selectedChannel: YoutubeChannelSummary | null;
    updatedAt: string | null;
  } | null;
}
