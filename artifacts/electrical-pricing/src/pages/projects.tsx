import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [region, setRegion] = useState<"riyadh" | "jeddah" | "dammam" | "other">("riyadh");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    createProject.mutate({
      data: {
        name,
        nameAr,
        region,
      }
    }, {
      onSuccess: (newProject) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setOpen(false);
        setLocation(`/projects/${newProject.id}`);
      }
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage and monitor BOQ pricing projects.</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Initialize a new BOQ pricing project workspace.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Project Name (English)</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nameAr">Project Name (Arabic) - Optional</Label>
                    <Input id="nameAr" value={nameAr} onChange={e => setNameAr(e.target.value)} dir="rtl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="region">Region</Label>
                    <Select value={region} onValueChange={(v: any) => setRegion(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="riyadh">Riyadh</SelectItem>
                        <SelectItem value="jeddah">Jeddah</SelectItem>
                        <SelectItem value="dammam">Dammam</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createProject.isPending || !name}>
                    {createProject.isPending ? "Creating..." : "Create Project"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 bg-background" placeholder="Search projects..." />
          </div>
        </div>

        <Card>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Project Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Region</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Items</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Std Total (SAR)</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {projects?.map((project) => (
                  <tr key={project.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted group cursor-pointer" onClick={() => setLocation(`/projects/${project.id}`)}>
                    <td className="p-4 align-middle font-medium">
                      <div className="flex flex-col">
                        <span>{project.name}</span>
                        {project.nameAr && <span className="text-xs text-muted-foreground" dir="rtl">{project.nameAr}</span>}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                        {project.status}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle capitalize">{project.region}</td>
                    <td className="p-4 align-middle text-right">{project.totalItems || '-'}</td>
                    <td className="p-4 align-middle text-right font-mono">
                      {project.totalStandard ? project.totalStandard.toLocaleString() : '-'}
                    </td>
                    <td className="p-4 align-middle text-right text-muted-foreground">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!projects?.length && !isLoading && (
              <div className="p-8 text-center text-muted-foreground">
                No projects yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
