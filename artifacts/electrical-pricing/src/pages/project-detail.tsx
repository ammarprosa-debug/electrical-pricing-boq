import { useGetProject, useListBoqItems, useUploadBoqFile, useStartPricing, useGetPricingStatus, useGetProjectSummary, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, Play, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Building2, ChevronDown, ChevronRight, Package, Send, Zap, Radio, Flame, Cpu, Activity, Scissors, BarChart3 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";

const COLORS = ['#1e3a5f', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899'];

const DISCIPLINE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  "Electrical":    { icon: <Zap className="w-3.5 h-3.5" />,      color: "text-blue-700",   bg: "bg-blue-100 dark:bg-blue-950/40",    label: "كهرباء" },
  "Low Current":   { icon: <Radio className="w-3.5 h-3.5" />,    color: "text-green-700",  bg: "bg-green-100 dark:bg-green-950/40",  label: "تيار خفيف" },
  "Fire Alarm":    { icon: <Flame className="w-3.5 h-3.5" />,    color: "text-red-700",    bg: "bg-red-100 dark:bg-red-950/40",      label: "إنذار حريق" },
  "BMS":           { icon: <Cpu className="w-3.5 h-3.5" />,      color: "text-purple-700", bg: "bg-purple-100 dark:bg-purple-950/40",label: "BMS" },
  "Medical Gases": { icon: <Activity className="w-3.5 h-3.5" />, color: "text-teal-700",   bg: "bg-teal-100 dark:bg-teal-950/40",   label: "غازات طبية" },
  "Mechanical":    { icon: <Activity className="w-3.5 h-3.5" />, color: "text-orange-700", bg: "bg-orange-100 dark:bg-orange-950/40",label: "ميكانيكا" },
  "General":       { icon: <Building2 className="w-3.5 h-3.5" />,color: "text-gray-700",   bg: "bg-gray-100 dark:bg-gray-800/40",   label: "عام" },
};

function getDCfg(d: string) { return DISCIPLINE_CONFIG[d] || DISCIPLINE_CONFIG["General"]; }

type BoqItem = {
  id: number; itemNumber?: string | null; descriptionEn: string; descriptionAr?: string | null;
  unit: string; quantity: number; discipline?: string | null; sectionName?: string | null;
  categoryLevel1?: string | null; supplierName?: string | null; supplyPrice?: number | null;
  wastagePercent?: number | null; installCost?: number | null; accessCost?: number | null;
  unitPriceEconomical?: number | null; unitPriceStandard?: number | null; unitPricePremium?: number | null;
  totalEconomical?: number | null; totalStandard?: number | null; totalPremium?: number | null;
  laborCost?: number | null; vatAmount?: number | null; confidenceScore?: number | null;
  complianceStatus?: string | null; complianceNotes?: string | null;
  anomalyFlag?: boolean | null; anomalyReason?: string | null;
  alternativeMaterial?: string | null; alternativeSaving?: number | null; notes?: string | null;
};

function fmt(n?: number | null) {
  if (n == null) return '–';
  return n.toLocaleString('en-SA', { maximumFractionDigits: 0 });
}

function DisciplineBadge({ discipline }: { discipline?: string | null }) {
  const d = discipline || "General";
  const cfg = getDCfg(d);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function OutletBreakdown({ item }: { item: BoqItem }) {
  const has = item.supplyPrice != null || item.installCost != null;
  if (!has) return null;
  return (
    <div className="mt-1 text-[10px] bg-blue-50/70 dark:bg-blue-950/30 rounded px-2 py-1 border border-blue-100 dark:border-blue-900/40">
      <div className="font-medium text-blue-700 mb-0.5">OUTLET(P) = Q×(1+R%) + S + T</div>
      <div className="grid grid-cols-2 gap-x-2 text-muted-foreground">
        <span>Supply(Q): <b className="text-foreground">{fmt(item.supplyPrice)}</b></span>
        <span>Wastage(R): <b className="text-foreground">{item.wastagePercent ?? 1}%</b></span>
        <span>Install(S): <b className="text-foreground">{fmt(item.installCost)}</b></span>
        <span>Access(T): <b className="text-foreground">{fmt(item.accessCost)}</b></span>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = Number(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [activeDiscipline, setActiveDiscipline] = useState<string>("all");
  const [showSplitConfirm, setShowSplitConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPolling, setIsPolling] = useState(false);

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: items } = useListBoqItems(projectId);
  const { data: summary } = useGetProjectSummary(projectId, {
    query: { enabled: project?.status === 'completed' || project?.status === 'reviewing' }
  });
  const { data: disciplinesData } = useQuery<Record<string, { count: number; priced: number; total: number }>>({
    queryKey: ["disciplines", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/disciplines`).then(r => r.json()),
    enabled: !!(project && ["completed", "reviewing", "draft"].includes(project.status)),
  });

  const uploadMutation = useUploadBoqFile();
  const startPricingMutation = useStartPricing();
  const splitMutation = useMutation({
    mutationFn: () => fetch(`/api/projects/${projectId}/split-by-discipline`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data: { success: boolean; projects: Array<{ id: number; name: string; discipline: string; itemCount: number }>; message: string }) => {
      toast({ title: "تم الفصل بنجاح", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowSplitConfirm(false);
    },
    onError: () => toast({ title: "فشل الفصل", variant: "destructive" }),
  });

  const { data: statusData } = useGetPricingStatus(projectId, {
    query: { enabled: isPolling, refetchInterval: 2000 }
  });

  useEffect(() => {
    if (statusData?.status === 'completed' || statusData?.status === 'reviewing' || statusData?.status === 'failed') {
      setIsPolling(false);
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: ["disciplines", projectId] });
      if (statusData.status !== 'failed') {
        toast({ title: "اكتمل التسعير", description: "تم تسعير المقايسة بالكامل." });
      } else {
        toast({ title: "فشل التسعير", variant: "destructive" });
      }
    }
  }, [statusData?.status, projectId, queryClient, toast]);

  useEffect(() => {
    if (project?.status === 'parsing' || project?.status === 'pricing') setIsPolling(true);
  }, [project?.status]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const all = items as BoqItem[];
    return activeDiscipline === "all" ? all : all.filter(i => (i.discipline || "General") === activeDiscipline);
  }, [items, activeDiscipline]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, BoqItem[]> = {};
    filteredItems.forEach(item => {
      const key = item.sectionName || item.categoryLevel1 || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredItems]);

  useEffect(() => {
    if (filteredItems.length > 0) {
      const s = new Set<string>();
      filteredItems.forEach(i => s.add(i.sectionName || i.categoryLevel1 || 'General'));
      setExpandedSections(s);
    }
  }, [activeDiscipline, filteredItems.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ id: projectId, data: { file } }, {
      onSuccess: (data: unknown) => {
        const d = data as { itemsFound?: number; disciplines?: string[]; message?: string };
        toast({ title: "تم رفع الملف", description: d.message || `تم استخراج ${d.itemsFound} بند` });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: ["disciplines", projectId] });
      },
      onError: () => toast({ title: "فشل الرفع", variant: "destructive" }),
    });
  };

  const handleStartPricing = () => {
    startPricingMutation.mutate({ id: projectId, data: { scenarios: ['economical', 'standard', 'premium'] } }, {
      onSuccess: () => {
        setIsPolling(true);
        toast({ title: "بدأ التسعير", description: "الذكاء الاصطناعي يسعّر بأسعار السوق السعودي." });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  const downloadRfq = (disc: string = "all") =>
    window.location.href = `/api/projects/${projectId}/report/rfq?discipline=${encodeURIComponent(disc)}`;

  const toggleSection = (sec: string) =>
    setExpandedSections(prev => { const n = new Set(prev); n.has(sec) ? n.delete(sec) : n.add(sec); return n; });

  const disciplines = Object.keys(disciplinesData || {});
  const isPriced = project?.status === 'completed' || project?.status === 'reviewing';
  const isDraft = project?.status === 'draft';
  const hasMultipleDisciplines = disciplines.length > 1;

  if (projectLoading) return <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>;
  if (!project) return <div className="p-8 text-center">المشروع غير موجود</div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/40 dark:bg-background">
      {/* Header */}
      <div className="border-b bg-background px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <div>
            <h1 className="text-base font-bold">{project.name}</h1>
            {project.nameAr && <p className="text-xs text-muted-foreground" dir="rtl">{project.nameAr}</p>}
          </div>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex items-center gap-1.5">
          {isPriced && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowBreakdown(!showBreakdown)} className="text-blue-600 text-xs h-7">
                {showBreakdown ? 'إخفاء' : 'عرض'} OUTLET
              </Button>
              {hasMultipleDisciplines && (
                <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs h-7" onClick={() => setShowSplitConfirm(true)}>
                  <Scissors className="w-3 h-3 mr-1" /> فصل التخصصات
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.location.href = `/api/projects/${projectId}/report/excel?scenario=standard`}>
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> BOQ Excel
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.location.href = `/api/projects/${projectId}/report/pdf`}>
                <FileText className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
              <Button size="sm" onClick={() => downloadRfq(activeDiscipline)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
                <Send className="w-3.5 h-3.5 mr-1" />
                RFQ {activeDiscipline !== "all" ? `(${getDCfg(activeDiscipline).label})` : "كامل"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Split Confirmation Modal */}
      {showSplitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-500" />
                فصل المقايسة بالتخصص
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                سيتم إنشاء مشروع مستقل لكل تخصص مع نسخ البنود والأسعار. التخصصات المكتشفة:
              </p>
              <div className="flex flex-wrap gap-2">
                {disciplines.map(d => {
                  const info = disciplinesData?.[d];
                  return (
                    <div key={d} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${getDCfg(d).bg} ${getDCfg(d).color}`}>
                      {getDCfg(d).icon} {getDCfg(d).label} ({info?.count} بند)
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={() => splitMutation.mutate()} disabled={splitMutation.isPending}>
                  {splitMutation.isPending ? "جارٍ الفصل..." : "تأكيد الفصل"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setShowSplitConfirm(false)}>إلغاء</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Discipline filter tabs */}
      {isPriced && hasMultipleDisciplines && (
        <div className="border-b bg-background px-5 py-1.5 flex items-center gap-2 overflow-x-auto shrink-0">
          <button onClick={() => setActiveDiscipline("all")}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all shrink-0 ${activeDiscipline === "all" ? "bg-slate-800 text-white" : "text-muted-foreground hover:bg-muted"}`}>
            الكل ({items?.length || 0})
          </button>
          {disciplines.map(d => {
            const cfg = getDCfg(d);
            const info = disciplinesData?.[d];
            return (
              <button key={d} onClick={() => setActiveDiscipline(d)}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-all shrink-0 ${activeDiscipline === d ? `${cfg.bg} ${cfg.color} ring-2 ring-current ring-offset-1` : "text-muted-foreground hover:bg-muted"}`}>
                {cfg.icon}{cfg.label}<span className="opacity-60">({info?.count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {/* Upload state */}
        {(isDraft || isPolling) && (
          <Card className="mb-6 max-w-2xl mx-auto mt-4">
            <CardContent className="pt-5">
              {isDraft && !isPolling ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg border-muted">
                  <UploadCloud className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
                  <h3 className="font-semibold mb-2">رفع ملف المقايسة</h3>
                  <div className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto space-y-1.5">
                    <p>يدعم: <span className="font-medium text-foreground">.xlsx / .xls / .csv / .json</span></p>
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2.5 text-right text-[11px]" dir="rtl">
                      <p className="font-semibold mb-1">✅ كشف تلقائي للتخصصات:</p>
                      <p>⚡ كهرباء | 📡 تيار خفيف | 🔥 إنذار حريق | 🖥 BMS | 💊 غازات طبية</p>
                      <p className="mt-1 text-muted-foreground">الأسعار مربوطة بقاعدة بيانات السوق السعودي 2025</p>
                    </div>
                  </div>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.json" />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending ? "جارٍ الرفع..." : "اختر ملف المقايسة"}
                  </Button>
                  {items && items.length > 0 && (
                    <div className="mt-5 pt-5 border-t">
                      <p className="text-sm font-medium mb-1">{items.length} بند مُستخرج</p>
                      {disciplines.length > 1 && (
                        <div className="flex flex-wrap justify-center gap-1 mb-3">
                          {disciplines.map(d => <DisciplineBadge key={d} discipline={d} />)}
                        </div>
                      )}
                      <Button onClick={handleStartPricing} className="w-full max-w-xs" disabled={startPricingMutation.isPending}>
                        <Play className="w-4 h-4 mr-1.5" />
                        {startPricingMutation.isPending ? "جارٍ البدء..." : "تسعير بالذكاء الاصطناعي + أسعار KSA"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8">
                  <h3 className="font-semibold text-center mb-2">
                    {statusData?.status === 'parsing' ? 'جارٍ قراءة الملف...' : '⚡ الذكاء الاصطناعي يسعّر بأسعار السوق السعودي...'}
                  </h3>
                  <p className="text-xs text-center text-muted-foreground mb-4">يحسب OUTLET(P) = Q × (1+R%) + S + T لكل تخصص</p>
                  <Progress value={statusData?.progress || 0} className="mb-2" />
                  <p className="text-center text-sm text-muted-foreground">{statusData?.currentStep || '...'} ({statusData?.progress || 0}%)</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Priced view */}
        {isPriced && (
          <div className="flex gap-3 h-full">
            {/* Main table */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-muted-foreground">
                  {filteredItems.length} بند {Object.keys(groupedItems).length > 0 && `في ${Object.keys(groupedItems).length} قسم`}
                  {activeDiscipline !== "all" && <span className="ml-2 font-medium text-foreground">← {getDCfg(activeDiscipline).label}</span>}
                </span>
                <div className="flex gap-1.5">
                  {activeDiscipline !== "all" && (
                    <Button size="sm" variant="outline" onClick={() => downloadRfq(activeDiscipline)} className="text-emerald-600 border-emerald-300 h-6 text-[11px] px-2">
                      <Send className="w-2.5 h-2.5 mr-1" /> RFQ {getDCfg(activeDiscipline).label}
                    </Button>
                  )}
                  {project.reviewItems ? (
                    <Link href={`/projects/${project.id}/review`}>
                      <Button variant="secondary" size="sm" className="bg-amber-500/10 text-amber-600 h-6 text-[11px] px-2">
                        <AlertTriangle className="w-3 h-3 mr-1" /> {project.reviewItems} مراجعة
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>

              <Card className="flex-1 rounded-md border overflow-hidden">
                <div className="w-full overflow-auto max-h-[calc(100vh-220px)]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/60 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="p-2 font-medium text-muted-foreground w-14 text-xs">رقم</th>
                        <th className="p-2 font-medium text-muted-foreground min-w-[200px] text-xs">الوصف</th>
                        <th className="p-2 font-medium text-muted-foreground w-12 text-xs">وحدة</th>
                        <th className="p-2 font-medium text-muted-foreground w-12 text-right text-xs">كمية</th>
                        <th className="p-2 font-medium text-muted-foreground text-right bg-green-50/50 w-20 text-xs">اقتصادي</th>
                        <th className="p-2 font-medium text-muted-foreground text-right bg-blue-50/50 w-20 text-xs">معياري</th>
                        <th className="p-2 font-medium text-muted-foreground text-right bg-purple-50/50 w-20 text-xs">متميز</th>
                        <th className="p-2 font-medium text-muted-foreground text-right w-24 text-xs">إجمالي</th>
                        <th className="p-2 font-medium text-muted-foreground text-center w-14 text-xs">ثقة</th>
                        <th className="p-2 font-medium text-muted-foreground text-center w-12 text-xs">SASO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedItems).map(([section, secItems]) => {
                        const isExp = expandedSections.has(section);
                        const secDisc = secItems[0]?.discipline || "General";
                        const cfg = getDCfg(secDisc);
                        const secTotal = secItems.reduce((s, i) => s + (i.totalStandard || 0), 0);
                        return [
                          <tr key={`sec-${section}`} className="border-y border-muted/60 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleSection(section)}>
                            <td colSpan={2} className="p-2 font-semibold text-xs">
                              <div className="flex items-center gap-1.5">
                                {isExp ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                <span className={`${cfg.color} shrink-0`}>{cfg.icon}</span>
                                <span className="truncate" dir="auto">{section}</span>
                                <Badge variant="secondary" className="text-[10px] h-3.5 shrink-0">{secItems.length}</Badge>
                              </div>
                            </td>
                            <td colSpan={5} />
                            <td className="p-2 text-right font-mono font-semibold text-xs">{fmt(secTotal)} <span className="text-muted-foreground font-normal text-[10px]">SAR</span></td>
                            <td colSpan={2} />
                          </tr>,
                          ...(isExp ? secItems.map(item => (
                            <tr key={item.id} className="hover:bg-muted/20 border-b border-muted/25 transition-colors">
                              <td className="p-1.5 text-muted-foreground font-mono text-[10px] pl-6">{item.itemNumber || item.id}</td>
                              <td className="p-1.5">
                                <div className="font-medium text-[11px] leading-snug">{item.descriptionEn}</div>
                                {item.descriptionAr && <div className="text-muted-foreground text-[10px]" dir="rtl">{item.descriptionAr}</div>}
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  {activeDiscipline === "all" && item.discipline && item.discipline !== "General" && <DisciplineBadge discipline={item.discipline} />}
                                  {item.supplierName && (
                                    <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                                      <Package className="w-2.5 h-2.5" />{item.supplierName}
                                    </span>
                                  )}
                                </div>
                                {item.alternativeMaterial && item.alternativeSaving && (
                                  <div className="text-[10px] text-green-600">💡 {item.alternativeMaterial} (توفير {item.alternativeSaving}%)</div>
                                )}
                                {showBreakdown && <OutletBreakdown item={item} />}
                              </td>
                              <td className="p-1.5 text-muted-foreground text-[10px]">{item.unit}</td>
                              <td className="p-1.5 text-right font-mono text-[11px]">{item.quantity}</td>
                              <td className="p-1.5 text-right font-mono text-[10px] bg-green-50/20">{fmt(item.unitPriceEconomical)}</td>
                              <td className="p-1.5 text-right font-mono text-xs font-semibold bg-blue-50/20">{fmt(item.unitPriceStandard)}</td>
                              <td className="p-1.5 text-right font-mono text-[10px] bg-purple-50/20">{fmt(item.unitPricePremium)}</td>
                              <td className="p-1.5 text-right font-mono text-xs font-medium">{fmt(item.totalStandard)}</td>
                              <td className="p-1.5 text-center"><ConfidenceBadge score={item.confidenceScore} /></td>
                              <td className="p-1.5 text-center"><ComplianceIcon status={item.complianceStatus} /></td>
                            </tr>
                          )) : []),
                        ];
                      })}
                    </tbody>
                    {filteredItems.length > 0 && (
                      <tfoot className="sticky bottom-0 bg-slate-800 text-white">
                        <tr>
                          <td colSpan={4} className="p-2 font-semibold text-xs">
                            الإجمالي ({filteredItems.length} بند){activeDiscipline !== "all" && ` — ${getDCfg(activeDiscipline).label}`}
                          </td>
                          <td className="p-2 text-right font-mono text-[11px] font-semibold bg-green-900/30">{fmt(filteredItems.reduce((s, i) => s + (i.totalEconomical || 0), 0))}</td>
                          <td className="p-2 text-right font-mono font-bold bg-blue-900/30">{fmt(filteredItems.reduce((s, i) => s + (i.totalStandard || 0), 0))}</td>
                          <td className="p-2 text-right font-mono text-[11px] font-semibold bg-purple-900/30">{fmt(filteredItems.reduce((s, i) => s + (i.totalPremium || 0), 0))}</td>
                          <td className="p-2 text-right font-mono font-bold">{fmt(filteredItems.reduce((s, i) => s + (i.totalStandard || 0), 0))} SAR</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Card>
            </div>

            {/* Right panel */}
            <div className="w-60 shrink-0 space-y-2.5">
              {/* Discipline split card */}
              {hasMultipleDisciplines && (
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-500" /> التخصصات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1">
                    {disciplines.map(d => {
                      const info = disciplinesData?.[d];
                      const cfg = getDCfg(d);
                      return (
                        <button key={d} onClick={() => setActiveDiscipline(activeDiscipline === d ? "all" : d)}
                          className={`w-full flex items-center justify-between text-xs rounded px-2 py-1 transition-all ${activeDiscipline === d ? `${cfg.bg} ${cfg.color} font-semibold` : "hover:bg-muted"}`}>
                          <div className="flex items-center gap-1"><span className={cfg.color}>{cfg.icon}</span>{cfg.label}</div>
                          <div className="text-right">
                            <div className="font-mono text-[10px]">{fmt(info?.total)}</div>
                            <div className="text-muted-foreground text-[10px]">{info?.count} بند</div>
                          </div>
                        </button>
                      );
                    })}
                    <div className="pt-1.5 space-y-1 border-t">
                      <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-6" onClick={() => downloadRfq("all")}>
                        <Send className="w-2.5 h-2.5 mr-1" /> RFQ كل التخصصات
                      </Button>
                      <Button size="sm" variant="outline" className="w-full text-amber-600 border-amber-300 text-xs h-6" onClick={() => setShowSplitConfirm(true)}>
                        <Scissors className="w-2.5 h-2.5 mr-1" /> فصل لمشاريع منفصلة
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Totals */}
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold">ملخص التكاليف</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-1.5">
                  {summary ? (
                    <>
                      <ScenRow label="اقتصادي" v={summary.scenarios.economical.grandTotal} color="text-green-600" />
                      <ScenRow label="معياري ★" v={summary.scenarios.standard.grandTotal} color="text-blue-600" bold />
                      <ScenRow label="متميز" v={summary.scenarios.premium.grandTotal} color="text-purple-600" />
                      <div className="text-[10px] text-muted-foreground pt-1.5 border-t space-y-0.5">
                        <div className="flex justify-between"><span>صافي:</span><span className="font-mono">{fmt(summary.scenarios.standard.subtotal)}</span></div>
                        <div className="flex justify-between"><span>VAT 15%:</span><span className="font-mono">{fmt(summary.scenarios.standard.vatTotal)}</span></div>
                        <div className="flex justify-between font-semibold text-foreground text-xs pt-0.5 border-t mt-0.5">
                          <span>الإجمالي:</span><span className="font-mono">{fmt(summary.scenarios.standard.grandTotal)} SAR</span>
                        </div>
                      </div>
                    </>
                  ) : <div className="animate-pulse space-y-2">{[1,2,3].map(i => <div key={i} className="h-3 bg-muted rounded" />)}</div>}
                </CardContent>
              </Card>

              {/* Pie chart */}
              {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-0 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">توزيع التكاليف</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="flex justify-center">
                      <PieChart width={170} height={110}>
                        <Pie data={summary.categoryBreakdown} cx={85} cy={55} innerRadius={28} outerRadius={50} paddingAngle={2} dataKey="totalStandard" stroke="none">
                          {summary.categoryBreakdown.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${fmt(v)} SAR`]} contentStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {summary.categoryBreakdown.slice(0, 5).map((cat: { category: string; totalStandard: number }, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1 truncate">
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                            <span className="truncate text-muted-foreground">{cat.category}</span>
                          </div>
                          <span className="font-mono shrink-0 ml-1">{fmt(cat.totalStandard)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* SASO */}
              <Card>
                <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs font-semibold">SASO</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3">
                  {summary?.complianceSummary ? (
                    <div className="space-y-1">
                      <CompRow icon={<CheckCircle2 className="w-3 h-3 text-green-500" />} label="ممتثل" v={summary.complianceSummary.pass} color="text-green-600" />
                      <CompRow icon={<AlertTriangle className="w-3 h-3 text-amber-500" />} label="تحذير" v={summary.complianceSummary.warning} color="text-amber-600" />
                      <CompRow icon={<XCircle className="w-3 h-3 text-red-500" />} label="مرفوض" v={summary.complianceSummary.fail} color="text-red-600" />
                    </div>
                  ) : <div className="text-[10px] text-muted-foreground">جارٍ...</div>}
                </CardContent>
              </Card>

              {/* Re-upload */}
              <Card>
                <CardContent className="px-3 py-2.5">
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.json" />
                  <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    {uploadMutation.isPending ? "جارٍ الرفع..." : "رفع مقايسة جديدة"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: 'مسودة', cls: 'bg-gray-100 text-gray-700' },
    parsing: { label: 'قراءة...', cls: 'bg-yellow-100 text-yellow-700' },
    pricing: { label: 'تسعير...', cls: 'bg-blue-100 text-blue-700' },
    reviewing: { label: 'مراجعة', cls: 'bg-amber-100 text-amber-700' },
    completed: { label: 'مكتمل', cls: 'bg-green-100 text-green-700' },
    failed: { label: 'فشل', cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

function ConfidenceBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-[10px]">–</span>;
  const cls = score >= 85 ? 'border-green-500 text-green-600' : score >= 70 ? 'border-amber-500 text-amber-600' : 'border-red-500 text-red-600';
  return <Badge variant="outline" className={`text-[10px] h-4 ${cls}`}>{score}%</Badge>;
}

function ComplianceIcon({ status }: { status?: string | null }) {
  if (status === 'pass') return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />;
  if (status === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mx-auto" />;
  if (status === 'fail') return <XCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />;
  return <span className="text-muted-foreground text-[10px]">–</span>;
}

function ScenRow({ label, v, color, bold }: { label: string; v: number; color: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-xs ${bold ? 'font-semibold' : ''}`}>
      <span className={color}>{label}</span><span className="font-mono">{fmt(v)} SAR</span>
    </div>
  );
}

function CompRow({ icon, label, v, color }: { icon: React.ReactNode; label: string; v: number; color: string }) {
  return (
    <div className="flex justify-between text-xs">
      <div className={`flex items-center gap-1 ${color}`}>{icon}{label}</div>
      <span className="font-medium">{v}</span>
    </div>
  );
}
