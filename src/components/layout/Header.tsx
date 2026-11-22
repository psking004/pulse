import { Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountMenu } from '@/features/auth/AccountMenu';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 cursor-pointer lg:hidden"
        aria-label="Open navigation"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>
      <p className="hidden text-sm font-medium text-muted-foreground md:block">Business cashflow</p>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer" aria-label="Notifications" title="Coming soon">
        <Bell className="h-5 w-5" aria-hidden="true" />
      </Button>
      <AccountMenu />
    </header>
  );
}
