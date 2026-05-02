import { useGetProject, useListBoqItems, useUploadBoqFile, useStartPricing, useGetPricingStatus, useGetProjectSummary, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadCloud, Play, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Building2, ChevronDown, ChevronRight, Package } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ['#1e3a5f', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899'];

type BoqItem = {
  id: number;
  itemNumber?: string | null;
  descriptionEn: string;
  descriptionAr?: string | null;
  unit: string;
  quantity: number;
  sectionName?: string | null;
  categoryLevel1?: string | null;
  supplierName?: string | null;
  supplyPrice?: number | null;
  wastagePercent?: number | null;
  installCost?: number | null;
  accessCost?: number | null;
  unitPriceEconomical?: number | null;
  unitPriceStandard?: number | null;
  unitPricePremium?: number | null;
  totalEconomical?: number | null;
  totalStandard?: number | null;
  totalPremium?: number | null;
  laborCost?: number | null;
  vatAmount?: number | null;
  confidenceScore?: number | null;
  complianceStatus?: string | null;
  anomalyFlag?: boolean | null;
  anomalyReason?: string | null;
  alternativeMaterial?: string | null;
  alternativeSaving?: number | null;
  notes?: string | null;
};

function fmt(n?: number | null) {
  if (n == null) return '–';
  return n.toLocaleString('en-SA', { maximumFractionDigits: 0 });
}

function OutletBreakdown({ item }: { item: BoqItem }) {
  const hasBreakdown = item.supplyPrice != null || item.installCost != null || item.accessCost != null;
  if (!hasBreakdown) return null;
  const wastage = (item.supplyPrice || 0) * ((item.wastagePercent || 1) / 100);
  return (
    <div className="mt-2 text-xs bg-blue-50/60 dark:bg-blue-950/30 rounded px-2 py-1.5 space-y-0.5 border border-blue-100 dark:border-blue-900/40">
      <div className="font-medium text-blue-700 dark:text-blue-400 mb-1">OUTLET = Q×(1+R%) + S + T</div>
      <div className="grid grid-cols-2 gap-x-3 text-muted-foreground">
        <span>Supply(Q): <span className="text-foreground font-mono">{fmt(item.supplyPrice)}</span></span>
        <span>Wastage(R): <span className="text-foreground font-mono">{item.wastagePercent ?? 1}%</span></span>
        <span>Install(S): <span className="text-foreground font-mono">{fmt(item.installCost)}</span></span>
        <span>Access(T): <span className="text-foreground font-mono">{fmt(item.accessCost)}</span></span>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: items } = useListBoqItems(projectId);
  const { data: summary } = useGetProjectSummary(projectId, { query: { enabled: project?.status === 'completed' || project?.status === 'reviewing' } });
  
  const uploadMutation = useUploadBoqFile();
  const startPricingMutation = useStartPricing();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const { data: statusData } = useGetPricingStatus(projectId, {
    query: { enabled: isPolling, refetchInterval: 2000 }
  });

  useEffect(() => {
    if (statusData?.status === 'completed' || statusData?.status === 'reviewing' || statusData?.status === 'failed') {
      setIsPolling(false);
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      if (statusData.status === 'completed' || statusData.status === 'reviewing') {
        toast({ title: "اكتمل التسعير", description: "تم تسعير بنود المقايسة بنجاح." });
      } else {
        toast({ title: "فشل التسعير", description: "حدث خطأ أثناء التسعير.", variant: "destructive" });
      }
    }
  }, [statusData?.status, projectId, queryClient, toast]);

  useEffect(() => {
    if (project?.status === 'parsing' || project?.status === 'pricing') setIsPolling(true);
  }, [project?.status]);

  // Initialize all sections expanded
  useEffect(() => {
    if (items && items.length > 0) {
      const sections = new Set<string>();
      (items as BoqItem[]).forEach(i => sections.add(i.sectionName || i.categoryLevel1 || 'General'));
      setExpandedSections(sections);
    }
  }, [items]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ id: projectId, data: { file } }, {
      onSuccess: () => {
        toast({ title: "تم رفع الملف", description: "تم رفع ملف المقايسة بنجاح." });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      },
      onError: () => toast({ title: "فشل الرفع", description: "تعذر رفع الملف.", variant: "destructive" }),
    });
  };

  const handleStartPricing = () => {
    startPricingMutation.mutate({ id: projectId, data: { scenarios: ['economical', 'standard', 'premium'] } }, {
      onSuccess: () => {
        setIsPolling(true);
        toast({ title: "بدأ التسعير", description: "الذكاء الاصطناعي يحلل ويسعر البنود." });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  // Group items by section
  const groupedItems = (() => {
    if (!items) return {};
    const groups: Record<string, BoqItem[]> = {};
    (items as BoqItem[]).forEach(item => {
      const key = item.sectionName || item.categoryLevel1 || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  })();

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sec)) next.delete(sec);
      else next.add(sec);
      return next;
    });
  };

  const getSectionTotal = (secItems: BoqItem[]) =>
    secItems.reduce((s, i) => s + (i.totalStandard || 0), 0);

  if (projectLoading) return <div className="p-8 text-center">جارٍ التحميل...</div>;
  if (!project) return <div className="p-8 text-center">المشروع غير موجود</div>;

  const isPriced = project.status === 'completed' || project.status === 'reviewing';
  const isDraft = project.status === 'draft';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50 dark:bg-background">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
            {project.nameAr && <p className="text-sm text-muted-foreground" dir="rtl">{project.nameAr}</p>}
          </div>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex items-center gap-2">
          {isPriced && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                {showBreakdown ? 'إخفاء' : 'عرض'} التفصيل Q+R+S+T
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.href = `/api/projects/${projectId}/report/excel?scenario=standard`}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.href = `/api/projects/${projectId}/report/pdf`}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Upload / Pricing State */}
        {(isDraft || isPolling) && (
          <Card className="mb-6 max-w-2xl mx-auto mt-8">
            <CardContent className="pt-6">
              {isDraft && !isPolling ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg border-muted">
                  <UploadCloud className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">رفع ملف المقايسة</h3>
                  <p className="text-muted-foreground mb-2 text-sm">يدعم النظام: Excel (.xlsx/.xls), CSV, JSON</p>
                  <p className="text-muted-foreground mb-6 text-xs bg-blue-50 dark:bg-blue-950/30 rounded p-2">
                    يقرأ النظام الفورمات الاحترافي للمقايسات الكهربائية السعودية<br/>
                    بما فيها أعمدة: رقم البند، الوصف، الوحدة، الكمية، التوريد(Q)، الهالك(R)، التركيب(S)، الاكسسوارات(T)
                  </p>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.json" />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} size="lg">
                    {uploadMutation.isPending ? "جارٍ الرفع..." : "اختر الملف"}
                  </Button>
                  {items && items.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-muted">
                      <p className="mb-2 font-medium">{items.length} بند جاهز للتسعير</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        {Object.keys(groupedItems).length} قسم / تصنيف تم اكتشافه
                      </p>
                      <Button onClick={handleStartPricing} size="lg" className="w-full max-w-sm" disabled={startPricingMutation.isPending}>
                        <Play className="w-4 h-4 mr-2" />
                        {startPricingMutation.isPending ? "جارٍ البدء..." : "ابدأ التسعير بالذكاء الاصطناعي"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12">
                  <h3 className="font-semibold text-lg text-center mb-4">
                    {statusData?.status === 'parsing' ? 'جارٍ قراءة الملف...' : 'الذكاء الاصطناعي يسعّر البنود...'}
                  </h3>
                  <p className="text-xs text-center text-muted-foreground mb-4">
                    يحسب: OUTLET(P) = Supply(Q) × (1+Wastage%) + Install(S) + Access(T)
                  </p>
                  <Progress value={statusData?.progress || 0} className="mb-4" />
                  <p className="text-center text-sm text-muted-foreground">
                    {statusData?.currentStep || 'جارٍ المعالجة...'} ({statusData?.progress || 0}%)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Completed / Reviewing View */}
        {isPriced && (
          <div className="flex gap-6 h-full">
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {items?.length || 0} بند في {Object.keys(groupedItems).length} قسم
                  </span>
                </div>
                {project.reviewItems ? (
                  <Link href={`/projects/${project.id}/review`}>
                    <Button variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      {project.reviewItems} بند يحتاج مراجعة
                    </Button>
                  </Link>
                ) : null}
              </div>

              <Card className="flex-1 rounded-md border overflow-hidden">
                <div className="w-full overflow-auto max-h-[calc(100vh-240px)] relative">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/60 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="p-2.5 font-medium text-muted-foreground w-16">رقم</th>
                        <th className="p-2.5 font-medium text-muted-foreground min-w-[240px]">الوصف</th>
                        <th className="p-2.5 font-medium text-muted-foreground w-16">وحدة</th>
                        <th className="p-2.5 font-medium text-muted-foreground w-16 text-right">كمية</th>
                        <th className="p-2.5 font-medium text-muted-foreground text-right bg-green-50/50 dark:bg-green-950/20 w-24">اقتصادي</th>
                        <th className="p-2.5 font-medium text-muted-foreground text-right bg-blue-50/50 dark:bg-blue-900/10 w-24">معياري</th>
                        <th className="p-2.5 font-medium text-muted-foreground text-right bg-purple-50/50 dark:bg-purple-950/20 w-24">متميز</th>
                        <th className="p-2.5 font-medium text-muted-foreground text-right w-28">إجمالي معياري</th>
                        <th className="p-2.5 font-medium text-muted-foreground text-center w-20">ثقة</th>
                        <th className="p-2.5 font-medium text-muted-foreground text-center w-16">SASO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedItems).map(([section, secItems]) => {
                        const isExpanded = expandedSections.has(section);
                        const secTotal = getSectionTotal(secItems);
                        return [
                          // Section header row
                          <tr key={`sec-${section}`} className="bg-slate-100/80 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-700/50" onClick={() => toggleSection(section)}>
                            <td colSpan={2} className="p-2.5 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                              <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                              <span className="truncate" dir="auto">{section}</span>
                              <Badge variant="secondary" className="text-xs ml-1 shrink-0">{secItems.length}</Badge>
                            </td>
                            <td colSpan={5} />
                            <td className="p-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {fmt(secTotal)} SAR
                            </td>
                            <td colSpan={2} />
                          </tr>,
                          // Item rows (when expanded)
                          ...(isExpanded ? secItems.map(item => (
                            <tr key={item.id} className="hover:bg-muted/30 border-b border-muted/50">
                              <td className="p-2.5 text-muted-foreground font-mono text-xs pl-6">{item.itemNumber || item.id}</td>
                              <td className="p-2.5">
                                <div className="font-medium text-foreground text-sm">{item.descriptionEn}</div>
                                {item.descriptionAr && <div className="text-muted-foreground text-xs mt-0.5" dir="rtl">{item.descriptionAr}</div>}
                                {item.supplierName && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Package className="w-3 h-3 text-blue-500 shrink-0" />
                                    <span className="text-xs text-blue-600 dark:text-blue-400">{item.supplierName}</span>
                                  </div>
                                )}
                                {item.alternativeMaterial && item.alternativeSaving && (
                                  <div className="text-xs text-green-600 mt-0.5">
                                    💡 بديل: {item.alternativeMaterial} (توفير {item.alternativeSaving}%)
                                  </div>
                                )}
                                {item.anomalyFlag && (
                                  <div className="flex items-center text-xs text-amber-600 mt-0.5">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    {item.anomalyReason || "شذوذ مكتشف"}
                                  </div>
                                )}
                                {showBreakdown && <OutletBreakdown item={item} />}
                              </td>
                              <td className="p-2.5 text-muted-foreground text-xs">{item.unit}</td>
                              <td className="p-2.5 text-right font-mono text-xs">{item.quantity}</td>
                              <td className="p-2.5 text-right font-mono text-xs bg-green-50/30 dark:bg-green-950/10">
                                {fmt(item.unitPriceEconomical)}
                              </td>
                              <td className="p-2.5 text-right font-mono text-sm font-semibold bg-blue-50/30 dark:bg-blue-900/5">
                                {fmt(item.unitPriceStandard)}
                              </td>
                              <td className="p-2.5 text-right font-mono text-xs bg-purple-50/30 dark:bg-purple-950/10">
                                {fmt(item.unitPricePremium)}
                              </td>
                              <td className="p-2.5 text-right font-mono text-xs font-medium">
                                {fmt(item.totalStandard)}
                              </td>
                              <td className="p-2.5 text-center">
                                <ConfidenceBadge score={item.confidenceScore} />
                              </td>
                              <td className="p-2.5 text-center">
                                <ComplianceIcon status={item.complianceStatus} />
                              </td>
                            </tr>
                          )) : []),
                        ];
                      })}
                    </tbody>
                    {/* Grand total footer */}
                    {items && items.length > 0 && (
                      <tfoot className="sticky bottom-0 bg-slate-800 dark:bg-slate-900 text-white">
                        <tr>
                          <td colSpan={4} className="p-2.5 font-semibold text-sm">
                            الإجمالي الكلي ({items.length} بند)
                          </td>
                          <td className="p-2.5 text-right font-mono text-xs font-semibold bg-green-900/30">
                            {fmt((items as BoqItem[]).reduce((s, i) => s + (i.totalEconomical || 0), 0))}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold bg-blue-900/30">
                            {fmt((items as BoqItem[]).reduce((s, i) => s + (i.totalStandard || 0), 0))}
                          </td>
                          <td className="p-2.5 text-right font-mono text-xs font-semibold bg-purple-900/30">
                            {fmt((items as BoqItem[]).reduce((s, i) => s + (i.totalPremium || 0), 0))}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            {fmt((items as BoqItem[]).reduce((s, i) => s + (i.totalStandard || 0), 0))} SAR
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </Card>
            </div>

            {/* Right Summary Panel */}
            <div className="w-72 shrink-0 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">ملخص التكاليف</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary ? (
                    <>
                      <ScenarioRow label="اقتصادي" value={summary.scenarios.economical.grandTotal} color="text-green-600" />
                      <ScenarioRow label="معياري" value={summary.scenarios.standard.grandTotal} color="text-blue-600" bold />
                      <ScenarioRow label="متميز" value={summary.scenarios.premium.grandTotal} color="text-purple-600" />
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        <div className="flex justify-between">
                          <span>صافي (معياري):</span>
                          <span className="font-mono">{fmt(summary.scenarios.standard.totalBeforeVat)} SAR</span>
                        </div>
                        <div className="flex justify-between">
                          <span>VAT 15%:</span>
                          <span className="font-mono">{fmt(summary.scenarios.standard.vatAmount)} SAR</span>
                        </div>
                        <div className="flex justify-between font-medium text-foreground mt-1">
                          <span>الإجمالي شامل VAT:</span>
                          <span className="font-mono">{fmt(summary.scenarios.standard.grandTotal)} SAR</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="animate-pulse space-y-2">
                      {[1, 2, 3].map(i => <div key={i} className="h-4 bg-muted rounded w-full" />)}
                    </div>
                  )}
                </CardContent>
              </Card>

              {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm">توزيع التكاليف</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 pb-2">
                    <div className="flex justify-center">
                      <PieChart width={200} height={140}>
                        <Pie data={summary.categoryBreakdown} cx={100} cy={70} innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="totalStandard" stroke="none">
                          {summary.categoryBreakdown.map((_: unknown, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${fmt(v)} SAR`, '']} contentStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </div>
                    <div className="space-y-1 mt-1">
                      {summary.categoryBreakdown.slice(0, 6).map((cat: { category: string; totalStandard: number }, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                            <span className="truncate text-muted-foreground">{cat.category}</span>
                          </div>
                          <span className="font-mono shrink-0 ml-2">{fmt(cat.totalStandard)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">امتثال SASO</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary?.complianceSummary ? (
                    <div className="space-y-2">
                      <ComplianceRow icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />} label="ممتثل" value={summary.complianceSummary.pass} color="text-green-600" />
                      <ComplianceRow icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />} label="تحذير" value={summary.complianceSummary.warning} color="text-amber-600" />
                      <ComplianceRow icon={<XCircle className="w-3.5 h-3.5 text-red-500" />} label="مرفوض" value={summary.complianceSummary.fail} color="text-red-600" />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">جارٍ التحليل...</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">رفع ملف جديد</CardTitle>
                </CardHeader>
                <CardContent>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.json" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                    <UploadCloud className="w-4 h-4 mr-2" />
                    {uploadMutation.isPending ? "جارٍ الرفع..." : "رفع ملف مقايسة"}
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
  const map: Record<string, { label: string; class: string }> = {
    draft: { label: 'مسودة', class: 'bg-gray-100 text-gray-700' },
    parsing: { label: 'قراءة...', class: 'bg-yellow-100 text-yellow-700' },
    pricing: { label: 'تسعير...', class: 'bg-blue-100 text-blue-700' },
    reviewing: { label: 'مراجعة', class: 'bg-amber-100 text-amber-700' },
    completed: { label: 'مكتمل', class: 'bg-green-100 text-green-700' },
    failed: { label: 'فشل', class: 'bg-red-100 text-red-700' },
  };
  const s = map[status] || { label: status, class: 'bg-gray-100 text-gray-700' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.class}`}>{s.label}</span>;
}

function ConfidenceBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">–</span>;
  const cls = score >= 85 ? 'border-green-500 text-green-600' : score >= 70 ? 'border-amber-500 text-amber-600' : 'border-red-500 text-red-600';
  return <Badge variant="outline" className={`text-xs ${cls}`}>{score}%</Badge>;
}

function ComplianceIcon({ status }: { status?: string | null }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-500 mx-auto" />;
  return <span className="text-muted-foreground text-xs">–</span>;
}

function ScenarioRow({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-center text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={color}>{label}</span>
      <span className="font-mono">{fmt(value)} SAR</span>
    </div>
  );
}

function ComplianceRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <div className={`flex items-center gap-1.5 ${color}`}>{icon}{label}</div>
      <span className="font-medium">{value}</span>
    </div>
  );
}
