import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckCircle,
  UserCheck,
  PlayCircle,
  BarChart3,
  Target,
  Dumbbell,
  FileText,
  Bot,
  Settings,
  type LucideIcon,
} from 'lucide-react';

/**
 * Navigation configuration.
 * Single source of truth for all navigation items.
 * Bottom nav shows only the primary items (5 max for mobile).
 * Sidebar shows all items grouped by category.
 */

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Show in mobile bottom nav (max 5 items) */
  primary: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, primary: true },
  { label: 'Squad', path: '/players', icon: Users, primary: true },
  { label: 'Fixtures', path: '/fixtures', icon: Calendar, primary: true },
  { label: 'Availability', path: '/availability', icon: CheckCircle, primary: false },
  { label: 'Team Selection', path: '/team-selection', icon: UserCheck, primary: true },
  { label: 'Match Day', path: '/match-day', icon: PlayCircle, primary: true },
  { label: 'Statistics', path: '/stats', icon: BarChart3, primary: false },
  { label: 'Development', path: '/development', icon: Target, primary: false },
  { label: 'Training', path: '/training', icon: Dumbbell, primary: false },
  { label: 'Reports', path: '/reports', icon: FileText, primary: false },
  { label: 'AI Coach', path: '/ai-coach', icon: Bot, primary: false },
  { label: 'Settings', path: '/settings', icon: Settings, primary: false },
];

/** Items shown in mobile bottom navigation bar */
export const primaryNavItems = navItems.filter((item) => item.primary);

/** Grouped items for desktop sidebar */
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: navItems.filter((i) => ['/', '/players', '/fixtures'].includes(i.path)),
  },
  {
    label: 'Match Week',
    items: navItems.filter((i) =>
      ['/availability', '/team-selection', '/match-day'].includes(i.path)
    ),
  },
  {
    label: 'Development',
    items: navItems.filter((i) =>
      ['/stats', '/development', '/training'].includes(i.path)
    ),
  },
  {
    label: 'Tools',
    items: navItems.filter((i) =>
      ['/reports', '/ai-coach', '/settings'].includes(i.path)
    ),
  },
];
