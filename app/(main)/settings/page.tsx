"use client";

import { useState } from "react";
import { Mail, User, Bell, Palette, ShieldAlert, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  danger = false,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section className="glass p-6">
      <div className="mb-5 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
            danger
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-white/10 bg-white/5"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="ml-16 pt-16">
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-8 pb-12 space-y-6">
        {/* Profile */}
        <SettingsCard icon={User} title="Profile Information" description="Your account details">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground ring-1 ring-white/10">
              {user?.name?.charAt(0).toUpperCase() ?? "G"}
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-lg font-semibold">{user?.name ?? "Guest"}</h4>
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{user?.email ?? "Not signed in"}</span>
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <Input value={user?.name ?? "Guest"} readOnly className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <Input value={user?.email ?? ""} readOnly className="h-11" />
            </div>
          </div>
        </SettingsCard>

        {/* Preferences */}
        <SettingsCard icon={Bell} title="Notifications" description="Control how you're notified">
          <div className="space-y-3">
            <ToggleRow
              label="In-app notifications"
              description="Show alerts for scans, uploads and simulations"
              checked={notifications}
              onChange={setNotifications}
            />
            <ToggleRow
              label="Email notifications"
              description="Send important updates to your inbox"
              checked={emailNotifications}
              onChange={setEmailNotifications}
            />
          </div>
        </SettingsCard>

        {/* Appearance */}
        <SettingsCard icon={Palette} title="Appearance" description="Interface theme">
          <div className="flex gap-2">
            {["Dark", "Light", "System"].map((t, i) => (
              <button
                key={t}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  i === 0
                    ? "border-white/20 bg-white/[0.08] text-foreground"
                    : "border-border text-muted-foreground hover:bg-white/[0.04]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </SettingsCard>

        {/* Danger zone */}
        <SettingsCard
          icon={ShieldAlert}
          title="Danger Zone"
          description="Irreversible account actions"
          danger
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Permanently delete all your data and analyses.
            </p>
            <Button variant="destructive" className="shrink-0">
              Delete all data
            </Button>
          </div>
        </SettingsCard>

        {/* Save bar */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="min-w-32">
            {saved ? (
              <>
                <Check className="h-4 w-4" /> Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
