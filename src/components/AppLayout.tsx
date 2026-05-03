import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Boxes, Layers, ShieldCheck, Settings, Search, Moon, Sun, ChevronDown } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";

const nav = [
  { to: "/", label: "Workspace", icon: Boxes, end: true },
  { to: "/jobs", label: "Jobs", icon: Layers },
  { to: "/policies", label: "Policies", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const [tooNarrow, setTooNarrow] = useState(false);
  useEffect(() => {
    const check = () => setTooNarrow(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (tooNarrow) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="max-w-md text-center">
          <div className="eyebrow text-muted-foreground mb-3">BOM INTELLIGENCE ENGINE</div>
          <h1 className="text-2xl mb-2">Best viewed on desktop</h1>
          <p className="text-muted-foreground">This workstation is designed for screens 1024px and wider.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="group/side w-14 hover:w-56 transition-[width] duration-200 border-r border-border bg-sidebar flex flex-col">
        <div className="h-14 flex items-center px-3 border-b border-border">
          <div className="h-8 w-8 rounded-md bg-navy flex items-center justify-center text-navy-foreground mono text-xs font-semibold shrink-0">M</div>
          <span className="ml-3 text-sm font-semibold opacity-0 group-hover/side:opacity-100 transition-opacity whitespace-nowrap">Mouser BOM</span>
        </div>
        <nav className="flex-1 py-3">
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end as boolean | undefined}
                className={({ isActive }) =>
                  `flex items-center h-10 px-3 mx-2 my-0.5 rounded-md text-sm focus-ring ${
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="ml-3 opacity-0 group-hover/side:opacity-100 transition-opacity whitespace-nowrap">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-background/80 backdrop-blur sticky top-0 z-30">
          <button className="flex items-center gap-2 text-sm h-9 px-3 rounded-md hover:bg-muted focus-ring">
            <span className="font-medium">Mouser · Procurement</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search jobs, parts, MPNs…"
                className="w-full h-9 pl-9 pr-3 rounded-md bg-surface-muted border border-border text-sm focus-ring"
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center focus-ring" aria-label="Toggle theme">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <div className="h-8 w-8 rounded-full bg-navy text-navy-foreground mono text-xs flex items-center justify-center">AC</div>
          </div>
        </header>
        <main key={pathname} className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
