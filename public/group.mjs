export function groupByCategory(items) {
  const groups = new Map();

  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }

  return [...groups].map(([category, groupItems]) => ({ category, items: groupItems }));
}
