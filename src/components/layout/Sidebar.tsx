import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const primaryItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Invoices', to: '/invoices', icon: FileText },
  { label: 'Payments', to: '/payments', icon: CreditCard },
  { label: 'Forecast', to: '/forecast', icon: TrendingUp },
];

const manageItems: NavItem[] = [
  { label: 'Customers', to: '/customers', icon: Users },
  { label: 'Expenses', to: '/expenses', icon: Receipt },
  { label: 'Settings', to: '/settings', icon: Settings },
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
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </NavLink>
        );
      })}
    </>
  );
}

function SidebarBody({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
          <Activity className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold tracking-tight">PULSE</span>
          <span className="text-xs text-muted-foreground">Your next move.</span>
        </div>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3 pb-6">
        <SidebarLinks items={primaryItems} onClose={onClose} />
        <Separator className="my-3" />
        <p className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Manage</p>
        <SidebarLinks items={manageItems} onClose={onClose} />
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card lg:flex">
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
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card lg:hidden"
            aria-label="Navigation"
          >
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close navigation">
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
