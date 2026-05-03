import { useState } from "react";
import { Plus, GripVertical, X } from "lucide-react";

type Policy = {
  id: string; name: string; default: boolean; usedBy: number;
  preferInStock: boolean; maxIncrease: number; mfrs: string[]; forbidden: string[];
  disallowed: string[]; require: { pkg: boolean; tol: boolean; voltage: boolean };
};
const seed: Policy[] = [
  { id: "default", name: "Default", default: true, usedBy: 14, preferInStock: true, maxIncrease: 10, mfrs: ["Texas Instruments", "Analog Devices", "STMicroelectronics"], forbidden: [], disallowed: ["obsolete"], require: { pkg: true, tol: true, voltage: false } },
  { id: "auto",    name: "Automotive AEC-Q",  default: false, usedBy: 3,  preferInStock: true, maxIncrease: 25, mfrs: ["Infineon", "onsemi", "NXP"], forbidden: ["Generic"], disallowed: ["nrnd", "obsolete"], require: { pkg: true, tol: true, voltage: true } },
  { id: "low-cost", name: "Low-cost rebuild", default: false, usedBy: 1,  preferInStock: false, maxIncrease: 0, mfrs: ["Yageo", "Murata"], forbidden: [], disallowed: ["obsolete"], require: { pkg: true, tol: false, voltage: false } },
];

export default function Policies() {
  const [policies, setPolicies] = useState<Policy[]>(seed);
  const [edit, setEdit] = useState<Policy | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Substitution policies</h1>
          <p className="text-sm text-muted-foreground mt-1">Govern how alternatives are selected and ranked.</p>
        </div>
        <button onClick={() => setEdit({ id: "new", name: "New policy", default: false, usedBy: 0, preferInStock: true, maxIncrease: 10, mfrs: [], forbidden: [], disallowed: [], require: { pkg: true, tol: false, voltage: false } })}
          className="h-9 px-3 rounded-md bg-accent text-accent-foreground text-sm inline-flex items-center gap-2 focus-ring hover:opacity-90">
          <Plus className="h-4 w-4" /> New policy
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        {policies.map(p => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-5 hover:border-accent/50 cursor-pointer" onClick={() => setEdit(p)}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <div className="mt-1 text-xs text-muted-foreground">Used by {p.usedBy} jobs</div>
              </div>
              {p.default && <span className="text-[10px] mono px-1.5 py-0.5 rounded bg-accent/10 text-accent uppercase">Default</span>}
            </div>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <div>Prefer in-stock: <span className="text-foreground">{p.preferInStock ? "yes" : "no"}</span></div>
              <div>Max price increase: <span className="text-foreground mono">{p.maxIncrease}%</span></div>
              <div>Manufacturer prefs: <span className="text-foreground">{p.mfrs.length}</span></div>
            </div>
          </div>
        ))}
      </div>

      {edit && <PolicyEditor policy={edit} onClose={() => setEdit(null)} onSave={(p) => {
        setPolicies(prev => prev.find(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [...prev, { ...p, id: Math.random().toString(36).slice(2, 7) }]);
        setEdit(null);
      }} />}
    </div>
  );
}

function PolicyEditor({ policy, onClose, onSave }: { policy: Policy; onClose: () => void; onSave: (p: Policy) => void }) {
  const [p, setP] = useState(policy);
  const lifecycles = ["nrnd", "obsolete", "preview"];
  return (
    <>
      <div className="fixed inset-0 bg-foreground/20 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-[480px] bg-card border-l border-border z-50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <input value={p.name} onChange={e => setP({ ...p, name: e.target.value })}
            className="text-base font-semibold bg-transparent focus-ring rounded px-1 -mx-1 flex-1" />
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-5 text-sm">
          <Section label="Disallow lifecycles">
            <div className="flex gap-1.5 flex-wrap">
              {lifecycles.map(l => {
                const on = p.disallowed.includes(l);
                return (
                  <button key={l}
                    onClick={() => setP({ ...p, disallowed: on ? p.disallowed.filter(x => x !== l) : [...p.disallowed, l] })}
                    className={`text-xs px-2 py-1 rounded border ${on ? "bg-accent/10 border-accent text-accent" : "border-border text-muted-foreground"}`}>
                    {l}
                  </button>
                );
              })}
            </div>
          </Section>
          <Section label="Prefer in-stock">
            <Switch on={p.preferInStock} onClick={() => setP({ ...p, preferInStock: !p.preferInStock })} />
          </Section>
          <Section label="Manufacturer preference (drag to reorder)">
            <div className="space-y-1">
              {p.mfrs.map(m => (
                <div key={m} className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-surface-muted">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{m}</span>
                </div>
              ))}
              {p.mfrs.length === 0 && <p className="text-xs text-muted-foreground">No preferred manufacturers.</p>}
            </div>
          </Section>
          <Section label="Forbidden manufacturers">
            <div className="flex gap-1.5 flex-wrap">
              {p.forbidden.map(f => (
                <span key={f} className="text-xs px-2 py-1 rounded bg-danger/10 text-danger">{f}</span>
              ))}
              {p.forbidden.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
            </div>
          </Section>
          <Section label="Require attribute exact">
            <div className="space-y-2">
              {(["pkg", "tol", "voltage"] as const).map(k => (
                <label key={k} className="flex items-center justify-between text-sm capitalize">
                  <span>{k}</span>
                  <Switch on={p.require[k]} onClick={() => setP({ ...p, require: { ...p.require, [k]: !p.require[k] } })} />
                </label>
              ))}
            </div>
          </Section>
          <Section label={`Max price increase (${p.maxIncrease}%)`}>
            <input type="range" min={0} max={100} value={p.maxIncrease}
              onChange={(e) => setP({ ...p, maxIncrease: +e.target.value })}
              className="w-full accent-[hsl(var(--accent))]" />
          </Section>
        </div>
        <div className="p-5 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted">Cancel</button>
          <button onClick={() => onSave(p)} className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-sm hover:opacity-90">Save policy</button>
        </div>
      </aside>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow text-muted-foreground mb-2">{label.toUpperCase()}</div>
      {children}
    </div>
  );
}
function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-accent" : "bg-muted"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
