import update from 'immutability-helper';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';
import { getTaskStatusDone, toggleTask } from 'src/parsers/helpers/inlineMetadata';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { c } from '../helpers';
import { Board, Item } from '../types';
import { getFamilyIndex, getPlainTitle, scrollToCard } from './FamilyBadges';

interface ChildListParams {
  anchor: HTMLElement;
  parentId: string;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
}

let closeCurrent: (() => void) | null = null;
let currentAnchor: HTMLElement | null = null;

function toggleChecked(
  item: Item,
  path: Path,
  stateManager: StateManager,
  boardModifiers: BoardModifiers
) {
  const updates = toggleTask(item, stateManager.file);
  if (updates) {
    const [itemStrings, checkChars, thisIndex] = updates;
    const replacements: Item[] = itemStrings.map((str, i) => {
      const next = stateManager.getNewItem(str, checkChars[i]);
      if (i === thisIndex) next.id = item.id;
      return next;
    });

    boardModifiers.replaceItem(path, replacements);
    return;
  }

  boardModifiers.updateItem(
    path,
    update(item, {
      data: {
        checkChar: { $apply: (v) => (v === ' ' ? getTaskStatusDone() : ' ') },
        $toggle: ['checked'],
      },
    })
  );
}

function renderList(el: HTMLElement, board: Board, params: ChildListParams, close: () => void) {
  const { anchor, parentId, stateManager, boardModifiers } = params;
  const parent = getFamilyIndex(
    board,
    !!stateManager.getSetting('count-archived-children-as-done')
  ).get(parentId);

  el.empty();
  if (!parent || !anchor.isConnected) {
    close();
    return;
  }

  const childIds = new Set(parent.childIds);
  const showCheckboxes = !!stateManager.getSetting('show-checkboxes');

  const addRow = (group: HTMLElement, item: Item, path: Path | null) => {
    const row = group.createDiv({
      cls: [c('child-list-item'), ...(path ? [] : ['is-archived'])],
    });

    if (showCheckboxes) {
      const checkbox = row.createEl('input', {
        type: 'checkbox',
        cls: 'task-list-item-checkbox',
      });
      checkbox.checked = !!item.data.checked;
      checkbox.dataset.task = item.data.checkChar;
      checkbox.disabled = !path;
      checkbox.addEventListener('click', (e) => e.stopPropagation());
      checkbox.addEventListener('change', () => {
        if (path) toggleChecked(item, path, stateManager, boardModifiers);
      });
    }

    row.createSpan({
      cls: c('child-list-item-title'),
      text: getPlainTitle(item) || t('Untitled card'),
    });

    if (path) {
      row.addEventListener('click', () => {
        close();
        scrollToCard(anchor, item.id);
      });
    }
  };

  board.children.forEach((lane, laneIndex) => {
    const items = lane.children
      .map((item, itemIndex) => ({ item, path: [laneIndex, itemIndex] as Path }))
      .filter(({ item }) => childIds.has(item.id));
    if (!items.length) return;

    const group = el.createDiv({ cls: c('child-list-group') });
    group.createDiv({ cls: c('child-list-heading'), text: lane.data.title });
    items.forEach(({ item, path }) => addRow(group, item, path));
  });

  const archived = (board.data.archive ?? []).filter((item) => childIds.has(item.id));
  if (archived.length) {
    const group = el.createDiv({ cls: c('child-list-group') });
    group.createDiv({ cls: c('child-list-heading'), text: t('Archived') });
    archived.forEach((item) => addRow(group, item, null));
  }
}

function position(el: HTMLElement, anchor: HTMLElement) {
  const win = anchor.ownerDocument.defaultView ?? window;
  const rect = anchor.getBoundingClientRect();
  const margin = 8;

  let top = rect.bottom + 4;
  let left = rect.left;

  const { width, height } = el.getBoundingClientRect();
  if (left + width > win.innerWidth - margin) left = win.innerWidth - margin - width;
  if (top + height > win.innerHeight - margin) top = rect.top - 4 - height;

  el.style.left = `${Math.max(margin, left)}px`;
  el.style.top = `${Math.max(margin, top)}px`;
}

export function openChildList(params: ChildListParams) {
  closeCurrent?.();

  const { anchor, stateManager } = params;
  const doc = anchor.ownerDocument;
  const el = doc.body.createDiv({ cls: c('child-list') });

  const onMouseDown = (e: MouseEvent) => {
    if (!el.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  // Render after the board has re-rendered, so the anchor check sees the new DOM
  const receiver = (board: Board) => {
    (doc.defaultView ?? window).requestAnimationFrame(() => {
      if (closeCurrent !== close) return;
      renderList(el, board, params, close);
      if (el.isConnected) position(el, anchor);
    });
  };

  function close() {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    currentAnchor = null;
    doc.removeEventListener('mousedown', onMouseDown, true);
    doc.removeEventListener('keydown', onKeyDown, true);
    stateManager.stateReceivers.remove(receiver);
    el.remove();
  }

  closeCurrent = close;
  currentAnchor = anchor;
  doc.addEventListener('mousedown', onMouseDown, true);
  doc.addEventListener('keydown', onKeyDown, true);
  stateManager.stateReceivers.push(receiver);

  receiver(stateManager.state);
}

export function toggleChildList(params: ChildListParams) {
  if (closeCurrent && currentAnchor === params.anchor) {
    closeCurrent();
    return;
  }
  openChildList(params);
}
