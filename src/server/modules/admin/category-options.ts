import type { Category } from "@/server/modules/taxonomy/service";

/** "Parent › Child" labels for every category, optionally excluding one subtree. */
export function categoryPathOptions(categories: Category[], excludeId?: string, onlyActive = false) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const label = (c: Category): string => {
    const parent = c.parentId ? byId.get(c.parentId) : undefined;
    return parent ? `${label(parent)} › ${c.name}` : c.name;
  };
  const inExcluded = (c: Category): boolean => {
    let current: Category | undefined = c;
    while (current) {
      if (current.id === excludeId) return true;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  };
  return categories
    .filter((c) => !excludeId || !inExcluded(c))
    .filter((c) => !onlyActive || c.isActive)
    .map((c) => ({ value: c.id, label: label(c) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
