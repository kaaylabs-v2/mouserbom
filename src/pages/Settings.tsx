import { useState } from "react";
import { useTheme } from "@/hooks/use-theme";

const tabs = ["Profile", "API keys", "Theme", "Notifications"] as const;

export default function Settings() {
  const [tab, setTab] = useState<typeof tabs[number]>("Profile");
  const { theme, toggle } = useTheme();
  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <h1 className="text-2xl">Settings</h1>
      <div className="mt-6 flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative px-3 h-9 text-sm focus-ring ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t}{tab === t && <span className="absolute -bottom-px left-2 right-2 h-px bg-accent" />}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "Profile" && (
          <div className="space-y-4 max-w-md">
            <Field label="Name" value="Alex Chen" />
            <Field label="Email" value="alex@mouser.com" />
            <Field label="Role" value="Procurement Engineer" />
          </div>
        )}
        {tab === "API keys" && (
          <div className="rounded-md border border-border bg-card p-4 max-w-xl">
            <div className="text-xs text-muted-foreground mb-1">PERSONAL TOKEN</div>
            <div className="mono text-sm">mse_live_••••••••••••8421</div>
          </div>
        )}
        {tab === "Theme" && (
          <div className="rounded-md border border-border bg-card p-4 max-w-md flex items-center justify-between">
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-xs text-muted-foreground">Current: {theme}</div>
            </div>
            <button onClick={toggle} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted">Switch</button>
          </div>
        )}
        {tab === "Notifications" && (
          <p className="text-sm text-muted-foreground">No notifications configured.</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input defaultValue={value} className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-card text-sm focus-ring" />
    </label>
  );
}
