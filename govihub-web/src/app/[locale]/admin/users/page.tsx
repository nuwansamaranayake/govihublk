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
  phone: string;
  role: UserRole;
  status: UserStatus;
  district: string;
  createdAt: string;
  listingsCount?: number;
  matchesCount?: number;
}

const MOCK_USERS: User[] = [
  { id:"1", name:"Kamal Perera", email:"kamal@example.com", phone:"+94771234567", role:"farmer", status:"active", district:"Kandy", createdAt:"2026-01-15", listingsCount:5, matchesCount:12 },
  { id:"2", name:"Thilini Wickramasinghe", email:"thilini@example.com", phone:"+94712345678", role:"buyer", status:"active", district:"Colombo", createdAt:"2026-01-20", matchesCount:8 },
  { id:"3", name:"Rohan Jayasuriya", email:"rohan@example.com", phone:"+94773456789", role:"supplier", status:"active", district:"Gampaha", createdAt:"2026-02-01", listingsCount:7 },
  { id:"4", name:"Nimal Silva", email:"nimal@example.com", phone:"+94774567890", role:"farmer", status:"suspended", district:"Nuwara Eliya", createdAt:"2026-02-10", listingsCount:2, matchesCount:3 },
  { id:"5", name:"Admin User", email:"admin@govihub.lk", phone:"+94700000001", role:"admin", status:"active", district:"Colombo", createdAt:"2025-12-01" },
];

const ROLE_COLOR: Record<UserRole, "green"|"gold"|"blue"|"gray"> = {
  farmer:"green", buyer:"gold", supplier:"blue", admin:"gray",
};
const STATUS_COLOR: Record<UserStatus, "green"|"red"|"gray"> = {
  active:"green", inactive:"gray", suspended:"red",
};

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

  useEffect(() => {
    if (!isReady) return;
    api.get<User[]>("/admin/users")
      .then((data) => setUsers(Array.isArray(data) ? data : []))
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
      await api.put(`/admin/users/${userId}`, { status: newStatus });
      setUsers(prev => prev.map(u => u.id===userId ? {...u, status:newStatus} : u));
      if (selectedUser?.id===userId) setSelectedUser(prev => prev ? {...prev, status:newStatus} : null);
    } catch {
      setUsers(prev => prev.map(u => u.id===userId ? {...u, status:newStatus} : u));
    } finally { setActionLoading(false); }
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
            <button
              key={user.id}
              onClick={() => openDetail(user)}
              className="w-full bg-white rounded-2xl border border-neutral-200 p-4 text-left hover:border-neutral-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-neutral-900 text-sm">{user.name}</span>
                    <Badge color={ROLE_COLOR[user.role]} size="sm">{user.role}</Badge>
                    <Badge color={STATUS_COLOR[user.status]} size="sm" dot>{user.status}</Badge>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{user.email}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">📍 {user.district} · Joined {user.createdAt}</p>
                </div>
                <span className="text-neutral-300 text-lg shrink-0">›</span>
              </div>
            </button>
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
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
