import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navGroups } from './navigation';
import { useAuth } from '@/lib/auth';
import { TeamSwitcher } from './TeamSwitcher';

/**
 * Desktop sidebar navigation — dark football theme.
 * Shows all nav items grouped by category.
 * Shows team switcher for admins, team name for coaches.
 */
export function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const isScout = user?.role === 'scout';

  // Scouts only see the scout report
  const scoutPaths = ['/scout-report'];
  const filteredGroups = isScout
    ? [{ label: 'Scout', items: navGroups.flatMap(g => g.items).filter(i => scoutPaths.includes(i.path)) }]
    : navGroups;

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:pt-14 sidebar-dark">
      {/* Team Switcher / Team Name */}
      <div className="px-3 pt-4 pb-2">
        {isAdmin ? (
          <TeamSwitcher />
        ) : isScout ? (
          <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
            Scout View
          </div>
        ) : (
          <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
            My Team
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {filteredGroups.map((group) => (
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

      {/* User info + logout at bottom */}
      {user && (
        <div className="border-t border-slate-700 px-3 py-3">
          <div className="flex items-center justify-between px-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-xs text-slate-400 hover:text-white transition-colors ml-2 shrink-0"
              title="Sign out"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
