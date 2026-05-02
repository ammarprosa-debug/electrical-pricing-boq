import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, Zap, FolderOpen, MapPin, Calendar, BarChart2, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:     { label: "مسودة",    color: "text-slate-600",  bg: "bg-slate-100 dark:bg-slate-800",  dot: "bg-slate-400" },
  parsing:   { label: "قراءة",   color: "text-yellow-700", bg: "bg-yellow-100 dark:bg-yellow-900/30", dot: "bg-yellow-400 animate-pulse" },
  pricing:   { label: "تسعير",   color: "text-blue-700",   bg: "bg-blue-100 dark:bg-blue-900/30",  dot: "bg-blue-500 animate-pulse" },
  reviewing: { label: "مراجعة",  color: "text-amber-700",  bg: "bg-amber-100 dark:bg-amber-900/30",dot: "bg-amber-500" },
  completed: { label: "مكتمل",   color: "text-emerald-700",bg: "bg-emerald-100 dark:bg-emerald-900/30", dot: "bg-emerald-500" },
  failed:    { label: "فشل",     color: "text-red-700",    bg: "bg-red-100 dark:bg-red-900/30",    dot: "bg-red-500" },
};

const REGION_LABELS: Record<string, string> = {
  riyadh: "الرياض 🏙", jeddah: "جدة 🏖", dammam: "الدمام 🏭", other: "أخرى 🗺"
};

function fmt(n?: number | null) {
  if (n == null || n === 0) return null;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M SAR`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K SAR`;
  return `${n.toFixed(0)} SAR`;
}

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [region, setRegion] = useState<"riyadh" | "jeddah" | "dammam" | "other">("riyadh");
  const [search, setSearch] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    createProject.mutate({ data: { name, nameAr, region } }, {
      onSuccess: (newProject) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setOpen(false); setName(""); setNameAr("");
        setLocation(`/projects/${newProject.id}`);
      }
    });
  };

  const filtered = (projects || []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.nameAr || "").includes(search)
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-background px-5 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold">إدارة المشاريع</h1>
          <p className="text-xs text-muted-foreground">{projects?.length || 0} مشروع إجمالاً</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs h-8">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> مشروع جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>إنشاء مشروع جديد</DialogTitle>
                <DialogDescription>أدخل بيانات المشروع لبدء رفع المقايسة والتسعير</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">اسم المشروع (إنجليزي)</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hospital Electrical Works" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nameAr">اسم المشروع (عربي) — اختياري</Label>
                  <Input id="nameAr" value={nameAr} onChange={e => setNameAr(e.target.value)} dir="rtl" placeholder="مثال: أعمال كهربائية مستشفى" />
                </div>
                <div className="grid gap-2">
                  <Label>المنطقة</Label>
                  <Select value={region} onValueChange={(v: "riyadh" | "jeddah" | "dammam" | "other") => setRegion(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="riyadh">الرياض</SelectItem>
                      <SelectItem value="jeddah">جدة</SelectItem>
                      <SelectItem value="dammam">الدمام</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createProject.isPending || !name} className="bg-blue-600 hover:bg-blue-700">
                  {createProject.isPending ? "جارٍ الإنشاء..." : "إنشاء المشروع"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Search */}
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-9 h-8 text-sm bg-background" placeholder="بحث في المشاريع..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{search ? "لا توجد مشاريع مطابقة" : "لا توجد مشاريع بعد"}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(project => {
              const sc = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
              const progress = project.totalItems > 0 ? Math.round((project.pricedItems / project.totalItems) * 100) : 0;
              return (
                <Card key={project.id} className="border shadow-none hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setLocation(`/projects/${project.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex-1 min-w-0 mr-2">
                        <h3 className="font-bold text-sm truncate group-hover:text-blue-600 transition-colors">{project.name}</h3>
                        {project.nameAr && <p className="text-xs text-muted-foreground truncate" dir="rtl">{project.nameAr}</p>}
                      </div>
                      <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${sc.bg} ${sc.color}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{REGION_LABELS[project.region] || project.region}</div>
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(project.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}</div>
                      <div className="flex items-center gap-1"><Zap className="w-3 h-3" />{project.totalItems || 0} بند</div>
                      {fmt(project.totalStandard) && (
                        <div className="flex items-center gap-1 text-emerald-600 font-semibold"><BarChart2 className="w-3 h-3" />{fmt(project.totalStandard)}</div>
                      )}
                    </div>

                    {project.totalItems > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>التقدم</span><span>{progress}% ({project.pricedItems}/{project.totalItems})</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t">
                      {project.reviewItems ? (
                        <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">⚠ {project.reviewItems} مراجعة</span>
                      ) : <span />}
                      <button className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600 font-medium" onClick={e => { e.stopPropagation(); setLocation(`/projects/${project.id}`); }}>
                        فتح المشروع <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
