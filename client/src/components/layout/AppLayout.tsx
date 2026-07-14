import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MobileMenu } from './MobileMenu';

/**
 * Root application layout.
 * Responsive navigation:
 * - Mobile: Top header with hamburger menu + bottom navigation bar
 * - Desktop: Fixed sidebar + header
 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          {/* Mobile menu trigger (visible only on mobile) */}
          <div className="md:hidden">
            <MobileMenu />
          </div>

          {/* Logo */}
          <div className="flex items-center gap-2 md:w-64">
            <span className="text-xl">⚽</span>
            <h1 className="text-lg font-bold text-primary">Touchline</h1>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area - offset for sidebar on desktop, padded for bottom nav on mobile */}
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
