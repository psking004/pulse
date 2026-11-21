import { Bell, CircleUser, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={onMenuClick}>
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>
      <p className="hidden text-sm text-muted-foreground md:block">
        Your business. Your cashflow. Your next move.
      </p>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" aria-label="Notifications" title="Coming soon">
        <Bell className="h-5 w-5" aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Account menu" title="Coming soon">
        <CircleUser className="h-5 w-5" aria-hidden="true" />
      </Button>
    </header>
  );
}
