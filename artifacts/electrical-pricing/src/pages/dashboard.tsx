import { useGetProjectsStats, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, CheckCircle2, ListTodo, AlertCircle, TrendingUp,
  FolderOpen, Bot, Zap, ArrowUpRight, Clock, BarChart2
} from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:      { label: "مسودة",    color: "text-slate-600",  bg: "bg-slate-100" },
  parsing:    { label: "قراءة...", color: "text-yellow-600", bg: "bg-yellow-100" },
  pricing:    { label: "تسعير...", color: "text-blue-600",   bg: "bg-blue-100" },
  reviewing:  { label: "مراجعة",  color: "text-amber-600",  bg: "bg-amber-100" },
  completed:  { label: "مكتمل",   color: "text-emerald-600",bg: "bg-emerald-100" },
  failed:     { label: "فشل",     color: "text-red-600",    bg: "bg-red-100" },
};

const REGION_LABELS: Record<string, string> = {
  riyadh: "الرياض", jeddah: "جدة", dammam: "الدمام", other: "أخرى"
};

export default function Dashboard() {
  const { data: stats } = useGetProjectsStats();
  const { data: projects, isLoading } = useListProjects();

  const recentProjects = projects?.slice(0, 6) || [];
  const completedProjects = projects?.filter(p => p.status === "completed") || [];
  const totalSAR = completedProjects.reduce((s, p) => s + (p.totalStandard || 0), 0);

  const chartData = (projects || [])
    .filter(p => p.totalStandard && p.totalStandard > 0)
    .slice(0, 6)
    .map(p => ({
      name: p.name.slice(0, 18),
      value: Math.round((p.totalStandard || 0) / 1000),
    }))
    .reverse();

  const kpis = [
    {
      label: "إجمالي المشاريع",
      labelEn: "Total Projects",
      value: stats?.totalProjects || 0,
      icon: <FolderOpen className="w-5 h-5" />,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200 dark:border-blue-800",
    },
    {
      label: "قيد التنفيذ",
      labelEn: "In Progress",
      value: stats?.inProgressProjects || 0,
      icon: <Activity className="w-5 h-5" />,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-800",
    },
    {
      label: "بنود مسعّرة",
      labelEn: "Items Priced",
      value: (stats?.totalItemsPriced || 0).toLocaleString(),
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    {
      label: "دقة الذكاء الاصطناعي",
      labelEn: "AI Confidence",
      value: stats?.avgConfidenceScore ? `${stats.avgConfidenceScore.toFixed(1)}%` : "–",
      icon: <BarChart2 className="w-5 h-5" />,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
      border: "border-purple-200 dark:border-purple-800",
    },
  ];

  return (
    <div className="flex-1 overflow-auto">
      {/* Top bar */}
      <div className="border-b bg-background px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold">لوحة التحكم الرئيسية</h1>
          <p className="text-xs text-muted-foreground">نظام تسعير المشاريع الكهربائية — السوق السعودي 2025</p>
        </div>
        <Link href="/projects">
          <button className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors">
            <Zap className="w-3.5 h-3.5" /> مشروع جديد
          </button>
        </Link>
      </div>

      <div className="p-5 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((kpi, i) => (
            <Card key={i} className={`border ${kpi.border} ${kpi.bg} shadow-none`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5" dir="rtl">{kpi.label}</p>
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{kpi.labelEn}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}>
                    {kpi.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <Card className="lg:col-span-2 shadow-none border">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  قيمة المشاريع (ألف ريال — سيناريو معياري)
                </CardTitle>
                <span className="text-xs text-muted-foreground font-mono font-semibold">
                  {(totalSAR / 1000000).toFixed(2)} مليون SAR
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v: number) => [`${v.toLocaleString()} ألف SAR`]}
                      contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i % 2 === 0 ? "#3b82f6" : "#60a5fa"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">
                  لا توجد بيانات مشاريع بعد
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Agents Card */}
          <Card className="shadow-none border bg-gradient-to-br from-slate-900 to-blue-950 text-white">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-200">
                <Bot className="w-4 h-4" /> وكلاء الذكاء الاصطناعي
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {[
                { name: "مراجعة أسعار السوق السعودي", nameEn: "KSA Market Price Comparator", icon: "🔍", color: "text-blue-300" },
                { name: "مراجعة الامتثال والاتساق", nameEn: "Compliance & Consistency Validator", icon: "✅", color: "text-emerald-300" },
                { name: "تفصيل المواد (MTO)", nameEn: "Material Sub-Components Breakdown", icon: "📋", color: "text-amber-300" },
                { name: "إثراء قاعدة BOM", nameEn: "BOM Enrichment & KSA Prices", icon: "💡", color: "text-purple-300" },
              ].map((agent, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <span className="text-lg shrink-0">{agent.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${agent.color} truncate`}>{agent.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{agent.nameEn}</p>
                  </div>
                </div>
              ))}
              <Link href="/agents">
                <button className="w-full mt-1 text-xs bg-blue-600/40 hover:bg-blue-600/60 text-blue-200 rounded-lg py-2 flex items-center justify-center gap-1.5 transition-colors font-medium">
                  <Bot className="w-3.5 h-3.5" /> تشغيل الوكلاء
                </button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <Card className="shadow-none border">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> آخر المشاريع
              </CardTitle>
              <Link href="/projects">
                <button className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
                  عرض الكل <ArrowUpRight className="w-3 h-3" />
                </button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}</div>
            ) : recentProjects.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                لا توجد مشاريع بعد — <Link href="/projects"><span className="text-blue-500 hover:underline cursor-pointer">أنشئ مشروعاً جديداً</span></Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentProjects.map(project => {
                  const sc = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
                  const progress = project.totalItems > 0
                    ? Math.round((project.pricedItems / project.totalItems) * 100) : 0;
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-muted">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${sc.bg}`}>
                          <Zap className={`w-3.5 h-3.5 ${sc.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-semibold truncate">{project.name}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${sc.bg} ${sc.color}`}>{sc.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="flex-1 h-1" />
                            <span className="text-[10px] text-muted-foreground shrink-0">{progress}%</span>
                            {project.totalStandard ? (
                              <span className="text-[10px] font-mono text-emerald-600 shrink-0">
                                {(project.totalStandard / 1000).toFixed(0)}K SAR
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{REGION_LABELS[project.region] || project.region}</span>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground">{project.totalItems} بند</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
