import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from './ConfirmProvider';
import { useConfirm } from '../hooks/useConfirm';

const Fixture = ({ onResult = () => {} }: { onResult?: (confirmed: boolean) => void }) => {
  const confirm = useConfirm();
  const [result, setResult] = useState('');
  return <>
    <button onClick={async () => {
      const confirmed = await confirm({
        title: 'Delete record?',
        message: 'This action cannot be undone.',
        confirmLabel: 'Delete record',
        destructive: true,
      });
      onResult(confirmed);
      setResult(confirmed ? 'Confirmed' : 'Cancelled');
    }}>Open confirmation</button>
    <p role="status">{result}</p>
  </>;
};

describe('ConfirmProvider', () => {
  it('describes the alert, focuses Cancel, traps focus, and restores the trigger', async () => {
    render(<ConfirmProvider><Fixture /></ConfirmProvider>);
    const trigger = screen.getByRole('button', { name: 'Open confirmation' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete record?' });
    expect(dialog).toHaveAccessibleDescription('This action cannot be undone.');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Delete record' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Delete record' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled');
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it.each(['Cancel', 'Close modal', 'backdrop'])('cancels safely via %s', async (action) => {
    render(<ConfirmProvider><Fixture /></ConfirmProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Open confirmation' }));
    if (action === 'backdrop') await userEvent.click(screen.getByRole('alertdialog').parentElement!);
    else await userEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('only confirms after an explicit affirmative action', async () => {
    const onResult = vi.fn();
    render(<ConfirmProvider><Fixture onResult={onResult} /></ConfirmProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Open confirmation' }));
    expect(onResult).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete record' }));
    expect(onResult).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole('status')).toHaveTextContent('Confirmed');
  });

  it('resolves a pending request as cancelled when unmounted', async () => {
    const onResult = vi.fn();
    const { unmount } = render(<ConfirmProvider><Fixture onResult={onResult} /></ConfirmProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Open confirmation' }));
    unmount();
    await Promise.resolve();
    expect(onResult).toHaveBeenCalledExactlyOnceWith(false);
    expect(document.body.style.overflow).toBe('');
  });
});
