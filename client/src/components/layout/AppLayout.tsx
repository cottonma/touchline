import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileMenu } from './MobileMenu';
import { TeamSwitcher } from './TeamSwitcher';
import { useAuth } from '@/lib/auth';

/**
 * Root application layout — football-themed.
 * Responsive navigation:
 * - Mobile: Dark header with hamburger menu + team switcher + bottom navigation bar
 * - Desktop: Dark fixed sidebar + dark header
 */
export function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const isParent = user?.role === 'parent';

  return (
    <div className="min-h-screen bg-background">
      {/* Header — dark navy with green accent */}
      <header className="app-header sticky top-0 z-50 w-full">
        <div className="flex h-14 items-center px-4">
          {/* Mobile menu trigger — not for parents */}
          {!isParent && (
            <div className="md:hidden">
              <MobileMenu />
            </div>
          )}

          {/* Logo */}
          <div className="flex items-center gap-2 md:w-64">
            <span className="text-xl">⚽</span>
            <h1 className="logo-text text-lg hidden sm:inline">Touchline</h1>
          </div>

          {/* Mobile team switcher — admin only */}
          {isAdmin && (
            <div className="md:hidden flex-1 mx-2">
              <TeamSwitcher />
            </div>
          )}

          {/* Spacer (desktop) */}
          <div className="flex-1 hidden md:block" />

          {/* User info + settings shortcut */}
          {user && (
            <div className="flex items-center gap-2">
              <a
                href="/settings"
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors md:hidden"
                aria-label="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </a>
              <span className="text-sm text-slate-300 hidden sm:inline">
                {user.firstName}
              </span>
              <button
                onClick={logout}
                className="text-xs text-slate-400 hover:text-white transition-colors md:hidden"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Desktop sidebar — not for parents */}
      {!isParent && <Sidebar />}

      {/* Main content area */}
      <main className={`pb-20 md:pb-0 ${isParent ? '' : 'md:pl-64'}`}>
        <div className="container max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
