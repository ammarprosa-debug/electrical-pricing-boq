import { useGetProjectsStats, useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, ListTodo, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetProjectsStats();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 dark:bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground mt-1">System status and recent project activity.</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
              <ListTodo className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProjects || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.inProgressProjects || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Items Priced</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalItemsPriced?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Confidence</CardTitle>
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.avgConfidenceScore ? `${stats.avgConfidenceScore.toFixed(1)}%` : '0%'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-4">Recent Activity</h2>
          <Card>
            <div className="divide-y">
              {projects?.slice(0, 5).map((project) => (
                <Link 
                  key={project.id} 
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{project.name}</span>
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      {project.region && <span className="capitalize">{project.region}</span>}
                      {project.region && <span>•</span>}
                      <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={
                      project.status === 'completed' ? 'default' : 
                      project.status === 'failed' ? 'destructive' : 'secondary'
                    }>
                      {project.status.toUpperCase()}
                    </Badge>
                  </div>
                </Link>
              ))}
              {!projects?.length && !projectsLoading && (
                <div className="p-8 text-center text-muted-foreground">
                  No projects found.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
