"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth";

type UserRole = "farmer"|"buyer"|"supplier"|"admin";
type UserStatus = "active"|"inactive"|"suspended";

interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  district: string;
  createdAt: string;
  listingsCount?: number;
  matchesCount?: number;
}

const ROLE_COLOR: Record<UserRole, "green"|"gold"|"blue"|"gray"> = {
  farmer:"green", buyer:"gold", supplier:"blue", admin:"gray",
};
const STATUS_COLOR: Record<UserStatus, "green"|"red"|"gray"> = {
  active:"green", inactive:"gray", suspended:"red",
};

function generatePassword(): string {
  const words = ["Pepper","Ginger","Clove","Nutmeg","Spice","Cinnamon","Turmeric","Cardamom"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}${num}`;
}

export default function AdminUsersPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User|null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Reset Password state
  const [resetUser, setResetUser] = useState<User|null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string|null>(null);
  const [resetSuccess, setResetSuccess] = useState<string|null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    api.get<any>("/admin/users?size=100")
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.items ?? [];
        setUsers(items.map((u: any) => ({
          ...u,
          createdAt: u.createdAt || u.created_at || "",
          status: u.status || (u.is_active === false ? "inactive" : "active") as UserStatus,
        })));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [isReady]);

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter==="all" || u.role===roleFilter;
    const matchStatus = statusFilter==="all" || u.status===statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const openDetail = (user: User) => { setSelectedUser(user); setDetailOpen(true); };

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    setActionLoading(true);
    try {
      const payload = { is_active: newStatus === "active" };
      await api.put(`/admin/users/${userId}`, payload);
      setUsers(prev => prev.map(u => u.id===userId ? {...u, status:newStatus} : u));
      if (selectedUser?.id===userId) setSelectedUser(prev => prev ? {...prev, status:newStatus} : null);
    } catch {
      // Optimistic update even on error
    } finally { setActionLoading(false); }
  };

  const openResetPassword = (user: User) => {
    setResetUser(user);
    setNewPassword("");
    setResetError(null);
    setResetSuccess(null);
    setCopied(false);
    setResetOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetUser || !newPassword) return;
    setResetLoading(true);
    setResetError(null);
    try {
      await api.put(`/admin/users/${resetUser.id}/reset-password`, { new_password: newPassword });
      setResetSuccess(newPassword);
    } catch (err: any) {
      setResetError(err?.message || "Failed to reset password");
    } finally { setResetLoading(false); }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      <div className="bg-neutral-800 px-6 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">User Management</h1>
        <p className="text-neutral-300 text-sm mt-1">{users.length} registered users</p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 space-y-2">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<span>🔍</span>}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            options={[
              {value:"all",label:"All Roles"},
              {value:"farmer",label:"Farmers"},
              {value:"buyer",label:"Buyers"},
              {value:"supplier",label:"Suppliers"},
              {value:"admin",label:"Admins"},
            ]}
          />
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            options={[
              {value:"all",label:"All Status"},
              {value:"active",label:"Active"},
              {value:"inactive",label:"Inactive"},
              {value:"suspended",label:"Suspended"},
            ]}
          />
        </div>
        <p className="text-xs text-neutral-400">{filtered.length} results</p>
      </div>

      {/* User List */}
      <div className="px-4 py-4 space-y-2">
        {loading ? (
          Array.from({length:5}).map((_,i) => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
              <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState icon="👤" title="No users found" description="Try adjusting your search or filters." />
        ) : (
          filtered.map(user => (
            <div key={user.id} className="bg-white rounded-2xl border border-neutral-200 p-4 hover:border-neutral-400 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => openDetail(user)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-neutral-900 text-sm">{user.name}</span>
                    <Badge color={ROLE_COLOR[user.role]} size="sm">{user.role}</Badge>
                    <Badge color={STATUS_COLOR[user.status]} size="sm" dot>{user.status}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{user.email}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">📍 {user.district} · Joined {user.createdAt}</p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openResetPassword(user)}>Reset Password</Button>
                  <button onClick={() => openDetail(user)} className="text-neutral-300 text-lg">›</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* User Detail Panel */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="User Details"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center text-xl font-bold text-neutral-600">
                {selectedUser.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-neutral-900">{selectedUser.name}</h3>
                <p className="text-sm text-neutral-500">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge color={ROLE_COLOR[selectedUser.role]} size="sm">{selectedUser.role}</Badge>
                  <Badge color={STATUS_COLOR[selectedUser.status]} size="sm" dot>{selectedUser.status}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-neutral-50 rounded-xl p-3">
                <p className="text-xs text-neutral-400 mb-1">Phone</p>
                <p className="font-medium text-neutral-800">{selectedUser.phone}</p>
              </div>
              <div className="bg-neutral-50 rounded-xl p-3">
                <p className="text-xs text-neutral-400 mb-1">District</p>
                <p className="font-medium text-neutral-800">{selectedUser.district}</p>
              </div>
              <div className="bg-neutral-50 rounded-xl p-3">
                <p className="text-xs text-neutral-400 mb-1">Joined</p>
                <p className="font-medium text-neutral-800">{selectedUser.createdAt}</p>
              </div>
              {selectedUser.listingsCount != null && (
                <div className="bg-neutral-50 rounded-xl p-3">
                  <p className="text-xs text-neutral-400 mb-1">Listings</p>
                  <p className="font-medium text-neutral-800">{selectedUser.listingsCount}</p>
                </div>
              )}
              {selectedUser.matchesCount != null && (
                <div className="bg-neutral-50 rounded-xl p-3">
                  <p className="text-xs text-neutral-400 mb-1">Matches</p>
                  <p className="font-medium text-neutral-800">{selectedUser.matchesCount}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-neutral-100 pt-4">
              <p className="text-sm font-medium text-neutral-700 mb-3">Account Actions</p>
              <div className="flex flex-wrap gap-2">
                {selectedUser.status !== "active" && (
                  <Button variant="primary" size="sm" loading={actionLoading}
                    onClick={() => handleStatusChange(selectedUser.id, "active")}>
                    Activate
                  </Button>
                )}
                {selectedUser.status !== "suspended" && selectedUser.role !== "admin" && (
                  <Button variant="danger" size="sm" loading={actionLoading}
                    onClick={() => handleStatusChange(selectedUser.id, "suspended")}>
                    Suspend
                  </Button>
                )}
                {selectedUser.status !== "inactive" && (
                  <Button variant="ghost" size="sm" loading={actionLoading}
                    onClick={() => handleStatusChange(selectedUser.id, "inactive")}>
                    Deactivate
                  </Button>
                )}
                <Button variant="accent" size="sm"
                  onClick={() => { setDetailOpen(false); openResetPassword(selectedUser); }}>
                  Reset Password
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Password"
        size="md"
      >
        {resetUser && (
          <div className="space-y-4">
            <div className="bg-neutral-50 rounded-xl p-3 space-y-1">
              <p className="text-sm text-neutral-500">User</p>
              <p className="font-semibold text-neutral-900">{resetUser.name}</p>
              <p className="text-sm text-neutral-600">{resetUser.email}</p>
            </div>

            {resetSuccess ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-green-800 mb-2">Password reset successful!</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white border border-green-300 rounded-lg px-3 py-2 text-sm font-mono text-neutral-900 select-all">
                      {resetSuccess}
                    </code>
                    <Button variant="primary" size="sm" onClick={() => copyToClipboard(resetSuccess)}>
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-800">
                    Share this password with the user securely. They should change it after login.
                  </p>
                </div>
                <Button variant="ghost" fullWidth onClick={() => setResetOpen(false)}>Done</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {resetError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2">{resetError}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">New Password</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 8 chars)"
                      className="flex-1 border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      minLength={8}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setNewPassword(generatePassword())}>
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" fullWidth onClick={() => setResetOpen(false)}>Cancel</Button>
                  <Button variant="primary" fullWidth loading={resetLoading}
                    disabled={newPassword.length < 8}
                    onClick={handleResetPassword}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
