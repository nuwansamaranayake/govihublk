"use client";

import React from "react";
import Button from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={"flex flex-col items-center justify-center text-center py-12 px-6 " + className}
    >
      {icon ? (
        <div className="mb-4 text-neutral-300">{icon}</div>
      ) : (
        <div className="mb-4" aria-hidden="true">
          <svg
            className="w-16 h-16 text-neutral-200 mx-auto"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            viewBox="0 0 48 48"
          >
            <circle cx="24" cy="24" r="20" />
            <path strokeLinecap="round" d="M16 24h16M24 16v16" />
          </svg>
        </div>
      )}
      <h3 className="text-base font-semibold text-neutral-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-neutral-400 max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Button variant="primary" size="md" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

export default EmptyState;
