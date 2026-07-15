import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navGroups } from './navigation';

/**
 * Desktop sidebar navigation — dark football theme.
 * Shows all nav items grouped by category.
 */
export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:pt-14 sidebar-dark">
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <h3 className="nav-group-label mb-2 px-3">
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
                        'nav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                        isActive && 'nav-link-active'
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
