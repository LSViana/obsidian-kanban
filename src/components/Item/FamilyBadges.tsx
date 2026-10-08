import classcat from 'classcat';
import { useContext, useEffect, useState } from 'preact/compat';
import { StateManager } from 'src/StateManager';
import { t } from 'src/lang/helpers';
import { parentFieldRegex } from 'src/parsers/formats/list';

import { Icon } from '../Icon/Icon';
import { KanbanContext } from '../context';
import { baseClassName, c } from '../helpers';
import { Board, Item } from '../types';

interface FamilyNode {
  item: Item;
  done: boolean;
  archived: boolean;
  parentId?: string;
  parentMissing: boolean;
  inLoop: boolean;
  childIds: string[];
}

type FamilyIndex = Map<string, FamilyNode>;

interface CachedIndex {
  archive: Item[];
  countArchivedAsDone: boolean;
  index: FamilyIndex;
}

// One index per board state. Lanes are immutable, so a new array means the board changed.
const indexCache = new WeakMap<Board['children'], CachedIndex>();

function buildFamilyIndex(board: Board, countArchivedAsDone: boolean): FamilyIndex {
  const index: FamilyIndex = new Map();
  const byBlockId = new Map<string, Item>();

  board.children.forEach((lane) => {
    lane.children.forEach((item) => {
      index.set(item.id, {
        item,
        done: !!item.data.checked || !!lane.data.shouldMarkItemsComplete,
        archived: false,
        parentMissing: false,
        inLoop: false,
        childIds: [],
      });

      const blockId = item.data.blockId;
      if (blockId && !byBlockId.has(blockId)) byBlockId.set(blockId, item);
    });
  });

  // Archived cards only count toward their parent's total. They can't be parents.
  (board.data.archive ?? []).forEach((item) => {
    index.set(item.id, {
      item,
      done: countArchivedAsDone,
      archived: true,
      parentMissing: false,
      inLoop: false,
      childIds: [],
    });
  });

  index.forEach((node) => {
    const parentBlockId = node.item.data.metadata.parentBlockId;
    if (!parentBlockId) return;

    const parent = byBlockId.get(parentBlockId);
    if (!parent) {
      node.parentMissing = true;
      return;
    }

    node.parentId = parent.id;
    index.get(parent.id).childIds.push(node.item.id);
  });

  index.forEach((node, id) => {
    const seen = new Set<string>();
    let current = node.parentId;
    while (current && !seen.has(current)) {
      if (current === id) {
        node.inLoop = true;
        break;
      }
      seen.add(current);
      current = index.get(current)?.parentId;
    }
  });

  return index;
}

export function getFamilyIndex(board: Board, countArchivedAsDone = false) {
  const archive = board.data.archive;
  const cached = indexCache.get(board.children);
  if (cached && cached.archive === archive && cached.countArchivedAsDone === countArchivedAsDone) {
    return cached.index;
  }

  const index = buildFamilyIndex(board, countArchivedAsDone);
  indexCache.set(board.children, { archive, countArchivedAsDone, index });
  return index;
}

function useBoard(stateManager: StateManager) {
  const [board, setBoard] = useState(stateManager.state);

  useEffect(() => {
    const receiver = (state: Board) => setBoard(state);
    stateManager.stateReceivers.push(receiver);
    setBoard(stateManager.state);
    return () => {
      stateManager.stateReceivers.remove(receiver);
    };
  }, [stateManager]);

  return board;
}

// The item, all its ancestors, and all its descendants
export function getFamilyIds(index: FamilyIndex, id: string) {
  const ids = new Set<string>([id]);

  let current = index.get(id)?.parentId;
  while (current && !ids.has(current)) {
    ids.add(current);
    current = index.get(current)?.parentId;
  }

  const stack = [...(index.get(id)?.childIds ?? [])];
  while (stack.length) {
    const childId = stack.pop();
    if (ids.has(childId)) continue;
    ids.add(childId);
    stack.push(...(index.get(childId)?.childIds ?? []));
  }

  return ids;
}

// The family above, plus the item's siblings (other children of the same parent)
function getHighlightIds(index: FamilyIndex, id: string) {
  const ids = getFamilyIds(index, id);
  const parentId = index.get(id)?.parentId;
  if (parentId) index.get(parentId)?.childIds.forEach((siblingId) => ids.add(siblingId));
  return ids;
}

export function getPlainTitle(item: Item) {
  const line =
    item.data.titleRaw
      .replace(parentFieldRegex, '$1')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';

  return line
    .replace(/\s\^[A-Za-z0-9-]+$/, '')
    .replace(/!?\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/!?\[\[([^\]]*)\]\]/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~=`]+/g, '')
    .trim();
}

const badgeClass = c('family-badge');
const highlightClass = 'is-family-highlight';

function getBoardRoot(el: HTMLElement) {
  return el.closest(`.${baseClassName}`) as HTMLElement | null;
}

function setHighlight(el: HTMLElement, ids: Set<string> | null) {
  const root = getBoardRoot(el);
  if (!root) return;

  root.querySelectorAll<HTMLElement>(`.${badgeClass}`).forEach((badge) => {
    badge.toggleClass(highlightClass, !!ids?.has(badge.dataset.familyId));
  });
}

function scrollToCard(el: HTMLElement, id: string) {
  const root = getBoardRoot(el);
  const card = root
    ?.querySelector(`.${badgeClass}[data-family-id="${id}"]`)
    ?.closest(`.${c('item')}`) as HTMLElement | null;

  if (!card) return;

  card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  card.addClass('is-family-flash');
  window.setTimeout(() => card.removeClass('is-family-flash'), 1200);
}

export function FamilyBadges({ item }: { item: Item }) {
  const { stateManager } = useContext(KanbanContext);
  const board = useBoard(stateManager);
  const countArchivedAsDone = !!stateManager.useSetting('count-archived-children-as-done');

  if (!board) return null;

  const index = getFamilyIndex(board, countArchivedAsDone);
  const node = index.get(item.id);
  if (!node) return null;

  const hasParent = !!node.parentId || node.parentMissing;
  const childCount = node.childIds.length;
  if (!hasParent && !childCount) return null;

  const onEnter = (e: MouseEvent) =>
    setHighlight(e.currentTarget as HTMLElement, getHighlightIds(index, item.id));
  const onLeave = (e: MouseEvent) => setHighlight(e.currentTarget as HTMLElement, null);

  const parent = node.parentId ? index.get(node.parentId) : null;
  const parentTitle = parent ? getPlainTitle(parent.item) : t('Parent card not found');
  const doneCount = node.childIds.filter((id) => index.get(id)?.done).length;

  return (
    <div className={c('family-badges')}>
      {hasParent && (
        <span
          className={classcat([
            badgeClass,
            c('family-badge-parent'),
            { 'is-missing': node.parentMissing, 'is-loop': node.inLoop },
          ])}
          data-family-id={item.id}
          aria-label={node.inLoop ? t('Parent cards form a loop') : parentTitle}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onClick={(e) => {
            if (!node.parentId) return;
            e.stopPropagation();
            scrollToCard(e.currentTarget as HTMLElement, node.parentId);
          }}
        >
          <Icon name={node.inLoop ? 'lucide-alert-triangle' : 'lucide-corner-down-right'} />
          <span className={c('family-badge-text')}>{parentTitle}</span>
        </span>
      )}
      {childCount > 0 && (
        <span
          className={classcat([
            badgeClass,
            c('family-badge-children'),
            { 'is-complete': doneCount === childCount },
          ])}
          data-family-id={item.id}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          <Icon name="lucide-list-tree" />
          <span className={c('family-badge-text')}>
            {doneCount}/{childCount} {t('done')}
          </span>
        </span>
      )}
    </div>
  );
}
