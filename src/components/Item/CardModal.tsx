import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { App, Keymap, Modal, Notice } from 'obsidian';
import { createPortal, useCallback, useContext, useEffect, useRef, useState } from 'preact/compat';
import { DndManagerContext } from 'src/dnd/components/context';
import { t } from 'src/lang/helpers';

import { MarkdownEditor } from '../Editor/MarkdownEditor';
import { Icon } from '../Icon/Icon';
import { KanbanContext } from '../context';
import { c, useGetDateColorFn } from '../helpers';
import { Board, EditState, EditingState, Item, isEditing } from '../types';
import { DateAndTime, RelativeDate } from './DateAndTime';
import { InlineMetadata } from './InlineMetadata';
import { Tags } from './ItemContent';
import { ItemMetadata } from './MetadataTable';

// 'left' and 'right' are reserved for a future side peek layout.
export type CardModalLayout = 'center' | 'left' | 'right';

const AUTOSAVE_DELAY_MS = 750;

// Wait a bit before opening on click so a double-click can still start inline editing.
const SINGLE_CLICK_DELAY_MS = 125;
const IGNORE_CLICK_AFTER_DRAG_MS = 300;

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  '.tag',
  '.task-list-item-checkbox',
  '.clickable-icon',
  '.is-button',
  `.${c('item-prefix-button-wrapper')}`,
  `.${c('item-postfix-button-wrapper')}`,
  `.${c('item-tags')}`,
  `.${c('item-metadata-date-wrapper')}`,
  `.${c('date')}`,
  `.${c('preview-date-wrapper')}`,
  `.${c('preview-time-wrapper')}`,
  `.${c('item-metadata-date')}`,
  `.${c('item-metadata-time')}`,
  `.${c('item-input-wrapper')}`,
].join(',');

/**
 * Opens the card on a single click when enabled. Ignores clicks on links, checkboxes, tags,
 * dates and buttons, clicks while editing inline, clicks that end a drag, and double-clicks.
 */
export function useOpenCardOnClick(enabled: boolean, editState: EditState, openCard: () => void) {
  const { view } = useContext(KanbanContext);
  const dndManager = useContext(DndManagerContext);
  const timerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastDragEndRef = useRef(0);

  const cancelPendingOpen = useCallback(() => {
    if (timerRef.current !== null) {
      view.getWindow().clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [view]);

  useEffect(() => {
    if (!enabled || !dndManager) return;

    const onDragStart = () => {
      isDraggingRef.current = true;
      cancelPendingOpen();
    };
    // dragEnd fires on every pointerup, even without a drag, so only count real drags.
    const onDragEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      lastDragEndRef.current = Date.now();
    };

    dndManager.dragManager.emitter.on('dragStart', onDragStart);
    dndManager.dragManager.emitter.on('dragEnd', onDragEnd);
    return () => {
      dndManager.dragManager.emitter.off('dragStart', onDragStart);
      dndManager.dragManager.emitter.off('dragEnd', onDragEnd);
      cancelPendingOpen();
    };
  }, [enabled, dndManager, cancelPendingOpen]);

  const onClick = useCallback(
    (e: MouseEvent) => {
      if (!enabled || isEditing(editState)) return;
      if (e.button !== 0 || e.defaultPrevented) return;
      if (e.detail > 1) {
        cancelPendingOpen();
        return;
      }
      if (Date.now() - lastDragEndRef.current < IGNORE_CLICK_AFTER_DRAG_MS) return;

      const target = e.target as Element | null;
      if (target?.closest?.(INTERACTIVE_SELECTOR)) return;

      const selection = view.getWindow().getSelection();
      if (selection && !selection.isCollapsed) return;

      cancelPendingOpen();
      timerRef.current = view.getWindow().setTimeout(() => {
        timerRef.current = null;
        openCard();
      }, SINGLE_CLICK_DELAY_MS);
    },
    [enabled, editState, openCard, view, cancelPendingOpen]
  );

  return { onClick, cancelPendingOpen };
}

class CardModal extends Modal {
  // Not named onCloseCallback, which Obsidian's Modal already uses internally.
  handleClose: () => void;

  constructor(app: App, layout: CardModalLayout, handleClose: () => void) {
    super(app);
    this.handleClose = handleClose;
    this.containerEl.addClass(c('card-modal-container'), c(`card-modal-${layout}`));
    this.modalEl.addClass(c('card-modal'));
  }

  onClose() {
    this.handleClose();
  }
}

function findItemPath(board: Board | null, id: string): [number, number] | null {
  if (!board) return null;
  for (let laneIndex = 0; laneIndex < board.children.length; laneIndex++) {
    const items = board.children[laneIndex].children;
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      if (items[itemIndex].id === id) return [laneIndex, itemIndex];
    }
  }
  return null;
}

interface CardModalPortalProps {
  item: Item;
  onClose: () => void;
  layout?: CardModalLayout;
}

/**
 * Opens a card in an Obsidian modal. The content is rendered through a portal so it keeps
 * the board's Preact context and receives live item updates.
 */
export function CardModalPortal({ item, onClose, layout = 'center' }: CardModalPortalProps) {
  const { view, stateManager, boardModifiers, filePath } = useContext(KanbanContext);
  const getDateColor = useGetDateColorFn(stateManager);
  const board = stateManager.useState();

  const [modal, setModal] = useState<CardModal | null>(null);
  const editorRef = useRef<EditorView>(null);
  const pendingTextRef = useRef<string | null>(null);
  const lastSavedRef = useRef<string>(item.data.titleRaw);
  const timerRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const save = useCallback(() => {
    const win = view.getWindow();
    if (timerRef.current !== null) {
      win.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const text = pendingTextRef.current;
    if (text === null) return;
    pendingTextRef.current = null;

    // Look the card up by id, since its position may have changed while the modal was open.
    const currentBoard = stateManager.state;
    const path = findItemPath(currentBoard, item.id);
    if (!path) {
      navigator.clipboard?.writeText(text);
      new Notice(t('This card no longer exists. Your text was copied to the clipboard.'));
      return;
    }

    const current = currentBoard.children[path[0]].children[path[1]];
    if (current.data.titleRaw !== lastSavedRef.current) {
      new Notice(t('This card was changed somewhere else while it was open. Your version was saved.'));
    }

    const updated = stateManager.updateItemContent(current, text);
    lastSavedRef.current = updated.data.titleRaw;
    boardModifiers.updateItem(path, updated);
  }, [view, stateManager, boardModifiers, item.id]);

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const cardModal = new CardModal(view.app, layout, () => {
      if (closedRef.current) return;
      closedRef.current = true;
      try {
        saveRef.current();
      } finally {
        onCloseRef.current();
      }
    });

    cardModal.open();
    setModal(cardModal);

    return () => {
      if (!closedRef.current) cardModal.close();
    };
  }, []);

  const closeModal = useCallback(() => {
    if (modal && !closedRef.current) modal.close();
  }, [modal]);

  useEffect(() => {
    const cm = editorRef.current;
    if (!modal || !cm) return;
    cm.focus();
    cm.dispatch({ selection: EditorSelection.cursor(cm.state.doc.length) });
  }, [modal]);

  const onEnter = useCallback(
    (_cm: EditorView, mod: boolean) => {
      if (mod) {
        closeModal();
        return true;
      }
      return false;
    },
    [closeModal]
  );

  const onEscape = useCallback(() => closeModal(), [closeModal]);

  const onOpenLinkedNote = useCallback(
    (e: MouseEvent) => {
      const file = item.data.metadata.file;
      if (!file) return;
      closeModal();
      view.app.workspace.openLinkText(file.path, filePath, Keymap.isModEvent(e));
    },
    [item, filePath, view, closeModal]
  );

  if (!modal) return null;

  const path = findItemPath(board, item.id);
  const laneTitle = path ? board.children[path[0]].data.title : '';

  return createPortal(
    <div className={c('card-modal-content')}>
      <div className={c('card-modal-header')}>
        <span className={c('card-modal-lane')}>{laneTitle}</span>
        {item.data.metadata.file && (
          <button
            className={`clickable-icon ${c('card-modal-action')}`}
            aria-label={t('Open linked note')}
            onClick={onOpenLinkedNote}
          >
            <Icon name="lucide-file-text" />
          </button>
        )}
      </div>
      <div className={`${c('item-input-wrapper')} ${c('card-modal-editor')}`}>
        <MarkdownEditor
          editorRef={editorRef}
          editState={EditingState.cancel}
          className={c('item-input')}
          value={item.data.titleRaw}
          onEnter={onEnter}
          onEscape={onEscape}
          onSubmit={closeModal}
          onChange={(update) => {
            if (!update.docChanged) return;
            pendingTextRef.current = update.state.doc.toString().trim();
            const win = view.getWindow();
            if (timerRef.current !== null) win.clearTimeout(timerRef.current);
            timerRef.current = win.setTimeout(() => saveRef.current(), AUTOSAVE_DELAY_MS);
          }}
        />
      </div>
      <div className={`${c('item-metadata')} ${c('card-modal-metadata')}`}>
        <RelativeDate item={item} stateManager={stateManager} />
        <DateAndTime
          item={item}
          stateManager={stateManager}
          filePath={filePath}
          getDateColor={getDateColor}
        />
        <InlineMetadata item={item} stateManager={stateManager} />
        <Tags tags={item.data.metadata.tags} alwaysShow />
      </div>
      <ItemMetadata item={item} />
    </div>,
    modal.contentEl
  );
}
