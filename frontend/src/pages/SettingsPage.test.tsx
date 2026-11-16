import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getSettings, getUsers, patchSettings, putUserPermissions, setUserDisabled } from '../features/settings/settingsapi';

vi.mock('../features/auth/useAuth', () => ({
  useAuth: vi.fn(),
  useLogout: vi.fn(),
}));
vi.mock('../features/settings/settingsapi', () => ({
  getUsers: vi.fn(),
  putUserPermissions: vi.fn(),
  setUserDisabled: vi.fn(),
  getSettings: vi.fn(),
  patchSettings: vi.fn(),
  usersQueryKey: ['admin', 'users'],
  settingsQueryKey: ['admin', 'settings'],
}));

const USERS = [
  { id: '1', name: 'Taylor', email: 'taylor@example.com', disabled: false, permissions: ['CreateItem'] },
  { id: '2', name: 'Alex', email: 'alex@example.com', disabled: false, permissions: ['Administrator'] },
];

const renderPage = (path = '/app/settings') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/settings/*" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
);

const openUser = async () => {
  renderPage('/app/settings/users');
  await userEvent.click(await screen.findByRole('button', { name: /Taylor taylor@example.com/ }));
};

const openSettings = async () => {
  renderPage('/app/settings/app');
  await screen.findByLabelText('Automatically Disable New Users');
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    data: { loggedIn: true, disabled: false, name: 'Alex', email: 'alex@example.com', permissions: ['Administrator'] },
  } as never);
  vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  vi.mocked(getUsers).mockResolvedValue(USERS);
  vi.mocked(getSettings).mockResolvedValue({
    signup_policy: 'whitelist',
    whitelisted_email_domains: '["mun.ca"]',
  });
  vi.mocked(putUserPermissions).mockResolvedValue(undefined);
  vi.mocked(setUserDisabled).mockResolvedValue(undefined);
  vi.mocked(patchSettings).mockResolvedValue(undefined);
});

describe('SettingsPage: account and access', () => {
  it('shows regular users their account without admin tabs or empty permission spacing', () => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, name: 'Alex', email: 'alex@example.com', permissions: [] },
    } as never);
    renderPage();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('No permissions assigned.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'App settings' })).not.toBeInTheDocument();
    expect(getUsers).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it('redirects regular users away from admin pages', async () => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions: [] },
    } as never);
    renderPage('/app/settings/users');
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument();
    expect(getUsers).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });
});

describe('SettingsPage: users', () => {
  it('opens a user from the list in a modal and closes it with Escape', async () => {
    renderPage('/app/settings/users');
    expect(screen.getByRole('status', { name: 'Loading users' })).toBeInTheDocument();
    const user = await screen.findByRole('button', { name: /Taylor taylor@example.com/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(user);
    expect(screen.getByRole('dialog', { name: 'Manage user' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(user).toHaveFocus();
  });

  it('saves permission changes using the existing API', async () => {
    await openUser();
    await userEvent.click(screen.getByRole('checkbox', { name: /^ModifyItem/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save permissions' }));
    expect(putUserPermissions).toHaveBeenCalledWith('1', ['CreateItem', 'ModifyItem']);
    expect(await screen.findByText('Permissions saved.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Permission name')).not.toBeInTheDocument();
  });

  it('disables and enables another user without a confirmation popup', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    await openUser();
    await userEvent.click(screen.getByRole('button', { name: 'Disable user' }));
    expect(setUserDisabled).toHaveBeenCalledWith('1', true);
    expect(confirm).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Enable user' }));
    await waitFor(() => expect(setUserDisabled).toHaveBeenLastCalledWith('1', false));
  });

  it('does not allow disabling your own account', async () => {
    renderPage('/app/settings/users');
    await userEvent.click(await screen.findByRole('button', { name: /Alex alex@example.com/ }));
    const button = screen.getByRole('button', { name: 'Disable user' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(setUserDisabled).not.toHaveBeenCalled();
  });

});

describe('SettingsPage: app settings', () => {
  it('saves the automatic disabling policy without changing its API values', async () => {
    await openSettings();
    const policy = screen.getByLabelText('Automatically Disable New Users');
    expect(within(policy).getByRole('option', { name: 'Never' })).toHaveValue('open');
    expect(within(policy).getByRole('option', { name: 'When their email domain is not whitelisted' })).toHaveValue('whitelist');
    expect(within(policy).getByRole('option', { name: 'Always' })).toHaveValue('closed');
    await userEvent.selectOptions(policy, 'closed');
    await userEvent.click(within(screen.getByRole('form', { name: 'Edit Automatically Disable New Users' })).getByRole('button', { name: 'Save setting' }));
    expect(patchSettings).toHaveBeenCalledWith({ signup_policy: 'closed' });
    expect(await screen.findByText('Setting saved.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create setting' })).not.toBeInTheDocument();
  });

  it('adds and removes domains in a list, then saves them in the API format', async () => {
    await openSettings();
    expect(screen.getByText('mun.ca')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Whitelisted Email Domains'), 'Example.COM{Enter}');
    expect(screen.getByText('example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove domain mun.ca' }));
    await userEvent.click(within(screen.getByRole('form', { name: 'Edit Whitelisted Email Domains' })).getByRole('button', { name: 'Save setting' }));
    expect(patchSettings).toHaveBeenCalledWith({ whitelisted_email_domains: '["example.com"]' });
  });

});
