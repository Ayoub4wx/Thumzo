import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { BillingProvider } from "./context/BillingContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { StudioGenerationProvider } from "./context/StudioGenerationContext";
import PublicLayout from "./components/PublicLayout";
import DashboardLayout from "./context/layouts/DashboardLayout";
import CookieConsent from "./components/CookieConsent";
import { supabase } from "./lib/supabase";

import { Analytics } from "@vercel/analytics/react";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const ChangelogPage = lazy(() => import("./pages/ChangelogPage"));
const ApiDocsPage = lazy(() => import("./pages/ApiDocsPage"));
const TutorialsPage = lazy(() => import("./pages/TutorialsPage"));
const TutorialArticlePage = lazy(() => import("./pages/TutorialArticlePage"));
const UseCasePage = lazy(() => import("./pages/UseCasePage"));
const AdminTemplatesPage = lazy(() => import("./pages/AdminTemplatesPage"));
const AdminStoragePage = lazy(() => import("./pages/AdminStoragePage"));
const TemplatesDashboard = lazy(() => import("./pages/dashboard/TemplatesDashboard"));
const AssetsDashboard = lazy(() => import("./pages/dashboard/AssetsDashboard"));
const BulkEditsDashboard = lazy(() => import("./pages/dashboard/BulkEditsDashboard"));
const SettingsDashboard = lazy(() => import("./pages/dashboard/SettingsDashboard"));
const StudioDashboard = lazy(() => import("./pages/dashboard/StudioDashboard"));
const StudioEditor = lazy(() => import("./pages/dashboard/StudioEditor"));
const DraftsDashboard = lazy(() => import("./pages/dashboard/DraftsDashboard"));
const ToolIdeasDashboard = lazy(() => import("./pages/dashboard/ToolIdeasDashboard"));
const GrowthLabDashboard = lazy(() => import("./pages/dashboard/GrowthLabDashboard"));
const SiteContentPage = lazy(() => import("./pages/SiteContentPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function isLocalHost() {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

function ScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.slice(1);
      const timeoutId = window.setTimeout(() => {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 40);

      return () => window.clearTimeout(timeoutId);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return undefined;
  }, [location.hash, location.pathname]);

  return null;
}

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="rounded-2xl border border-border bg-card/60 px-5 py-3 text-sm font-medium text-muted-foreground shadow-[0_16px_48px_rgba(0,0,0,0.06)]">
        Loading...
      </div>
    </div>
  );
}

function AuthLinkRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(location.search);
    const authType = hashParams.get("type") || searchParams.get("type");
    const isRecoveryLink = authType === "recovery" || hashParams.get("recovery") === "true" || searchParams.get("recovery") === "true";

    if (isRecoveryLink && !location.pathname.startsWith("/settings/privacy")) {
      searchParams.set("recovery", "true");
      navigate(`/settings/privacy?${searchParams.toString()}${location.hash}`, { replace: true });
      return;
    }

    if ((authType === "magiclink" || authType === "invite") && location.pathname === "/") {
      navigate(`/projects${location.search}${location.hash}`, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

function readSafeRecoveryNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/settings/privacy?recovery=true";
  }

  return value;
}

function AuthRecoveryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tokenHash = searchParams.get("token_hash");
    const next = readSafeRecoveryNext(searchParams.get("next"));

    if (!tokenHash) {
      setErrorMessage("This reset link is missing a verification token. Request a new password reset email.");
      return;
    }

    let cancelled = false;

    async function verifyRecoveryLink() {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });

      if (cancelled) {
        return;
      }

      if (error) {
        setErrorMessage(error.message || "This reset link is invalid or expired. Request a new password reset email.");
        return;
      }

      navigate(next, { replace: true });
    }

    void verifyRecoveryLink();

    return () => {
      cancelled = true;
    };
  }, [location.search, navigate]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-14rem)] max-w-xl items-center justify-center px-4 py-16">
      <div className="w-full rounded-[2rem] border border-border bg-background p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.06)] sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Resetting your password</h1>
        {errorMessage ? (
          <>
            <p className="mt-4 text-sm leading-6 text-red-500">{errorMessage}</p>
            <a href="/login" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background">
              Back to login
            </a>
          </>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Checking your reset link...</p>
        )}
      </div>
    </div>
  );
}

function PublicPage() {
  return (
    <PublicLayout>
      <SiteContentPage />
    </PublicLayout>
  );
}

function LandingPublicPage() {
  return (
    <PublicLayout>
      <LandingPage />
    </PublicLayout>
  );
}

function PricingPublicPage() {
  return (
    <PublicLayout>
      <PricingPage />
    </PublicLayout>
  );
}

function AboutPublicPage() {
  return (
    <PublicLayout>
      <AboutPage />
    </PublicLayout>
  );
}

function ContactPublicPage() {
  return (
    <PublicLayout>
      <ContactPage />
    </PublicLayout>
  );
}

function FaqPublicPage() {
  return (
    <PublicLayout>
      <FaqPage />
    </PublicLayout>
  );
}

function ChangelogPublicPage() {
  return (
    <PublicLayout>
      <ChangelogPage />
    </PublicLayout>
  );
}

function ApiDocsPublicPage() {
  return (
    <PublicLayout>
      <ApiDocsPage />
    </PublicLayout>
  );
}

function TutorialsPublicPage() {
  return (
    <PublicLayout>
      <TutorialsPage />
    </PublicLayout>
  );
}

function TutorialArticlePublicPage({ slug }: { slug: string }) {
  return (
    <PublicLayout>
      <TutorialArticlePage slug={slug} />
    </PublicLayout>
  );
}

function UseCasePublicPage({ slug }: { slug: string }) {
  return (
    <PublicLayout>
      <UseCasePage slug={slug} />
    </PublicLayout>
  );
}

function AuthPublicPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <PublicLayout>
      <AuthPage mode={mode} />
    </PublicLayout>
  );
}

function AuthRecoveryPublicPage() {
  return (
    <PublicLayout>
      <AuthRecoveryPage />
    </PublicLayout>
  );
}

function PublicNotFoundPage() {
  return (
    <PublicLayout>
      <NotFoundPage />
    </PublicLayout>
  );
}

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();

  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

function LocaleRedirect({ locale }: { locale: "ar" | "en" }) {
  const location = useLocation();
  const prefix = `/${locale}`;
  const pathWithoutLocale = location.pathname.slice(prefix.length) || "/";

  return <Navigate to={`${pathWithoutLocale}${location.search}${location.hash}`} replace />;
}

export default function App() {
  const localAdminEnabled = isLocalHost();

  return (
    <ThemeProvider>
      <AuthProvider>
        <BillingProvider>
          <ToastProvider>
            <StudioGenerationProvider>
              <Router>
              <ScrollToHash />
              <AuthLinkRedirect />
              <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                  <Route path="/" element={<LandingPublicPage />} />
                  <Route path="/ar/*" element={<LocaleRedirect locale="ar" />} />
                  <Route path="/en/*" element={<LocaleRedirect locale="en" />} />
                  <Route path="/pricing" element={<PricingPublicPage />} />
                  <Route path="/about" element={<AboutPublicPage />} />
                  <Route path="/contact" element={<ContactPublicPage />} />
                  <Route path="/faq" element={<FaqPublicPage />} />
                  <Route path="/changelog" element={<ChangelogPublicPage />} />
                  <Route path="/api-docs" element={<ApiDocsPublicPage />} />
                  <Route path="/tutorials" element={<TutorialsPublicPage />} />
                  <Route path="/tutorials/insert-me-thumbnail" element={<TutorialArticlePublicPage slug="insert-me-thumbnail" />} />
                  <Route path="/tutorials/youtube-url-thumbnail-import" element={<TutorialArticlePublicPage slug="youtube-url-thumbnail-import" />} />
                  <Route path="/youtube-thumbnail-maker" element={<UseCasePublicPage slug="youtube-thumbnail-maker" />} />
                  <Route path="/ai-thumbnail-remaker" element={<UseCasePublicPage slug="ai-thumbnail-remaker" />} />
                  <Route path="/thumbnail-ideas-for-youtube" element={<UseCasePublicPage slug="thumbnail-ideas-for-youtube" />} />
                  <Route path="/thumbnail-maker-from-youtube-url" element={<UseCasePublicPage slug="thumbnail-maker-from-youtube-url" />} />
                  <Route path="/terms-of-service" element={<PublicPage />} />
                  <Route path="/privacy-policy" element={<PublicPage />} />
                  <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />

                  <Route path="/login" element={<AuthPublicPage mode="login" />} />
                  <Route path="/signup" element={<AuthPublicPage mode="signup" />} />
                  <Route path="/auth/recovery" element={<AuthRecoveryPublicPage />} />

                  <Route path="/projects" element={<DashboardLayout><StudioDashboard /></DashboardLayout>} />
                  <Route path="/drafts" element={<DashboardLayout><DraftsDashboard /></DashboardLayout>} />
                  <Route path="/create" element={<DashboardLayout><StudioEditor forceStartScreen /></DashboardLayout>} />
                  <Route path="/studio" element={<DashboardLayout><StudioEditor /></DashboardLayout>} />
                  <Route path="/cdo" element={<RedirectWithSearch to="/studio" />} />
                  <Route path="/projects/editor" element={<RedirectWithSearch to="/studio" />} />
                  <Route path="/studio/editor" element={<RedirectWithSearch to="/studio" />} />
                  <Route path="/templates" element={<DashboardLayout><TemplatesDashboard /></DashboardLayout>} />
                  <Route path="/tools" element={<DashboardLayout><BulkEditsDashboard /></DashboardLayout>} />
                  <Route path="/tools/ideas" element={<DashboardLayout><ToolIdeasDashboard /></DashboardLayout>} />
                  <Route path="/tools/growth" element={<DashboardLayout><GrowthLabDashboard /></DashboardLayout>} />
                  <Route path="/assets" element={<DashboardLayout><AssetsDashboard /></DashboardLayout>} />
                  <Route path="/settings" element={<Navigate to="/settings/billing" replace />} />
                  <Route path="/settings/billing" element={<DashboardLayout><SettingsDashboard /></DashboardLayout>} />
                  <Route path="/settings/usage" element={<DashboardLayout><SettingsDashboard /></DashboardLayout>} />
                  <Route path="/settings/privacy" element={<DashboardLayout><SettingsDashboard /></DashboardLayout>} />
                  <Route path="/settings/integrations" element={<DashboardLayout><SettingsDashboard /></DashboardLayout>} />
                  <Route path="/settings/*" element={<Navigate to="/settings/billing" replace />} />

                  <Route path="/bulk-edits" element={<Navigate to="/tools" replace />} />
                  <Route path="/docs" element={<Navigate to="/templates" replace />} />
                  <Route path="/admin/templates" element={localAdminEnabled ? <AdminTemplatesPage /> : <Navigate to="/" replace />} />
                  <Route path="/admin/storage" element={localAdminEnabled ? <AdminStoragePage /> : <Navigate to="/" replace />} />

                  <Route path="*" element={<PublicNotFoundPage />} />
                  </Routes>
                </Suspense>
                <CookieConsent />
                <Analytics />
              </div>
              </Router>
            </StudioGenerationProvider>
          </ToastProvider>
        </BillingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
