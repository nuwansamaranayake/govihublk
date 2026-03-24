"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import BottomNav, { BottomNavItem } from "@/components/ui/BottomNav";
import TopBar from "@/components/ui/TopBar";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-6 h-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function ListingsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-6 h-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

function InquiriesIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="w-6 h-6"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {active ? (
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      )}
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const base = `/${locale}/supplier`;

  const navItems: BottomNavItem[] = [
    { href: base + "/dashboard", label: t("home"), icon: (a) => <HomeIcon active={a} /> },
    { href: base + "/listings", label: t("listings"), icon: (a) => <ListingsIcon active={a} /> },
    { href: base + "/inquiries", label: "Inquiries", icon: (a) => <InquiriesIcon active={a} /> },
    { href: base + "/more", label: "More", icon: () => <MoreIcon /> },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-neutral-50">
      <TopBar
        leftAction={
          <span className="text-base font-bold text-primary-600">GoviHub</span>
        }
        rightActions={
          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
            Supplier
          </span>
        }
      />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
