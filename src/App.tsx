import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Provider } from 'react-redux';
import { store } from '@/store';
import Index from "./pages/Index";
import UserProfile from "./pages/UserProfile";
import PostPage from "./pages/PostPage";
import NotFound from "./pages/NotFound";
import UploaderPortal from "./pages/UploaderPortal";
import SuperAdmin from "./pages/SuperAdmin";

const queryClient = new QueryClient();

const App = () => (
  <div className="min-h-screen bg-background">
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/user" element={<UserProfile />} />
              <Route path="/post/:postId" element={<PostPage />} />
              <Route path="/upload" element={<UploaderPortal />} />
              <Route path="/uploader" element={<Navigate to="/upload" replace />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </Provider>
  </div>
);

export default App;
