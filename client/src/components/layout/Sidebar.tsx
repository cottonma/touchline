import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navGroups } from './navigation';

/**
 * Desktop sidebar navigation.
 * Shows all nav items grouped by category.
 * Visible only on medium screens and above (hidden on mobile).
 */
export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:pt-14 md:border-r md:bg-background">
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <h3 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
