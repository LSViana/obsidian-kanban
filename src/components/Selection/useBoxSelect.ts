import { Keymap, Platform } from 'obsidian';
import { useEffect } from 'preact/compat';
import type { KanbanView } from 'src/KanbanView';

import { baseClassName, c } from '../helpers';
import { SelectionManager } from './SelectionManager';

const DRAG_THRESHOLD = 5;

// A box can only start on empty board or list space
const NO_BOX_SELECTOR = [
  `.${c('item-wrapper')}`,
  `.${c('lane-header-wrapper')}`,
  `.${c('item-form')}`,
  `.${c('item-button-wrapper')}`,
  `.${c('lane-form-wrapper')}`,
  `.${c('search-wrapper')}`,
  `.${c('selection-bar')}`,
  `.${c('table-wrapper')}`,
  '.cm-editor',
  'a',
  'button',
  'input',
  'textarea',
  'select',
  '.clickable-icon',
].join(',');

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"], .cm-editor';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function intersects(a: Rect, b: DOMRect) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

/**
 * Selects cards by dragging a box on empty board space, like a file manager.
 * Shift adds to the selection, Ctrl/Cmd toggles. A click on empty space clears it.
 */
export function useBoxSelect(view: KanbanView, selection: SelectionManager, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const container = view.contentEl;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.pointerType !== 'mouse' || e.defaultPrevented) return;

      const target = e.target as HTMLElement;
      if (!target?.closest) return;

      const root = target.closest(`.${baseClassName}`) as HTMLElement | null;
      if (!root || !target.closest(`.${c('board')}`)) return;
      if (target.closest(NO_BOX_SELECTOR)) return;

      // Ignore presses on scrollbars
      if (e.offsetX > target.clientWidth || e.offsetY > target.clientHeight) return;

      const win = view.getWindow();
      const start = { x: e.clientX, y: e.clientY };
      let last = start;
      const mode = e.shiftKey ? 'add' : Keymap.isModifier(e, 'Mod') ? 'toggle' : 'replace';
      const base = selection.getIds();
      let box: HTMLElement | null = null;
      let frame = 0;

      const update = () => {
        frame = 0;
        if (!box) return;

        const rect: Rect = {
          left: Math.min(start.x, last.x),
          top: Math.min(start.y, last.y),
          right: Math.max(start.x, last.x),
          bottom: Math.max(start.y, last.y),
        };

        const rootRect = root.getBoundingClientRect();
        box.style.left = `${rect.left - rootRect.left}px`;
        box.style.top = `${rect.top - rootRect.top}px`;
        box.style.width = `${rect.right - rect.left}px`;
        box.style.height = `${rect.bottom - rect.top}px`;

        const hits = new Set<string>();
        root.querySelectorAll<HTMLElement>('[data-selectable-id]').forEach((el) => {
          if (intersects(rect, el.getBoundingClientRect())) hits.add(el.dataset.selectableId);
        });

        if (mode === 'replace') {
          selection.set(hits);
        } else if (mode === 'add') {
          selection.set([...base, ...hits]);
        } else {
          const next = new Set(base);
          hits.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
          selection.set(next);
        }
      };

      const scheduleUpdate = () => {
        if (!frame) frame = win.requestAnimationFrame(update);
      };

      const onMove = (e: PointerEvent) => {
        last = { x: e.clientX, y: e.clientY };

        if (!box) {
          if (Math.hypot(last.x - start.x, last.y - start.y) < DRAG_THRESHOLD) return;
          box = root.createDiv(c('selection-box'));
          root.addClass('is-box-selecting');
          win.getSelection()?.removeAllRanges();
        }

        scheduleUpdate();
      };

      // Lists and the board can scroll under a still pointer while the box is open
      const onScroll = () => {
        if (box) scheduleUpdate();
      };

      const onUp = () => {
        win.removeEventListener('pointermove', onMove);
        win.removeEventListener('pointerup', onUp);
        win.removeEventListener('pointercancel', onUp);
        root.removeEventListener('scroll', onScroll, true);
        if (frame) win.cancelAnimationFrame(frame);

        if (box) {
          update();
          box.remove();
          root.removeClass('is-box-selecting');
        } else if (mode === 'replace') {
          selection.clear();
        }
      };

      win.addEventListener('pointermove', onMove);
      win.addEventListener('pointerup', onUp);
      win.addEventListener('pointercancel', onUp);
      root.addEventListener('scroll', onScroll, true);
    };

    container.addEventListener('pointerdown', onPointerDown);
    return () => container.removeEventListener('pointerdown', onPointerDown);
  }, [view, selection, enabled]);
}

// True when the board view owns the key: it is the active view and nothing else is typing,
// showing a menu, or showing a modal.
function isBoardKey(view: KanbanView, win: Window, e: KeyboardEvent) {
  if (e.defaultPrevented) return false;
  if (view.app.workspace.getActiveViewOfType(view.constructor as typeof KanbanView) !== view) {
    return false;
  }

  const doc = win.document;
  const active = doc.activeElement as HTMLElement | null;
  if (active?.closest?.(EDITABLE_SELECTOR)) return false;
  if (doc.body.querySelector('.modal-container, .menu')) return false;

  return true;
}

/** Escape clears the selection when the board is focused and nothing else wants the key. */
export function useClearSelectionOnEscape(view: KanbanView, selection: SelectionManager) {
  useEffect(() => {
    const win = view.getWindow();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !selection.size || !isBoardKey(view, win, e)) return;
      selection.clear();
    };

    win.addEventListener('keydown', onKeyDown);
    return () => win.removeEventListener('keydown', onKeyDown);
  }, [view, selection]);
}

/** Del (and Backspace on macOS) deletes the selected cards, same as the menu's Delete. */
export function useDeleteSelectionOnKey(
  view: KanbanView,
  selection: SelectionManager,
  onDelete: () => void
) {
  useEffect(() => {
    const win = view.getWindow();

    const onKeyDown = (e: KeyboardEvent) => {
      const isDeleteKey = e.key === 'Delete' || (Platform.isMacOS && e.key === 'Backspace');
      if (!isDeleteKey || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (!selection.size || !isBoardKey(view, win, e)) return;

      e.preventDefault();
      onDelete();
    };

    win.addEventListener('keydown', onKeyDown);
    return () => win.removeEventListener('keydown', onKeyDown);
  }, [view, selection, onDelete]);
}
