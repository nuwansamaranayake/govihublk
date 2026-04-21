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
import { PhoneInput, isValidE164Phone } from "@/components/ui/PhoneInput";
import { useAuth } from "@/lib/auth";

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  district: string;
  language: "en"|"si"|"ta";
}

interface NotifPrefs {
  match_alerts: boolean;
  price_alerts: boolean;
  weather_alerts: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
}

const DISTRICTS = ["Ampara","Anuradhapura","Badulla","Colombo","Galle","Gampaha","Hambantota","Jaffna","Kalutara","Kandy","Kurunegala","Matale","Matara","Nuwara Eliya","Polonnaruwa","Puttalam","Ratnapura","Trincomalee"];

export default function SupplierSettingsPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [profile, setProfile] = useState<ProfileData|null>(null);
  const [notifs, setNotifs] = useState<NotifPrefs>({
    match_alerts: true, price_alerts: true, weather_alerts: true,
    push_enabled: true, sms_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    Promise.all([
      api.get<any>("/users/me"),
      api.get<any>("/users/me/preferences").catch(() => null),
    ])
      .then(([user, prefs]) => {
        setProfile({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          district: user.district || "",
          language: user.language || "en",
        });
        if (prefs) {
          setNotifs({
            match_alerts: prefs.match_alerts ?? true,
            price_alerts: prefs.price_alerts ?? true,
            weather_alerts: prefs.weather_alerts ?? true,
            push_enabled: prefs.push_enabled ?? true,
            sms_enabled: prefs.sms_enabled ?? true,
          });
        }
      })
      .catch((err: any) => setError(err?.message || "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [isReady]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!isValidE164Phone(profile.phone)) {
      setError(t("auth.phone_invalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        api.put("/users/me", {
          name: profile.name,
          email: profile.email || undefined,
          phone: profile.phone,
          language: profile.language,
          district: profile.district || undefined,
        }),
        api.put("/users/me/preferences", notifs),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif = (key: keyof NotifPrefs) => {
    setNotifs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setField = (key: keyof ProfileData, val: string) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: val });
  };

  const handleDeactivate = async () => {
    try { await api.delete("/users/me"); } catch {}
    setConfirmDeactivate(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-blue-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("nav.settings")}</h1>
        <p className="text-blue-100 text-sm mt-1">Manage your supplier account</p>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="px-4 py-4 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : profile && (
        <form onSubmit={handleSave} className="px-4 py-4 space-y-4">
          <Card header={<h2 className="font-semibold text-neutral-800 text-sm">Business Information</h2>} padding="md">
            <div className="space-y-3 mt-3">
              <Input label="Contact Name" value={profile.name} onChange={e => setField("name", e.target.value)} required />
              <Input label="Email" type="email" value={profile.email} onChange={e => setField("email", e.target.value)} placeholder="your@email.com" />
              <PhoneInput
                label={t("auth.phone_label")}
                required
                value={profile.phone}
                onChange={(v) => setField("phone", v)}
                defaultCountry="LK"
                error={profile.phone && !isValidE164Phone(profile.phone) ? t("auth.phone_invalid") : undefined}
              />
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
                { key: "match_alerts" as keyof NotifPrefs, label: "Farmer inquiry notifications" },
                { key: "price_alerts" as keyof NotifPrefs, label: "Market price alerts" },
                { key: "weather_alerts" as keyof NotifPrefs, label: "Weather alerts" },
                { key: "push_enabled" as keyof NotifPrefs, label: "Push notifications" },
                { key: "sms_enabled" as keyof NotifPrefs, label: "SMS notifications" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-700">{item.label}</span>
                  <button type="button" role="switch" aria-checked={notifs[item.key]} onClick={() => toggleNotif(item.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifs[item.key]?"bg-blue-500":"bg-neutral-300"}`}>
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifs[item.key]?"translate-x-5":"translate-x-0"}`} />
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
