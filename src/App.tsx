import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Workspace from "./pages/Workspace";
import Processing from "./pages/Processing";
import Results from "./pages/Results";
import Catalog from "./pages/Catalog";
import Policies from "./pages/Policies";
import Settings from "./pages/Settings";
import Architecture from "./pages/Architecture";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Workspace />} />
            <Route path="/jobs" element={<Navigate to="/" replace />} />
            <Route path="/jobs/:jobId" element={<Processing />} />
            <Route path="/jobs/:jobId/results" element={<Results />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/architecture" element={<Architecture />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
