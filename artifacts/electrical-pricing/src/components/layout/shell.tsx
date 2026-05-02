import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FolderKanban, Database, Settings,
  Bot, BarChart3, ChevronRight, Zap, BrainCircuit,
  FileText, PackageSearch, Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useHealthCheck } from "@workspace/api-client-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { refetchInterval: 30000 } });

  const navGroups = [
    {
      label: "النظام",
      items: [
        { href: "/", label: "لوحة التحكم", labelEn: "Dashboard", icon: LayoutDashboard },
        { href: "/projects", label: "المشاريع", labelEn: "Projects", icon: FolderKanban },
      ],
    },
    {
      label: "التحليل الذكي",
      items: [
        { href: "/agents", label: "وكلاء الذكاء", labelEn: "AI Agents (1–9)", icon: Bot },
        { href: "/intelligence", label: "استخبارات المشروع", labelEn: "Project Intelligence", icon: BrainCircuit },
        { href: "/takeoff", label: "تفصيل المواد", labelEn: "Material Takeoff", icon: BarChart3 },
      ],
    },
    {
      label: "المقايسة والمواد",
      items: [
        { href: "/boq-report", label: "مقايسة احترافية", labelEn: "BOQ Report (16–17)", icon: FileText },
        { href: "/materials-db", label: "إدارة قاعدة البيانات", labelEn: "Materials Manager (15)", icon: Sparkles },
        { href: "/materials", label: "قاعدة الأسعار", labelEn: "Price Database", icon: Database },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] border-r bg-[#0f1729] flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/10 shrink-0">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center mr-2.5 shadow-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-white leading-none">Goval BOQ</h1>
            <p className="text-[10px] text-blue-300/70 leading-none mt-0.5">نظام التسعير الكهربائي</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.label} className="mb-4">
              <p className="text-[10px] font-semibold text-blue-300/50 uppercase tracking-widest px-4 mb-1">{group.label}</p>
              <ul className="space-y-0.5 px-2">
                {group.items.map(item => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-all group ${
                          isActive
                            ? "bg-blue-600/30 text-blue-200 border border-blue-500/30"
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                          <div>
                            <div>{item.label}</div>
                            <div className={`text-[9px] ${isActive ? "text-blue-300/70" : "text-slate-600 group-hover:text-slate-500"}`}>{item.labelEn}</div>
                          </div>
                        </div>
                        {isActive && <ChevronRight className="w-3 h-3 text-blue-400" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center text-xs font-medium text-slate-400">
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              الإعدادات
            </div>
            <ThemeToggle />
          </div>
          <div className={`flex items-center text-[10px] px-2 py-1 rounded ${health?.status === "ok" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${health?.status === "ok" ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            {health?.status === "ok" ? "الخادم متصل" : "الخادم غير متصل"}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50/40 dark:bg-background">
        {children}
      </main>
    </div>
  );
}
