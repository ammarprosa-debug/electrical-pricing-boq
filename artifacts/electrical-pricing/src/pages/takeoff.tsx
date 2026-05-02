import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers, Play, RefreshCw, Package, Wrench, Puzzle,
  ChevronDown, ChevronRight, Download, BarChart3, Zap
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

type TakeoffItem = {
  id: number; boqItemId: number; parentBoqDesc: string; lineNo: number;
  subItemCode?: string; descriptionEn: string; descriptionAr?: string;
  category?: string; brand?: string; brandAr?: string; unit: string;
  quantity: number; wastagePercent?: number;
  unitPriceMin?: number; unitPriceStd?: number; unitPricePremium?: number;
  totalPriceStd?: number; isLabor?: boolean; isAccessory?: boolean; isMajor?: boolean;
  notes?: string; notesAr?: string;
};

type TakeoffGroup = {
  boqItemId: number;
  parentDesc: string;
  items: TakeoffItem[];
  totals: { min: number; std: number; premium: number };
};

type TakeoffSummary = {
  totalItems: number; materials: number; labor: number; accessories: number;
  grandTotal: number;
  categories: Array<{ cat: string; qty: number; total: number }>;
};

function fmt(n?: number | null) {
  if (n == null) return "–";
  return n.toLocaleString("en-SA", { maximumFractionDigits: 0 });
}

function ItemTypeBadge({ item }: { item: TakeoffItem }) {
  if (item.isLabor) return <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] h-4">عمالة</Badge>;
  if (item.isAccessory) return <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px] h-4">ملحق</Badge>;
  if (item.isMajor) return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] h-4">رئيسي</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-0 text-[10px] h-4">ثانوي</Badge>;
}

export default function TakeoffPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: projects } = useListProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [polling, setPolling] = useState(false);

  const completedProjects = (projects || []).filter(p => p.status === "completed" || p.status === "reviewing");

  const { data: agentStatus } = useQuery({
    queryKey: ["agent-status", selectedProjectId],
    queryFn: () => fetch(`/api/projects/${selectedProjectId}/agents/status`).then(r => r.json()),
    enabled: !!selectedProjectId,
    refetchInterval: polling ? 3000 : false,
  });

  const { data: takeoffData, isLoading } = useQuery<{ groups: TakeoffGroup[]; summary: TakeoffSummary }>({
    queryKey: ["takeoff", selectedProjectId],
    queryFn: () => fetch(`/api/projects/${selectedProjectId}/takeoff`).then(r => r.json()),
    enabled: !!selectedProjectId,
  });

  const { data: takeoffSummary } = useQuery<TakeoffSummary>({
    queryKey: ["takeoff-summary", selectedProjectId],
    queryFn: () => fetch(`/api/projects/${selectedProjectId}/takeoff/summary`).then(r => r.json()),
    enabled: !!selectedProjectId,
  });

  useEffect(() => {
    if (!agentStatus) return;
    const toStatus = (agentStatus as Record<string, { status: string }>)["material-takeoff"];
    if (toStatus?.status === "running") { setPolling(true); return; }
    if (polling && toStatus?.status === "done") {
      setPolling(false);
      queryClient.invalidateQueries({ queryKey: ["takeoff", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["takeoff-summary", selectedProjectId] });
      toast({ title: "اكتمل تفصيل المواد", description: "يمكنك الآن عرض وتحميل قائمة المواد التفصيلية." });
    }
  }, [agentStatus, polling]);

  const runTakeoff = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${selectedProjectId}/agents/material-takeoff`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      setPolling(true);
      queryClient.invalidateQueries({ queryKey: ["agent-status", selectedProjectId] });
      toast({ title: "وكيل MTO بدأ العمل", description: "جارٍ تفصيل جميع بنود المقايسة..." });
    },
  });

  const allItems = useMemo(() =>
    (takeoffData?.groups || []).flatMap(g => g.items), [takeoffData]);

  const categories = useMemo(() =>
    [...new Set(allItems.map(i => i.category).filter(Boolean))], [allItems]);

  const filteredGroups = useMemo(() => {
    if (filterCategory === "all") return takeoffData?.groups || [];
    return (takeoffData?.groups || []).map(g => ({
      ...g,
      items: g.items.filter(i => i.category === filterCategory),
    })).filter(g => g.items.length > 0);
  }, [takeoffData, filterCategory]);

  const toggleGroup = (id: number) =>
    setExpandedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportExcel = () => {
    if (!takeoffData?.groups?.length) return;
    const wb = XLSX.utils.book_new();
    const headers = ["#", "الوصف", "الكود", "الفئة", "الماركة", "وحدة", "كمية", "هدر%", "سعر أدنى", "سعر معياري", "سعر متميز", "إجمالي معياري", "نوع", "ملاحظات عربية"];
    const rows: unknown[][] = [headers];
    let n = 1;
    for (const g of (takeoffData?.groups || [])) {
      rows.push([`▶ ${g.parentDesc}`, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
      for (const item of g.items) {
        rows.push([
          n++, item.descriptionEn, item.subItemCode || "", item.category || "",
          item.brand || "", item.unit, item.quantity, (item.wastagePercent || 0) + "%",
          item.unitPriceMin || "", item.unitPriceStd || "", item.unitPricePremium || "",
          item.totalPriceStd || "",
          item.isLabor ? "عمالة" : item.isAccessory ? "ملحق" : item.isMajor ? "رئيسي" : "ثانوي",
          item.notesAr || "",
        ]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 4 }, { wch: 50 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 6 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws, "Material Takeoff");
    // Summary sheet
    const sRows: unknown[][] = [
      ["ملخص تفصيل المواد — Material Takeoff Summary"],
      [],
      ["الفئة", "الكمية", "الإجمالي المعياري (SAR)"],
      ...(takeoffSummary?.categories || []).map(c => [c.cat, c.qty, c.total]),
      [],
      ["الإجمالي", "", takeoffSummary?.grandTotal || 0],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(sRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");
    XLSX.writeFile(wb, `MTO_${selectedProjectId}.xlsx`);
  };

  const isRunning = (agentStatus as Record<string, { status: string }>)?.["material-takeoff"]?.status === "running";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-background px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-amber-500" />
          <div>
            <h1 className="text-base font-bold">تفصيل المواد — Material Takeoff (MTO)</h1>
            <p className="text-xs text-muted-foreground">تحليل BOQ لمكوناته المادية التفصيلية بأسعار السوق السعودي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProjectId?.toString() || ""} onValueChange={v => setSelectedProjectId(Number(v))}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="اختر مشروعاً..." /></SelectTrigger>
            <SelectContent>
              {completedProjects.map(p => (<SelectItem key={p.id} value={p.id.toString()} className="text-xs">{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
          {selectedProjectId && (
            <>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportExcel} disabled={!takeoffData?.groups?.length}>
                <Download className="w-3.5 h-3.5 mr-1" /> تحميل Excel
              </Button>
              <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700 text-xs"
                onClick={() => runTakeoff.mutate()} disabled={isRunning || polling}>
                {isRunning || polling ? <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />جارٍ...</> : <><Play className="w-3.5 h-3.5 mr-1" />تشغيل MTO</>}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!selectedProjectId ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">اختر مشروعاً مسعّراً لعرض تفصيل المواد</p>
            </div>
          </div>
        ) : isRunning || polling ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-amber-500 mx-auto mb-2 animate-spin" />
              <p className="font-medium">وكيل MTO يحلل بنود المقايسة...</p>
              <p className="text-xs text-muted-foreground mt-1">يفكك كل بند إلى مكوناته المادية الفعلية</p>
            </div>
          </div>
        ) : !takeoffData?.groups?.length ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <Puzzle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground font-medium">لا يوجد تفصيل مواد بعد</p>
              <p className="text-xs text-muted-foreground/70 mt-1">شغّل وكيل MTO لتفصيل المقايسة</p>
              <Button size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700" onClick={() => runTakeoff.mutate()}>
                <Play className="w-3.5 h-3.5 mr-1" /> تشغيل وكيل MTO
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            {takeoffSummary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "إجمالي البنود", v: takeoffSummary.totalItems, icon: <Package className="w-3.5 h-3.5" />, color: "text-foreground" },
                  { label: "مواد", v: takeoffSummary.materials, icon: <Package className="w-3.5 h-3.5" />, color: "text-emerald-600" },
                  { label: "عمالة", v: takeoffSummary.labor, icon: <Wrench className="w-3.5 h-3.5" />, color: "text-blue-600" },
                  { label: "ملحقات", v: takeoffSummary.accessories, icon: <Puzzle className="w-3.5 h-3.5" />, color: "text-amber-600" },
                  { label: "إجمالي (SAR)", v: fmt(takeoffSummary.grandTotal), icon: <BarChart3 className="w-3.5 h-3.5" />, color: "text-purple-600" },
                ].map((s, i) => (
                  <div key={i} className="bg-background border rounded-xl p-3 flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg bg-muted ${s.color}`}>{s.icon}</div>
                    <div><p className={`text-base font-bold ${s.color}`}>{s.v}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
                  </div>
                ))}
              </div>
            )}

            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">تصفية:</span>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setFilterCategory("all")}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${filterCategory === "all" ? "bg-slate-800 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  الكل
                </button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setFilterCategory(cat!)}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${filterCategory === cat ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Takeoff Groups */}
            <div className="space-y-2">
              {filteredGroups.map(group => {
                const isExp = expandedGroups.has(group.boqItemId);
                const materialItems = group.items.filter(i => !i.isLabor && !i.isAccessory);
                const laborItems = group.items.filter(i => i.isLabor);
                return (
                  <Card key={group.boqItemId} className="shadow-none border overflow-hidden">
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleGroup(group.boqItemId)}>
                      {isExp ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{group.parentDesc}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{group.items.length} مكون</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-mono font-medium">{fmt(group.totals.std)} SAR</span>
                          <span className="text-muted-foreground/60">/ {fmt(group.totals.min)}–{fmt(group.totals.premium)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] h-4">{materialItems.length} مواد</Badge>
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] h-4">{laborItems.length} عمالة</Badge>
                      </div>
                    </div>

                    {isExp && (
                      <div className="border-t overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="p-2 text-left font-medium text-muted-foreground w-6">#</th>
                              <th className="p-2 text-left font-medium text-muted-foreground min-w-[180px]">الوصف</th>
                              <th className="p-2 text-left font-medium text-muted-foreground w-20">الماركة</th>
                              <th className="p-2 text-center font-medium text-muted-foreground w-12">وحدة</th>
                              <th className="p-2 text-right font-medium text-muted-foreground w-12">كمية</th>
                              <th className="p-2 text-right font-medium text-muted-foreground w-16 bg-green-50/50">أدنى</th>
                              <th className="p-2 text-right font-medium text-muted-foreground w-16 bg-blue-50/50">معياري</th>
                              <th className="p-2 text-right font-medium text-muted-foreground w-16 bg-purple-50/50">متميز</th>
                              <th className="p-2 text-right font-medium text-muted-foreground w-20">إجمالي</th>
                              <th className="p-2 text-center font-medium text-muted-foreground w-14">نوع</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map(item => (
                              <tr key={item.id} className={`border-t border-muted/30 ${item.isLabor ? "bg-blue-50/30" : item.isMajor ? "bg-emerald-50/20" : ""}`}>
                                <td className="p-1.5 text-muted-foreground pl-3">{item.lineNo}</td>
                                <td className="p-1.5">
                                  <div className="font-medium leading-snug">{item.descriptionEn}</div>
                                  {item.descriptionAr && <div className="text-muted-foreground text-[10px]" dir="rtl">{item.descriptionAr}</div>}
                                  {item.subItemCode && <div className="font-mono text-[10px] text-blue-500">{item.subItemCode}</div>}
                                  {item.notesAr && <div className="text-muted-foreground/70 text-[10px]">{item.notesAr}</div>}
                                </td>
                                <td className="p-1.5 text-muted-foreground text-[10px]">{item.brand}</td>
                                <td className="p-1.5 text-center text-muted-foreground">{item.unit}</td>
                                <td className="p-1.5 text-right font-mono">{item.quantity}</td>
                                <td className="p-1.5 text-right font-mono bg-green-50/20 text-muted-foreground">{fmt(item.unitPriceMin)}</td>
                                <td className="p-1.5 text-right font-mono font-semibold bg-blue-50/20">{fmt(item.unitPriceStd)}</td>
                                <td className="p-1.5 text-right font-mono bg-purple-50/20 text-muted-foreground">{fmt(item.unitPricePremium)}</td>
                                <td className="p-1.5 text-right font-mono font-bold">{fmt(item.totalPriceStd)}</td>
                                <td className="p-1.5 text-center"><ItemTypeBadge item={item} /></td>
                              </tr>
                            ))}
                            <tr className="border-t border-muted/60 bg-muted/30 font-semibold">
                              <td colSpan={5} className="p-2 text-xs">إجمالي البند</td>
                              <td className="p-2 text-right font-mono text-xs">{fmt(group.totals.min)}</td>
                              <td className="p-2 text-right font-mono text-xs text-blue-600">{fmt(group.totals.std)}</td>
                              <td className="p-2 text-right font-mono text-xs">{fmt(group.totals.premium)}</td>
                              <td className="p-2 text-right font-mono text-xs font-bold">{fmt(group.totals.std)} SAR</td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
