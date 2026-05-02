import { useGetProject, useListBoqItems, useUploadBoqFile, useStartPricing, useGetPricingStatus, useGetProjectSummary, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadCloud, Play, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowLeft } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: items } = useListBoqItems(projectId);
  const { data: summary } = useGetProjectSummary(projectId, { query: { enabled: project?.status === 'completed' || project?.status === 'reviewing' } });
  
  const uploadMutation = useUploadBoqFile();
  const startPricingMutation = useStartPricing();

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPolling, setIsPolling] = useState(false);
  
  const { data: statusData } = useGetPricingStatus(projectId, {
    query: {
      enabled: isPolling,
      refetchInterval: 2000, // Poll every 2s
    }
  });

  // Watch status to stop polling and refetch project
  useEffect(() => {
    if (statusData?.status === 'completed' || statusData?.status === 'reviewing' || statusData?.status === 'failed') {
      setIsPolling(false);
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      if (statusData.status === 'completed' || statusData.status === 'reviewing') {
        toast({ title: "Pricing Complete", description: "BOQ pricing has finished successfully." });
      } else {
        toast({ title: "Pricing Failed", description: "An error occurred during pricing.", variant: "destructive" });
      }
    }
  }, [statusData?.status, projectId, queryClient, toast]);

  // Start polling if project loads and is already parsing/pricing
  useEffect(() => {
    if (project?.status === 'parsing' || project?.status === 'pricing') {
      setIsPolling(true);
    }
  }, [project?.status]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadMutation.mutate({ id: projectId, data: { file } }, {
      onSuccess: () => {
        toast({ title: "File uploaded", description: "BOQ file uploaded successfully." });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      },
      onError: (err) => {
        toast({ title: "Upload failed", description: "Could not upload file.", variant: "destructive" });
      }
    });
  };

  const handleStartPricing = () => {
    startPricingMutation.mutate({
      id: projectId,
      data: { scenarios: ['economical', 'standard', 'premium'] }
    }, {
      onSuccess: () => {
        setIsPolling(true);
        toast({ title: "Pricing Started", description: "AI is now analyzing and pricing items." });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  const downloadExcel = () => {
    window.location.href = `/api/projects/${projectId}/report/excel?scenario=standard`;
  };

  const downloadPdf = () => {
    window.location.href = `/api/projects/${projectId}/report/pdf`;
  };

  const COLORS = ['#1e3a5f', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#ec4899'];

  if (projectLoading) return <div className="p-8">Loading...</div>;
  if (!project) return <div className="p-8">Project not found</div>;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50 dark:bg-background">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.nameAr && <p className="text-sm text-muted-foreground" dir="rtl">{project.nameAr}</p>}
          </div>
          <Badge variant="outline" className="ml-2 capitalize">{project.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {(project.status === 'completed' || project.status === 'reviewing') && (
            <>
              <Button variant="outline" size="sm" onClick={downloadExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel Report
              </Button>
              <Button variant="outline" size="sm" onClick={downloadPdf}>
                <FileText className="w-4 h-4 mr-2" />
                PDF Summary
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        
        {/* Upload / Processing State */}
        {(project.status === 'draft' || isPolling) && (
          <Card className="mb-6 max-w-2xl mx-auto mt-8">
            <CardContent className="pt-6">
              {project.status === 'draft' ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg border-muted">
                  <UploadCloud className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Upload BOQ Document</h3>
                  <p className="text-muted-foreground mb-6">Excel, CSV, or PDF format supported.</p>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.pdf" />
                  <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending ? "Uploading..." : "Select File"}
                  </Button>
                  
                  {items && items.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-muted">
                      <p className="mb-4">{items.length} items parsed and ready for pricing.</p>
                      <Button onClick={handleStartPricing} size="lg" className="w-full max-w-sm" disabled={startPricingMutation.isPending}>
                        <Play className="w-4 h-4 mr-2" />
                        Start AI Pricing
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12">
                  <h3 className="font-semibold text-lg text-center mb-6">
                    {statusData?.status === 'parsing' ? 'Parsing Document...' : 'AI Pricing in Progress...'}
                  </h3>
                  <Progress value={statusData?.progress || 0} className="mb-4" />
                  <p className="text-center text-sm text-muted-foreground">
                    {statusData?.currentStep || 'Processing...'} ({statusData?.progress || 0}%)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Detailed View (Completed/Reviewing) */}
        {(project.status === 'completed' || project.status === 'reviewing') && (
          <div className="flex gap-6 h-full">
            <div className="flex-1 flex flex-col overflow-hidden">
              <Tabs defaultValue="items" className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="items">BOQ Items</TabsTrigger>
                  </TabsList>
                  {project.reviewItems ? (
                    <Link href={`/projects/${project.id}/review`}>
                      <Button variant="secondary" className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        {project.reviewItems} Items Need Review
                      </Button>
                    </Link>
                  ) : null}
                </div>
                
                <TabsContent value="items" className="flex-1 overflow-auto m-0">
                  <Card className="h-full rounded-md border">
                    <div className="w-full overflow-auto max-h-[calc(100vh-250px)] relative">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="p-3 font-medium text-muted-foreground w-16">No.</th>
                            <th className="p-3 font-medium text-muted-foreground min-w-[300px]">Description</th>
                            <th className="p-3 font-medium text-muted-foreground w-20">Unit</th>
                            <th className="p-3 font-medium text-muted-foreground w-24 text-right">Qty</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Eco Price</th>
                            <th className="p-3 font-medium text-muted-foreground text-right bg-blue-50/50 dark:bg-blue-900/10">Std Price</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Prem Price</th>
                            <th className="p-3 font-medium text-muted-foreground w-24 text-center">Confidence</th>
                            <th className="p-3 font-medium text-muted-foreground w-24 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {items?.map(item => (
                            <tr key={item.id} className="hover:bg-muted/30">
                              <td className="p-3 text-muted-foreground font-mono">{item.itemNumber || item.id}</td>
                              <td className="p-3">
                                <div className="font-medium text-foreground">{item.descriptionEn}</div>
                                {item.descriptionAr && <div className="text-muted-foreground text-xs mt-1" dir="rtl">{item.descriptionAr}</div>}
                                {item.anomalyFlag && (
                                  <div className="flex items-center text-xs text-amber-600 mt-1">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    {item.anomalyReason || "Anomaly detected"}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-muted-foreground">{item.unit}</td>
                              <td className="p-3 text-right font-mono">{item.quantity}</td>
                              <td className="p-3 text-right font-mono">{item.unitPriceEconomical?.toLocaleString() || '-'}</td>
                              <td className="p-3 text-right font-mono font-medium bg-blue-50/30 dark:bg-blue-900/5">{item.unitPriceStandard?.toLocaleString() || '-'}</td>
                              <td className="p-3 text-right font-mono">{item.unitPricePremium?.toLocaleString() || '-'}</td>
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
                                {item.complianceStatus === 'pass' && <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                                {item.complianceStatus === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />}
                                {item.complianceStatus === 'fail' && <XCircle className="w-4 h-4 text-red-500 mx-auto" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Summary Panel */}
            <div className="w-80 shrink-0 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Project Totals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summary ? (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Economical</span>
                          <span className="font-mono">{summary.scenarios.economical.grandTotal.toLocaleString()} SAR</span>
                        </div>
                        <div className="flex justify-between font-medium text-primary">
                          <span>Standard</span>
                          <span className="font-mono">{summary.scenarios.standard.grandTotal.toLocaleString()} SAR</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Premium</span>
                          <span className="font-mono">{summary.scenarios.premium.grandTotal.toLocaleString()} SAR</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground pt-2 border-t text-right">
                        Totals include 15% VAT
                      </div>
                    </>
                  ) : (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-muted rounded w-full"></div>
                      <div className="h-4 bg-muted rounded w-full"></div>
                      <div className="h-4 bg-muted rounded w-full"></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0 && (
                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="text-sm">Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center pb-2 pt-4">
                    <PieChart width={240} height={160}>
                        <Pie
                          data={summary.categoryBreakdown}
                          cx={120}
                          cy={80}
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={2}
                          dataKey="totalStandard"
                          stroke="none"
                        >
                          {summary.categoryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value.toLocaleString()} SAR`, 'Standard']}
                          contentStyle={{ fontSize: '11px' }}
                        />
                      </PieChart>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">SASO Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                   {summary?.complianceSummary ? (
                     <div className="space-y-3">
                       <div className="flex justify-between items-center text-sm">
                         <div className="flex items-center text-green-600"><CheckCircle2 className="w-4 h-4 mr-2" /> Passed</div>
                         <span className="font-medium">{summary.complianceSummary.pass}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                         <div className="flex items-center text-amber-600"><AlertTriangle className="w-4 h-4 mr-2" /> Warnings</div>
                         <span className="font-medium">{summary.complianceSummary.warning}</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                         <div className="flex items-center text-red-600"><XCircle className="w-4 h-4 mr-2" /> Failed</div>
                         <span className="font-medium">{summary.complianceSummary.fail}</span>
                       </div>
                     </div>
                   ) : (
                     <div className="text-sm text-muted-foreground">Analyzing compliance...</div>
                   )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
