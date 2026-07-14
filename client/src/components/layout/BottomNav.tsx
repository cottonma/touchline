import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { primaryNavItems } from './navigation';

/**
 * Mobile bottom navigation bar.
 * Shows 5 primary nav items with icons and labels.
 * Visible only on small screens (md breakpoint and below).
 */
export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
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
      </div>
    </nav>
  );
}
