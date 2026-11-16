import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MainPage } from './MainPage';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getItems, createItem, adjustItem, deleteItem, type Item } from '../features/items/itemsapi';
import { getTags, createTag, deleteTag, setItemTags } from '../features/items/tagsapi';

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
vi.mock('../features/items/tagsapi', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  setItemTags: vi.fn(),
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

// MainPage's page selector needs a router around it.
const renderMain = () =>
  render(
    <MemoryRouter>
      <MainPage />
    </MemoryRouter>
  );

const renderPage = async (items = ITEMS) => {
  vi.mocked(getItems).mockResolvedValue(items);
  renderMain();
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading items' })).not.toBeInTheDocument());
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: false } } as never);
  vi.mocked(useLogout).mockReturnValue({ mutate: logoutMutate, isPending: false } as never);
  vi.mocked(getTags).mockResolvedValue([]); // resetAllMocks clears this, so set it every time
});

describe('MainPage: auth gate', () => {
  it('renders nothing when the user is not logged in', async () => {
    vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: false } } as never);
    vi.mocked(getItems).mockResolvedValue([]);
    const { container } = renderMain();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing when the account is disabled', async () => {
    vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: true } } as never);
    vi.mocked(getItems).mockResolvedValue([]);
    const { container } = renderMain();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
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
  it('shows skeleton rows while loading, then the items', async () => {
    vi.mocked(getItems).mockResolvedValue(ITEMS);
    renderMain();
    expect(screen.getByRole('status', { name: 'Loading items' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('No items yet.')).not.toBeInTheDocument();
    expect(await screen.findByText('Resistor 4.7k')).toBeInTheDocument();
    expect(screen.getByText('Capacitor 10uF')).toBeInTheDocument();
    expect(screen.getByText('LED Red')).toBeInTheDocument();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading items' })).not.toBeInTheDocument();
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
    renderMain();
    expect(await screen.findByText('Network down')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Dismiss'));
    expect(screen.queryByText('Network down')).not.toBeInTheDocument();
  });

});

describe('MainPage: search', () => {
  it('filters by item name (case-insensitive)', async () => {
    await renderPage();
    await userEvent.type(screen.getByPlaceholderText(/search name, part number/i), 'LED');
    expect(screen.getByText('LED Red')).toBeInTheDocument();
    expect(screen.queryByText('Resistor 4.7k')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('filters by manufacturer part number', async () => {
    await renderPage();
    await userEvent.type(screen.getByPlaceholderText(/search name, part number/i), 'cap-10u');
    expect(screen.getByText('Capacitor 10uF')).toBeInTheDocument();
    expect(screen.queryByText('LED Red')).not.toBeInTheDocument();
  });

  it('shows a no-match message and "Clear search" restores the list', async () => {
    await renderPage();
    await userEvent.type(screen.getByPlaceholderText(/search name, part number/i), 'zzzz');
    expect(screen.getByText('No items match your filters.')).toBeInTheDocument();

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
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions: ['DeleteItem'] },
    } as never);
  });

  it('hides Delete item without DeleteItem permission', async () => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions: ['CreateItem', 'ModifyItem'] },
    } as never);
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /led red/i }));
    expect(screen.queryByTitle('Delete item')).not.toBeInTheDocument();
    expect(deleteItem).not.toHaveBeenCalled();
  });

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
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions: ['CreateItem'] },
    } as never);
  });

  it('allows administrators to create and delete items', async () => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions: ['Administrator'] },
    } as never);
    await renderPage();
    expect(screen.getByRole('button', { name: /new item/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /led red/i }));
    expect(screen.getByTitle('Delete item')).toBeInTheDocument();
  });

  it('hides New item without CreateItem permission', async () => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions: ['ModifyItem', 'DeleteItem'] },
    } as never);
    await renderPage();
    expect(screen.queryByRole('button', { name: /new item/i })).not.toBeInTheDocument();
  });

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

describe('MainPage: tag permissions', () => {
  const resistorTag = { ID: 'tag-1', Name: 'Resistors' };
  const sensorTag = { ID: 'tag-2', Name: 'Sensors' };
  const taggedItem = makeItem({ Tags: [resistorTag] });

  const setPermissions = (permissions?: string[]) => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions },
    } as never);
  };

  const openItem = async () => {
    await renderPage([taggedItem]);
    await userEvent.click(screen.getByRole('button', { name: /resistor 4\.7k/i }));
  };

  beforeEach(() => {
    vi.mocked(getTags).mockResolvedValue([resistorTag, sensorTag]);
  });

  it('keeps tags read-only without permissions but still allows filtering', async () => {
    setPermissions([]);
    await openItem();

    expect(screen.queryByPlaceholderText('New tag')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete tag Resistors' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add a tag…')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove tag Resistors' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Sensors/ }));
    expect(screen.getByText('No items match your filters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('heading', { name: taggedItem.itemName })).toBeInTheDocument();
    expect(createTag).not.toHaveBeenCalled();
    expect(deleteTag).not.toHaveBeenCalled();
    expect(setItemTags).not.toHaveBeenCalled();
  });

  it('creates a tag with CreateTag permission', async () => {
    setPermissions(['CreateTag']);
    vi.mocked(createTag).mockResolvedValue({ ID: 'tag-3', Name: 'Power' });
    await renderPage();
    await userEvent.type(screen.getByPlaceholderText('New tag'), 'Power');
    await userEvent.click(screen.getByTitle('Create tag'));
    expect(createTag).toHaveBeenCalledWith('Power');
    expect(await screen.findByRole('button', { name: /^Power/ })).toBeInTheDocument();
  });

  it('deletes a global tag with DeleteTag permission', async () => {
    setPermissions(['DeleteTag']);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteTag).mockResolvedValue(undefined);
    await openItem();
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Resistors' }));
    expect(deleteTag).toHaveBeenCalledWith(resistorTag.ID);
    await waitFor(() => expect(screen.queryByText('Resistors')).not.toBeInTheDocument());
    expect(setItemTags).not.toHaveBeenCalled();
  });

  it('assigns an existing tag with ModifyItem permission', async () => {
    setPermissions(['ModifyItem']);
    vi.mocked(setItemTags).mockResolvedValue([resistorTag, sensorTag]);
    await openItem();
    await userEvent.type(screen.getByPlaceholderText('Add a tag…'), 'Sensors');
    await userEvent.click(screen.getByRole('button', { name: 'Sensors' }));
    expect(setItemTags).toHaveBeenCalledWith(taggedItem.id, [resistorTag.ID, sensorTag.ID]);
    expect(createTag).not.toHaveBeenCalled();
  });

});
