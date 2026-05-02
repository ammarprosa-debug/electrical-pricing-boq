import { useGetProject, useGetReviewQueue, useUpdateBoqItem, getGetReviewQueueQueryKey, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, AlertTriangle, Save } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function ProjectReview() {
  const { id } = useParams();
  const projectId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: queueItems } = useGetReviewQueue(projectId);
  
  const updateItemMutation = useUpdateBoqItem();
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    economical: number;
    standard: number;
    premium: number;
  }>({ economical: 0, standard: 0, premium: 0 });

  const handleEditClick = (item: any) => {
    setEditingId(item.id);
    setEditValues({
      economical: item.unitPriceEconomical || 0,
      standard: item.unitPriceStandard || 0,
      premium: item.unitPricePremium || 0,
    });
  };

  const handleSave = (itemId: number) => {
    updateItemMutation.mutate({
      itemId,
      data: {
        unitPriceEconomical: editValues.economical,
        unitPriceStandard: editValues.standard,
        unitPricePremium: editValues.premium,
        status: 'reviewed'
      }
    }, {
      onSuccess: () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getGetReviewQueueQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        toast({ title: "Item saved", description: "Pricing updated successfully." });
      }
    });
  };

  const handleApprove = (itemId: number) => {
    updateItemMutation.mutate({
      itemId,
      data: { status: 'approved' }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetReviewQueueQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        toast({ title: "Item approved", description: "Item marked as approved." });
      }
    });
  };

  if (projectLoading) return <div className="p-8">Loading...</div>;
  if (!project) return <div className="p-8">Project not found</div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50 dark:bg-background">
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${project.id}`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review Queue</h1>
            <p className="text-sm text-muted-foreground">Items requiring manual intervention</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 font-medium text-muted-foreground w-16">No.</th>
                  <th className="p-3 font-medium text-muted-foreground min-w-[250px]">Description</th>
                  <th className="p-3 font-medium text-muted-foreground w-20">Unit</th>
                  <th className="p-3 font-medium text-muted-foreground w-20 text-right">Qty</th>
                  <th className="p-3 font-medium text-muted-foreground w-28 text-right">Economical</th>
                  <th className="p-3 font-medium text-muted-foreground w-28 text-right">Standard</th>
                  <th className="p-3 font-medium text-muted-foreground w-28 text-right">Premium</th>
                  <th className="p-3 font-medium text-muted-foreground w-24 text-center">Confidence</th>
                  <th className="p-3 font-medium text-muted-foreground w-32 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queueItems?.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground font-mono">{item.itemNumber || item.id}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{item.descriptionEn}</div>
                      {item.descriptionAr && <div className="text-muted-foreground text-xs mt-1" dir="rtl">{item.descriptionAr}</div>}
                      {(item.anomalyReason || item.complianceNotes) && (
                        <div className="flex flex-col gap-1 mt-1">
                          {item.anomalyReason && (
                            <div className="flex items-center text-xs text-amber-600">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {item.anomalyReason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{item.unit}</td>
                    <td className="p-3 text-right font-mono">{item.quantity}</td>
                    
                    {/* Editable fields */}
                    {editingId === item.id ? (
                      <>
                        <td className="p-3"><Input type="number" value={editValues.economical} onChange={e => setEditValues({...editValues, economical: Number(e.target.value)})} className="h-8 text-right font-mono" /></td>
                        <td className="p-3"><Input type="number" value={editValues.standard} onChange={e => setEditValues({...editValues, standard: Number(e.target.value)})} className="h-8 text-right font-mono border-blue-200" /></td>
                        <td className="p-3"><Input type="number" value={editValues.premium} onChange={e => setEditValues({...editValues, premium: Number(e.target.value)})} className="h-8 text-right font-mono" /></td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 text-right font-mono">{item.unitPriceEconomical?.toLocaleString() || '-'}</td>
                        <td className="p-3 text-right font-mono font-medium bg-blue-50/30 dark:bg-blue-900/5">{item.unitPriceStandard?.toLocaleString() || '-'}</td>
                        <td className="p-3 text-right font-mono">{item.unitPricePremium?.toLocaleString() || '-'}</td>
                      </>
                    )}

                    <td className="p-3 text-center">
                      <Badge variant="outline" className={
                        (item.confidenceScore || 0) >= 85 ? 'border-green-500 text-green-600' :
                        (item.confidenceScore || 0) >= 70 ? 'border-amber-500 text-amber-600' :
                        'border-red-500 text-red-600'
                      }>
                        {item.confidenceScore}%
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="default" className="h-8 w-8 p-0" onClick={() => handleSave(item.id)}>
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                            X
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => handleEditClick(item)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="default" className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700" onClick={() => handleApprove(item.id)}>
                            <Check className="w-4 h-4 text-white" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!queueItems?.length && (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Check className="w-12 h-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">Queue Empty</h3>
                <p>All items have been reviewed.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
