import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from '../components/ConfirmProvider';
import { useUnsavedChanges } from './useUnsavedChanges';

const Editor = () => {
  const [value, setValue] = useState('');
  useUnsavedChanges(!!value, false);
  return <>
    <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
    <Link to="/next">Next page</Link>
  </>;
};

const renderEditor = () => render(
  <MemoryRouter>
    <ConfirmProvider>
      <Routes>
        <Route path="/" element={<Editor />} />
        <Route path="/next" element={<h1>Destination</h1>} />
      </Routes>
    </ConfirmProvider>
  </MemoryRouter>
);

describe('useUnsavedChanges', () => {
  it('resumes router navigation only after confirming discard', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    renderEditor();
    await userEvent.type(screen.getByRole('textbox'), 'Unsaved draft');
    await userEvent.click(screen.getByRole('link', { name: 'Next page' }));
    expect(screen.queryByRole('heading', { name: 'Destination' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('textbox')).toHaveValue('Unsaved draft');
    await userEvent.click(screen.getByRole('link', { name: 'Next page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('heading', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });
});
