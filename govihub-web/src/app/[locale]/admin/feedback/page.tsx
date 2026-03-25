"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface FeedbackEntry {
  id: string;
  user_name: string;
  user_email: string;
  page_url: string;
  message: string;
  rating: number | null;
  created_at: string;
}

const MOCK_FEEDBACK: FeedbackEntry[] = [
  {
    id: "fb-001",
    user_name: "Kamal Perera",
    user_email: "kamal@example.com",
    page_url: "/en/farmer/dashboard",
    message: "Weather data is very helpful for planning. Would love to see 7-day forecast too.",
    rating: 4,
    created_at: "2026-03-24T10:30:00Z",
  },
  {
    id: "fb-002",
    user_name: "Nimali Silva",
    user_email: "nimali@example.com",
    page_url: "/en/farmer/marketplace",
    message: "Marketplace search is slow and sometimes doesn't show results.",
    rating: 2,
    created_at: "2026-03-23T14:15:00Z",
  },
  {
    id: "fb-003",
    user_name: "Sunil Fernando",
    user_email: "sunil@example.com",
    page_url: "/en/supplier/dashboard",
    message: "Great platform! Easy to manage my product listings.",
    rating: 5,
    created_at: "2026-03-22T09:00:00Z",
  },
];

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-neutral-400">No rating</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill={star <= rating ? "#F59E0B" : "none"}
          stroke={star <= rating ? "#F59E0B" : "#D1D5DB"}
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      ))}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<FeedbackEntry[]>("/admin/feedback")
      .then(setFeedback)
      .catch(() => setFeedback(MOCK_FEEDBACK))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-LK", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">User Feedback</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Review feedback submitted by beta testers
        </p>
      </div>

      {/* Content */}
      <Card padding="none">
        {feedback.length === 0 ? (
          <EmptyState
            title="No feedback yet"
            description="Feedback from users will appear here."
            icon={
              <svg
                className="w-16 h-16 text-neutral-300 mx-auto"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                viewBox="0 0 48 48"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 20h.01M24 20h.01M36 20h.01M42 24c0 8.837-8.059 16-18 16a19.727 19.727 0 01-8.51-1.898L6 40l2.79-7.44C7.024 30.084 6 27.148 6 24c0-8.837 8.059-16 18-16s18 7.163 18 16z"
                />
              </svg>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">User</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Page</th>
                  <th className="px-4 py-3 font-medium text-neutral-600 min-w-[200px]">
                    Message
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Rating</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-800">{entry.user_name}</p>
                      <p className="text-xs text-neutral-400">{entry.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 font-mono">
                      {entry.page_url}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 max-w-xs">
                      <p className="line-clamp-2">{entry.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StarRating rating={entry.rating} />
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
