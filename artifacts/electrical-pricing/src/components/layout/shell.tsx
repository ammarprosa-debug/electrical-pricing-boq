import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderKanban, Database, Settings, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useHealthCheck } from "@workspace/api-client-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { refetchInterval: 30000 } });

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/materials", label: "Materials", icon: Database },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b shrink-0">
          <div className="w-6 h-6 bg-primary rounded-sm mr-3"></div>
          <h1 className="font-bold text-lg tracking-tight text-sidebar-foreground">Goval BOQ</h1>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-sm font-medium text-sidebar-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full mr-2 ${health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            API Status: {health?.status === 'ok' ? 'Online' : 'Offline'}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
