import { useEffect, useState } from 'preact/compat';
import { Path } from 'src/dnd/types';

import { Board, Item } from '../types';

export interface SelectedItem {
  item: Item;
  path: Path;
}

/**
 * Card selection for one board view. Stores card ids only, since paths go stale when cards
 * move. Cards subscribe to their own id, so a change only re-renders the cards it affects.
 */
export class SelectionManager {
  private ids = new Set<string>();
  private itemListeners = new Map<string, Set<() => void>>();
  private listeners = new Set<() => void>();

  get size() {
    return this.ids.size;
  }

  has(id: string) {
    return this.ids.has(id);
  }

  getIds() {
    return new Set(this.ids);
  }

  set(ids: Iterable<string>) {
    const next = new Set(ids);
    const changed: string[] = [];

    this.ids.forEach((id) => {
      if (!next.has(id)) changed.push(id);
    });
    next.forEach((id) => {
      if (!this.ids.has(id)) changed.push(id);
    });

    if (!changed.length) return;

    this.ids = next;
    changed.forEach((id) => this.itemListeners.get(id)?.forEach((fn) => fn()));
    this.listeners.forEach((fn) => fn());
  }

  toggle(id: string) {
    const next = new Set(this.ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.set(next);
  }

  clear() {
    this.set([]);
  }

  // Drops ids of cards that are no longer on the board
  prune(board: Board | null) {
    if (!this.ids.size || !board) return;

    const existing = new Set<string>();
    board.children.forEach((lane) => lane.children.forEach((item) => existing.add(item.id)));

    this.set([...this.ids].filter((id) => existing.has(id)));
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  subscribeItem(id: string, fn: () => void) {
    let set = this.itemListeners.get(id);
    if (!set) {
      set = new Set();
      this.itemListeners.set(id, set);
    }
    set.add(fn);

    return () => {
      set.delete(fn);
      if (!set.size) this.itemListeners.delete(id);
    };
  }
}

// Lets drag and drop code, which lives outside the board view, find a view's selection
const selectionByView = new Map<string, SelectionManager>();

export function registerSelection(viewId: string, selection: SelectionManager) {
  selectionByView.set(viewId, selection);
  return () => {
    if (selectionByView.get(viewId) === selection) selectionByView.delete(viewId);
  };
}

// The selected ids when dragging this card should move the whole selection, else null
export function getDragGroup(viewId: string, itemId: string): Set<string> | null {
  const selection = selectionByView.get(viewId);
  if (!selection || selection.size < 2 || !selection.has(itemId)) return null;
  return selection.getIds();
}

// Selected cards that still exist, in board order (list by list, top to bottom)
export function resolveSelection(board: Board, ids: Set<string>): SelectedItem[] {
  const result: SelectedItem[] = [];
  if (!ids.size) return result;

  board.children.forEach((lane, laneIndex) => {
    lane.children.forEach((item, itemIndex) => {
      if (ids.has(item.id)) result.push({ item, path: [laneIndex, itemIndex] });
    });
  });

  return result;
}

export function useIsSelected(selection: SelectionManager | null, id: string) {
  const [isSelected, setIsSelected] = useState(() => !!selection?.has(id));

  useEffect(() => {
    if (!selection) return;
    setIsSelected(selection.has(id));
    return selection.subscribeItem(id, () => setIsSelected(selection.has(id)));
  }, [selection, id]);

  return isSelected;
}

export function useSelectedIds(selection: SelectionManager | null) {
  const [ids, setIds] = useState<Set<string>>(() => selection?.getIds() ?? new Set());

  useEffect(() => {
    if (!selection) return;
    setIds(selection.getIds());
    return selection.subscribe(() => setIds(selection.getIds()));
  }, [selection]);

  return ids;
}
