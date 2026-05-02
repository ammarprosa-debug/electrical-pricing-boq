import { useListMaterials } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Materials() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const { data: materials, isLoading } = useListMaterials({
    search: search || undefined,
    category: category !== "all" ? category : undefined
  });

  // Extract unique categories from materials
  const categories = Array.from(new Set(materials?.map(m => m.category) || []));

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Materials Database</h1>
            <p className="text-muted-foreground mt-1">Standard Saudi electrical materials and current pricing.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              className="pl-8 bg-background" 
              placeholder="Search materials..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-64">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b bg-muted/50 transition-colors">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[250px]">Material</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Category</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-20">Unit</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Economical</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground bg-blue-50/50 dark:bg-blue-900/10">Standard</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Premium</th>
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">SASO</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0 divide-y">
                {materials?.map((material) => (
                  <tr key={material.id} className="transition-colors hover:bg-muted/30">
                    <td className="p-4 align-middle">
                      <div className="font-medium">{material.nameEn}</div>
                      {material.nameAr && <div className="text-muted-foreground text-xs mt-1" dir="rtl">{material.nameAr}</div>}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">{material.category}</td>
                    <td className="p-4 align-middle text-muted-foreground">{material.unit}</td>
                    <td className="p-4 align-middle text-right font-mono">{material.priceEconomical?.toLocaleString() || '-'}</td>
                    <td className="p-4 align-middle text-right font-mono font-medium bg-blue-50/30 dark:bg-blue-900/5">{material.priceStandard?.toLocaleString() || '-'}</td>
                    <td className="p-4 align-middle text-right font-mono">{material.pricePremium?.toLocaleString() || '-'}</td>
                    <td className="p-4 align-middle text-center">
                      {material.sasoApproved ? (
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                          <ShieldCheck className="w-3 h-3 mr-1" /> SASO
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                          <ShieldAlert className="w-3 h-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!materials?.length && !isLoading && (
              <div className="p-8 text-center text-muted-foreground">
                No materials found.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
