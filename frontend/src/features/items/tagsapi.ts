import { request } from './inventoryRequest';

export type TagID = string;

export interface Tag {
  ID: TagID;
  Name: string;
  ParentID?: TagID | null;
}

export interface ServerCategory {
  ID: TagID;
  CategoryName: string;
  ParentID: TagID | null;
}

export const normalizeTag = (category: ServerCategory): Tag => ({
  ID: category.ID,
  Name: category.CategoryName,
  ParentID: category.ParentID,
});

export const getTags = async (): Promise<Tag[]> => {
  const res = await request('/categories', { method: 'GET' }, 'Failed to load categories');
  const body: { itemCategories: ServerCategory[] | null } = await res.json();
  return (body.itemCategories ?? []).map(normalizeTag);
};

export const createTag = async (name: string): Promise<Tag> => {
  const res = await request(
    '/categories',
    { method: 'POST', body: JSON.stringify({ categoryName: name }) },
    'Failed to create category'
  );
  const body: { itemCategory: ServerCategory } = await res.json();
  return normalizeTag(body.itemCategory);
};

export const moveTag = async (id: TagID, parentID: TagID | null): Promise<void> => {
  await request(
    `/categories/${id}`,
    { method: 'PATCH', body: JSON.stringify({ parentID }) },
    'Failed to move category'
  );
};

export const deleteTag = async (id: TagID): Promise<void> => {
  await request(`/categories/${id}`, { method: 'DELETE' }, 'Failed to delete category');
};
