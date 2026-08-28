import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.92h5.45c-.24 1.26-.96 2.33-2.05 3.04l3.32 2.57c1.94-1.78 3.05-4.41 3.05-7.53 0-.72-.07-1.41-.19-2.08H12Z"
      />
      <path
        fill="#4285F4"
        d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.32-2.57c-.92.62-2.1.99-3.45.99-2.65 0-4.89-1.79-5.69-4.19l-3.44 2.65A10.22 10.22 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.31 13.76a6.12 6.12 0 0 1 0-3.52L2.87 7.59a10.22 10.22 0 0 0 0 8.82l3.44-2.65Z"
      />
      <path
        fill="#34A853"
        d="M12 6.05c1.5 0 2.85.52 3.91 1.55l2.93-2.93C17.07 2.94 14.76 2 12 2a10.22 10.22 0 0 0-9.13 5.59l3.44 2.65C7.11 7.84 9.35 6.05 12 6.05Z"
      />
    </svg>
  );
}

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const {
    user,
    loading,
    login,
    loginWithPassword,
    signupWithPassword,
    resetPassword,
    sendMagicLink,
    initializeOnboarding,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [wantsMarketingEmails, setWantsMarketingEmails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLogin = mode === "login";
  const title = isLogin ? "Log In | Thumora AI: AI Thumbnail Editor" : "Sign Up Free | Thumora AI: AI Thumbnail Editor";
  const heading = isLogin ? "Sign In" : "Sign Up";
  const subheading = isLogin
    ? "Enter your email and password to sign in."
    : "Enter your email and password to create your account.";
  const submitLabel = isLogin ? "Sign in" : "Sign up";
  const switchLabel = isLogin ? "Don't have an account?" : "Already have an account?";
  const switchCta = isLogin ? "Sign up" : "Sign in";
  const googleLabel = isLogin ? "Sign in with Google" : "Sign up with Google";
  const magicLinkLabel = isLogin ? "Sign in with a magic link instead" : "Sign up with a magic link instead";

  useDocumentMetadata({
    title,
    description: subheading,
    canonicalPath: isLogin ? "/login" : "/signup",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    if (!loading && user) {
      navigate("/projects", { replace: true });
    }
  }, [loading, navigate, user]);

  const clearMessages = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;
    
    if (!isLogin && !agreedToTerms) {
      setErrorMessage("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    clearMessages();
    setIsGoogleLoading(true);
    
    try {
      await login(wantsMarketingEmails);
    } catch (error) {
      console.error("Google login interaction failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Google sign-in could not be completed.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!isLogin && !agreedToTerms) {
      setErrorMessage("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    clearMessages();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        await loginWithPassword(email, password);
      } else {
        const result = await signupWithPassword(email, password, wantsMarketingEmails, agreedToTerms);

        if (result.requiresEmailConfirmation) {
          setStatusMessage(
            result.emailAction === "sign_in"
              ? "We found an existing or pending account and sent a secure continue link. Check your inbox and spam folder."
              : "Confirmation email sent. Check your inbox and spam folder, then come back and sign in."
          );
        } else {
          await initializeOnboarding(wantsMarketingEmails, "password");
          setStatusMessage("Account created. Redirecting to My Projects.");
        }
      }
    } catch (error) {
      console.error("Password auth failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async () => {
    if (isSendingMagicLink) return;
    
    if (!isLogin && !agreedToTerms) {
      setErrorMessage("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    clearMessages();
    setIsSendingMagicLink(true);

    try {
      await sendMagicLink(email, {
        mode,
        marketingConsent: wantsMarketingEmails,
        acceptedTerms: agreedToTerms,
      });
      setStatusMessage(
        isLogin
          ? "Magic link sent. Check your inbox and spam folder."
          : "Signup link sent. Check your inbox and spam folder."
      );
    } catch (error) {
      console.error("Magic link failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Could not send magic link.");
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handleForgotPassword = async () => {
    if (isResettingPassword) return;

    clearMessages();
    setIsResettingPassword(true);

    try {
      await resetPassword(email);
      setStatusMessage("Password reset email sent. Check your inbox and spam folder.");
    } catch (error) {
      console.error("Password reset failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Could not send a password reset email.");
    } finally {
      setIsResettingPassword(false);
    }
  };


  return (
    <div className="mx-auto flex min-h-[calc(100vh-14rem)] max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-[460px]">
        <div className="rounded-[2rem] border border-border bg-background p-6 shadow-[0_24px_70px_rgba(0,0,0,0.06)] sm:p-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{heading}</h1>
            <p className="text-base leading-7 text-muted-foreground">{subheading}</p>
          </div>

          <div className="mt-8 space-y-6">
            <button
              onClick={() => void handleGoogleLogin()}
              disabled={loading || isGoogleLoading}
              className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              {googleLabel}
            </button>

            <div className="h-px bg-border" />

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor={`${mode}-email`} className="text-sm font-medium text-foreground">
                  Email address
                </label>
                <input
                  id={`${mode}-email`}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Your email address"
                  className="h-13 w-full rounded-2xl border border-border bg-background px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor={`${mode}-password`} className="text-sm font-medium text-foreground">
                  {isLogin ? "Your Password" : "Create a password"}
                </label>
                <div className="relative">
                  <input
                    id={`${mode}-password`}
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isLogin ? "Your password" : "Create a password"}
                    className="h-13 w-full rounded-2xl border border-border bg-background px-4 pr-12 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="flex h-5 items-center">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-background text-foreground focus:ring-foreground focus:ring-offset-background transition-colors cursor-pointer"
                      />
                    </div>
                    <div className="text-sm leading-5 text-muted-foreground">
                      I agree to the{" "}
                      <Link to="/terms-of-service" className="text-foreground underline underline-offset-4 hover:text-accent transition-colors">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link to="/privacy-policy" className="text-foreground underline underline-offset-4 hover:text-accent transition-colors">
                        Privacy Policy
                      </Link>
                      . <span className="text-red-500">*</span>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="flex h-5 items-center">
                      <input
                        type="checkbox"
                        checked={wantsMarketingEmails}
                        onChange={(e) => setWantsMarketingEmails(e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-background text-foreground focus:ring-foreground focus:ring-offset-background transition-colors cursor-pointer"
                      />
                    </div>
                    <div className="text-sm leading-5 text-muted-foreground">
                      Send me product updates, tips, and special offers. (Optional)
                    </div>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !email.trim() || !password.trim() || (!isLogin && !agreedToTerms)}
                className="flex h-13 w-full items-center justify-center rounded-2xl bg-foreground px-5 text-base font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 mt-4"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
              </button>
            </form>

            {isLogin ? (
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                disabled={isResettingPassword}
                className="block w-full text-center text-sm text-foreground underline underline-offset-4 transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResettingPassword ? "Sending reset email..." : "Forgot your password?"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void handleMagicLink()}
              disabled={isSendingMagicLink || !email.trim()}
              className="block w-full text-center text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingMagicLink ? "Sending magic link..." : magicLinkLabel}
            </button>

            {statusMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                {statusMessage}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {errorMessage}
              </div>
            ) : null}

            <p className="text-center text-sm text-muted-foreground">
              {switchLabel}{" "}
              <Link to={isLogin ? "/signup" : "/login"} className="text-foreground underline underline-offset-4">
                {switchCta}
              </Link>
            </p>

            {isLogin && (
              <p className="text-center text-sm leading-6 text-muted-foreground">
                By signing in, you agree to our{" "}
                <Link to="/terms-of-service" className="text-foreground underline underline-offset-4">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy-policy" className="text-foreground underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
