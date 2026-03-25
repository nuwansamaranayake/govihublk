"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  district: string;
  businessName: string;
  language: "en"|"si"|"ta";
  notifyInquiries: boolean;
  notifyPrices: boolean;
  notifySystem: boolean;
}

const DISTRICTS = ["Ampara","Anuradhapura","Badulla","Colombo","Galle","Gampaha","Hambantota","Jaffna","Kalutara","Kandy","Kurunegala","Matale","Matara","Nuwara Eliya","Polonnaruwa","Puttalam","Ratnapura","Trincomalee"];

export default function SupplierSettingsPage() {
  const t = useTranslations();
  const [profile, setProfile] = useState<UserProfile|null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    api.get<UserProfile>("/users/me")
      .then(setProfile)
      .catch((err: any) => {
        setError(err?.message || "Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try { await api.put("/users/me", profile); } catch (err: any) { setError(err?.message || "Failed to save"); }
    finally { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  const toggle = (key: keyof UserProfile) => { if (!profile) return; setProfile({...profile, [key]: !profile[key as keyof UserProfile]}); };
  const setField = (key: keyof UserProfile, val: string) => { if (!profile) return; setProfile({...profile, [key]: val}); };
  const handleDeactivate = async () => { try { await api.post("/users/me/deactivate"); } catch {} setConfirmDeactivate(false); };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-blue-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("nav.settings")}</h1>
        <p className="text-blue-100 text-sm mt-1">Manage your supplier account</p>
      </div>
      {loading ? (
        <div className="px-4 py-4 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : profile && (
        <form onSubmit={handleSave} className="px-4 py-4 space-y-4">
          <Card header={<h2 className="font-semibold text-neutral-800 text-sm">Business Information</h2>} padding="md">
            <div className="space-y-3 mt-3">
              <Input label="Business Name" value={profile.businessName} onChange={e => setField("businessName", e.target.value)} />
              <Input label="Contact Name" value={profile.name} onChange={e => setField("name", e.target.value)} required />
              <Input label="Email" type="email" value={profile.email} onChange={e => setField("email", e.target.value)} required />
              <Input label="Phone" type="tel" value={profile.phone} onChange={e => setField("phone", e.target.value)} />
              <Select label="District" value={profile.district} onChange={e => setField("district", e.target.value)} options={DISTRICTS.map(d => ({value:d,label:d}))} />
            </div>
          </Card>
          <Card header={<h2 className="font-semibold text-neutral-800 text-sm">Language Preference</h2>} padding="md">
            <div className="space-y-2 mt-3">
              {[{value:"en",label:"English"},{value:"si",label:"සිංහල (Sinhala)"},{value:"ta",label:"தமிழ் (Tamil)"}].map(lang => (
                <label key={lang.value} className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="language" value={lang.value} checked={profile.language===lang.value} onChange={() => setField("language", lang.value)} className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-neutral-700">{lang.label}</span>
                </label>
              ))}
            </div>
          </Card>
          <Card header={<h2 className="font-semibold text-neutral-800 text-sm">Notification Preferences</h2>} padding="md">
            <div className="space-y-3 mt-3">
              {[
                { key:"notifyInquiries" as keyof UserProfile, label:"Farmer inquiries" },
                { key:"notifyPrices" as keyof UserProfile, label:"Market price alerts" },
                { key:"notifySystem" as keyof UserProfile, label:"System announcements" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-700">{item.label}</span>
                  <button type="button" role="switch" aria-checked={!!profile[item.key]} onClick={() => toggle(item.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${profile[item.key]?"bg-blue-500":"bg-neutral-300"}`}>
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${profile[item.key]?"translate-x-5":"translate-x-0"}`} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
          <Button type="submit" variant="primary" fullWidth loading={saving}>{saved ? "✓ Saved!" : "Save Changes"}</Button>
          <Card padding="md" className="border-red-200">
            <h2 className="font-semibold text-red-700 text-sm mb-2">Danger Zone</h2>
            <p className="text-sm text-neutral-500 mb-3">Deactivating removes your listings from search results.</p>
            <Button type="button" variant="danger" onClick={() => setConfirmDeactivate(true)}>Deactivate Account</Button>
          </Card>
        </form>
      )}
      <Modal isOpen={confirmDeactivate} onClose={() => setConfirmDeactivate(false)} title="Deactivate Account"
        footer={<div className="flex gap-3"><Button variant="ghost" fullWidth onClick={() => setConfirmDeactivate(false)}>Cancel</Button><Button variant="danger" fullWidth onClick={handleDeactivate}>Yes, Deactivate</Button></div>}>
        <p className="text-sm text-neutral-700">Your listings will be hidden until you reactivate. Contact support to reactivate.</p>
      </Modal>
    </div>
  );
}
