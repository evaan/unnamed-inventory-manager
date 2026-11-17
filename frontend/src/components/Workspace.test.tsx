import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetailPanel } from './Workspace';

const Fixture = () => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <header><button>Background action</button></header>
      <div>
        <main><button onClick={() => setOpen(true)}>Open details</button></main>
        <DetailPanel label="Test details" open={open}>
          <button onClick={() => setOpen(false)}>Close details</button>
          <input aria-label="Detail field" />
          <button>Last action</button>
        </DetailPanel>
      </div>
    </div>
  );
};

afterEach(() => vi.unstubAllGlobals());

describe('DetailPanel', () => {
  it('isolates the mobile dialog, traps focus, and restores the trigger on close', async () => {
    vi.stubGlobal('innerWidth', 375);
    render(<Fixture />);
    const trigger = screen.getByRole('button', { name: 'Open details' });
    const header = screen.getByRole('banner');
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Test details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(header).toHaveAttribute('aria-hidden', 'true');
    expect(header.inert).toBe(true);
    expect(trigger.closest('main')?.inert).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    const close = within(dialog).getByRole('button', { name: 'Close details' });
    const last = within(dialog).getByRole('button', { name: 'Last action' });
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.click(close);
    expect(trigger).toHaveFocus();
    expect(header).not.toHaveAttribute('aria-hidden');
    expect(header.inert).not.toBe(true);
    expect(document.body.style.overflow).toBe('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Detail field')).not.toBeInTheDocument();
  });

  it('leaves desktop content usable and reacts to viewport changes', async () => {
    vi.stubGlobal('innerWidth', 1280);
    render(<Fixture />);
    await userEvent.click(screen.getByRole('button', { name: 'Open details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background action' })).toBeVisible();
    vi.stubGlobal('innerWidth', 700);
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Background action' })).not.toBeInTheDocument();
    vi.stubGlobal('innerWidth', 1280);
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background action' })).toBeVisible();
  });

  it('restores background state when unmounted with the panel open', async () => {
    vi.stubGlobal('innerWidth', 375);
    const { unmount } = render(<Fixture />);
    await userEvent.click(screen.getByRole('button', { name: 'Open details' }));
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
