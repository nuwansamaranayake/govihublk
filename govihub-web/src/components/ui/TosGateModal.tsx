"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams, usePathname } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Terms of Use version this build expects users to have accepted.
 * Duplicates the backend `settings.TOS_VERSION` — no meta endpoint exposes it.
 * Bumping the terms means changing BOTH places. See TECH_DEBT.md.
 */
const TOS_VERSION = "1.1";

interface AcceptTosResponse {
  tos_accepted_at: string;
  tos_version: string;
}

/**
 * Blocking re-acceptance gate. Renders over the whole app for any signed-in
 * non-admin user who has never accepted the Terms, or accepted an older
 * version. Admins are exempt.
 *
 * Deliberately NOT dismissible: no backdrop click, no Escape, no close button.
 * Logout stays reachable so a user who declines is not trapped in the app.
 */
export default function TosGateModal() {
  const t = useTranslations("tos");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const { user, logout, updateUser } = useAuth();

  const [isAccepting, setIsAccepting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsTos =
    !!user &&
    user.role !== "admin" &&
    (!user.tosAcceptedAt || user.tosVersion !== TOS_VERSION);

  // "View Terms" opens /terms in a new tab, which inherits sessionStorage and
  // therefore the signed-in user. Without this the gate would render over the
  // terms page too and block reading the very document being accepted.
  const isTermsPage = pathname?.endsWith("/terms") ?? false;

  if (!needsTos || isTermsPage) return null;

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);
    try {
      const data = await api.post<AcceptTosResponse>("/users/me/accept-tos");
      // Refresh local user state so `needsTos` flips false and the gate closes.
      updateUser({
        tosAcceptedAt: data.tos_accepted_at,
        tosVersion: data.tos_version,
      });
    } catch {
      // Keep the gate open — silently closing would let an unaccepted user through.
      setError(tCommon("error"));
    } finally {
      setIsAccepting(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push(`/${locale}/auth/beta-login`);
    }
  };

  const busy = isAccepting || isLoggingOut;

  return (
    <Modal
      isOpen
      // No-op: this gate must not be dismissible by backdrop click or Escape.
      onClose={() => {}}
      size="md"
    >
      <h2 className="text-lg font-semibold text-neutral-900">
        {t("modal_title")}
      </h2>
      <p className="mt-2 text-sm text-neutral-600">{t("modal_body")}</p>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-5 space-y-2">
        <a
          href={`/${locale}/terms`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 rounded-xl border border-neutral-300 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          {t("modal_view")}
        </a>

        <button
          type="button"
          onClick={handleAccept}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAccepting ? `${t("modal_accept")}…` : t("modal_accept")}
        </button>

        {/* Escape hatch — without this, declining traps the user in the app. */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={busy}
          className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-700 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {tNav("logout")}
        </button>
      </div>
    </Modal>
  );
}
