import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navGroups } from './navigation';
import { useAuth } from '@/lib/auth';

/**
 * Mobile hamburger menu.
 * Provides access to ALL navigation items on mobile (since bottom nav only shows 5).
 * Slides in as a full-screen overlay.
 */
export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const isScout = user?.role === 'scout';
  const isParent = user?.role === 'parent';

  const filteredGroups = isScout
    ? [{ label: 'Scout', items: navGroups.flatMap(g => g.items).filter(i => ['/scout-report'].includes(i.path)) }]
    : isParent
    ? [{ label: 'Parent', items: navGroups.flatMap(g => g.items).filter(i => ['/parent'].includes(i.path)) }]
    : navGroups;

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-background">
          {/* Close header */}
          <div className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚽</span>
              <h1 className="text-lg font-bold text-primary">Touchline</h1>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="overflow-y-auto p-4">
            {filteredGroups.map((group) => (
              <div key={group.label} className="mb-5">
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground hover:bg-accent'
                          )
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
