import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileMenu } from './MobileMenu';

/**
 * Root application layout — football-themed.
 * Responsive navigation:
 * - Mobile: Dark header with hamburger menu + bottom navigation bar
 * - Desktop: Dark fixed sidebar + dark header
 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header — dark navy with green accent */}
      <header className="app-header sticky top-0 z-50 w-full">
        <div className="flex h-14 items-center px-4">
          {/* Mobile menu trigger */}
          <div className="md:hidden">
            <MobileMenu />
          </div>

          {/* Logo */}
          <div className="flex items-center gap-2 md:w-64">
            <span className="text-xl">⚽</span>
            <h1 className="logo-text text-lg">Touchline</h1>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="pb-20 md:pb-0 md:pl-64">
        <div className="container max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
