import { Item } from '../types';

export interface ItemNest {
  // 0 for cards that aren't nested
  depth: number;
  // For each level 1..depth (index 0 = level 1): the later cards at that level,
  // under the same ancestor, whose tree line runs past this card
  laterSiblings: string[][];
}

// Child cards directly below their parent in a lane, with no unrelated card in
// between, are nested under it. Their own children nest one level deeper.
export function getLaneNesting(items: Item[]): ItemNest[] {
  const idByBlockId = new Map<string, string>();
  items.forEach((item) => {
    const blockId = item.data.blockId;
    if (blockId && !idByBlockId.has(blockId)) idByBlockId.set(blockId, item.id);
  });

  // Ancestors of each card, closest last, within the current unbroken run
  const chains: string[][] = [];
  let stack: string[] = [];

  items.forEach((item) => {
    const parentBlockId = item.data.metadata.parentBlockId;
    const parentId = parentBlockId ? idByBlockId.get(parentBlockId) : undefined;
    const at = parentId ? stack.lastIndexOf(parentId) : -1;

    stack = at === -1 ? [] : stack.slice(0, at + 1);
    chains.push(stack);
    stack = [...stack, item.id];
  });

  return items.map((_, i) => {
    const chain = chains[i];
    const depth = chain.length;
    const laterSiblings: string[][] = [];

    for (let level = 1; level <= depth; level++) {
      const ancestorId = chain[level - 1];
      const ids: string[] = [];

      // Later cards at this level under the same ancestor, until that run ends
      for (let j = i + 1; j < items.length; j++) {
        const later = chains[j];
        if (later[level - 1] !== ancestorId) break;
        if (later.length === level) ids.push(items[j].id);
      }

      laterSiblings.push(ids);
    }

    return { depth, laterSiblings };
  });
}
