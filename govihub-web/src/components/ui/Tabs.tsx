"use client";

import React, { useState } from "react";

interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (key: string) => void;
  children: (activeTab: string) => React.ReactNode;
  className?: string;
}

export function Tabs({ tabs, defaultTab, onChange, children, className = "" }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.key);

  const handleChange = (key: string) => {
    setActive(key);
    onChange?.(key);
  };

  return (
    <div className={"flex flex-col " + className}>
      <div
        className="flex overflow-x-auto no-scrollbar border-b border-neutral-200"
        role="tablist"
        aria-orientation="horizontal"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={"tabpanel-" + tab.key}
              id={"tab-" + tab.key}
              onClick={() => handleChange(tab.key)}
              className={[
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap",
                "transition-colors duration-150 border-b-2 -mb-px",
                isActive
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-neutral-500 hover:text-neutral-700",
              ].join(" ")}
            >
              {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        id={"tabpanel-" + active}
        role="tabpanel"
        aria-labelledby={"tab-" + active}
        className="flex-1"
      >
        {children(active)}
      </div>
    </div>
  );
}

export default Tabs;
