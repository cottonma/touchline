import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MoreHorizontal, X, Calendar, Trophy, Target, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { primaryNavItems, navItems } from './navigation';
import { useAuth } from '@/lib/auth';

/**
 * Mobile bottom navigation bar.
 * Shows role-appropriate nav items.
 * - Parent: simplified nav (Fixtures, MOTM, Development, Logout)
 * - Coach/Admin: full 5 primary items + More button
 * Visible only on small screens (md breakpoint and below).
 */
export function BottomNav() {
  const [showMore, setShowMore] = useState(false);
  const { user, logout } = useAuth();
  const isParent = user?.role === 'parent';
  const secondaryItems = navItems.filter(i => !i.primary && i.path !== '/parent');

  // Parents get a simplified nav
  if (isParent) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden safe-area-bottom">
        <div className="flex items-center justify-around">
          <NavLink
            to="/parent"
            end
            className={({ isActive }) => cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Calendar className="h-5 w-5" />
            <span className="font-medium">Fixtures</span>
          </NavLink>
          <NavLink
            to="/development"
            className={({ isActive }) => cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Target className="h-5 w-5" />
            <span className="font-medium">Development</span>
          </NavLink>
          <button
            onClick={logout}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-[60] flex items-end md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-card rounded-t-2xl p-4 pb-24 animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">More</h3>
              <button onClick={() => setShowMore(false)} className="p-2 rounded-md hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {secondaryItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMore(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1.5 rounded-lg p-3 min-h-[72px] transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs font-medium text-center">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden safe-area-bottom">
        <div className="flex items-center justify-around">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn('h-5 w-5', isActive && 'text-primary')}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
              showMore ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
