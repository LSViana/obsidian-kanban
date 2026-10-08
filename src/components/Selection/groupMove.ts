import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { insertEntity, removeEntity, updateEntity } from 'src/dnd/util/data';
import { parentFieldRegex } from 'src/parsers/formats/list';

import { generateInstanceId, maybeCompleteForMove } from '../helpers';
import { Board, Item } from '../types';
import { resolveSelection } from './SelectionManager';

/**
 * Moves all selected cards to a drop spot in one board update. The group keeps board order:
 * lists left to right, cards top to bottom within each list.
 *
 * dropPath is [laneIndex, gapIndex], where gapIndex counts the cards still in the list,
 * the same convention single-card drops use.
 */
export function moveSelectionTo(
  stateManager: StateManager,
  board: Board,
  ids: Set<string>,
  dropPath: Path
): Board {
  const [laneIndex, gapIndex] = dropPath;
  const lane = board.children[laneIndex];
  const selected = resolveSelection(board, ids);
  if (!lane || !selected.length || gapIndex === undefined) return board;

  const moved: Item[] = [];
  const replacements: Array<Item | undefined> = [];

  selected.forEach(({ item, path }) => {
    const { next, replacement } = maybeCompleteForMove(
      stateManager,
      board,
      path,
      stateManager,
      board,
      [laneIndex, 0],
      item
    );
    moved.push(next);
    replacements.push(replacement);
  });

  // Selected cards above the drop gap in the target list leave, so the gap moves up
  const removedAboveGap = selected.filter(
    ({ path }) => path[0] === laneIndex && path[1] < gapIndex
  ).length;

  let next = board;
  for (let i = selected.length - 1; i >= 0; i--) {
    next = removeEntity(next, selected[i].path, replacements[i]) as Board;
  }

  const targetLength = next.children[laneIndex].children.length;
  const insertIndex = Math.max(0, Math.min(gapIndex - removedAboveGap, targetLength));
  next = insertEntity(next, [laneIndex, insertIndex], moved) as Board;

  if (next.children[laneIndex].data.sorted !== undefined) {
    next = updateEntity(next, [laneIndex], { data: { $unset: ['sorted'] } }) as Board;
  }

  return next;
}

/**
 * Copies the selected cards to a drop spot in one board update. The originals stay. Copies
 * keep board order and their content, follow a list that marks cards complete, and get new
 * ids. Copies drop their block ID, except a copied parent whose child is copied too: it gets
 * a new block ID and the child copy links to it.
 *
 * dropPath is [laneIndex, gapIndex] like moveSelectionTo. Returns the new board and the ids
 * of the copies.
 */
export function copySelectionTo(
  stateManager: StateManager,
  board: Board,
  ids: Set<string>,
  dropPath: Path
): { board: Board; copyIds: string[] } {
  const [laneIndex, gapIndex] = dropPath;
  const lane = board.children[laneIndex];
  const selected = resolveSelection(board, ids);
  if (!lane || !selected.length || gapIndex === undefined) return { board, copyIds: [] };

  // New block IDs for copied parents that also have a copied child
  const copiedBlockIds = new Set(
    selected.map(({ item }) => item.data.blockId).filter((id): id is string => !!id)
  );
  const newBlockIds = new Map<string, string>();
  selected.forEach(({ item }) => {
    const parentBlockId = item.data.metadata.parentBlockId;
    if (parentBlockId && copiedBlockIds.has(parentBlockId) && !newBlockIds.has(parentBlockId)) {
      newBlockIds.set(parentBlockId, generateInstanceId(6));
    }
  });

  const copies: Item[] = selected.map(({ item, path }) => {
    const parentBlockId = item.data.metadata.parentBlockId;
    let titleRaw = item.data.titleRaw;
    if (parentBlockId && newBlockIds.has(parentBlockId)) {
      titleRaw = titleRaw.replace(parentFieldRegex, (field) =>
        field.replace(`#^${parentBlockId}`, `#^${newBlockIds.get(parentBlockId)}`)
      );
    }

    const blockId = item.data.blockId ? newBlockIds.get(item.data.blockId) : undefined;
    const copy = stateManager.updateItemContent(
      { ...item, id: generateInstanceId(), data: { ...item.data, blockId } },
      titleRaw
    );

    return maybeCompleteForMove(
      stateManager,
      board,
      path,
      stateManager,
      board,
      [laneIndex, 0],
      copy
    ).next;
  });

  const insertIndex = Math.max(0, Math.min(gapIndex, lane.children.length));
  let next = insertEntity(board, [laneIndex, insertIndex], copies) as Board;

  if (next.children[laneIndex].data.sorted !== undefined) {
    next = updateEntity(next, [laneIndex], { data: { $unset: ['sorted'] } }) as Board;
  }

  return { board: next, copyIds: copies.map((copy) => copy.id) };
}
