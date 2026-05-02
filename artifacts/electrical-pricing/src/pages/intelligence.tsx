import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertTriangle, Shield, Brain, TrendingDown, Search, Handshake,
  Zap, RefreshCw, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  AlertOctagon, Package, BarChart3, DollarSign, ArrowDownCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmt(n?: number | null, dec = 0) {
  if (n == null) return "—";
  return n.toLocaleString("en-SA", { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

function RiskBadge({ level }: { level?: string | null }) {
  const map: Record<string, { label: string; labelAr: string; cls: string }> = {
    critical: { label: "Critical", labelAr: "حرج", cls: "bg-red-100 text-red-700 border-red-200" },
    high: { label: "High", labelAr: "مرتفع", cls: "bg-orange-100 text-orange-700 border-orange-200" },
    medium: { label: "Medium", labelAr: "متوسط", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    low: { label: "Low", labelAr: "منخفض", cls: "bg-green-100 text-green-700 border-green-200" },
  };
  const r = map[level || "low"] || map["low"];
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${r.cls}`}>{r.labelAr} / {r.label}</span>;
}

function AgentCard({
  icon, title, titleEn, badge, badgeVariant, description, children, onRun, running,
}: {
  icon: React.ReactNode; title: string; titleEn: string;
  badge?: string; badgeVariant?: "default" | "destructive" | "outline" | "secondary";
  description: string; children?: React.ReactNode;
  onRun?: () => void; running?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">{icon}</div>
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                {title}
                {badge && <Badge variant={badgeVariant || "secondary"} className="text-[10px] h-4 px-1.5">{badge}</Badge>}
              </div>
              <div className="text-[10px] text-muted-foreground">{titleEn}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onRun && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRun} disabled={running}>
                {running ? <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />يعمل...</> : <><Zap className="w-3 h-3 mr-1.5" />تشغيل</>}
              </Button>
            )}
            {children && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setOpen(o => !o)}>
                {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardHeader>
      {open && children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export default function IntelligencePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState<string>("");
  const pid = projectId ? Number(projectId) : null;

  const { data: projects } = useListProjects({ query: { staleTime: 60000 } });

  // ── Data queries ────────────────────────────────────────────────────────────
  const { data: scopeGaps, refetch: refetchGaps } = useQuery({
    queryKey: ["scope-gaps", pid],
    queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/scope-gaps`); return r.json(); },
    enabled: !!pid, staleTime: 30000,
  });

  const { data: risk, refetch: refetchRisk } = useQuery({
    queryKey: ["risk", pid],
    queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/risk`); return r.json(); },
    enabled: !!pid, staleTime: 30000,
  });

  const { data: alternatives, refetch: refetchAlts } = useQuery({
    queryKey: ["alternatives", pid],
    queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/alternatives`); return r.json() as Promise<Array<{
      id: number; boqItemId: number; rank: number; brand: string; brandAr?: string;
      spec: string; specAr?: string; unitPriceSar: number; originalPriceSar?: number;
      savingsPct?: number; savingsSar?: number; sasoApproved?: boolean; availability?: string;
    }>>; },
    enabled: !!pid, staleTime: 30000,
  });

  const { data: priceReviews } = useQuery({
    queryKey: ["price-reviews-anomaly", pid],
    queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/price-reviews?agent=anomaly_detector`); return r.json(); },
    enabled: !!pid, staleTime: 30000,
  });

  const { data: jobStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["agent-status", pid],
    queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/agents/status`); return r.json() as Promise<Record<string, { status: string; result?: unknown; startedAt?: string }>>; },
    enabled: !!pid, refetchInterval: 3000,
  });

  // ── Agent run mutations ─────────────────────────────────────────────────────
  function makeRunner(endpoint: string, successMsg: string) {
    return useMutation({
      mutationFn: async () => {
        const r = await fetch(`${API}/api/projects/${pid}/agents/${endpoint}`, { method: "POST" });
        return r.json();
      },
      onSuccess: () => { toast({ title: successMsg }); refetchStatus(); },
      onError: () => toast({ title: "خطأ في تشغيل الوكيل", variant: "destructive" }),
    });
  }

  const anomalyMut = makeRunner("anomaly-detection", "وكيل كشف الشذوذ يعمل...");
  const riskMut = makeRunner("risk-analysis", "وكيل تحليل المخاطر يعمل...");
  const scopeMut = makeRunner("scope-analysis", "وكيل تحليل النطاق يعمل...");
  const negMut = makeRunner("negotiation", "وكيل التفاوض يعمل...");
  const altsMut = makeRunner("alternatives", "وكيل المواد البديلة يعمل...");
  const runAllMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/api/projects/${pid}/agents/run-all`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => { toast({ title: "🚀 تم تشغيل جميع الوكلاء التسعة — يرجى الانتظار..." }); refetchStatus(); },
    onError: () => toast({ title: "خطأ", variant: "destructive" }),
  });

  const isRunning = (key: string) => jobStatus?.[key]?.status === "running";

  // ── Computed values ─────────────────────────────────────────────────────────
  const anomalyReviews = Array.isArray(priceReviews) ? priceReviews : [];
  const criticalAnomalies = anomalyReviews.filter((r: { severity?: string }) => r.severity === "critical");
  const altsArr = Array.isArray(alternatives) ? alternatives : [];
  const totalAltSaving = altsArr.reduce((s: number, a) => s + (a.savingsSar || 0), 0);
  const gapsArr = Array.isArray(scopeGaps) ? scopeGaps : [];
  const gapCostMin = gapsArr.reduce((s: number, g: { estimatedCostMin?: number }) => s + (g.estimatedCostMin || 0), 0);
  const gapCostMax = gapsArr.reduce((s: number, g: { estimatedCostMax?: number }) => s + (g.estimatedCostMax || 0), 0);

  const negResult = jobStatus?.["negotiation"]?.result as {
    recommendedBidSar?: number; safeLowerFloorSar?: number; maxDiscountPct?: number;
    overallMarginPct?: number; highFlexCategories?: string[]; fixedCostCategories?: string[];
    bidStrategy?: string; bidStrategyAr?: string;
    paymentMilestones?: Array<{ phase: string; phaseAr: string; pct: number; trigger: string; triggerAr: string }>;
    keyNegotiationPoints?: string[]; keyNegotiationPointsAr?: string[];
    competitorUndercut?: { likelySar: number; likelyPct: number; riskLevel: string };
  } | null;

  const riskData = risk as {
    riskLevel?: string; totalProjectCost?: number; commodityExposureSar?: number;
    commodityExposurePct?: number; contingencySar?: number; contingencyPct?: number;
    copperSar?: number; aluminumSar?: number; steelSar?: number;
    itemsAtRisk?: Array<{ id: number; desc: string; category: string; totalSar: number; commodityExposurePct: number; riskLevel: string }>;
  } | null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-white dark:bg-background shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-sm">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">استخبارات المشروع</h1>
              <p className="text-xs text-muted-foreground">Project Intelligence — 5 وكلاء متخصصين: شذوذ، مخاطر، نطاق، تفاوض، بدائل</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-56 h-9 text-sm">
                <SelectValue placeholder="اختر مشروعاً..." />
              </SelectTrigger>
              <SelectContent>
                {(projects as Array<{ id: number; name: string }> | undefined)?.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pid && (
              <Button size="sm" className="h-9 bg-violet-600 hover:bg-violet-700 text-white text-xs"
                onClick={() => runAllMut.mutate()} disabled={runAllMut.isPending || isRunning("run-all")}>
                {isRunning("run-all") ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />يعمل...</> : <><Brain className="w-3.5 h-3.5 mr-1.5" />تشغيل كل الوكلاء</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!pid ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Brain className="w-14 h-14 opacity-20" />
          <p className="font-medium text-base">اختر مشروعاً لعرض التحليل الذكي</p>
          <p className="text-sm opacity-70">يجب إكمال التسعير أولاً قبل تشغيل الوكلاء</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* KPI Summary Row */}
            {(riskData || gapsArr.length > 0 || altsArr.length > 0) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border bg-orange-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertOctagon className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-medium text-orange-700">تعرض السلع</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{fmt(riskData?.commodityExposurePct, 1)}%</div>
                    <div className="text-xs text-muted-foreground">{fmt(riskData?.commodityExposureSar)} ريال نحاس/ألمنيوم/فولاذ</div>
                    {riskData?.riskLevel && <RiskBadge level={riskData.riskLevel} />}
                  </CardContent>
                </Card>
                <Card className="border bg-red-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-medium text-red-700">فجوات النطاق</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{gapsArr.length}</div>
                    <div className="text-xs text-muted-foreground">نظام مفقود · تكلفة محتملة {fmt(gapCostMin)}–{fmt(gapCostMax)} ريال</div>
                  </CardContent>
                </Card>
                <Card className="border bg-amber-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Search className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-medium text-amber-700">شذوذات الأسعار</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600">{anomalyReviews.length}</div>
                    <div className="text-xs text-muted-foreground">{criticalAnomalies.length} حرج · {anomalyReviews.length - criticalAnomalies.length} تحذير</div>
                  </CardContent>
                </Card>
                <Card className="border bg-green-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <TrendingDown className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-medium text-green-700">توفير بالبدائل</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{fmt(totalAltSaving)} ريال</div>
                    <div className="text-xs text-muted-foreground">{altsArr.length} بديل متاح في السوق السعودي</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Agent 5: Anomaly Detection ───────────────────────────────── */}
            <AgentCard
              icon={<Search className="w-4 h-4 text-amber-600" />}
              title="كشف الشذوذ الإحصائي"
              titleEn="Anomaly Detection Agent (IQR Method)"
              badge={anomalyReviews.length > 0 ? `${anomalyReviews.length} شذوذ` : undefined}
              badgeVariant={criticalAnomalies.length > 0 ? "destructive" : "secondary"}
              description="يكتشف الأسعار الشاذة إحصائياً (IQR)، الأسعار الصفرية، البنود المكررة، وعدم تطابق الوحدات. لا يحتاج نداء AI — سريع ودقيق."
              onRun={() => anomalyMut.mutate()}
              running={anomalyMut.isPending || isRunning("anomaly-detection")}
            >
              {anomalyReviews.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {anomalyReviews.map((r: { id: number; severity?: string; reviewType?: string; title?: string; description?: string; descriptionAr?: string; currentValue?: number; minMarketValue?: number; maxMarketValue?: number }) => (
                    <div key={r.id} className={`flex gap-3 p-2.5 rounded-lg border text-xs ${r.severity === "critical" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                      <div className="shrink-0 mt-0.5">
                        {r.severity === "critical"
                          ? <XCircle className="w-3.5 h-3.5 text-red-500" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate">{r.title?.replace(/_/g, " ")}</div>
                        <div className="text-muted-foreground mt-0.5 line-clamp-2">{r.descriptionAr || r.description}</div>
                        {r.currentValue && (
                          <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                            القيمة: <b>{fmt(r.currentValue)}</b> ريال
                            {r.minMarketValue && r.maxMarketValue && <> · نطاق متوقع: {fmt(r.minMarketValue)}–{fmt(r.maxMarketValue)}</>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد شذوذات مكتشفة حتى الآن — شغّل الوكيل أولاً</p>
              )}
            </AgentCard>

            {/* ── Agent 6: Risk Analysis ───────────────────────────────────── */}
            <AgentCard
              icon={<Shield className="w-4 h-4 text-orange-600" />}
              title="تحليل مخاطر السلع"
              titleEn="Commodity Risk Analyzer"
              badge={riskData?.riskLevel ? riskData.riskLevel.toUpperCase() : undefined}
              badgeVariant={riskData?.riskLevel === "high" || riskData?.riskLevel === "critical" ? "destructive" : "secondary"}
              description="يحسب نسبة تعرض المشروع لتقلبات أسعار النحاس والألمنيوم والفولاذ، ويوصي بنسبة الاحتياطي المناسبة."
              onRun={() => riskMut.mutate()}
              running={riskMut.isPending || isRunning("risk-analysis")}
            >
              {riskData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "نحاس", labelEn: "Copper", value: riskData.copperSar, color: "text-orange-600" },
                      { label: "ألمنيوم", labelEn: "Aluminum", value: riskData.aluminumSar, color: "text-blue-600" },
                      { label: "فولاذ", labelEn: "Steel", value: riskData.steelSar, color: "text-slate-600" },
                    ].map(c => (
                      <div key={c.label} className="bg-muted/50 rounded-lg p-3 text-center">
                        <div className={`text-lg font-bold ${c.color}`}>{fmt(c.value)} ريال</div>
                        <div className="text-xs text-muted-foreground">{c.label} / {c.labelEn}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي تعرض السلع:</span>
                      <b>{fmt(riskData.commodityExposureSar)} ريال ({fmt(riskData.commodityExposurePct, 1)}%)</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الاحتياطي الموصى به:</span>
                      <b className="text-red-600">{fmt(riskData.contingencySar)} ريال ({fmt(riskData.contingencyPct, 1)}%)</b>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">مستوى المخاطر الكلي:</span>
                      <RiskBadge level={riskData.riskLevel} />
                    </div>
                  </div>
                  {(riskData.itemsAtRisk as Array<{ id: number; desc: string; category: string; commodityExposurePct: number; riskLevel: string }> | undefined)?.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs border-b pb-2 last:border-0 last:pb-0">
                      <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-orange-700">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.desc}</div>
                        <div className="text-muted-foreground">{item.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-orange-600">{fmt(item.commodityExposurePct, 0)}% تعرض</div>
                        <RiskBadge level={item.riskLevel} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">لم يُجرَ تحليل المخاطر بعد — شغّل الوكيل أولاً</p>
              )}
            </AgentCard>

            {/* ── Agent 7: Scope Analysis ──────────────────────────────────── */}
            <AgentCard
              icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
              title="كاشف فجوات النطاق"
              titleEn="Scope Gap Analyzer"
              badge={gapsArr.length > 0 ? `${gapsArr.length} نظام مفقود` : undefined}
              badgeVariant={gapsArr.filter((g: { riskLevel?: string }) => g.riskLevel === "critical").length > 0 ? "destructive" : "secondary"}
              description="يرصد الأنظمة الكهربائية المطلوبة بمعايير KSA/SEC المفقودة من المقايسة (تأريض، إضاءة طوارئ، صواعق، مولد، اختبار وتشغيل...)."
              onRun={() => scopeMut.mutate()}
              running={scopeMut.isPending || isRunning("scope-analysis")}
            >
              {gapsArr.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {gapsArr.map((gap: { id: number; system?: string; systemAr?: string; riskLevel?: string; estimatedCostMin?: number; estimatedCostMax?: number; recommendationAr?: string; recommendation?: string; boqSection?: string }) => (
                    <div key={gap.id} className={`p-3 rounded-lg border text-xs ${gap.riskLevel === "critical" ? "bg-red-50 border-red-200" : gap.riskLevel === "high" ? "bg-orange-50 border-orange-200" : "bg-yellow-50 border-yellow-200"}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-semibold">{gap.systemAr || gap.system}</div>
                        <RiskBadge level={gap.riskLevel} />
                      </div>
                      <div className="text-muted-foreground mb-1.5">{gap.recommendationAr || gap.recommendation}</div>
                      <div className="flex items-center gap-3 text-[10px] font-mono">
                        <span className="bg-white/70 rounded px-1.5 py-0.5 border">
                          تكلفة متوقعة: {fmt(gap.estimatedCostMin)}–{fmt(gap.estimatedCostMax)} ريال
                        </span>
                        {gap.boqSection && <span className="text-muted-foreground">القسم: {gap.boqSection}</span>}
                      </div>
                    </div>
                  ))}
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-center">
                    <b>إجمالي تكلفة الفجوات المقدرة:</b> {fmt(gapCostMin)}–{fmt(gapCostMax)} ريال
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">لم يُجرَ تحليل نطاق المشروع — شغّل الوكيل أولاً</p>
              )}
            </AgentCard>

            {/* ── Agent 8: Negotiation Strategy ───────────────────────────── */}
            <AgentCard
              icon={<Handshake className="w-4 h-4 text-violet-600" />}
              title="استراتيجية التفاوض والعطاء"
              titleEn="Negotiation Strategy Agent"
              badge={negResult?.maxDiscountPct ? `هامش ${fmt(negResult.maxDiscountPct, 1)}%` : undefined}
              description="يحلل هوامش الربح بكل فئة، يحدد مجال التفاوض الآمن، ويوصي بهيكل دفعات المرحلية المثلى للمشروع."
              onRun={() => negMut.mutate()}
              running={negMut.isPending || isRunning("negotiation")}
            >
              {negResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "سعر العطاء المقترح", value: negResult.recommendedBidSar, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                      { label: "الحد الأدنى الآمن", value: negResult.safeLowerFloorSar, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
                      { label: "هامش الربح الكلي", value: negResult.overallMarginPct, suffix: "%", color: "text-green-700", bg: "bg-green-50 border-green-200" },
                    ].map(k => (
                      <div key={k.label} className={`rounded-lg p-3 border text-center ${k.bg}`}>
                        <div className={`text-base font-bold ${k.color}`}>{fmt(k.value, k.suffix ? 1 : 0)}{k.suffix || " ريال"}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {negResult.bidStrategyAr && (
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-xs">
                      <div className="font-semibold text-violet-700 mb-1">💡 الاستراتيجية الموصى بها:</div>
                      <p className="text-foreground leading-relaxed">{negResult.bidStrategyAr}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-green-700 mb-1.5">✅ فئات قابلة للتفاوض</div>
                      {negResult.highFlexCategories?.slice(0, 4).map(c => (
                        <div key={c} className="flex items-center gap-1.5 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />{c}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="font-semibold text-red-700 mb-1.5">🔒 تكاليف ثابتة لا تُخفَّض</div>
                      {negResult.fixedCostCategories?.slice(0, 4).map(c => (
                        <div key={c} className="flex items-center gap-1.5 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />{c}
                        </div>
                      ))}
                    </div>
                  </div>

                  {negResult.paymentMilestones && (
                    <div>
                      <div className="text-xs font-semibold mb-2">جدول الدفعات المرحلية المقترح</div>
                      <div className="space-y-1.5">
                        {negResult.paymentMilestones.map((m, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <div className="w-10 text-right font-bold text-blue-600 shrink-0">{m.pct}%</div>
                            <div className="flex-1">
                              <Progress value={m.pct} className="h-1.5 mb-0.5" />
                              <div className="font-medium">{m.phaseAr}</div>
                              <div className="text-[10px] text-muted-foreground">{m.triggerAr}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {negResult.keyNegotiationPointsAr && negResult.keyNegotiationPointsAr.length > 0 && (
                    <div className="bg-slate-50 border rounded-lg p-3">
                      <div className="text-xs font-semibold mb-2">نقاط تفاوض رئيسية</div>
                      <ul className="space-y-1">
                        {negResult.keyNegotiationPointsAr.map((p, i) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <span className="text-violet-500 font-bold shrink-0">{i + 1}.</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">لم يُجرَ تحليل التفاوض — شغّل الوكيل أولاً</p>
              )}
            </AgentCard>

            {/* ── Agent 9: Alternative Materials ──────────────────────────── */}
            <AgentCard
              icon={<TrendingDown className="w-4 h-4 text-green-600" />}
              title="المواد البديلة الأقل تكلفة"
              titleEn="Alternative Materials Agent"
              badge={altsArr.length > 0 ? `وفر ${fmt(totalAltSaving)} ريال` : undefined}
              badgeVariant="secondary"
              description="يقترح بدائل معتمدة SASO وIEC بأسعار أقل من السوق السعودي للبنود ذات القيمة العالية."
              onRun={() => altsMut.mutate()}
              running={altsMut.isPending || isRunning("alternatives")}
            >
              {altsArr.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {altsArr.slice(0, 20).map(alt => (
                    <div key={alt.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-green-50/50 text-xs">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-green-700">{alt.rank}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{alt.brandAr || alt.brand}</div>
                        <div className="text-muted-foreground truncate">{alt.specAr || alt.spec}</div>
                        {alt.availability && <div className="text-[10px] text-muted-foreground">{alt.availability}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-green-700">{fmt(alt.unitPriceSar)} ريال</div>
                        {alt.originalPriceSar && <div className="text-[10px] text-muted-foreground line-through">{fmt(alt.originalPriceSar)} ريال</div>}
                        {alt.savingsPct && (
                          <div className="text-[10px] font-bold text-green-600">-{fmt(alt.savingsPct, 1)}% وفر</div>
                        )}
                        {alt.sasoApproved && <div className="text-[10px] text-emerald-600 flex items-center gap-0.5 justify-end"><CheckCircle2 className="w-2.5 h-2.5" />SASO</div>}
                      </div>
                    </div>
                  ))}
                  {totalAltSaving > 0 && (
                    <div className="p-2.5 bg-green-100 border border-green-300 rounded-lg text-xs text-center">
                      <b className="text-green-700">إجمالي التوفير الممكن: {fmt(totalAltSaving)} ريال</b> بالتحول للبدائل المعتمدة
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">لم يُجرَ تحليل البدائل — شغّل الوكيل أولاً</p>
              )}
            </AgentCard>

          </div>
        </div>
      )}
    </div>
  );
}
