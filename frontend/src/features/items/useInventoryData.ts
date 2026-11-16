import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getItems, type Item } from './itemsapi';
import { getTags, type Tag } from './tagsapi';

export function useInventoryData(email: string | undefined, enabled: boolean) {
  const client = useQueryClient();
  const itemsKey = ['inventory', email, 'items'] as const;
  const tagsKey = ['inventory', email, 'tags'] as const;
  const itemsQuery = useQuery({ queryKey: itemsKey, queryFn: getItems, enabled, retry: false });
  const tagsQuery = useQuery({ queryKey: tagsKey, queryFn: getTags, enabled, retry: false });

  return {
    items: itemsQuery.data ?? [],
    itemsLoaded: itemsQuery.data !== undefined,
    tagsLoaded: tagsQuery.data !== undefined,
    tags: [...(tagsQuery.data ?? [])].sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' })),
    setItems: (update: (items: Item[]) => Item[]) => client.setQueryData<Item[]>(itemsKey, (previous) => update(previous ?? [])),
    setTags: (update: (tags: Tag[]) => Tag[]) => client.setQueryData<Tag[]>(tagsKey, (previous) => update(previous ?? [])),
    cancelItems: () => client.cancelQueries({ queryKey: itemsKey }),
    cancelTags: () => client.cancelQueries({ queryKey: tagsKey }),
    loading: itemsQuery.isLoading || tagsQuery.isLoading,
    loadError: itemsQuery.error ?? tagsQuery.error,
    retrying: itemsQuery.isFetching || tagsQuery.isFetching,
    retry: () => { void itemsQuery.refetch(); void tagsQuery.refetch(); },
  };
}
