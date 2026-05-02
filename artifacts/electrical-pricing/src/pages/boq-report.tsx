import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, RefreshCw, Zap, CheckCircle2, XCircle, AlertTriangle,
  Download, Eye, Brain, Clock, Package, Users, Wrench, Truck, ChevronDown, ChevronUp, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmt(n?: number | null, dec = 0) {
  if (n == null) return "—";
  return n.toLocaleString("en-SA", { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (!score) return null;
  const cls = score >= 85 ? "bg-green-100 text-green-700 border-green-200"
    : score >= 65 ? "bg-yellow-100 text-yellow-700 border-yellow-200"
    : "bg-red-100 text-red-700 border-red-200";
  const label = score >= 85 ? "ممتاز" : score >= 65 ? "جيد" : "يحتاج مراجعة";
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label} {score}/100</span>;
}

function AgentResultCard({ title, titleEn, icon, children, defaultOpen = false }: {
  title: string; titleEn: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 pt-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">{icon}</div>
            <div>
              <div className="font-semibold text-sm">{title}</div>
              <div className="text-[10px] text-muted-foreground">{titleEn}</div>
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export default function BoqReportPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [scenario, setScenario] = useState<"standard" | "economical" | "premium">("standard");
  const pid = projectId ? Number(projectId) : null;

  const { data: projects } = useListProjects({ query: { staleTime: 60000 } });

  const { data: jobStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["agent-status-boq", pid],
    queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/agents/status`); return r.json() as Promise<Record<string, { status: string; result?: unknown }>>; },
    enabled: !!pid, refetchInterval: 3000,
  });

  const { data: boqDoc, refetch: refetchDoc } = useQuery({
    queryKey: ["boq-doc", pid],
    queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/boq-document`); return r.json(); },
    enabled: !!pid, staleTime: 10000,
  });

  const { data: laborData } = useQuery({
    queryKey: ["labor", pid], queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/labor-costs`); return r.json(); },
    enabled: !!pid, staleTime: 30000,
  });
  const { data: procData } = useQuery({
    queryKey: ["proc", pid], queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/procurement`); return r.json(); },
    enabled: !!pid, staleTime: 30000,
  });
  const { data: veData } = useQuery({
    queryKey: ["ve", pid], queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/value-engineering`); return r.json(); },
    enabled: !!pid, staleTime: 30000,
  });
  const { data: timelineData } = useQuery({
    queryKey: ["timeline", pid], queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/timeline`); return r.json(); },
    enabled: !!pid, staleTime: 30000,
  });
  const { data: subData } = useQuery({
    queryKey: ["sub", pid], queryFn: async () => { const r = await fetch(`${API}/api/projects/${pid}/subcontractor-split`); return r.json(); },
    enabled: !!pid, staleTime: 30000,
  });

  function makeRunner(endpoint: string, msg: string) {
    return useMutation({
      mutationFn: async (body?: object) => {
        const r = await fetch(`${API}/api/projects/${pid}/agents/${endpoint}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        return r.json();
      },
      onSuccess: () => { toast({ title: msg }); refetchStatus(); setTimeout(refetchDoc, 5000); },
      onError: () => toast({ title: "خطأ في تشغيل الوكيل", variant: "destructive" }),
    });
  }

  const laborMut = makeRunner("labor-optimizer", "وكيل العمالة يعمل...");
  const procMut = makeRunner("procurement", "وكيل المشتريات يعمل...");
  const veMut = makeRunner("value-engineering", "وكيل هندسة القيمة يعمل...");
  const timelineMut = makeRunner("timeline", "وكيل الجدول الزمني يعمل...");
  const subMut = makeRunner("subcontractor-split", "وكيل تقسيم المقاولين يعمل...");
  const fmtMut = makeRunner("boq-format", "وكيل تنسيق المقايسة يعمل...");
  const revMut = makeRunner("boq-review", "وكيل مراجعة المقايسة يعمل...");

  const runAllMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/api/projects/${pid}/agents/run-all`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => { toast({ title: "🚀 تم تشغيل 17 وكيل ذكاء اصطناعي — يرجى الانتظار..." }); refetchStatus(); },
  });

  const isRunning = (k: string) => jobStatus?.[k]?.status === "running";

  const doc = boqDoc as {
    id?: number; qualityScore?: number; reviewStatus?: string; totalWithVat?: number;
    totalBeforeVat?: number; vatAmount?: number; economicalTotal?: number; premiumTotal?: number;
    sections?: Array<{ sectionNumber: string; titleAr: string; subtotalStd: number }>;
    reviewNotesAr?: string; issuesFound?: Array<{ severity: string; category: string; issueAr: string; recommendationAr: string }>;
    technicalNotesAr?: string;
  } | null;

  const labor = laborData as { grandTotalLaborSar?: number; electricianDays?: number; helperDays?: number; region?: string; recommendations?: string[]; totalLaborPct?: number } | null;
  const proc = procData as { summary?: { totalBulkSavingsSar?: number; totalSupplierCount?: number; procurementPlanAr?: string; localPct?: number }; groups?: Array<{ supplierName: string; totalSupplySar: number; bulkDiscountPct: number }> } | null;
  const ve = veData as { summary?: { totalPotentialSavingsSar?: number; recommendedSavingsSar?: number; totalFindings?: number; overallRecommendationAr?: string }; findings?: Array<{ category: string; findingAr: string; savingsSar: number; riskLevel: string }> } | null;
  const tl = timelineData as { timeline?: { totalDurationWeeks?: number; resourcePeakWorkers?: number; notesAr?: string }; phases?: Array<{ phaseNumber: number; phaseNameAr: string; durationWeeks: number; costPct: number }> } | null;
  const sub = subData as { summary?: { mainContractorPct?: number; subcontractorPct?: number; subcontractorCount?: number; strategyAr?: string }; splits?: Array<{ tradeCategory: string; tradeCategoryAr?: string; isSubcontract: boolean; estimatedValueSar?: number; reasonAr?: string }> } | null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-white shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">المقايسة الاحترافية</h1>
              <p className="text-xs text-muted-foreground">Professional BOQ — وكلاء 10–14 + 16–17 (7 وكلاء متخصصين)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-52 h-9 text-sm"><SelectValue placeholder="اختر مشروعاً..." /></SelectTrigger>
              <SelectContent>
                {(projects as Array<{ id: number; name: string }> | undefined)?.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scenario} onValueChange={v => setScenario(v as typeof scenario)}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="economical">🟢 اقتصادي</SelectItem>
                <SelectItem value="standard">⭐ معياري</SelectItem>
                <SelectItem value="premium">💎 متميز</SelectItem>
              </SelectContent>
            </Select>
            {pid && (
              <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                onClick={() => runAllMut.mutate()} disabled={runAllMut.isPending || isRunning("run-all")}>
                {isRunning("run-all") ? <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />يعمل...</> : <><Brain className="w-3.5 h-3.5 mr-1" />تشغيل كل الوكلاء</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!pid ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <FileText className="w-14 h-14 opacity-20" />
          <p className="font-medium text-base">اختر مشروعاً لإنشاء المقايسة الاحترافية</p>
          <p className="text-sm opacity-70">يجب إكمال التسعير أولاً ثم تشغيل وكلاء المقايسة</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Quick Run Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: "عمالة", labelEn: "10", icon: <Users className="w-3.5 h-3.5" />, mut: laborMut, key: "labor-optimizer" },
              { label: "مشتريات", labelEn: "11", icon: <Truck className="w-3.5 h-3.5" />, mut: procMut, key: "procurement" },
              { label: "هندسة قيمة", labelEn: "12", icon: <Wrench className="w-3.5 h-3.5" />, mut: veMut, key: "value-engineering" },
              { label: "جدول زمني", labelEn: "13", icon: <Clock className="w-3.5 h-3.5" />, mut: timelineMut, key: "timeline" },
              { label: "مقاولون", labelEn: "14", icon: <Package className="w-3.5 h-3.5" />, mut: subMut, key: "subcontractor-split" },
              { label: "تنسيق BOQ", labelEn: "16", icon: <FileText className="w-3.5 h-3.5" />, mut: fmtMut, key: "boq-format", body: { scenario } },
              { label: "مراجعة BOQ", labelEn: "17", icon: <CheckCircle2 className="w-3.5 h-3.5" />, mut: revMut, key: "boq-review" },
            ].map(a => (
              <Button key={a.key} variant="outline" size="sm" className="h-9 text-xs flex-col gap-0.5 py-1"
                onClick={() => a.mut.mutate((a as { body?: object }).body)} disabled={a.mut.isPending || isRunning(a.key)}>
                {isRunning(a.key) ? <RefreshCw className="w-3 h-3 animate-spin" /> : a.icon}
                <span>{a.label}</span>
                <span className="text-[9px] opacity-60">وكيل {a.labelEn}</span>
              </Button>
            ))}
          </div>

          {/* BOQ Document Summary */}
          {doc && (
            <Card className="border-2 border-emerald-200 bg-emerald-50/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-base">وثيقة المقايسة — {doc.sections?.length} قسم</span>
                    {doc.reviewStatus && (
                      <Badge variant={doc.reviewStatus === "approved" ? "default" : doc.reviewStatus === "conditional" ? "secondary" : "destructive"}
                        className="text-xs">
                        {doc.reviewStatus === "approved" ? "✓ معتمد" : doc.reviewStatus === "conditional" ? "تحفظات" : "يحتاج مراجعة"}
                      </Badge>
                    )}
                    <ScoreBadge score={doc.qualityScore} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => window.open(`${API}/api/projects/${pid}/boq-document/html`, "_blank")}>
                      <Eye className="w-3 h-3 mr-1" />معاينة
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => { const a = document.createElement("a"); a.href = `${API}/api/projects/${pid}/boq-document/html`; a.download = "boq.html"; a.click(); }}>
                      <Download className="w-3 h-3 mr-1" />تحميل
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">🟢 اقتصادي</div>
                    <div className="text-lg font-bold text-green-700">{fmt(doc.economicalTotal)} ريال</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-blue-200 bg-blue-50/30">
                    <div className="text-xs text-muted-foreground">⭐ معياري (قبل ضريبة)</div>
                    <div className="text-lg font-bold text-blue-700">{fmt(doc.totalBeforeVat)} ريال</div>
                    <div className="text-xs text-muted-foreground mt-0.5">+ VAT {fmt(doc.vatAmount)} = <b>{fmt(doc.totalWithVat)}</b></div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">💎 متميز</div>
                    <div className="text-lg font-bold text-purple-700">{fmt(doc.premiumTotal)} ريال</div>
                  </div>
                </div>

                {/* Section Subtotals */}
                {doc.sections && doc.sections.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {doc.sections.map((sec) => (
                      <div key={sec.sectionNumber} className="flex justify-between items-center bg-white rounded px-2.5 py-1.5 border text-xs">
                        <span className="text-muted-foreground truncate max-w-[140px]">{sec.sectionNumber}. {sec.titleAr}</span>
                        <span className="font-mono font-semibold text-blue-700 mr-1">{fmt(sec.subtotalStd)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Review Notes */}
                {doc.reviewNotesAr && (
                  <div className="mt-3 bg-white/70 rounded-lg p-3 border text-xs text-muted-foreground" dir="rtl">
                    <span className="font-semibold text-foreground">ملاحظات المراجعة: </span>{doc.reviewNotesAr}
                  </div>
                )}

                {/* Issues */}
                {doc.issuesFound && (doc.issuesFound as Array<{ severity: string; category: string; issueAr: string; recommendationAr: string }>).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {(doc.issuesFound as Array<{ severity: string; category: string; issueAr: string; recommendationAr: string }>).map((issue, i) => (
                      <div key={i} className={`flex gap-2 p-2 rounded border text-xs ${issue.severity === "critical" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                        {issue.severity === "critical" ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
                        <div><span className="font-medium">[{issue.category}] </span>{issue.issueAr} — <span className="text-muted-foreground">{issue.recommendationAr}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Agent 10: Labor */}
          <AgentResultCard title="وكيل تحسين تكاليف العمالة (10)" titleEn="Labor Cost Optimizer — KSA Regional Rates" icon={<Users className="w-4 h-4 text-blue-600" />}>
            {labor ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                    <div className="text-xs text-muted-foreground">الإجمالي الكلي للعمالة</div>
                    <div className="text-xl font-bold text-blue-700">{fmt(labor.grandTotalLaborSar)} ريال</div>
                    <div className="text-xs text-muted-foreground">{fmt(labor.totalLaborPct, 1)}% من تكلفة المشروع · المنطقة: {labor.region}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">أيام العمل — الكهربائيون</div>
                    <div className="text-xl font-bold">{fmt(labor.electricianDays)}</div>
                    <div className="text-xs text-muted-foreground">يوم عمل</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">أيام العمل — المساعدون</div>
                    <div className="text-xl font-bold">{fmt(labor.helperDays)}</div>
                    <div className="text-xs text-muted-foreground">يوم عمل</div>
                  </div>
                </div>
                {labor.recommendations && (labor.recommendations as string[]).length > 0 && (
                  <div className="space-y-1">
                    {(labor.recommendations as string[]).map((rec, i) => (
                      <div key={i} className="flex gap-2 text-xs bg-amber-50 border border-amber-200 rounded p-2">
                        <Star className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="text-xs text-muted-foreground py-3 text-center">لم يُشغَّل الوكيل بعد — اضغط الزر أعلاه</p>}
          </AgentResultCard>

          {/* Agent 11: Procurement */}
          <AgentResultCard title="وكيل تخطيط المشتريات (11)" titleEn="Procurement & Supplier Grouping" icon={<Truck className="w-4 h-4 text-teal-600" />}>
            {proc?.summary ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-teal-50/50 rounded-lg p-3 border border-teal-100">
                    <div className="text-xs text-muted-foreground">توفير الشراء بالجملة</div>
                    <div className="text-xl font-bold text-teal-700">{fmt(proc.summary.totalBulkSavingsSar)} ريال</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">عدد الموردين</div>
                    <div className="text-xl font-bold">{proc.summary.totalSupplierCount}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">نسبة التوريد المحلي</div>
                    <div className="text-xl font-bold text-green-600">{fmt(proc.summary.localPct, 0)}%</div>
                  </div>
                </div>
                {proc.summary.procurementPlanAr && <p className="text-xs bg-muted/30 rounded p-2">{proc.summary.procurementPlanAr}</p>}
                {proc.groups && proc.groups.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {(proc.groups as Array<{ supplierName: string; totalSupplySar: number; bulkDiscountPct: number; priority?: string }>).map((g, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-white border rounded px-3 py-1.5">
                        <span className="font-medium">{g.supplierName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{fmt(g.totalSupplySar)} ريال</span>
                          {g.bulkDiscountPct > 0 && <Badge variant="secondary" className="text-[9px] h-4">خصم {g.bulkDiscountPct}%</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="text-xs text-muted-foreground py-3 text-center">لم يُشغَّل الوكيل بعد</p>}
          </AgentResultCard>

          {/* Agent 12: Value Engineering */}
          <AgentResultCard title="وكيل هندسة القيمة (12)" titleEn="Value Engineering — Cost Optimization" icon={<Wrench className="w-4 h-4 text-orange-600" />}>
            {ve?.summary ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-orange-50/50 rounded-lg p-3 border border-orange-100">
                    <div className="text-xs text-muted-foreground">التوفير الموصى به</div>
                    <div className="text-xl font-bold text-orange-700">{fmt(ve.summary.recommendedSavingsSar)} ريال</div>
                    <div className="text-xs text-muted-foreground">من إجمالي {fmt(ve.summary.totalPotentialSavingsSar)}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">فرص التحسين</div>
                    <div className="text-xl font-bold">{ve.summary.totalFindings}</div>
                    <div className="text-xs text-muted-foreground">إجمالي الفرص</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">منخفضة المخاطر</div>
                    <div className="text-xl font-bold text-green-600">{(ve.findings as Array<{ riskLevel: string }> | undefined)?.filter(f => f.riskLevel === "low").length || 0}</div>
                  </div>
                </div>
                {ve.summary.overallRecommendationAr && <p className="text-xs bg-muted/30 rounded p-2">{ve.summary.overallRecommendationAr}</p>}
                {ve.findings && (ve.findings as Array<{ category: string; findingAr: string; savingsSar: number; riskLevel: string }>).slice(0, 5).map((f, i) => (
                  <div key={i} className="text-xs border rounded p-2.5 bg-white">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium">{f.findingAr}</span>
                      <span className="text-green-700 font-bold shrink-0">وفر {fmt(f.savingsSar)} ريال</span>
                    </div>
                    <span className="text-muted-foreground">{f.category}</span>
                    <Badge variant="outline" className={`ml-1 text-[9px] h-4 ${f.riskLevel === "low" ? "border-green-400 text-green-600" : f.riskLevel === "medium" ? "border-yellow-400 text-yellow-600" : "border-red-400 text-red-600"}`}>
                      مخاطر {f.riskLevel}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground py-3 text-center">لم يُشغَّل الوكيل بعد</p>}
          </AgentResultCard>

          {/* Agent 13: Timeline */}
          <AgentResultCard title="وكيل الجدول الزمني (13)" titleEn="Project Timeline & Phasing" icon={<Clock className="w-4 h-4 text-violet-600" />}>
            {tl?.timeline ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-violet-50/50 rounded-lg p-3 border border-violet-100">
                    <div className="text-xs text-muted-foreground">المدة الكلية</div>
                    <div className="text-xl font-bold text-violet-700">{tl.timeline.totalDurationWeeks} أسبوع</div>
                    <div className="text-xs text-muted-foreground">{(tl.timeline.totalDurationWeeks || 0) * 5} يوم عمل</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">ذروة العمالة</div>
                    <div className="text-xl font-bold">{tl.timeline.resourcePeakWorkers}</div>
                    <div className="text-xs text-muted-foreground">عامل</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">عدد المراحل</div>
                    <div className="text-xl font-bold">{tl.phases?.length}</div>
                  </div>
                </div>
                {tl.timeline.notesAr && <p className="text-xs bg-muted/30 rounded p-2">{tl.timeline.notesAr}</p>}
                {tl.phases && (
                  <div className="space-y-1.5">
                    {(tl.phases as Array<{ phaseNumber: number; phaseNameAr: string; startWeek: number; endWeek: number; durationWeeks: number; costPct: number; laborCount: number }>).map(phase => (
                      <div key={phase.phaseNumber} className="border rounded p-2.5 bg-white text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">المرحلة {phase.phaseNumber}: {phase.phaseNameAr}</span>
                          <span className="text-muted-foreground">أسبوع {phase.startWeek}–{phase.endWeek} · {phase.durationWeeks} أسبوع</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={phase.costPct} className="flex-1 h-1.5" />
                          <span className="text-[10px] font-mono text-muted-foreground">{phase.costPct}% من التكلفة · {phase.laborCount} عامل</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="text-xs text-muted-foreground py-3 text-center">لم يُشغَّل الوكيل بعد</p>}
          </AgentResultCard>

          {/* Agent 14: Subcontractor */}
          <AgentResultCard title="وكيل تقسيم المقاولين (14)" titleEn="Subcontractor BOQ Split" icon={<Package className="w-4 h-4 text-rose-600" />}>
            {sub?.summary ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">المقاول الرئيسي</div>
                    <div className="text-xl font-bold">{sub.summary.mainContractorPct}%</div>
                  </div>
                  <div className="bg-rose-50/50 rounded-lg p-3 border border-rose-100">
                    <div className="text-xs text-muted-foreground">مقاولو الباطن</div>
                    <div className="text-xl font-bold text-rose-700">{sub.summary.subcontractorPct}%</div>
                    <div className="text-xs text-muted-foreground">{sub.summary.subcontractorCount} تخصص</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">متخصصون</div>
                    <div className="text-xl font-bold">{(sub as { summary?: { specialistSubsCount?: number } }).summary?.specialistSubsCount}</div>
                    <div className="text-xs text-muted-foreground">يحتاج تراخيص خاصة</div>
                  </div>
                </div>
                {sub.summary.strategyAr && <p className="text-xs bg-muted/30 rounded p-2">{sub.summary.strategyAr}</p>}
                {sub.splits && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(sub.splits as Array<{ tradeCategory: string; tradeCategoryAr?: string; isSubcontract: boolean; estimatedValueSar?: number; reasonAr?: string; riskLevel?: string }>)
                      .filter(s => s.isSubcontract)
                      .map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs bg-rose-50/50 border border-rose-200 rounded p-2">
                          <Badge variant="destructive" className="text-[9px] h-4 shrink-0 mt-0.5">متعاقَد</Badge>
                          <div>
                            <span className="font-medium">{s.tradeCategoryAr || s.tradeCategory}</span>
                            <span className="text-muted-foreground mr-1">— {fmt(s.estimatedValueSar)} ريال</span>
                            {s.reasonAr && <div className="text-muted-foreground mt-0.5">{s.reasonAr}</div>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ) : <p className="text-xs text-muted-foreground py-3 text-center">لم يُشغَّل الوكيل بعد</p>}
          </AgentResultCard>

        </div>
      )}
    </div>
  );
}
