// Dummy tag API, same approach as itemsapi.ts: backed by in-memory data until the backend is wired in.
// To go live: delete the DUMMY STORE section and swap each function body for the fetch shown in its comment.
//
// Backend routes (tags.go):
//   GET    /tags                      -> { tags: [{id, name}] }
//   POST   /tags   { name }           -> 201 { tag }   (409 if the name exists, any casing)
//   DELETE /tags/:id                  -> 204           (also detaches the tag from every item)
//   PUT    /items/:id/tags { tag_ids } -> { item }     (replaces the item's whole tag set)
// GET /items must return each item's tags (db.Preload("Tags")); map them with normalizeTag.

export type TagID = string; // uuid on the backend

export interface Tag {
  ID: TagID;
  Name: string;
}

// Mirrors Item with the tags field. Item in itemsapi.ts already has `Tags?: Tag[]`, so this is a convenience alias.
export type WithTags<T> = T & { Tags?: Tag[] };

// A tag as the backend sends it: {id, name} (or {ID, Name} if the Go struct has no json tags).
export type RawTag = { ID?: unknown; id?: unknown; Name?: unknown; name?: unknown };

// Use this when mapping API responses, including the `tags` array on each item.
export const normalizeTag = (raw: RawTag): Tag => ({
  ID: String(raw.ID ?? raw.id),
  Name: String(raw.Name ?? raw.name),
});

/* ---------- DUMMY STORE (remove when the API is live) ---------- */
const SEED_TAG_NAMES = [
  'Resistors',
  'Capacitors',
  'Inductors',
  'Passives',
  'Microcontrollers',
  'ICs',
  'Power',
  'LEDs',
  'Sensors',
  'Connectors',
  'Wireless',
  'Switches',
  'SMD',
  'Through-hole',
];
let tagStore: Tag[] = SEED_TAG_NAMES.map((Name, i) => ({ ID: `tag-${i + 1}`, Name }));
let nextTagId = tagStore.length + 1;
// item ID -> tag IDs (matches the item_tags join table)
const itemTagLinks = new Map<string, TagID[]>();
const latency = () => new Promise((r) => setTimeout(r, 200));

// Used by the dummy itemsapi so items come back with their tags. Not needed once the backend preloads them.
export const tagsForItem = (itemId: string): Tag[] =>
  (itemTagLinks.get(itemId) ?? [])
    .map((id) => tagStore.find((t) => t.ID === id))
    .filter((t): t is Tag => !!t)
    .map((t) => ({ ...t }));
// Seeds the dummy links by tag name (used by the dummy item generator in itemsapi.ts).
export const linkItemTags = (itemId: string, names: string[]) => {
  itemTagLinks.set(
    itemId,
    names
      .map((n) => tagStore.find((t) => t.Name === n)?.ID)
      .filter((id): id is TagID => !!id)
  );
};
export const forgetItemTags = (itemId: string) => {
  itemTagLinks.delete(itemId);
};
/* ---------- /DUMMY STORE ---------- */

// GET /tags  ->  { tags: Tag[] }
export const getTags = async (): Promise<Tag[]> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/tags`, { credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
  // return ((await res.json()).tags ?? []).map(normalizeTag);
  return tagStore.map((t) => ({ ...t }));
};

// POST /tags  { name }  ->  { tag }
export const createTag = async (name: string): Promise<Tag> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/tags`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   credentials: 'include',
  //   body: JSON.stringify({ name }),
  // });
  // const body = await res.json().catch(() => ({}));
  // if (!res.ok) throw new Error(body.error ?? `Failed to create tag (${res.status})`);
  // return normalizeTag(body.tag);
  if (tagStore.some((t) => t.Name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A tag with that name already exists');
  }
  const created: Tag = { ID: `tag-${nextTagId++}`, Name: name };
  tagStore = [...tagStore, created];
  return { ...created };
};

// DELETE /tags/:id
export const deleteTag = async (id: TagID): Promise<void> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/tags/${id}`, { method: 'DELETE', credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to delete tag (${res.status})`);
  tagStore = tagStore.filter((t) => t.ID !== id);
  for (const [itemId, ids] of itemTagLinks) itemTagLinks.set(itemId, ids.filter((t) => t !== id));
};

// PUT /items/:id/tags  { tag_ids }  ->  { item }  (returns the item's full tag list after the change)
export const setItemTags = async (itemId: string, tagIds: TagID[]): Promise<Tag[]> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/items/${itemId}/tags`, {
  //   method: 'PUT',
  //   headers: { 'Content-Type': 'application/json' },
  //   credentials: 'include',
  //   body: JSON.stringify({ tag_ids: tagIds }),
  // });
  // const body = await res.json().catch(() => ({}));
  // if (!res.ok) throw new Error(body.error ?? `Failed to update tags (${res.status})`);
  // return (body.item.tags ?? []).map(normalizeTag);
  const unique = [...new Set(tagIds)];
  if (unique.some((id) => !tagStore.some((t) => t.ID === id))) throw new Error("One or more tags don't exist");
  itemTagLinks.set(itemId, unique);
  return tagsForItem(itemId);
};