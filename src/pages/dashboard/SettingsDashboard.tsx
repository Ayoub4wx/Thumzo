import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useBilling } from "../../context/BillingContext";
import { isPaidPlan, publicPricingPlans, type BillingPlanKey } from "../../lib/billingPlans";
import { apiFetch, apiFetchResponse } from "../../lib/apiClient";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import type { YoutubeChannelSummary, YoutubeIntegrationStatus } from "../../server/types";

type Tab = "billing" | "usage" | "privacy" | "integrations";
type AsyncState = "idle" | "loading" | "success" | "error";
type BannerTone = "default" | "success" | "warning" | "error";

const AI_TRAINING_STORAGE_KEY = "thumora:allow-ai-training";

function getActiveTab(pathname: string): Tab {
  if (pathname.startsWith("/settings/usage")) {
    return "usage";
  }

  if (pathname.startsWith("/settings/privacy")) {
    return "privacy";
  }

  if (pathname.startsWith("/settings/integrations")) {
    return "integrations";
  }

  return "billing";
}

function parseDownloadFileName(headerValue: string | null) {
  if (!headerValue) {
    return null;
  }

  const match = headerValue.match(/filename=\"?([^\"]+)\"?/i);
  return match?.[1] || null;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function SettingsDashboard() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { billing, loading, checkoutPending, refreshBilling, startCheckout } = useBilling();
  const activeTab = getActiveTab(location.pathname);
  const searchParams = new URLSearchParams(location.search || location.hash?.replace("#", "?"));
  const checkoutSuccess = searchParams.get("checkout") === "success" || searchParams.get("status") === "success";
  const checkoutError = searchParams.get("status") === "error";
  const needsCredits = searchParams.get("reason") === "no-credits";
  const youtubeStatusParam = searchParams.get("youtube");
  const youtubeMessageParam = searchParams.get("message");
  const isRecoveryMode = searchParams.get("recovery") === "true" || searchParams.get("type") === "recovery";

  const [allowAiTraining, setAllowAiTraining] = useState(false);
  const [exportState, setExportState] = useState<AsyncState>("idle");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [youtubeIntegration, setYoutubeIntegration] = useState<YoutubeIntegrationStatus | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeAction, setYoutubeAction] = useState<"connect" | "select-channel" | "disconnect" | null>(null);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeNotice, setYoutubeNotice] = useState<{ tone: BannerTone; message: string } | null>(null);

  // Password update state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, setPasswordState] = useState<AsyncState>("idle");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  // Usage state
  const [usageHistory, setUsageHistory] = useState<Array<{ id: string; date: string; type: string; model: string; cost: string }>>([]);
  const [dailyStats, setDailyStats] = useState<Array<{ date: string; amount: number }>>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"cycle" | "1d" | "7d" | "30d">("cycle");

  useEffect(() => {
    if (activeTab === "usage" && user) {
      void loadUsageHistory(selectedPeriod);
    }
  }, [activeTab, user, selectedPeriod]);

  async function loadUsageHistory(period: string) {
    try {
      setUsageLoading(true);
      const data = await apiFetch<{ history: any[], dailyStats: any[] }>(`/api/billing/usage?period=${period}`);
      setUsageHistory(data.history);
      setDailyStats(data.dailyStats);
    } catch (error) {
      console.error("Failed to load usage history", error);
    } finally {
      setUsageLoading(false);
    }
  }

  const dateRangeLabel = useMemo(() => {
    const now = new Date();
    const start = new Date();
    if (selectedPeriod === "1d") start.setDate(now.getDate() - 1);
    else if (selectedPeriod === "7d") start.setDate(now.getDate() - 7);
    else start.setDate(now.getDate() - 30);
    
    return `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }, [selectedPeriod]);

  useEffect(() => {
    if (isRecoveryMode) {
      setShowPasswordForm(true);
    }
  }, [isRecoveryMode]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AI_TRAINING_STORAGE_KEY);
      setAllowAiTraining(saved === "true");
    } catch (error) {
      console.error("Failed to read local AI training preference", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_TRAINING_STORAGE_KEY, String(allowAiTraining));
    } catch (error) {
      console.error("Failed to persist local AI training preference", error);
    }
  }, [allowAiTraining]);

  useEffect(() => {
    if (checkoutSuccess) {
      void refreshBilling();
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("checkout");
      newUrl.searchParams.delete("status");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [checkoutSuccess, refreshBilling]);

  useEffect(() => {
    if (activeTab !== "integrations" || !user) {
      return;
    }

    let cancelled = false;

    async function loadYoutubeIntegration() {
      try {
        setYoutubeLoading(true);
        setYoutubeError(null);
        const response = await apiFetch<YoutubeIntegrationStatus>("/api/integrations/youtube");

        if (!cancelled) {
          setYoutubeIntegration(response);
        }
      } catch (error) {
        console.error("Failed to load YouTube integration state", error);
        if (!cancelled) {
          setYoutubeError(error instanceof Error ? error.message : "Failed to load YouTube integration state.");
        }
      } finally {
        if (!cancelled) {
          setYoutubeLoading(false);
        }
      }
    }

    void loadYoutubeIntegration();

    return () => {
      cancelled = true;
    };
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== "integrations" || !youtubeStatusParam) {
      return;
    }

    if (youtubeStatusParam === "connected") {
      setYoutubeNotice({
        tone: "success",
        message: "Google account connected. Select a YouTube channel to start importing existing thumbnails into the studio.",
      });
      return;
    }

    if (youtubeStatusParam === "error") {
      setYoutubeNotice({
        tone: "error",
        message: youtubeMessageParam || "The YouTube connection could not be completed.",
      });
    }
  }, [activeTab, youtubeMessageParam, youtubeStatusParam]);

  const handleExportData = async () => {
    try {
      setExportState("loading");
      setExportMessage(null);

      const response = await apiFetchResponse("/api/account/export");
      const blob = await response.blob();
      const fileName =
        parseDownloadFileName(response.headers.get("content-disposition")) ||
        `thumora-account-export-${new Date().toISOString().slice(0, 10)}.json`;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);

      setExportState("success");
      setExportMessage("Your metadata export downloaded immediately as a JSON file.");
    } catch (error) {
      console.error("Failed to export account data", error);
      setExportState("error");
      setExportMessage(error instanceof Error ? error.message : "Failed to export your account data.");
    }
  };

  const handleExportUsageCsv = () => {
    const rows = [
      ["Date", "Type", "Model", "Cost"],
      ...usageHistory.map((row) => [
        new Date(row.date).toISOString(),
        row.type,
        row.model,
        row.cost,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = `thumora-usage-${selectedPeriod}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiFetch<{ success: boolean }>("/api/account/delete", { method: "DELETE" });
      await logout();
    } catch (error) {
      console.error("Failed to delete account:", error);
      setDeleteError(error instanceof Error ? error.message : "Failed to delete account. Please try again later.");
      setIsDeleting(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordState("error");
      setPasswordMessage("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordState("error");
      setPasswordMessage("Password must be at least 8 characters.");
      return;
    }

    try {
      setPasswordState("loading");
      setPasswordMessage(null);
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      const { error: signOutOthersError } = await supabase.auth.signOut({ scope: "others" });
      if (signOutOthersError) {
        console.error("Failed to sign out other sessions after password update", signOutOthersError);
      }

      setPasswordState("success");
      setPasswordMessage("Password updated successfully. Other active sessions were signed out.");
      setNewPassword("");
      setConfirmPassword("");

      // Clean up URL if in recovery mode
      if (isRecoveryMode) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("recovery");
        newUrl.searchParams.delete("type");
        window.history.replaceState({}, "", newUrl.toString());
      }
    } catch (error) {
      console.error("Failed to update password", error);
      setPasswordState("error");
      setPasswordMessage(error instanceof Error ? error.message : "Failed to update password.");
    }
  };

  const handleConnectYoutube = async () => {
    try {
      setYoutubeAction("connect");
      setYoutubeError(null);
      const response = await apiFetch<{ url: string }>("/api/integrations/youtube/start", {
        method: "POST",
        body: { returnPath: "/settings/integrations" },
      });

      window.location.assign(response.url);
    } catch (error) {
      console.error("Failed to start YouTube OAuth", error);
      setYoutubeAction(null);
      setYoutubeError(error instanceof Error ? error.message : "Failed to start YouTube OAuth.");
    }
  };

  const handleSelectChannel = async (channel: YoutubeChannelSummary) => {
    try {
      setYoutubeAction("select-channel");
      setYoutubeError(null);
      const response = await apiFetch<YoutubeIntegrationStatus>("/api/integrations/youtube/channel", {
        method: "POST",
        body: { channelId: channel.id },
      });

      setYoutubeIntegration(response);
      setYoutubeNotice({
        tone: "success",
        message: `Channel selected: ${channel.title}. Tools can now browse and import existing thumbnails.`,
      });
    } catch (error) {
      console.error("Failed to select channel", error);
      setYoutubeError(error instanceof Error ? error.message : "Failed to select channel.");
    } finally {
      setYoutubeAction(null);
    }
  };

  const handleDisconnectYoutube = async () => {
    try {
      setYoutubeAction("disconnect");
      setYoutubeError(null);
      await apiFetch<{ success: boolean }>("/api/integrations/youtube/disconnect", { method: "POST" });
      setYoutubeIntegration({
        configured: youtubeIntegration?.configured ?? true,
        connected: false,
        account: null,
        selectedChannel: null,
        availableChannels: [],
        scopes: [],
      });
      setYoutubeNotice({ tone: "success", message: "YouTube connection removed." });
    } catch (error) {
      console.error("Failed to disconnect YouTube", error);
      setYoutubeError(error instanceof Error ? error.message : "Failed to disconnect YouTube.");
    } finally {
      setYoutubeAction(null);
    }
  };

  const topBanner = useMemo(() => {
    if (activeTab === "billing") {
      if (checkoutSuccess) {
        return {
          tone: "success" as BannerTone,
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          title: "Checkout completed",
          body: "Billing has been refreshed. If the balance still looks stale, wait a few seconds for the provider webhook to land and refresh again.",
        };
      }

      if (checkoutError) {
        return {
          tone: "warning" as BannerTone,
          icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
          title: "Checkout needs another attempt",
          body: "The payment flow was canceled or failed on the provider side. Re-open checkout below to try again.",
        };
      }

      if (needsCredits) {
        return {
          tone: "warning" as BannerTone,
          icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
          title: "You are out of credits",
          body: "Upgrade or buy a one-time top-up pack before generating more thumbnails.",
        };
      }

      if (billing?.lowCredit && billing.canGenerate) {
        return {
          tone: "default" as BannerTone,
          icon: <Sparkles className="h-4 w-4 text-accent" />,
          title: "Low credit warning",
          body: `You have ${billing.creditsRemaining} credits left. Buying a top-up now avoids a hard stop inside the editor.`,
        };
      }
    }

    if (activeTab === "integrations" && youtubeNotice) {
      return {
        tone: youtubeNotice.tone,
        icon:
          youtubeNotice.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ),
        title: youtubeNotice.tone === "success" ? "YouTube integration updated" : "YouTube integration issue",
        body: youtubeNotice.message,
      };
    }

    return null;
  }, [activeTab, billing, checkoutError, checkoutSuccess, needsCredits, youtubeNotice]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 overflow-x-hidden p-3 pb-5 sm:gap-8 sm:p-8" dir="ltr">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Manage your account</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          Update billing, download a direct metadata export, and connect a YouTube channel for import into the studio tools workflow.
        </p>
      </div>

      <div className="no-scrollbar flex w-full max-w-full gap-1 overflow-x-auto rounded-lg bg-card/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:w-fit">
        <SettingsTabLink to="/settings/billing" active={activeTab === "billing"}>
          Billing & Plans
        </SettingsTabLink>
        <SettingsTabLink to="/settings/usage" active={activeTab === "usage"}>
          Usage
        </SettingsTabLink>
        <SettingsTabLink to="/settings/privacy" active={activeTab === "privacy"}>
          Privacy & Data
        </SettingsTabLink>
        <SettingsTabLink to="/settings/integrations" active={activeTab === "integrations"}>
          Integrations
        </SettingsTabLink>
      </div>

      {topBanner ? <Banner icon={topBanner.icon} title={topBanner.title} body={topBanner.body} tone={topBanner.tone} /> : null}

      {activeTab === "usage" ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <section className="rounded-[24px] border border-border bg-card/50 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.08)] sm:rounded-[1.75rem] sm:p-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Daily Usage</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Usage per day across your billing period</p>
                </div>
                <div className="relative">
                  <select className="appearance-none rounded-xl border border-border bg-background px-4 py-2 pr-10 text-sm font-medium text-foreground outline-none focus:border-accent">
                    <option>By Model</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                Google Flash 3.1
              </div>

              {/* Enhanced Chart Component */}
              <div className="relative h-64 w-full overflow-hidden border-b border-border/50 pt-8 pb-6">
                <div className="absolute left-0 top-6 text-[10px] font-bold text-muted-foreground/60">
                  ${Math.max(1.05, ...dailyStats.map(s => s.amount), 0).toFixed(2)}
                </div>
                <div className="absolute bottom-6 left-0 text-[10px] font-bold text-muted-foreground/60">$0</div>
                
                <div className="absolute left-[-45px] top-1/2 hidden -rotate-90 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 sm:block">
                  Cumulative Spend
                </div>

                <div className="flex h-full items-end justify-between px-8 sm:px-12">
                  {dailyStats.map((stat, i) => {
                    const maxAmount = Math.max(1.05, ...dailyStats.map(s => s.amount), 0);
                    const heightPercentage = maxAmount > 0 ? (stat.amount / maxAmount) * 100 : 0;
                    const height = stat.amount > 0 ? `${Math.max(heightPercentage, 2)}%` : "2px";
                    const color = stat.amount > 0 ? "bg-cyan-500" : "bg-muted/20";
                    
                    return (
                      <div key={stat.date} className="group relative flex h-full flex-1 flex-col justify-end items-center gap-1">
                        <div 
                          className={cn("w-[60%] max-w-[12px] rounded-t-[1px] transition-all hover:brightness-110", color)} 
                          style={{ height }} 
                        />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                          <div className="bg-popover text-popover-foreground text-[10px] font-bold px-2 py-1 rounded border border-border shadow-xl whitespace-nowrap">
                            {new Date(stat.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${stat.amount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 flex justify-between px-8 text-[10px] font-bold text-muted-foreground/50 sm:px-12">
                  <span>{dailyStats.length > 0 ? new Date(dailyStats[0].date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</span>
                  {dailyStats.length > 2 && (
                    <span>{new Date(dailyStats[Math.floor(dailyStats.length / 2)].date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  )}
                  <span>{dailyStats.length > 1 ? new Date(dailyStats[dailyStats.length-1].date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</span>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-2 text-xs font-bold text-foreground">
                    {dateRangeLabel}
                  </div>
                  <div className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-muted/30 p-0.5">
                    {["cycle", "1d", "7d", "30d"].map((label) => (
                      <button 
                        key={label}
                        onClick={() => setSelectedPeriod(label as any)}
                        className={cn(
                          "rounded-lg px-4 py-2 text-xs font-bold transition-all capitalize",
                          selectedPeriod === label ? "bg-card text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportUsageCsv}
                  disabled={usageLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              </div>

              <div className="overflow-x-auto mt-4">
                {usageLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                        <th className="pb-5 pt-2">Date</th>
                        <th className="pb-5 pt-2">Type</th>
                        <th className="pb-5 pt-2">Model</th>
                        <th className="pb-5 pt-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {usageHistory.length > 0 ? (
                        usageHistory.map((row) => (
                          <tr key={row.id} className="group hover:bg-muted/20 transition-colors">
                            <td className="py-5 font-medium text-foreground/70">
                              {new Date(row.date).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-5 text-muted-foreground/80">{row.type}</td>
                            <td className="py-5 font-mono text-[11px] text-muted-foreground/80">{row.model.toLowerCase().replace(/ /g, '-')}</td>
                            <td className="py-5 text-right font-semibold text-foreground/90">{row.cost}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-16 text-center text-muted-foreground/60 text-xs font-medium">
                            No usage history found for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "billing" ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-2xl bg-card p-8 border border-border shadow-sm">
              <div className="mb-8 flex items-start gap-3">
                <CreditCard className="mt-1.5 h-5 w-5 shrink-0 text-foreground" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Current Billing</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Manage your subscription, usage, and billing details.</p>
                </div>
              </div>


              {loading && !billing ? (
                <div className="rounded-lg bg-background/60 p-6 text-sm text-muted-foreground">
                  Loading billing state...
                </div>
              ) : billing ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                  {/* Plan Overview */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-muted/40 p-6 border border-border">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold text-foreground">{billing.planName} Plan</h3>
                        {["active", "trialing"].includes((billing.membershipStatus || "").toLowerCase()) ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted-foreground/10 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {billing.membershipStatus || "Free"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {billing.renewalPeriodEnd
                          ? `Next renewal on ${new Date(billing.renewalPeriodEnd).toLocaleDateString()}`
                          : "Plan refreshes every 30 days."}
                      </p>
                    </div>

                    {billing.manageUrl ? (
                      <a
                        href={billing.manageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        Manage plan
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    ) : (
                      <Link
                        to="/pricing"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        Manage plan
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>

                  {/* Credits & Usage */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3 whitespace-nowrap">
                        <span className="truncate">Credits Available</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-4xl font-bold tracking-tight text-foreground">{billing.creditsRemaining}</span>
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">credits</span>
                      </div>
                      <div className="mt-auto pt-6">
                        <button
                          type="button"
                          onClick={() => void startCheckout("top_up")}
                          disabled={checkoutPending === "top_up"}
                          className="inline-flex w-full h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                        >
                          {checkoutPending === "top_up" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Buy Top-up
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3 whitespace-nowrap">
                        <span className="truncate">Monthly Allowance</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-4xl font-bold tracking-tight text-foreground">{billing.includedMonthlyCredits}</span>
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">credits / mo</span>
                      </div>
                      <div className="mt-auto pt-6">
                        <Link
                          to="/pricing"
                          className="inline-flex w-full h-10 items-center justify-center rounded-lg bg-muted/60 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted whitespace-nowrap"
                        >
                          Compare Plans
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="flex items-center gap-3 rounded-xl bg-background border border-border p-4 text-sm text-muted-foreground">
                     <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Lock className="h-4 w-4" />
                     </span>
                     <div>
                       <span className="block font-medium text-foreground">Account Email</span>
                       {user?.email || "Signed-in account"}
                     </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-background/60 p-6 text-sm text-muted-foreground">
                  Billing is unavailable right now. Refresh the page or check your environment configuration.
                </div>
              )}
            </section>

              <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">Upgrade path</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose a plan that fits your creative workflow.
                </p>
              </div>


              <div className="mt-6 space-y-4">
                {publicPricingPlans.filter((plan) => isPaidPlan(plan.key)).map((plan) => {
                  const isCurrent = billing?.planKey === plan.key;
                  const isPending = checkoutPending === plan.key;

                  // Define a hierarchy of plans to determine if a user is "higher"
                  const planHierarchy: Record<BillingPlanKey, number> = {
                    hobby: 0,
                    creator: 1,
                    creator_plus: 2,
                    ultra: 3,
                    top_up: 4,
                  };
                  const currentPlanLevel = billing?.planKey ? planHierarchy[billing.planKey as BillingPlanKey] || 0 : 0;
                  const planLevel = planHierarchy[plan.key] || 0;
                  const isIncludedInCurrent = currentPlanLevel > planLevel;

                  return (
                    <div
                      key={plan.key}
                      className={cn(
                        "rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/50",
                        isCurrent && "border-primary bg-primary/5 ring-1 ring-primary/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xl font-bold text-foreground">{plan.name}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-foreground">{plan.priceLabel}</p>
                          <p className="text-xs text-muted-foreground mt-1">{plan.monthlyCredits} credits / mo</p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
                        {isCurrent ? (
                          <div className="inline-flex h-11 items-center justify-center rounded-xl bg-primary/20 px-6 text-sm font-semibold text-primary w-full sm:w-auto">
                            Current plan
                          </div>
                        ) : isIncludedInCurrent ? (
                          <div className="inline-flex h-11 items-center justify-center rounded-xl bg-muted px-6 text-sm font-semibold text-muted-foreground w-full sm:w-auto">
                            Included in your plan
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void startCheckout(plan.key)}
                            disabled={isPending}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 w-full sm:w-auto"
                          >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {isPending ? "Loading..." : `Select ${plan.name}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === "privacy" ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <section className="rounded-[1.75rem] border border-border bg-card/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-muted p-3 text-foreground">
                <Shield className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">AI training preference</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Uploaded images and generated thumbnails stay private by default. This toggle is currently stored locally on this device only and does not change server-side retention rules.
                </p>
                <div className="mt-6">
                  <label className="flex cursor-pointer items-center gap-3">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={allowAiTraining}
                        onChange={(event) => setAllowAiTraining(event.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-muted peer-checked:bg-foreground peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-['']" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      Keep this local preference enabled for future model-training controls
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border bg-card/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-muted p-3 text-foreground">
                <Lock className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">Update Password</h2>
                  <button
                    onClick={() => setShowPasswordForm(!showPasswordForm)}
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    {showPasswordForm ? "Cancel" : "Change password"}
                  </button>
                </div>
                
                {showPasswordForm ? (
                  <form onSubmit={handleUpdatePassword} className="mt-6 max-w-md space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="new-password" className="text-sm font-medium text-foreground">New Password</label>
                      <div className="relative">
                        <input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 pr-11 text-sm outline-none focus:border-accent"
                          minLength={8}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((current) => !current)}
                          aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                          aria-pressed={showNewPassword}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">Confirm New Password</label>
                      <div className="relative">
                        <input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 pr-11 text-sm outline-none focus:border-accent"
                          minLength={8}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                          aria-pressed={showConfirmPassword}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={passwordState === "loading"}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {passwordState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Update Password
                    </button>
                    {passwordMessage && (
                      <p className={`text-sm ${passwordState === "error" ? "text-red-500" : "text-emerald-500"}`}>
                        {passwordMessage}
                      </p>
                    )}
                  </form>
                ) : (
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Set a new secure password for your account. If you signed in with Google, you can still set a password to enable email login.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border bg-card/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-muted p-3 text-foreground">
                <Download className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">Export your data</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Download a direct JSON export of your account metadata, billing memberships, credit ledger, assets, generations, drafts, and YouTube connection summary. Binary files and OAuth tokens are excluded.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => void handleExportData()}
                    disabled={exportState === "loading"}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {exportState === "loading" ? "Preparing export..." : "Download JSON export"}
                  </button>
                </div>
                {exportMessage ? (
                  <p
                    className={`mt-4 text-sm ${
                      exportState === "error" ? "text-red-500" : exportState === "success" ? "text-emerald-500" : "text-muted-foreground"
                    }`}
                  >
                    {exportMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-12 rounded-[1.75rem] border border-red-500/20 bg-red-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-500/10 p-3 text-red-600 dark:text-red-500">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-600 dark:text-red-500">Danger Zone: Delete Account</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Permanently delete your account, generated assets, and all associated data. This action is <strong>irreversible</strong>. Any active subscriptions will be canceled.
                </p>

                <div className="mt-6 max-w-md space-y-4">
                  <div>
                    <label htmlFor="delete-confirm" className="mb-2 block text-sm font-medium text-foreground">
                      Type <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-red-500">DELETE</span> to confirm
                    </label>
                    <input
                      id="delete-confirm"
                      type="text"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      placeholder="DELETE"
                      className="h-11 w-full rounded-xl border border-red-500/30 bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <button
                    onClick={() => void handleDeleteAccount()}
                    disabled={deleteConfirmation !== "DELETE" || isDeleting}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition-opacity hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {isDeleting ? "Deleting..." : "Permanently Delete Account"}
                  </button>

                  {deleteError ? <p className="text-sm text-red-500">{deleteError}</p> : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "integrations" ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <section className="rounded-[1.75rem] border border-border bg-card/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-muted p-3 text-foreground">
                <Youtube className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-foreground">YouTube import</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Connect a Google account, choose one YouTube channel, browse its existing videos, and import current thumbnails into Studio. This utility is read-only: no publish-back, no campaigns, and no CTR reporting.
                </p>
              </div>
            </div>
          </section>

          {youtubeLoading && !youtubeIntegration ? (
            <section className="rounded-[1.75rem] border border-border bg-card/50 p-6 text-sm text-muted-foreground">
              Loading YouTube integration state...
            </section>
          ) : null}

          {youtubeError ? (
            <Banner
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              title="Could not load YouTube integration"
              body={youtubeError}
              tone="error"
            />
          ) : null}

          {youtubeIntegration && !youtubeIntegration.configured ? (
            <section className="rounded-[1.75rem] border border-amber-500/20 bg-amber-500/5 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-500">
                  <Settings className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-foreground">YouTube OAuth is not configured</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Add `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_STATE_SECRET`, and a valid `APP_URL` on the server before enabling channel imports.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleConnectYoutube()}
                    disabled={youtubeAction === "connect"}
                    className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-5 text-sm font-semibold text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
                  >
                    {youtubeAction === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
                    Try Connecting Anyway
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {youtubeIntegration?.configured && !youtubeIntegration.connected ? (
            <section className="rounded-[1.75rem] border border-border bg-card/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-bold text-foreground">Connect a Google account</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    After connection, you will explicitly choose the channel to browse. Imported thumbnails stay in the editor until you save or generate a new asset.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleConnectYoutube()}
                  disabled={youtubeAction === "connect"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {youtubeAction === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
                  Connect YouTube
                </button>
              </div>
            </section>
          ) : null}

          {youtubeIntegration?.connected && !youtubeIntegration.selectedChannel ? (
            <section className="rounded-[1.75rem] border border-border bg-card/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Select a channel</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connected as {youtubeIntegration.account?.googleAccountEmail || "Google account"}. Choose the YouTube channel you want the tools page to read from.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDisconnectYoutube()}
                  disabled={youtubeAction === "disconnect"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {youtubeAction === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Disconnect
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {youtubeIntegration.availableChannels.length > 0 ? (
                  youtubeIntegration.availableChannels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => void handleSelectChannel(channel)}
                      disabled={youtubeAction === "select-channel"}
                      className="flex items-center gap-4 rounded-3xl border border-border bg-background/70 p-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {channel.thumbnailUrl ? (
                        <img src={channel.thumbnailUrl} alt={channel.title} className="h-14 w-14 rounded-full border border-border object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
                          <Youtube className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{channel.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{channel.handle || channel.id}</p>
                      </div>
                      {youtubeAction === "select-channel" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </button>
                  ))
                ) : (
                  <div className="rounded-3xl border border-border bg-background/70 p-5 text-sm text-muted-foreground">
                    No YouTube channels were returned for this Google account. Connect another account or confirm that the account owns at least one channel.
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {youtubeIntegration?.connected && youtubeIntegration.selectedChannel ? (
            <section className="rounded-[1.75rem] border border-border bg-card/50 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  {youtubeIntegration.selectedChannel.thumbnailUrl ? (
                    <img
                      src={youtubeIntegration.selectedChannel.thumbnailUrl}
                      alt={youtubeIntegration.selectedChannel.title}
                      className="h-16 w-16 rounded-full border border-border object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-muted">
                      <Youtube className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Connected Channel</p>
                    <h2 className="mt-2 text-xl font-bold text-foreground">{youtubeIntegration.selectedChannel.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {youtubeIntegration.selectedChannel.handle || youtubeIntegration.selectedChannel.id}
                      {youtubeIntegration.account?.googleAccountEmail ? ` • ${youtubeIntegration.account.googleAccountEmail}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/tools"
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    Open Tools
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDisconnectYoutube()}
                    disabled={youtubeAction === "disconnect"}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {youtubeAction === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Disconnect
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-border bg-background/70 p-5 text-sm text-muted-foreground">
                The tools page will list the selected channel’s videos and let you import the current thumbnail into the studio editor. This does not publish changes back to YouTube.
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SettingsTabLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-[0_1px_8px_rgba(0,0,0,0.12)]"
          : "text-muted-foreground hover:bg-background/45 hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

// InfoCard removed as part of redesign

function Banner({
  icon,
  title,
  body,
  tone = "default",
}: {
  icon: ReactNode;
  title: string;
  body: string;
  tone?: BannerTone;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/5"
      : tone === "warning" || tone === "error"
        ? "border-amber-500/20 bg-amber-500/5"
        : "border-border bg-card/70";

  return (
    <div className={`flex items-start gap-3 rounded-3xl px-5 py-4 ${toneClass}`}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
