import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROUTE_PATHS } from "@/lib/index";

// ── Lazy-loaded pages (code splitting) ─────────────────────────
const LoginPage        = lazy(() => import("./pages/login/Index"));
const HospitalsPage    = lazy(() => import("./pages/hospitals/Index"));
const HospitalDetail   = lazy(() => import("./pages/hospitals/Detail"));
const CSFormPage       = lazy(() => import("./pages/cs/Index"));
const DemoFormPage     = lazy(() => import("./pages/demo/Index"));
const UpdateFormPage   = lazy(() => import("./pages/update/Index"));
const WithdrawPage     = lazy(() => import("./pages/withdraw/Index"));
const MyIssuesPage     = lazy(() => import("./pages/issues/Index"));
const ReceiptsPage     = lazy(() => import("./pages/issues/Receipts"));
const ReleaseNotesPage = lazy(() => import("./pages/releases/Index"));
const NoticesPage      = lazy(() => import("./pages/notices/Index"));
const NotFound         = lazy(() => import("./pages/not-found/Index"));
const ServiceReportPage    = lazy(() => import("./pages/service-report/Index"));
const InstallRequestPage   = lazy(() => import("./pages/install-request/Index"));
const QualificationPage    = lazy(() => import("./pages/qualification/Index"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ── 로딩 스피너 ────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="space-y-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto">
          <span className="text-primary-foreground font-bold">H</span>
        </div>
        <div className="flex gap-1 justify-center">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── 인증 가드 ─────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.LOGIN} replace />;
  }

  return <>{children}</>;
}

// ── 앱 라우터 ──────────────────────────────────────────────────
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path={ROUTE_PATHS.LOGIN}
          element={isAuthenticated ? <Navigate to={ROUTE_PATHS.HOSPITALS} replace /> : <LoginPage />}
        />
        <Route
          path={ROUTE_PATHS.HOME}
          element={<Navigate to={ROUTE_PATHS.HOSPITALS} replace />}
        />
        <Route
          path={ROUTE_PATHS.HOSPITALS}
          element={<ProtectedRoute><HospitalsPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.HOSPITAL_DETAIL}
          element={<ProtectedRoute><HospitalDetail /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.CS_FORM}
          element={<ProtectedRoute><CSFormPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.DEMO_FORM}
          element={<ProtectedRoute><DemoFormPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.UPDATE_FORM}
          element={<ProtectedRoute><UpdateFormPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.WITHDRAW}
          element={<ProtectedRoute><WithdrawPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.MY_ISSUES}
          element={<ProtectedRoute><MyIssuesPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.RECEIPTS}
          element={<ProtectedRoute><ReceiptsPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.RELEASES}
          element={<ProtectedRoute><ReleaseNotesPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.NOTICES}
          element={<ProtectedRoute><NoticesPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.SERVICE_REPORT}
          element={<ProtectedRoute><ServiceReportPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.INSTALL_REQUEST}
          element={<ProtectedRoute><InstallRequestPage /></ProtectedRoute>}
        />
        <Route
          path={ROUTE_PATHS.QUALIFICATION}
          element={<ProtectedRoute><QualificationPage /></ProtectedRoute>}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
