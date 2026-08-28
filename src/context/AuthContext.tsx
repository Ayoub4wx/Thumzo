import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface UserProfile {
  uid: string;
  email: string | undefined;
  displayName: string | undefined;
  photoURL: string | undefined;
}

type MagicLinkOptions = {
  mode?: "login" | "signup";
  marketingConsent?: boolean;
  acceptedTerms?: boolean;
};

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (marketingConsent?: boolean) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signupWithPassword: (email: string, password: string, marketingConsent?: boolean, acceptedTerms?: boolean) => Promise<{ requiresEmailConfirmation: boolean; emailAction?: "confirm" | "sign_in" }>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  sendMagicLink: (email: string, options?: MagicLinkOptions) => Promise<void>;
  refreshUser: () => Promise<void>;
  initializeOnboarding: (marketingConsent: boolean, signupSource: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

function assertValidEmailAddress(email: string) {
  if (!email) {
    throw new Error("Email address is required.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
}

async function postAuthEmailRequest<T>(path: string, body: Record<string, unknown>, fallbackMessage: string): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : fallbackMessage);
  }

  return payload as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const mapUser = (supabaseUser: any): UserProfile | null => {
    if (!supabaseUser) return null;

    const metadata = supabaseUser.user_metadata ?? {};
    const identityData =
      supabaseUser.identities?.find((identity: any) => identity.provider === "google")?.identity_data ??
      supabaseUser.identities?.[0]?.identity_data ??
      {};

    return {
      uid: supabaseUser.id,
      email: supabaseUser.email,
      displayName:
        metadata.full_name ||
        metadata.display_name ||
        metadata.name ||
        identityData.full_name ||
        identityData.name ||
        supabaseUser.email?.split("@")[0],
      photoURL:
        metadata.picture ||
        metadata.avatar_url ||
        identityData.picture ||
        identityData.avatar_url,
    };
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(mapUser(session?.user));
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session?.user));
      setLoading(false);
      
      // If we are in a popup, notify the opener and close
      if (window.opener && session) {
        window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS' }, window.location.origin);
        window.close();
      }
    });

    // Listen for messages from popup
    const handleMessage = (event: MessageEvent) => {
      // Security: Verify the origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setUser(mapUser(session?.user));
        });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    setUser(mapUser(data.user));
  };

  const login = async (marketingConsent?: boolean) => {
    // 1. Open blank popup synchronously to bypass popup blockers
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      '',
      'supabase_auth_popup',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    try {
      // 2. Fetch the auth URL
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
          queryParams: {
            // Pass marketing consent if provided
            ...(marketingConsent !== undefined && { marketing_consent: String(marketingConsent) }),
          }
        }
      });
      
      if (error) throw error;
      
      // 3. Navigate the popup
      if (data?.url && popup) {
        popup.location.href = data.url;
      } else if (!popup) {
        throw new Error("Please allow popups to sign in with Google.");
      }
    } catch (error) {
      if (popup) popup.close();
      console.error("Login failed", error);
      throw error;
    }
  };

  const loginWithPassword = async (email: string, password: string) => {
    const normalizedEmail = normalizeEmailAddress(email);
    assertValidEmailAddress(normalizedEmail);

    if (!password) {
      throw new Error("Password is required.");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const signupWithPassword = async (email: string, password: string, marketingConsent?: boolean, acceptedTerms?: boolean) => {
    const normalizedEmail = normalizeEmailAddress(email);
    assertValidEmailAddress(normalizedEmail);

    if (!password) {
      throw new Error("Password is required.");
    }

    return await postAuthEmailRequest<{ requiresEmailConfirmation: boolean; emailAction?: "confirm" | "sign_in" }>(
      "/api/auth/signup",
      {
        email: normalizedEmail,
        password,
        marketingConsent: marketingConsent === true,
        acceptedTerms: acceptedTerms === true,
      },
      "Could not send confirmation email."
    );
  };

  const resetPassword = async (email: string) => {
    const normalizedEmail = normalizeEmailAddress(email);
    assertValidEmailAddress(normalizedEmail);

    await postAuthEmailRequest<{ sent: boolean }>(
      "/api/auth/password-reset",
      { email: normalizedEmail },
      "Could not send a password reset email."
    );
  };

  const sendMagicLink = async (email: string, options: MagicLinkOptions = {}) => {
    const normalizedEmail = normalizeEmailAddress(email);
    assertValidEmailAddress(normalizedEmail);

    await postAuthEmailRequest<{ sent: boolean }>(
      "/api/auth/magic-link",
      {
        email: normalizedEmail,
        mode: options.mode ?? "login",
        marketingConsent: options.marketingConsent === true,
        acceptedTerms: options.acceptedTerms === true,
      },
      "Could not send magic link."
    );
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const initializeOnboarding = async (marketingConsent: boolean, signupSource: string) => {
    const session = await supabase.auth.getSession();
    if (!session.data.session) throw new Error("Not authenticated");

    const response = await fetch('/api/account/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session.access_token}`
      },
      body: JSON.stringify({ marketingConsent, signupSource })
    });

    if (!response.ok) throw new Error("Failed to initialize onboarding");
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithPassword,
        signupWithPassword,
        resetPassword,
        logout,
        sendMagicLink,
        refreshUser,
        initializeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
