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
  it('only confirms after an explicit affirmative action', async () => {
    const onResult = vi.fn();
    render(<ConfirmProvider><Fixture onResult={onResult} /></ConfirmProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Open confirmation' }));
    expect(onResult).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete record' }));
    expect(onResult).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByRole('status')).toHaveTextContent('Confirmed');
  });
});
