import { useParams } from "wouter";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bot, Play, CheckCircle2, AlertTriangle, XCircle, Info, ChevronDown,
  BarChart3, Zap, RefreshCw, TrendingUp, TrendingDown, ArrowRight,
  Wrench, ShieldCheck, Layers, Sparkles
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Review = {
  id: number; projectId: number; boqItemId?: number;
  agentId: string; agentName: string; reviewType: string;
  severity: "info" | "warning" | "critical"; status: string;
  title: string; titleAr?: string; description: string; descriptionAr?: string;
  currentValue?: number; suggestedValue?: number;
  variancePercent?: number; recommendation?: string; recommendationAr?: string;
  autoFixApplied?: boolean; createdAt: string;
};

type ReviewSummary = {
  total: number; critical: number; warnings: number; info: number; pending: number;
  byAgent: { market_comparator: number; compliance_validator: number };
  byType: Record<string, number>;
};

type AgentStatus = {
  "price-review": { status: string; result?: { total: number; critical: number; warnings: number } };
  "compliance-review": { status: string; result?: { total: number; issues: number } };
  "material-takeoff": { status: string; result?: { processed: number; subItems: number } };
  "run-all": { status: string; result?: unknown };
};

const AGENTS = [
  {
    id: "market_comparator",
    jobKey: "price-review",
    endpoint: "price-review",
    name: "وكيل مراجعة أسعار السوق",
    nameEn: "KSA Market Price Comparator",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    description: "يقارن أسعار المقايسة مع قاعدة بيانات السوق السعودي 2025، ويكتشف الانحرافات والتسعير غير الواقعي",
  },
  {
    id: "compliance_validator",
    jobKey: "compliance-review",
    endpoint: "compliance-review",
    name: "وكيل الامتثال والاتساق",
    nameEn: "Compliance & Consistency Validator",
    icon: <ShieldCheck className="w-5 h-5" />,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    description: "يتحقق من مطابقة SASO، ويكتشف التناقضات في التسعير، ويرصد المشكلات المنهجية في المقايسة",
  },
  {
    id: "material_takeoff",
    jobKey: "material-takeoff",
    endpoint: "material-takeoff",
    name: "وكيل تفصيل المواد (MTO)",
    nameEn: "Material Sub-Components Breakdown",
    icon: <Layers className="w-5 h-5" />,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    description: "يفكك كل بند BOQ إلى مكوناته المادية الفعلية مع الكميات والأسعار — مثل Material Takeoff الاحترافي",
  },
  {
    id: "bom_enrichment",
    jobKey: "material-takeoff",
    endpoint: null,
    name: "وكيل إثراء BOM",
    nameEn: "BOM Enrichment & KSA Price Augmentation",
    icon: <Sparkles className="w-5 h-5" />,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    description: "يربط كل مادة من قائمة BOM بأسعار السوق السعودي والعلامات التجارية الموصى بها تلقائياً — يعمل مع وكيل MTO",
  },
];

function fmt(n?: number | null) {
  if (n == null) return "–";
  return n.toLocaleString("en-SA", { maximumFractionDigits: 0 });
}

function SeverityIcon({ s }: { s: string }) {
  if (s === "critical") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (s === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
}

function ReviewCard({ review, onAccept, onReject, onFix }: {
  review: Review;
  onAccept: () => void;
  onReject: () => void;
  onFix: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sMap = { critical: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900", warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900", info: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900" };
  const isFixed = review.status === "auto_fixed" || review.status === "accepted";
  return (
    <div className={`border rounded-lg overflow-hidden ${sMap[review.severity]} ${isFixed ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <SeverityIcon s={review.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{review.titleAr || review.title}</span>
            <Badge variant="outline" className="text-[10px] h-4 shrink-0">{review.agentName}</Badge>
            {isFixed && <Badge className="bg-emerald-100 text-emerald-700 text-[10px] h-4 border-0">✓ مُعالج</Badge>}
          </div>
          {review.currentValue != null && (
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              <span>الحالي: <b className="font-mono text-foreground">{fmt(review.currentValue)} SAR</b></span>
              {review.suggestedValue != null && (<><ArrowRight className="w-3 h-3" /><span>المقترح: <b className="font-mono text-emerald-600">{fmt(review.suggestedValue)} SAR</b></span></>)}
              {review.variancePercent != null && (
                <span className={Math.abs(review.variancePercent) > 30 ? "text-red-500 font-medium" : "text-amber-600"}>
                  ({review.variancePercent > 0 ? "+" : ""}{review.variancePercent.toFixed(0)}%)
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>
      {expanded && (
        <div className="px-4 pb-3 border-t border-current/10 pt-2 space-y-2">
          <p className="text-xs text-muted-foreground" dir="auto">{review.descriptionAr || review.description}</p>
          {review.recommendationAr && (
            <div className="bg-white/60 dark:bg-background/30 rounded p-2 text-xs border border-current/10">
              <p className="font-medium mb-0.5">💡 التوصية:</p>
              <p>{review.recommendationAr}</p>
            </div>
          )}
          {!isFixed && (
            <div className="flex gap-2 pt-1">
              {review.suggestedValue != null && review.boqItemId && (
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onFix}>
                  <Wrench className="w-3 h-3 mr-1" /> تطبيق السعر المقترح
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAccept}>قبول</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={onReject}>رفض</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: projects } = useListProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [polling, setPolling] = useState(false);

  const projectId = selectedProjectId;

  const { data: agentStatus } = useQuery<AgentStatus>({
    queryKey: ["agent-status", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/agents/status`).then(r => r.json()),
    enabled: !!projectId,
    refetchInterval: polling ? 3000 : false,
  });

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ["price-reviews", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/price-reviews`).then(r => r.json()),
    enabled: !!projectId,
  });

  const { data: reviewSummary } = useQuery<ReviewSummary>({
    queryKey: ["review-summary", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/price-reviews/summary`).then(r => r.json()),
    enabled: !!projectId,
  });

  // Stop polling when all agents are done
  useEffect(() => {
    if (!agentStatus) return;
    const anyRunning = Object.values(agentStatus).some((v: { status: string }) => v.status === "running");
    if (anyRunning) { setPolling(true); return; }
    if (polling) {
      setPolling(false);
      queryClient.invalidateQueries({ queryKey: ["price-reviews", projectId] });
      queryClient.invalidateQueries({ queryKey: ["review-summary", projectId] });
      toast({ title: "اكتملت مهام الوكلاء", description: "راجع النتائج أدناه." });
    }
  }, [agentStatus]);

  const runAgent = useMutation({
    mutationFn: (endpoint: string) =>
      fetch(`/api/projects/${projectId}/agents/${endpoint}`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => { setPolling(true); queryClient.invalidateQueries({ queryKey: ["agent-status", projectId] }); },
  });

  const runAll = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${projectId}/agents/run-all`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => { setPolling(true); queryClient.invalidateQueries({ queryKey: ["agent-status", projectId] }); toast({ title: "تم تشغيل جميع الوكلاء" }); },
  });

  const patchReview = useMutation({
    mutationFn: ({ id, status, applyFix }: { id: number; status?: string; applyFix?: boolean }) =>
      fetch(`/api/price-reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, applyFix }) }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-reviews", projectId] }),
  });

  const filteredReviews = (reviews || []).filter(r => {
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    if (agentFilter !== "all" && r.agentId !== agentFilter) return false;
    return true;
  });

  const completedProjects = (projects || []).filter(p => p.status === "completed" || p.status === "reviewing");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-background px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Bot className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-base font-bold">وكلاء الذكاء الاصطناعي</h1>
            <p className="text-xs text-muted-foreground">4 وكلاء متخصصون لمراجعة الأسعار وتفصيل المواد</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProjectId?.toString() || ""} onValueChange={v => setSelectedProjectId(Number(v))}>
            <SelectTrigger className="w-60 h-8 text-xs">
              <SelectValue placeholder="اختر مشروعاً للتحليل..." />
            </SelectTrigger>
            <SelectContent>
              {completedProjects.map(p => (
                <SelectItem key={p.id} value={p.id.toString()} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {projectId && (
            <Button size="sm" className="h-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-xs"
              onClick={() => runAll.mutate()} disabled={runAll.isPending || polling}>
              {polling ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> جارٍ التحليل...</> : <><Zap className="w-3.5 h-3.5 mr-1.5" /> تشغيل كل الوكلاء</>}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!projectId ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">اختر مشروعاً مسعّراً للبدء</p>
              <p className="text-xs text-muted-foreground/70 mt-1">يجب إكمال التسعير أولاً قبل تشغيل الوكلاء</p>
            </div>
          </div>
        ) : (
          <>
            {/* Agent Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {AGENTS.map(agent => {
                const status = agentStatus?.[agent.jobKey as keyof AgentStatus];
                const isRunning = status?.status === "running";
                const isDone = status?.status === "done";
                return (
                  <Card key={agent.id} className={`border ${agent.border} ${agent.bg} shadow-none`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className={`p-2 rounded-lg bg-white/60 dark:bg-background/30 ${agent.color}`}>{agent.icon}</div>
                        {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {isRunning && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                      </div>
                      <p className={`text-xs font-bold leading-snug ${agent.color} mb-1`}>{agent.name}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-snug mb-2.5">{agent.nameEn}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{agent.description}</p>
                      {agent.endpoint && (
                        <Button size="sm" variant="outline" className={`w-full h-7 text-xs mt-3 ${agent.color} border-current/30`}
                          onClick={() => runAgent.mutate(agent.endpoint!)}
                          disabled={!projectId || isRunning || polling}>
                          {isRunning ? "جارٍ..." : "تشغيل"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Summary Row */}
            {reviewSummary && reviewSummary.total > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "إجمالي الملاحظات", v: reviewSummary.total, color: "text-foreground", bg: "bg-muted" },
                  { label: "حرجة", v: reviewSummary.critical, color: "text-red-600", bg: "bg-red-50 border-red-200" },
                  { label: "تحذيرات", v: reviewSummary.warnings, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
                  { label: "معلومات", v: reviewSummary.info, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
                ].map((item, i) => (
                  <div key={i} className={`rounded-xl border p-3 flex items-center justify-between ${item.bg}`}>
                    <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    <span className={`text-2xl font-bold ${item.color}`}>{item.v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews List */}
            {reviews && reviews.length > 0 && (
              <Card className="shadow-none border">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm font-semibold">نتائج المراجعة</CardTitle>
                    <div className="flex gap-2">
                      <Select value={severityFilter} onValueChange={setSeverityFilter}>
                        <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل الخطورات</SelectItem>
                          <SelectItem value="critical">حرجة</SelectItem>
                          <SelectItem value="warning">تحذيرات</SelectItem>
                          <SelectItem value="info">معلومات</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={agentFilter} onValueChange={setAgentFilter}>
                        <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">كل الوكلاء</SelectItem>
                          <SelectItem value="market_comparator">مراجعة السوق</SelectItem>
                          <SelectItem value="compliance_validator">الامتثال</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2">
                  {filteredReviews.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">لا توجد نتائج للفلتر المحدد</div>
                  ) : (
                    filteredReviews.map(r => (
                      <ReviewCard key={r.id} review={r}
                        onAccept={() => patchReview.mutate({ id: r.id, status: "accepted" })}
                        onReject={() => patchReview.mutate({ id: r.id, status: "rejected" })}
                        onFix={() => patchReview.mutate({ id: r.id, applyFix: true })}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {reviews?.length === 0 && (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد مراجعات بعد — شغّل الوكلاء للبدء</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
