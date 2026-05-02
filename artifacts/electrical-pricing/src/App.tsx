import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import { Shell } from "@/components/layout/shell";

import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import ProjectReview from "@/pages/project-review";
import Materials from "@/pages/materials";
import AgentsPage from "@/pages/agents";
import TakeoffPage from "@/pages/takeoff";
import IntelligencePage from "@/pages/intelligence";
import BoqReportPage from "@/pages/boq-report";
import MaterialsDbPage from "@/pages/materials-db";

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/projects/:id/review" component={ProjectReview} />
        <Route path="/materials" component={Materials} />
        <Route path="/agents" component={AgentsPage} />
        <Route path="/takeoff" component={TakeoffPage} />
        <Route path="/intelligence" component={IntelligencePage} />
        <Route path="/boq-report" component={BoqReportPage} />
        <Route path="/materials-db" component={MaterialsDbPage} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
