"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";
import { formatDateSafe } from "@/lib/utils";

type InquiryStatus = "new" | "responded" | "closed";

interface Inquiry {
  id: string;
  farmerName: string;
  product: string;
  message: string;
  date: string;
  status: InquiryStatus;
}

const STATUS_CONFIG: Record<InquiryStatus, { label: string; color: "blue" | "green" | "gray" }> = {
  new: { label: "New", color: "blue" },
  responded: { label: "Responded", color: "green" },
  closed: { label: "Closed", color: "gray" },
};


function formatDate(dateStr: string): string {
  return formatDateSafe(dateStr);
}

function InquiryIcon() {
  return (
    <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function FarmerAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
      {initials}
    </div>
  );
}

export default function SupplierInquiriesPage() {
  const { isReady } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    async function fetchInquiries() {
      try {
        const data = await api.get<Inquiry[]>("/supplier/inquiries");
        if (!cancelled) {
          setInquiries(Array.isArray(data) ? data : []);
        }
      } catch {
        // API not available yet — show empty state
        if (!cancelled) {
          setInquiries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInquiries();
    return () => { cancelled = true; };
  }, [isReady]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-lg font-semibold text-neutral-900 mb-4">Inquiries</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold text-neutral-900 mb-4">Inquiries</h1>
        <EmptyState
          icon={<InquiryIcon />}
          title="No inquiries yet"
          description="Farmers will reach out when they find your products. Make sure your listings are up to date!"
        />
      </div>
    );
  }

  const newCount = inquiries.filter((i) => i.status === "new").length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Inquiries</h1>
        {newCount > 0 && (
          <Badge color="blue" dot>
            {newCount} new
          </Badge>
        )}
      </div>

      {/* Inquiry List */}
      <div className="space-y-3">
        {inquiries.map((inquiry) => {
          const statusCfg = STATUS_CONFIG[inquiry.status];
          return (
            <Card key={inquiry.id} padding="md">
              <div className="flex items-start gap-3">
                <FarmerAvatar name={inquiry.farmerName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-medium text-sm text-neutral-900 truncate">
                      {inquiry.farmerName}
                    </span>
                    <Badge color={statusCfg.color} size="sm" dot>
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-blue-600 mb-1">{inquiry.product}</p>
                  <p className="text-sm text-neutral-600 line-clamp-2">{inquiry.message}</p>
                  <p className="text-xs text-neutral-400 mt-1.5">{formatDate(inquiry.date)}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
