"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// cn
import { cn } from "@/lib/utils";

// lucide-react
import { Mail, User, Key, AlertTriangle } from "lucide-react";

// shadcn
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function Settings() {
  const [settings, setSettings] = useState({
    apiKey: "••••••••••••••••",
    notifications: true,
    dataRetention: 90,
    theme: "dark",
    emailNotifications: true,
  });

  const handleSave = () => {
    console.log("Settings saved:", settings);
  };

  const {user} = useAuth();

  return (
    <div>
      <div className="ml-16 pt-16">
        <main className="mx-auto max-w-7xl container pt-8 bg-background min-w-full min-h-screen space-y-8">
          {/* Profile Card */}
          <Card className="px-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {/* Profile Circle */}
                <div
                  className={cn(
                    "shrink-0 w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-2xl font-display font-bold"
                  )}
                >
                  {user?.name.charAt(0).toUpperCase()}
                </div>

                {/* Name & Email */}
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-lg font-semibold truncate">
                    <span className="truncate">{user?.name ?? "Guest"}</span>
                  </h3>
                  <p className="text-muted-foreground flex items-center gap-2 truncate">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{user?.email ?? ""}</span>
                  </p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Full Name
                  </label>
                  <Input
                    value={user?.name ?? "Guest"}
                    readOnly
                    className="mt-1 truncate focus-visible:border-0 focus-visible:ring-ring/0 focus-visible:ring-[0px]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Email Address
                  </label>
                  <Input
                    value={user?.email ?? ""}
                    readOnly
                    className="mt-1 truncate focus-visible:border-0 focus-visible:ring-ring/0 focus-visible:ring-[0px]"
                  />
                </div>
              </div>

              {/* Edit Information */}
              {/* <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold truncate">
                    Update Your Profile
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Keep your information up to date to ensure your account
                    stays secure and you have a smooth, personalized experience.
                  </p>
                </div>
                <div>
                  <Button>Update Information</Button>
                </div>
              </div> */}
            </CardContent>
          </Card>

          {/* API & Account Settings Card */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6"> */}
              {/* API Key */}
              {/* <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  API Key
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={settings.apiKey}
                    readOnly
                    className=" truncate"
                  />
                  <Button>Regenerate</Button>
                </div>
              </div> */}

              {/* Data Retention */}
              {/* <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Data Retention (days)
                </label>
                <Input
                  type="number"
                  value={settings.dataRetention}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dataRetention: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div> */}

              {/* Theme Selection */}
              {/* <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Theme
                </label>
                <div className="flex gap-2">
                  {["Light", "Dark", "Auto"].map((theme) => (
                    <Button
                      key={theme}
                      variant={settings.theme === theme.toLowerCase() ? "default" : "outline"}
                      onClick={() =>
                        setSettings({ ...settings, theme: theme.toLowerCase() })
                      }
                    >
                      {theme}
                    </Button>
                  ))}
                </div>
              </div> */}

              {/* Notifications */}
              {/*<div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) =>
                    setSettings({ ...settings, notifications: e.target.checked })
                  }
                  className="w-4 h-4 rounded"
                />
                <label className="text-sm text-foreground cursor-pointer">
                  Enable notifications
                </label>
              </div> */}

{/*               <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, emailNotifications: e.target.checked })
                  }
                  className="w-4 h-4 rounded"
                />
                <label className="text-sm text-foreground cursor-pointer">
                  Email notifications
                </label>
              </div>

              <Button
                className="w-full flex items-center justify-center gap-2 mt-4"
                onClick={handleSave}
              >
                <Save className="w-4 h-4" />
                Save Settings
              </Button> */}
            {/* </CardContent>
          </Card> */}

          {/* Danger Zone Card */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                These actions are irreversible. Proceed with extreme caution.
              </p>
              <Button variant="destructive" className="w-full">
                Delete All Data
              </Button>
            </CardContent>
          </Card> */}
        </main>
      </div>
    </div>
  );
}
