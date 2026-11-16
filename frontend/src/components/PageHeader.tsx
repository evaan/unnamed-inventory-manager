import { LogOut } from 'lucide-react';
import { useLogout } from '../features/auth/useAuth';
import { ErrorBanner } from './ErrorBanner';
import { PageNavigation } from './PageNavigation';
import { ThemeToggle } from './ThemeToggle';

export const PageHeader = ({ onBeforeLogout }: { onBeforeLogout?: () => boolean }) => {
  const logout = useLogout();

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/50 px-4 py-3 sm:gap-6 sm:px-6">
        <div className="mr-auto w-full sm:w-auto">
          <PageNavigation />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => { if (!onBeforeLogout || onBeforeLogout()) logout.mutate(); }}
            disabled={logout.isPending}
            className="ui-button-secondary"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            {logout.isPending ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </header>
      {logout.error && <ErrorBanner message={logout.error.message} />}
    </>
  );
};
