import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { PulseLogo } from '@/components/brand/PulseLogo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
      { label: 'Forecast', to: '/forecast', icon: TrendingUp },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Invoices', to: '/invoices', icon: FileText },
      { label: 'Payments', to: '/payments', icon: CreditCard },
    ],
  },
  {
    label: 'Records',
    items: [
      { label: 'Customers', to: '/customers', icon: Users },
      { label: 'Expenses & bills', to: '/expenses', icon: Receipt },
    ],
  },
  {
    label: 'Account',
    items: [{ label: 'Settings', to: '/settings', icon: Settings }],
  },
];

interface SidebarLinksProps {
  items: NavItem[];
  onClose: () => void;
}

function SidebarLinks({ items, onClose }: SidebarLinksProps) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150 lg:py-2',
                isActive
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive ? (
                  <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-primary" />
                ) : null}
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </>
            )}
          </NavLink>
        );
      })}
    </>
  );
}

function SidebarBody({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="px-6 py-5">
        <PulseLogo variant="full" />
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          Your business. Your cashflow. Your next move.
        </p>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-5 px-3 pb-6">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group.label}</p>
            <SidebarLinks items={group.items} onClose={onClose} />
          </div>
        ))}
      </nav>
    </>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <SidebarBody onClose={onClose} />
      </aside>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card lg:hidden"
            aria-label="Navigation"
          >
            <div className="flex justify-end p-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 cursor-pointer"
                onClick={onClose}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <SidebarBody onClose={onClose} />
          </aside>
        </>
      ) : null}
    </>
  );
}
