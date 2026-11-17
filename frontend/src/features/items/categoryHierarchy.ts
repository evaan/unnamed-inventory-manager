import type { Tag, TagID } from './tagsapi';

export interface CategoryEntry {
  tag: Tag;
  ancestors: Tag[];
  path: string;
}

export function getCategoryHierarchy(tags: Tag[]): Map<TagID, CategoryEntry> {
  const ids = new Set(tags.map((tag) => tag.ID));
  const children = new Map<TagID | null, Tag[]>();
  for (const tag of tags) {
    const parent = tag.ParentID && ids.has(tag.ParentID) ? tag.ParentID : null;
    const siblings = children.get(parent) ?? [];
    siblings.push(tag);
    children.set(parent, siblings);
  }

  const hierarchy = new Map<TagID, CategoryEntry>();
  const visit = (tag: Tag, ancestors: Tag[]) => {
    if (hierarchy.has(tag.ID)) return;
    hierarchy.set(tag.ID, {
      tag,
      ancestors,
      path: [...ancestors, tag].map((category) => category.Name).join(' › '),
    });
    for (const child of children.get(tag.ID) ?? []) {
      visit(child, [...ancestors, tag]);
    }
  };
  for (const root of children.get(null) ?? []) visit(root, []);
  // Keep records with a cyclic parent chain visible.
  for (const tag of tags) visit(tag, []);
  return hierarchy;
}
