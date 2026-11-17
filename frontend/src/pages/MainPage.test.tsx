import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainPage } from './MainPage';
import { ConfirmProvider } from '../components/ConfirmProvider';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getItems, createItem, adjustItem, deleteItem, updateItem, type Item } from '../features/items/itemsapi';
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
  updateItem: vi.fn(),
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

// MainPage's page selector needs a router around it.
const renderMain = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ConfirmProvider><MainPage /></ConfirmProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

const renderPage = async (items = ITEMS) => {
  vi.mocked(getItems).mockResolvedValue(items);
  renderMain();
  await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading items' })).not.toBeInTheDocument());
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: false } } as never);
  vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  vi.mocked(getTags).mockResolvedValue([]); // resetAllMocks clears this, so set it every time
});

describe('MainPage: auth gate', () => {
  it('renders nothing when the user is not logged in', async () => {
    vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: false } } as never);
    vi.mocked(getItems).mockResolvedValue([]);
    const { container } = renderMain();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(getItems).not.toHaveBeenCalled();
    expect(getTags).not.toHaveBeenCalled();
  });

  it('renders nothing when the account is disabled', async () => {
    vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: true } } as never);
    vi.mocked(getItems).mockResolvedValue([]);
    const { container } = renderMain();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('MainPage: loading and listing', () => {
  it('can retry a failed inventory load without reloading the page', async () => {
    vi.mocked(getItems).mockRejectedValueOnce(new Error('Network down')).mockResolvedValue(ITEMS);
    renderMain();
    expect(await screen.findByText('Network down')).toBeInTheDocument();
    expect(screen.queryByText('No items yet.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Resistor 4.7k')).toBeInTheDocument();
    expect(screen.queryByText('Network down')).not.toBeInTheDocument();
  });

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

  it('shows the empty state when there are no items', async () => {
    await renderPage([]);
    expect(screen.getByText('No items yet.')).toBeInTheDocument();
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
});

describe('MainPage: adjust quantity', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions: ['ModifyItem'] },
    } as never);
  });
  it('keeps stock controls and editing hidden without ModifyItem permission', async () => {
    vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: false, permissions: [] } } as never);
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /resistor 4\.7k/i }));
    expect(screen.queryByRole('button', { name: '+1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit item' })).not.toBeInTheDocument();
    expect(adjustItem).not.toHaveBeenCalled();
  });

  it('sends ADDED with the amount when +1 is clicked and updates the item', async () => {
    vi.mocked(adjustItem).mockResolvedValue(makeItem({ id: '2', itemName: 'Capacitor 10uF', quantity: 6 }));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /capacitor 10uf/i }));
    await userEvent.click(screen.getByRole('button', { name: '+1' }));

    expect(adjustItem).toHaveBeenCalledWith('2', 'ADDED', 1);
    expect(await screen.findByLabelText('Quantity: 6', { selector: 'p' })).toBeInTheDocument();
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
    vi.mocked(deleteItem).mockResolvedValue(undefined as never);
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /led red/i }));
    await userEvent.click(screen.getByTitle('Delete item'));
    expect(deleteItem).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete item' }));

    expect(deleteItem).toHaveBeenCalledWith('3');
    await waitFor(() => expect(screen.queryByText('LED Red')).not.toBeInTheDocument());
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('does not delete when the user cancels the confirm dialog', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /led red/i }));
    await userEvent.click(screen.getByTitle('Delete item'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(deleteItem).not.toHaveBeenCalled();
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
  });
});

describe('MainPage: new item', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      data: { loggedIn: true, disabled: false, permissions: ['CreateItem'] },
    } as never);
  });

  it('rejects unsafe URLs', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Widget');
    await userEvent.type(screen.getByLabelText('Manufacturer'), 'TDK');
    await userEvent.type(screen.getByLabelText('Manufacturer Part #'), 'TDK-12');
    await userEvent.type(screen.getByLabelText('Distributor URL'), 'javascript:alert(1)');
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid http:// or https:// URL.');
    expect(createItem).not.toHaveBeenCalled();
  });

  it('discards a dirty draft only after confirmation', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Unsaved widget');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
  });

  it('prevents closing or duplicate submissions during save', async () => {
    let resolve!: (item: Item) => void;
    vi.mocked(createItem).mockReturnValue(new Promise((done) => { resolve = done; }));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Widget');
    await userEvent.type(screen.getByLabelText('Manufacturer'), 'TDK');
    await userEvent.type(screen.getByLabelText('Manufacturer Part #'), 'TDK-12');
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByLabelText('Name')).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(createItem).toHaveBeenCalledTimes(1);
    resolve(makeItem({ id: '99', itemName: 'Widget' }));
    expect(await screen.findByRole('heading', { name: 'Widget' })).toBeInTheDocument();
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

  it('refuses to save without a name and does not call the API', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(screen.getByText('Name, manufacturer and manufacturer part # are required.')).toBeInTheDocument();
    expect(createItem).not.toHaveBeenCalled();
  });

  it('rejects negative quantities instead of silently changing them', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'Widget');
    await userEvent.type(screen.getByLabelText('Manufacturer'), 'TDK');
    await userEvent.type(screen.getByLabelText('Manufacturer Part #'), 'TDK-12');
    await userEvent.clear(screen.getByLabelText('Quantity'));
    await userEvent.type(screen.getByLabelText('Quantity'), '-5');
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(createItem).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Quantity must be a whole number');
  });

  it('saves trimmed values with an integer quantity, then lists the new item', async () => {
    vi.mocked(createItem).mockImplementation(async (item) => makeItem({ ...item, id: '99' }));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /new item/i }));

    await userEvent.type(screen.getByLabelText('Name'), '  Inductor  ');
    await userEvent.clear(screen.getByLabelText('Quantity'));
    await userEvent.type(screen.getByLabelText('Quantity'), '12');
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

describe('MainPage: editing item details', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: false, permissions: ['ModifyItem'] } } as never);
  });

  it('prefills details and saves metadata without overwriting quantity', async () => {
    vi.mocked(updateItem).mockResolvedValue(makeItem({ itemName: 'Precision resistor', description: 'Updated description', quantity: 60 }));
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /resistor 4\.7k/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit item' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Resistor 4.7k');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), ' Precision resistor ');
    await userEvent.clear(screen.getByLabelText('Description'));
    await userEvent.type(screen.getByLabelText('Description'), 'Updated description');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(updateItem).toHaveBeenCalledWith('1', expect.objectContaining({
      itemName: 'Precision resistor', itemDescription: 'Updated description',
    }));
    expect(vi.mocked(updateItem).mock.calls[0][1]).not.toHaveProperty('quantity');
    expect(vi.mocked(updateItem).mock.calls[0][1]).not.toHaveProperty('description');
    expect(await screen.findByRole('heading', { name: 'Precision resistor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity: 60', { selector: 'span' })).toBeVisible();
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
    vi.mocked(deleteTag).mockResolvedValue(undefined);
    await openItem();
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag Resistors' }));
    expect(deleteTag).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete tag' }));
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
