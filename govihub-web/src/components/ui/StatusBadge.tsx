"use client";

import React from "react";
import Badge from "./Badge";

export type ListingStatus =
  | "planned"
  | "ready"
  | "matched"
  | "fulfilled"
  | "expired"
  | "cancelled"
  | "open"
  | "reviewing"
  | "confirmed"
  | "closed"
  | "proposed"
  | "farmer_accepted"
  | "buyer_accepted"
  | "in_transit"
  | "disputed";

interface StatusBadgeProps {
  status: ListingStatus;
  size?: "sm" | "md";
  className?: string;
}

type BadgeColor = "blue" | "green" | "gold" | "darkgreen" | "gray" | "red" | "orange";

const statusConfig: Record<
  ListingStatus,
  { label: string; color: BadgeColor; icon?: string }
> = {
  planned: { label: "Planned", color: "blue" },
  ready: { label: "Ready", color: "green" },
  matched: { label: "Matched", color: "gold" },
  fulfilled: { label: "Fulfilled", color: "green" },
  expired: { label: "Expired", color: "gray" },
  cancelled: { label: "Cancelled", color: "gray" },
  open: { label: "Open", color: "blue" },
  reviewing: { label: "Reviewing", color: "gold" },
  confirmed: { label: "Confirmed", color: "darkgreen" },
  closed: { label: "Closed", color: "gray" },
  proposed: { label: "Proposed", color: "blue" },
  farmer_accepted: { label: "Farmer Accepted", color: "gold" },
  buyer_accepted: { label: "Buyer Accepted", color: "gold" },
  in_transit: { label: "In Transit", color: "orange" },
  disputed: { label: "Disputed", color: "red" },
};

export function StatusBadge({ status, size = "md", className = "" }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge color={config.color} size={size} dot className={className}>
      {status === "fulfilled" && (
        <svg
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {config.label}
    </Badge>
  );
}

export default StatusBadge;
