import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query';
import { AppLayout } from '@/components/layout/AppLayout';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="players/:id" element={<PlayerDetailPage />} />
            <Route path="fixtures" element={<FixturesPage />} />
            <Route path="fixtures/:id" element={<FixtureDetailPage />} />
            <Route path="fixtures/:id" element={<FixtureDetailPage />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="team-selection" element={<TeamSelectionPage />} />
            <Route path="match-day" element={<MatchDayPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="development" element={<DevelopmentPage />} />
            <Route path="training" element={<TrainingPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="ai-coach" element={<AiCoachPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
