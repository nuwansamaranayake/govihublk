"use client";

import React from "react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

const GOOGLE_AUTH_URL = process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL || "/api/auth/google";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const t = useTranslations();

  const handleGoogleLogin = () => {
    const redirectUri = `${window.location.origin}/api/auth/callback`;
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
    });
    window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  };

  return (
    <div className="min-h-dvh flex flex-col bg-neutral-50">
      {/* Top bar with language switcher */}
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Logo / branding */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-200 mb-5">
            <svg
              className="w-10 h-10 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-primary-600 tracking-tight">
            GoviHub
          </h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">
            {t("common.tagline")}
          </p>
        </div>

        {/* Welcome card */}
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-neutral-100 p-8">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-neutral-900">
              {t("auth.welcome")}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Sri Lanka&rsquo;s smart farming marketplace
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 transition-colors shadow-sm font-medium text-neutral-700 text-sm"
          >
            <GoogleIcon />
            {t("auth.loginWithGoogle")}
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-neutral-400">
              By continuing, you agree to our{" "}
              <a href="/terms" className="text-primary-600 hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-primary-600 hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-sm">
          {[
            { icon: "🌾", label: "Smart Listings" },
            { icon: "🤝", label: "AI Matching" },
            { icon: "📱", label: "3 Languages" },
          ].map((feat) => (
            <div
              key={feat.label}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <span className="text-2xl" role="img" aria-label={feat.label}>
                {feat.icon}
              </span>
              <span className="text-xs text-neutral-500 font-medium">
                {feat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Gold accent bottom strip */}
      <div className="h-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500" />
    </div>
  );
}
