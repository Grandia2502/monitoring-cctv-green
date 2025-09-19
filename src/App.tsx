import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { CameraManagement } from "@/pages/CameraManagement";
import { MonitoringRecords } from "@/pages/MonitoringRecords";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/cameras" element={<Layout><CameraManagement /></Layout>} />
          <Route path="/records" element={<Layout><MonitoringRecords /></Layout>} />
          <Route path="/analytics" element={<Layout><div className="p-6"><h1 className="text-2xl font-bold">Analytics (Coming Soon)</h1></div></Layout>} />
          <Route path="/users" element={<Layout><div className="p-6"><h1 className="text-2xl font-bold">User Management (Coming Soon)</h1></div></Layout>} />
          <Route path="/settings" element={<Layout><div className="p-6"><h1 className="text-2xl font-bold">Settings (Coming Soon)</h1></div></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
