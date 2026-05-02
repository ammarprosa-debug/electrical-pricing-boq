import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListMaterials } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus,
  ShieldCheck, ShieldAlert, Search, Database, Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmt(n?: number | null, dec = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-SA", { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

export default function MaterialsDbPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data: materials, isLoading, refetch: refetchMats } = useListMaterials({
    search: search || undefined,
    category: category !== "all" ? category : undefined,
  });

  const { data: agentStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["mat-agent-status"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/agents/materials-price-update/status`);
      return r.json() as Promise<{
        jobStatus: { status: string };
        latestJob: {
          status: string; updatedCount: number; totalReviewed: number;
          summaryAr: string; completedAt: string;
          marketInsights: {
            overallOutlook?: string; hotCategories?: string[]; priceOutlook3Months?: string;
            buyingAdvice?: string; riskWarnings?: string[];
          } | null;
        } | null;
      }>;
    },
    refetchInterval: 5000,
  });

  const updateMut = useMutation({
    mutationFn: async (forceAll: boolean) => {
      const r = await fetch(`${API}/api/agents/materials-price-update`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll }),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "وكيل مدير الأسعار يعمل — يتحقق من إشارات السوق..." });
      refetchStatus();
      setTimeout(() => { refetchMats(); refetchStatus(); }, 8000);
    },
    onError: () => toast({ title: "خطأ في تشغيل الوكيل", variant: "destructive" }),
  });

  const categories = Array.from(new Set(materials?.map(m => m.category) || []));
  const isRunning = agentStatus?.jobStatus?.status === "running" || updateMut.isPending;
  const latestJob = agentStatus?.latestJob;
  const insights = latestJob?.marketInsights;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-white shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">إدارة قاعدة بيانات المواد</h1>
              <p className="text-xs text-muted-foreground">Materials Database Manager — Agent 15 (AI Price Manager)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 text-xs"
              onClick={() => updateMut.mutate(false)} disabled={isRunning}>
              {isRunning ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />يعمل...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />تحديث الأسعار</>}
            </Button>
            <Button variant="default" size="sm" className="h-9 text-xs bg-purple-600 hover:bg-purple-700"
              onClick={() => updateMut.mutate(true)} disabled={isRunning}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />تحديث كامل
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Agent Status Card */}
        {latestJob && (
          <Card className={`border ${latestJob.status === "completed" ? "border-green-200 bg-green-50/30" : latestJob.status === "running" ? "border-blue-200 bg-blue-50/30" : "border-gray-200"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-2">
                  {latestJob.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : latestJob.status === "running" ? <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  <span className="font-semibold text-sm">
                    {latestJob.status === "completed" ? "آخر تحديث اكتمل" : latestJob.status === "running" ? "الوكيل يعمل الآن..." : "آخر حالة للوكيل"}
                  </span>
                </div>
                {latestJob.completedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(latestJob.completedAt).toLocaleDateString("ar-SA-u-ca-gregory", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {latestJob.summaryAr && <p className="text-sm mb-3">{latestJob.summaryAr}</p>}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white rounded-lg p-2.5 border text-center">
                  <div className="text-2xl font-bold text-blue-700">{latestJob.updatedCount}</div>
                  <div className="text-xs text-muted-foreground">مادة تم تحديثها</div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border text-center">
                  <div className="text-2xl font-bold">{latestJob.totalReviewed}</div>
                  <div className="text-xs text-muted-foreground">مادة تمت مراجعتها</div>
                </div>
              </div>

              {/* Market Insights */}
              {insights && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">رؤى السوق — Market Insights</p>
                  {insights.overallOutlook && (
                    <div className="bg-white/70 rounded-lg p-3 border text-xs">
                      <span className="font-medium">التوقعات الكلية: </span>{insights.overallOutlook}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {insights.priceOutlook3Months && (
                      <div className="bg-white rounded p-2.5 border text-xs">
                        <div className="text-muted-foreground mb-1">توقع الأسعار (3 أشهر)</div>
                        <div className="flex items-center gap-1.5 font-bold">
                          {insights.priceOutlook3Months === "up" ? <TrendingUp className="w-3.5 h-3.5 text-red-500" /> : insights.priceOutlook3Months === "down" ? <TrendingDown className="w-3.5 h-3.5 text-green-500" /> : <Minus className="w-3.5 h-3.5 text-blue-500" />}
                          {insights.priceOutlook3Months === "up" ? "ارتفاع متوقع" : insights.priceOutlook3Months === "down" ? "انخفاض متوقع" : "مستقر"}
                        </div>
                      </div>
                    )}
                    {insights.hotCategories && insights.hotCategories.length > 0 && (
                      <div className="bg-white rounded p-2.5 border text-xs">
                        <div className="text-muted-foreground mb-1">فئات تحت المراقبة</div>
                        <div className="flex flex-wrap gap-1">
                          {insights.hotCategories.slice(0, 3).map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] h-4">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {insights.buyingAdvice && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs">
                      <span className="font-medium text-amber-700">نصيحة الشراء: </span>{insights.buyingAdvice}
                    </div>
                  )}
                  {insights.riskWarnings && insights.riskWarnings.length > 0 && (
                    <div className="space-y-1">
                      {insights.riskWarnings.map((w, i) => (
                        <div key={i} className="flex gap-1.5 text-xs bg-red-50 border border-red-200 rounded p-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "إجمالي المواد", value: materials?.length || 0, icon: <Database className="w-4 h-4 text-blue-500" /> },
            { label: "معتمدة SASO", value: materials?.filter(m => m.sasoApproved).length || 0, icon: <ShieldCheck className="w-4 h-4 text-green-500" /> },
            { label: "التصنيفات", value: categories.length, icon: <Sparkles className="w-4 h-4 text-purple-500" /> },
            { label: "تحت المراجعة", value: materials?.filter(m => !m.sasoApproved).length || 0, icon: <ShieldAlert className="w-4 h-4 text-amber-500" /> },
          ].map((stat, i) => (
            <Card key={i} className="border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">{stat.icon}</div>
                <div>
                  <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 bg-background h-9 text-sm" placeholder="بحث في المواد..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-60 h-9 text-sm"><SelectValue placeholder="جميع الفئات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Materials Table */}
        <Card>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground min-w-[200px]">المادة</th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">الفئة</th>
                  <th className="h-10 px-4 text-center align-middle font-medium text-muted-foreground w-16">الوحدة</th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground bg-green-50/50">اقتصادي</th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground bg-blue-50/50">معياري ⭐</th>
                  <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground bg-purple-50/50">متميز</th>
                  <th className="h-10 px-4 text-center align-middle font-medium text-muted-foreground w-24">SASO</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {materials?.map(mat => (
                  <tr key={mat.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 align-middle">
                      <div className="font-medium text-sm">{mat.nameAr || mat.nameEn}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{mat.nameEn}</div>
                      {mat.brand && <div className="text-[10px] text-blue-600 mt-0.5">{mat.brand}</div>}
                    </td>
                    <td className="p-3 align-middle">
                      <Badge variant="outline" className="text-[10px] h-5">{mat.category}</Badge>
                    </td>
                    <td className="p-3 align-middle text-center text-xs text-muted-foreground">{mat.unit}</td>
                    <td className="p-3 align-middle text-right font-mono text-sm bg-green-50/20">
                      {fmt(mat.priceEconomical)}
                    </td>
                    <td className="p-3 align-middle text-right font-mono text-sm font-bold text-blue-700 bg-blue-50/20">
                      {fmt(mat.priceStandard)}
                    </td>
                    <td className="p-3 align-middle text-right font-mono text-sm bg-purple-50/20">
                      {fmt(mat.pricePremium)}
                    </td>
                    <td className="p-3 align-middle text-center">
                      {mat.sasoApproved ? (
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50 text-[10px]">
                          <ShieldCheck className="w-3 h-3 mr-1" />SASO
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 text-[10px]">
                          <ShieldAlert className="w-3 h-3 mr-1" />مراجعة
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!materials?.length && !isLoading && (
              <div className="p-8 text-center text-muted-foreground">لا توجد مواد مطابقة</div>
            )}
            {isLoading && (
              <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />جاري التحميل...
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
