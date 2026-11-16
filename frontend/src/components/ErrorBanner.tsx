import { X } from 'lucide-react';

export const ErrorBanner = ({ message, onDismiss, onRetry, retrying = false }: {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
}) => (
  <div role="alert" className="flex items-center justify-between gap-3 border-b border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 sm:px-6">
    <span>{message}</span>
    {onRetry && (
      <button type="button" onClick={onRetry} disabled={retrying} className="ui-button-secondary ml-auto">
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    )}
    {onDismiss && (
      <button type="button" onClick={onDismiss} title="Dismiss" aria-label="Dismiss error" className="ui-icon-button text-rose-300">
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    )}
  </div>
);
