import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlayersPage } from '@/pages/PlayersPage';
import { PlayerDetailPage } from '@/pages/PlayerDetailPage';
import { FixturesPage } from '@/pages/FixturesPage';
import { FixtureDetailPage } from '@/pages/FixtureDetailPage';
import { AvailabilityPage } from '@/pages/AvailabilityPage';
import { TeamSelectionPage } from '@/pages/TeamSelectionPage';
import { MatchDayPage } from '@/pages/MatchDayPage';
import { StatsPage } from '@/pages/StatsPage';
import { DevelopmentPage } from '@/pages/DevelopmentPage';
import { TrainingPage } from '@/pages/TrainingPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AiCoachPage } from '@/pages/AiCoachPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ManageUsersPage } from '@/pages/ManageUsersPage';
import { ScoutReportPage } from '@/pages/ScoutReportPage';
import { SetupWizardPage } from '@/pages/SetupWizardPage';

/**
 * Route guard — redirects to /login if not authenticated.
 */
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <span className="text-4xl">⚽</span>
          <p className="text-slate-400 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/setup" element={<SetupWizardPage />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="players" element={<PlayersPage />} />
                <Route path="players/:id" element={<PlayerDetailPage />} />
                <Route path="fixtures" element={<FixturesPage />} />
                <Route path="fixtures/:id" element={<FixtureDetailPage />} />
                <Route path="availability" element={<AvailabilityPage />} />
                <Route path="team-selection" element={<TeamSelectionPage />} />
                <Route path="match-day" element={<MatchDayPage />} />
                <Route path="scout-report" element={<ScoutReportPage />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="development" element={<DevelopmentPage />} />
                <Route path="training" element={<TrainingPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="ai-coach" element={<AiCoachPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="manage-users" element={<ManageUsersPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
