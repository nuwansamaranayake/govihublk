"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  badge?: number;
}

interface BottomNavProps {
  items: BottomNavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200 safe-area-pb"
      aria-label="Main navigation"
    >
      <ul className="flex">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={[
                  "flex flex-col items-center justify-center gap-1 py-2 px-1 relative",
                  "transition-colors duration-150",
                  isActive ? "text-primary-600" : "text-neutral-400 hover:text-neutral-600",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="relative">
                  {item.icon(isActive)}
                  {item.badge != null && item.badge > 0 && (
                    <span
                      className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
                      aria-label={item.badge + " notifications"}
                    >
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none truncate max-w-[64px] text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomNav;
