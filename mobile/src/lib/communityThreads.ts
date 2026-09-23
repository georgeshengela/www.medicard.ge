type ThreadItem = { id: string; parentId: string | null; createdAt: string };

/** Parents precede replies; older replies precede newer ones without losing orphaned pages. */
export function communityThreads<T extends ThreadItem>(items: T[]): { item: T; depth: number }[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const item of items) {
    if (item.parentId && byId.has(item.parentId) && item.parentId !== item.id) {
      children.set(item.parentId, [...(children.get(item.parentId) || []), item]);
    } else roots.push(item);
  }
  for (const replies of children.values()) replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const seen = new Set<string>(), result: { item: T; depth: number }[] = [];
  const append = (item: T, depth: number) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    result.push({ item, depth: Math.min(depth, 3) });
    for (const child of children.get(item.id) || []) append(child, depth + 1);
  };
  for (const root of roots) append(root, root.parentId ? 1 : 0);
  // Defensive recovery for corrupt cycles, never an infinite traversal.
  for (const item of items) append(item, 0);
  return result;
}
