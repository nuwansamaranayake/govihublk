"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";

type NotifType = "match"|"price"|"advisory"|"system"|"offer";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  deepLink?: string;
}

const NOTIF_ICON: Record<NotifType, string> = { match:"🤝", price:"📊", advisory:"💬", system:"⚙️", offer:"💰" };


export default function BuyerNotificationsPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    api.get<any>("/notifications")
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        setNotifications(items);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load notifications");
        setNotifications([]);
      })
      .finally(() => setLoading(false));
  }, [isReady]);

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`).catch(()=>{});
    setNotifications(prev => prev.map(n => n.id===id ? {...n, read:true} : n));
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all").catch(()=>{});
    setNotifications(prev => prev.map(n => ({...n, read:true})));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-amber-600 px-4 pt-10 pb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            <p className="text-amber-100 text-sm mt-1">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="text-white border-white/30 hover:bg-white/10">
              Mark all read
            </Button>
          )}
        </div>
      </div>
      <div className="px-4 py-4 space-y-2">
        {loading ? (
          Array.from({length:4}).map((_,i) => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
              <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" />
            </div>
          ))
        ) : notifications.length === 0 ? (
          <EmptyState icon="🔔" title="No notifications" description="You'll be notified when farmers match your demands." />
        ) : (
          notifications.map(notif => (
            <button key={notif.id}
              onClick={() => { if (!notif.read) markRead(notif.id); if (notif.deepLink) window.location.href = notif.deepLink; }}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${notif.read?"bg-white border-neutral-200":"bg-amber-50 border-amber-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${notif.read?"bg-neutral-100":"bg-amber-100"}`}>
                  {NOTIF_ICON[notif.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-semibold ${notif.read?"text-neutral-700":"text-neutral-900"}`}>{notif.title}</h3>
                    {!notif.read && <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                  </div>
                  <p className="text-sm text-neutral-500 mt-0.5 line-clamp-2">{notif.body}</p>
                  <p className="text-xs text-neutral-400 mt-1">{notif.createdAt}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
