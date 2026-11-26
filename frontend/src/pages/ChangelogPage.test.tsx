import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getLogs, type ChangelogEntry } from '../features/items/changelogapi';
import { ChangelogPage } from './ChangelogPage';

vi.mock('../features/auth/useAuth', () => ({ useAuth: vi.fn(), useLogout: vi.fn() }));
vi.mock('../features/items/changelogapi', () => ({ getLogs: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    data: { loggedIn: true, disabled: false, name: 'Taylor', email: 'taylor@example.com', permissions: [] },
  } as never);
  vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
});

const renderChangelog = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/app/changelog']}><ChangelogPage /></MemoryRouter>
  </QueryClientProvider>,
);

it('lets a reader open field changes in the side panel without badges on modifications', async () => {
  const user = userEvent.setup();
  const entry: ChangelogEntry = {
    ID: 2,
    UserID: 'user-1',
    UserName: 'Alex',
    ItemID: 'item-1',
    Item: { ItemName: 'Resistor', DeletedAt: null },
    Quantity: 3,
    Action: 'ADDED',
    ChangeTime: '2026-11-25T10:00:00Z',
    Description: 'Restocked and relabelled',
    Changes: [
      { Field: 'Quantity', Before: '5', After: '8' },
      { Field: 'Description', Before: 'Old label', After: 'New label' },
    ],
  };
  vi.mocked(getLogs).mockResolvedValue([
    entry,
    {
      ...entry, ID: 1, Action: 'MODIFIED', Quantity: 0,
      Item: { ItemName: 'Capacitor', DeletedAt: null },
      Description: 'Updated manufacturer',
      Changes: [{ Field: 'Manufacturer', Before: 'Acme', After: 'Vishay' }],
    },
    { ...entry, ID: 0, Action: 'MODIFIED', Quantity: 0, Changes: [], Description: 'Unchanged save' },
  ]);
  renderChangelog();

  const stockEntry = await screen.findByRole('button', { name: /^Resistor Stock added by Alex/ });
  expect(screen.queryByRole('region', { name: 'Description' })).not.toBeInTheDocument();
  expect(screen.getByText('Stock added by Alex')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Changelog' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.queryByText('Unchanged save')).not.toBeInTheDocument();
  expect(screen.queryByText('No stock change')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Changelog' })).not.toBeInTheDocument();

  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();

  await user.click(stockEntry);
  const panel = within(screen.getByRole('complementary', { name: 'Changelog details' }));
  const quantity = within(panel.getByRole('region', { name: 'Quantity' }));
  expect(quantity.getByText('5')).toBeVisible();
  expect(quantity.getByText('8')).toBeVisible();
  const description = within(panel.getByRole('region', { name: 'Description' }));
  expect(description.getByText('Old label')).toBeVisible();
  expect(description.getByText('New label')).toBeVisible();
  expect(panel.getByText('Restocked and relabelled')).toBeVisible();
  expect(stockEntry).toHaveAttribute('aria-pressed', 'true');

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('complementary', { name: 'Changelog details' })).not.toBeInTheDocument();
  const modifiedEntry = screen.getByRole('button', { name: /^Capacitor Modified by Alex/ });
  expect(modifiedEntry.querySelector('.ui-badge')).toBeNull();
  await user.click(modifiedEntry);
  const manufacturer = within(screen.getByRole('region', { name: 'Manufacturer' }));
  expect(manufacturer.getByText('Acme')).toBeVisible();
  expect(manufacturer.getByText('Vishay')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close changelog details' }));
  expect(screen.queryByRole('complementary', { name: 'Changelog details' })).not.toBeInTheDocument();
});

it('condenses consecutive stock removals by the same person into one total', async () => {
  const entries: ChangelogEntry[] = Array.from({ length: 20 }, (_, index) => ({
    ID: 21 - index,
    UserID: 'user-1',
    UserName: 'Alex',
    ItemID: 'item-1',
    Item: { ItemName: 'Resistor', DeletedAt: null },
    Quantity: -1,
    Action: 'TAKEN',
    ChangeTime: new Date(Date.UTC(2026, 10, 25, 12, 20 - index)).toISOString(),
    Description: '',
    Changes: [{ Field: 'Quantity', Before: String(31 + index), After: String(30 + index) }],
  }));
  vi.mocked(getLogs).mockResolvedValue([
    ...entries,
    { ...entries[19], ID: 1, UserID: 'user-2', UserName: 'Taylor', Changes: null },
  ]);
  renderChangelog();

  expect(await screen.findByText('Stock change: -20')).toBeVisible();
  expect(screen.queryByText('(20 updates)')).not.toBeInTheDocument();
  const times = screen.getAllByRole('listitem')[0].querySelectorAll('time');
  expect(times).toHaveLength(1);
  expect(times[0]).toHaveAttribute('dateTime', entries[0].ChangeTime);
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText('Stock taken by Taylor')).toBeVisible();
  expect(screen.getByText('Stock change: -1')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /^Resistor Stock taken by Alex/ }));
  const quantity = within(screen.getByRole('region', { name: 'Quantity' }));
  expect(quantity.getByText('50')).toBeVisible();
  expect(quantity.getByText('30')).toBeVisible();
});
