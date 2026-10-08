import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { insertEntity, removeEntity, updateEntity } from 'src/dnd/util/data';

import { maybeCompleteForMove } from '../helpers';
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
