import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainPage } from './MainPage';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getItems, createItem, adjustItem, deleteItem, type Item } from '../features/items/itemsapi';

// Mock both feature modules so tests never touch the network or the other teams' services.
vi.mock('../features/auth/useAuth', () => ({
  useAuth: vi.fn(),
  useLogout: vi.fn(),
}));
vi.mock('../features/items/itemsapi', () => ({
  getItems: vi.fn(),
  createItem: vi.fn(),
  adjustItem: vi.fn(),
  deleteItem: vi.fn(),
}));

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: '1',
  itemName: 'Resistor 4.7k',
  quantity: 50,
  manufacturer: 'Yageo',
  manufacturerPart: 'RC0805-4K7',
  distributorPart: 'DK-4K7',
  distributorURL: 'https://dist.example/4k7',
  dataSheetURL: 'https://ds.example/4k7.pdf',
  description: 'Thick film resistor',
  ...overrides,
});

const ITEMS = [
  makeItem({ id: '1', itemName: 'Resistor 4.7k', quantity: 50, manufacturerPart: 'RC0805-4K7' }),
  makeItem({ id: '2', itemName: 'Capacitor 10uF', quantity: 5, manufacturerPart: 'CAP-10U' }),
  makeItem({ id: '3', itemName: 'LED Red', quantity: 0, manufacturerPart: 'LED-R' }),
];

const logoutMutate = vi.fn();

const renderPage = async (items = ITEMS) => {
  vi.mocked(getItems).mockResolvedValue(items);
  render(<MainPage />);
  await waitFor(() => expect(screen.queryByText(/loading items/i)).not.toBeInTheDocument());
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: false } } as never);
  vi.mocked(useLogout).mockReturnValue({ mutate: logoutMutate, isPending: false } as never);
});

describe('MainPage: auth gate', () => {
  it('renders nothing when the user is not logged in', () => {
    vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: false } } as never);
    vi.mocked(getItems).mockResolvedValue([]);
    const { container } = render(<MainPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the account is disabled', () => {
    vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: true } } as never);
    vi.mocked(getItems).mockResolvedValue([]);
    const { container } = render(<MainPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls logout.mutate when "Log out" is clicked', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(logoutMutate).toHaveBeenCalledTimes(1);
  });

  it('shows "Logging out…" and disables the button while logout is pending', async () => {
    vi.mocked(useLogout).mockReturnValue({ mutate: logoutMutate, isPending: true } as never);
    await renderPage();
    expect(screen.getByRole('button', { name: /logging out/i })).toBeDisabled();
  });
});

describe('MainPage: loading and listing', () => {
  it('shows a loading message, then the items', async () => {
    vi.mocked(getItems).mockResolvedValue(ITEMS);
    render(<MainPage />);
    expect(screen.getByText(/loading items/i)).toBeInTheDocument();
    expect(await screen.findByText('Resistor 4.7k')).toBeInTheDocument();
    expect(screen.getByText('Capacitor 10uF')).toBeInTheDocument();
    expect(screen.getByText('LED Red')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });

  it('derives stock status from quantity (>10, 1-10, 0)', async () => {
    await renderPage();
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('treats exactly 10 as low stock and 11 as in stock', async () => {
    await renderPage([
      makeItem({ id: '1', itemName: 'Ten', quantity: 10 }),
      makeItem({ id: '2', itemName: 'Eleven', quantity: 11 }),
    ]);
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });

  it('shows the empty state when there are no items', async () => {
    await renderPage([]);
    expect(screen.getByText('No items yet.')).toBeInTheDocument();
  });

  it('shows an error banner when loading fails, and it can be dismissed', async () => {
    vi.mocked(getItems).mockRejectedValue(new Error('Network down'));
    render(<MainPage />);
    expect(await screen.findByText('Network down')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Dismiss'));
    expect(screen.queryByText('Network down')).not.toBeInTheDocument();
  });
});

describe('MainPage: search', () => {
  it('filters by item name (case-insensitive)', async () => {
    await renderPage();
    await userEvent.type(screen.getByPlaceholderText(/search name or part number/i), 'LED');
    expect(screen.getByText('LED Red')).toBeInTheDocument();
    expect(screen.queryByText('Resistor 4.7k')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('filters by manufacturer part number', async () => {
    await renderPage();
    await userEvent.type(screen.getByPlaceholderText(/search name or part number/i), 'cap-10u');
    expect(screen.getByText('Capacitor 10uF')).toBeInTheDocument();
    expect(screen.queryByText('LED Red')).not.toBeInTheDocument();
  });

  it('shows a no-match message and "Clear search" restores the list', async () => {
    await renderPage();
    await userEvent.type(screen.getByPlaceholderText(/search name or part number/i), 'zzzz');
    expect(screen.getByText('No items match your search.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(screen.getByText('Resistor 4.7k')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });
});

describe('MainPage: spotlight panel', () => {
  it('opens the details panel when a row is clicked', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /resistor 4\.7k/i }));

    expect(screen.getByRole('heading', { name: 'Resistor 4.7k' })).toBeInTheDocument();
    expect(screen.getByText('Yageo')).toBeInTheDocument();
    expect(screen.getByText('Thick film resistor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Data sheet' })).toHaveAttribute(
      'href',
      'https://ds.example/4k7.pdf'
    );
    expect(screen.getByRole('link', { name: 'Distributor page' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
  });

  it('closes the panel with the close button', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /resistor 4\.7k/i }));
    await userEvent.click(screen.getByTitle('Close (Esc)'));
    expect(screen.queryByRole('heading', { name: 'Resistor 4.7k' })).not.toBeInTheDocument();
  });

  it('closes the panel when Escape is pressed', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /resistor 4\.7k/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('heading', { name: 'Resistor 4.7k' })).not.toBeInTheDocument();
  });

  it('toggles the panel closed when the selected row is clicked again', async () => {
    await renderPage();
    const row = screen.getByRole('button', { name: /resistor 4\.7k/i });
    await userEvent.click(row);
    await userEvent.click(row);
    expect(screen.queryByTitle('Close (Esc)')).not.toBeInTheDocument();
  });
});

describe('MainPage: adjust quantity', () => {
  it('sends ADDED with the amount when +1 is clicked and updates the item', async () => {
    vi.mocked(adjustItem).mockResolvedValue(makeItem({ id: '2', itemName: 'Capacitor 10uF', quantity: 6 }));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /capacitor 10uf/i }));
    await userEvent.click(screen.getByRole('button', { name: '+1' }));

    expect(adjustItem).toHaveBeenCalledWith('2', 'ADDED', 1);
    expect(await screen.findByText('6')).toBeInTheDocument();
  });

  it('sends TAKEN with a positive amount when -1 is clicked', async () => {
    vi.mocked(adjustItem).mockResolvedValue(makeItem({ id: '1', quantity: 49 }));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /resistor 4\.7k/i }));
    await userEvent.click(screen.getByRole('button', { name: '-1' }));

    expect(adjustItem).toHaveBeenCalledWith('1', 'TAKEN', 1);
  });

  it('disables decrement buttons that would take quantity below zero', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /capacitor 10uf/i })); // qty 5
    expect(screen.getByRole('button', { name: '-10' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '-1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '+10' })).toBeEnabled();
  });

  it('shows an error when the adjust request fails', async () => {
    vi.mocked(adjustItem).mockRejectedValue(new Error('Adjust failed'));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /resistor 4\.7k/i }));
    await userEvent.click(screen.getByRole('button', { name: '+10' }));
    expect(await screen.findByText('Adjust failed')).toBeInTheDocument();
  });
});

describe('MainPage: delete', () => {
  it('deletes the item after the user confirms', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteItem).mockResolvedValue(undefined as never);
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /led red/i }));
    await userEvent.click(screen.getByTitle('Delete item'));

    expect(deleteItem).toHaveBeenCalledWith('3');
    await waitFor(() => expect(screen.queryByText('LED Red')).not.toBeInTheDocument());
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('does not delete when the user cancels the confirm dialog', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /led red/i }));
    await userEvent.click(screen.getByTitle('Delete item'));

    expect(deleteItem).not.toHaveBeenCalled();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });

  it('keeps the item and shows an error when delete fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteItem).mockRejectedValue(new Error('Delete failed'));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /led red/i }));
    await userEvent.click(screen.getByTitle('Delete item'));

    expect(await screen.findByText('Delete failed')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });
});

describe('MainPage: new item', () => {
  it('opens a draft form with a Draft row', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));

    expect(screen.getByRole('heading', { name: 'New item' })).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Untitled item')).toBeInTheDocument();
  });

  it('refuses to save without a name and does not call the API', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(screen.getByText('Name, manufacturer and manufacturer part # are required.')).toBeInTheDocument();
    expect(createItem).not.toHaveBeenCalled();
  });

  it('clears the validation error once the user starts typing a name', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'x');
    expect(screen.queryByText('Name, manufacturer and manufacturer part # are required.')).not.toBeInTheDocument();
  });

  it('saves trimmed values with a sanitised integer quantity, then lists the new item', async () => {
    vi.mocked(createItem).mockImplementation(async (item) => makeItem({ ...item, id: '99' }));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));

    await userEvent.type(screen.getByLabelText('Name'), '  Inductor  ');
    await userEvent.clear(screen.getByLabelText('Quantity'));
    await userEvent.type(screen.getByLabelText('Quantity'), '12.7');
    await userEvent.type(screen.getByLabelText('Manufacturer'), ' TDK ');
    await userEvent.type(screen.getByLabelText('Manufacturer Part #'), ' TDK-12 ');
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemName: 'Inductor', quantity: 12, manufacturer: 'TDK', manufacturerPart: 'TDK-12' })
    );
    expect(await screen.findByRole('heading', { name: 'Inductor' })).toBeInTheDocument();
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(screen.getByText('4 of 4')).toBeInTheDocument();
  });

  it('clamps negative or non-numeric quantities to 0', async () => {
    vi.mocked(createItem).mockImplementation(async (item) => makeItem({ ...item, id: '99' }));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Widget');
    await userEvent.type(screen.getByLabelText('Manufacturer'), 'TDK');
    await userEvent.type(screen.getByLabelText('Manufacturer Part #'), 'TDK-12');
    await userEvent.clear(screen.getByLabelText('Quantity'));
    await userEvent.type(screen.getByLabelText('Quantity'), '-5');
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0 }));
  });

  it('discards the draft with Cancel', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(createItem).not.toHaveBeenCalled();
  });

  it('discards the draft with Escape', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
  });

  it('keeps the draft open and shows an error when create fails', async () => {
    vi.mocked(createItem).mockRejectedValue(new Error('Create failed'));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Widget');
    await userEvent.type(screen.getByLabelText('Manufacturer'), 'TDK');
    await userEvent.type(screen.getByLabelText('Manufacturer Part #'), 'TDK-12');
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(await screen.findByText('Create failed')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});
