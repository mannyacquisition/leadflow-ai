import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthProvider';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import AdminShell from '@/components/admin/AdminShell';
import AdminOverview from '@/pages/admin/Overview';
import KnowledgeBase from '@/pages/admin/KnowledgeBase';
import ToolRegistry from '@/pages/admin/ToolRegistry';
import AgentStudio from '@/pages/admin/AgentStudio';
import ExecutionLogs from '@/pages/admin/ExecutionLogs';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const ProtectedRoute = ({ children, currentPageName }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/Login" state={{ from: location }} replace />;
  }

  return (
    <LayoutWrapper currentPageName={currentPageName}>
      {children}
    </LayoutWrapper>
  );
};

const AppRouter = () => {
  const location = useLocation();
  
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/Login" element={<Login />} />
      <Route path="/AuthCallback" element={<AuthCallback />} />

      {/* Admin routes */}
      <Route path="/admin" element={<AdminShell><AdminOverview /></AdminShell>} />
      <Route path="/admin/knowledge" element={<AdminShell><KnowledgeBase /></AdminShell>} />
      <Route path="/admin/tools" element={<AdminShell><ToolRegistry /></AdminShell>} />
      <Route path="/admin/studio" element={<AdminShell><AgentStudio /></AdminShell>} />
      <Route path="/admin/logs" element={<AdminShell><ExecutionLogs /></AdminShell>} />
      
      {/* Protected app routes */}
      <Route path="/" element={
        <ProtectedRoute currentPageName={mainPageKey}>
          <MainPage />
        </ProtectedRoute>
      } />
      
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <ProtectedRoute currentPageName={path}>
              <Page />
            </ProtectedRoute>
          }
        />
      ))}
      
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRouter />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App

