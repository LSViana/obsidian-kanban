import classcat from 'classcat';
import { Keymap } from 'obsidian';
import {
  JSX,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/compat';
import useOnclickOutside from 'react-cool-onclickoutside';
import { Droppable, useNestedEntityPath } from 'src/dnd/components/Droppable';
import { DndManagerContext } from 'src/dnd/components/context';
import { useDragHandle } from 'src/dnd/managers/DragManager';
import { frontmatterKey } from 'src/parsers/common';

import { showBulkMenu } from '../Selection/BulkMenu';
import { useIsSelected } from '../Selection/SelectionManager';
import { KanbanContext, SearchContext, SelectionContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';
import { CardModalPortal, INTERACTIVE_SELECTOR, useOpenCardOnClick } from './CardModal';
import { FamilyBadges } from './FamilyBadges';
import { ItemCheckbox } from './ItemCheckbox';
import { ItemContent } from './ItemContent';
import { useItemMenu } from './ItemMenu';
import { ItemMenuButton } from './ItemMenuButton';
import { ItemMetadata } from './MetadataTable';
import { getItemClassModifiers } from './helpers';

export interface DraggableItemProps {
  item: Item;
  itemIndex: number;
  isStatic?: boolean;
  shouldMarkItemsComplete?: boolean;
}

export interface ItemInnerProps {
  item: Item;
  isStatic?: boolean;
  shouldMarkItemsComplete?: boolean;
  isMatch?: boolean;
  searchQuery?: string;
}

const ItemInner = memo(function ItemInner({
  item,
  shouldMarkItemsComplete,
  isMatch,
  searchQuery,
  isStatic,
}: ItemInnerProps) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const [editState, setEditState] = useState<EditState>(EditingState.cancel);
  const [isCardOpen, setIsCardOpen] = useState(false);

  const dndManager = useContext(DndManagerContext);

  useEffect(() => {
    const handler = () => {
      if (isEditing(editState)) setEditState(EditingState.cancel);
    };

    dndManager.dragManager.emitter.on('dragStart', handler);
    return () => {
      dndManager.dragManager.emitter.off('dragStart', handler);
    };
  }, [dndManager, editState]);

  // Clicking outside a card being edited saves the edit, same as pressing Enter.
  // Popups that belong to the editor (suggestions, date pickers, menus, modals) are ignored.
  const outsideClickIgnoreClasses = [
    c('ignore-click-outside'),
    'mobile-toolbar',
    'suggestion-container',
    'menu',
    'modal-container',
  ];
  const libraryClickOutsideRef = useOnclickOutside(
    () => {
      if (isEditing(editState)) setEditState(EditingState.complete);
    },
    {
      disabled: !isEditing(editState),
      ignoreClass: outsideClickIgnoreClasses,
    }
  );

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const clickOutsideRef = useCallback(
    (el: HTMLDivElement | null) => {
      wrapperRef.current = el;
      libraryClickOutsideRef(el);
    },
    [libraryClickOutsideRef]
  );

  // The handler above never sees presses on other cards or list headers: their drag handles
  // cancel mousedown and stop the event. Listening in the capture phase catches those too,
  // so only one card stays in edit mode.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!isEditing(editState) || !el) return;

    const ignoreSelector = outsideClickIgnoreClasses.map((cls) => `.${cls}`).join(',');
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest || el.contains(target) || target.closest(ignoreSelector)) return;
      setEditState(EditingState.complete);
    };

    const win = el.win;
    win.addEventListener('pointerdown', onPointerDown, true);
    return () => win.removeEventListener('pointerdown', onPointerDown, true);
  }, [editState]);

  useEffect(() => {
    if (item.data.forceEditMode) {
      setEditState({ x: 0, y: 0 });
    }
  }, [item.data.forceEditMode]);

  const path = useNestedEntityPath();

  const openCard = useCallback(() => {
    setEditState((state) => (isEditing(state) ? EditingState.complete : state));
    setIsCardOpen(true);
  }, []);

  const closeCard = useCallback(() => setIsCardOpen(false), []);

  const openCardOnClick = !!stateManager.useSetting('open-card-on-click') && !isStatic;
  const showFirstLineOnly = !!stateManager.useSetting('show-first-line-only');
  const { onClick: onCardClick, cancelPendingOpen } = useOpenCardOnClick(
    openCardOnClick,
    editState,
    openCard
  );

  const showItemMenu = useItemMenu({
    boardModifiers,
    item,
    setEditState: setEditState,
    stateManager,
    path,
    openCard: isStatic ? undefined : openCard,
  });

  const selection = useContext(SelectionContext);

  // A click that ends a drag must not change the selection
  const lastDragEndRef = useRef(0);
  useEffect(() => {
    if (!selection) return;
    let isDragging = false;
    const onDragStart = () => {
      isDragging = true;
    };
    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      lastDragEndRef.current = Date.now();
    };
    dndManager.dragManager.emitter.on('dragStart', onDragStart);
    dndManager.dragManager.emitter.on('dragEnd', onDragEnd);
    return () => {
      dndManager.dragManager.emitter.off('dragStart', onDragStart);
      dndManager.dragManager.emitter.off('dragEnd', onDragEnd);
    };
  }, [dndManager, selection]);

  // Starting an inline edit ends the selection
  useEffect(() => {
    if (isEditing(editState)) selection?.clear();
  }, [editState, selection]);

  // With several cards selected, the menu of a selected card acts on all of them.
  // Opening the menu of a card outside the selection replaces the selection.
  const showMenu = useCallback(
    (e: MouseEvent) => {
      if (selection && !isStatic) {
        if (selection.size > 1 && selection.has(item.id)) {
          showBulkMenu({ x: e.clientX, y: e.clientY }, { stateManager, boardModifiers, selection });
          return;
        }
        if (selection.size && !selection.has(item.id)) selection.clear();
      }
      showItemMenu(e);
    },
    [selection, isStatic, item.id, stateManager, boardModifiers, showItemMenu]
  );

  // Ctrl/Cmd+click toggles the card in the selection. A plain click clears the selection.
  // Clicks on links, checkboxes, tags, dates, and buttons keep their own behavior.
  const onClick = useCallback(
    (e: MouseEvent) => {
      if (selection && !isStatic && !isEditing(editState) && e.button === 0) {
        if (Date.now() - lastDragEndRef.current < 300) return;
        const target = e.target as Element | null;
        const isInteractive = !!target?.closest?.(INTERACTIVE_SELECTOR);
        const isMod = Keymap.isModifier(e, 'Mod');

        if (!isInteractive && isMod && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          cancelPendingOpen();
          selection.toggle(item.id);
          return;
        }

        if (!isInteractive && !isMod && !e.shiftKey && selection.size) {
          e.preventDefault();
          cancelPendingOpen();
          selection.clear();
          return;
        }
      }
      onCardClick(e);
    },
    [selection, isStatic, editState, item.id, cancelPendingOpen, onCardClick]
  );

  const onContextMenu: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (isEditing(editState)) return;
      if (
        e.targetNode.instanceOf(HTMLAnchorElement) &&
        (e.targetNode.hasClass('internal-link') || e.targetNode.hasClass('external-link'))
      ) {
        return;
      }
      showMenu(e);
    },
    [showMenu, editState]
  );

  const onDoubleClick: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      cancelPendingOpen();
      setEditState({ x: e.clientX, y: e.clientY });
    },
    [setEditState, cancelPendingOpen]
  );

  const ignoreAttr = useMemo(() => {
    if (isEditing(editState)) {
      return {
        'data-ignore-drag': true,
      };
    }

    return {};
  }, [editState]);

  return (
    <div
      ref={clickOutsideRef}
      // eslint-disable-next-line react/no-unknown-property
      onDblClick={onDoubleClick}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={classcat([
        c('item-content-wrapper'),
        { [c('opens-on-click')]: openCardOnClick && !isEditing(editState) },
      ])}
      {...ignoreAttr}
    >
      <div className={c('item-title-wrapper')} {...ignoreAttr}>
        <ItemCheckbox
          boardModifiers={boardModifiers}
          item={item}
          path={path}
          shouldMarkItemsComplete={shouldMarkItemsComplete}
          stateManager={stateManager}
        />
        <ItemContent
          item={item}
          searchQuery={isMatch ? searchQuery : undefined}
          setEditState={setEditState}
          editState={editState}
          isStatic={isStatic}
          firstLineOnly={showFirstLineOnly}
        />
        <ItemMenuButton editState={editState} setEditState={setEditState} showMenu={showMenu} />
      </div>
      <FamilyBadges item={item} />
      <ItemMetadata searchQuery={isMatch ? searchQuery : undefined} item={item} />
      {isCardOpen && <CardModalPortal item={item} onClose={closeCard} />}
    </div>
  );
});

export const DraggableItem = memo(function DraggableItem(props: DraggableItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const search = useContext(SearchContext);
  const selection = useContext(SelectionContext);

  const { itemIndex, ...innerProps } = props;

  const bindHandle = useDragHandle(measureRef, measureRef);
  const isSelected = useIsSelected(props.isStatic ? null : selection, props.item.id);

  const isMatch = search?.query ? innerProps.item.data.titleSearch.includes(search.query) : false;
  const classModifiers: string[] = getItemClassModifiers(innerProps.item);

  return (
    <div
      ref={(el) => {
        measureRef.current = el;
        bindHandle(el);
      }}
      className={c('item-wrapper')}
      data-selectable-id={props.isStatic || !selection ? undefined : props.item.id}
    >
      <div
        ref={elementRef}
        className={classcat([c('item'), ...classModifiers, { 'is-selected': isSelected }])}
      >
        {props.isStatic ? (
          <ItemInner
            {...innerProps}
            isMatch={isMatch}
            searchQuery={search?.query}
            isStatic={true}
          />
        ) : (
          <Droppable
            elementRef={elementRef}
            measureRef={measureRef}
            id={props.item.id}
            index={itemIndex}
            data={props.item}
          >
            <ItemInner {...innerProps} isMatch={isMatch} searchQuery={search?.query} />
          </Droppable>
        )}
      </div>
    </div>
  );
});

interface ItemsProps {
  isStatic?: boolean;
  items: Item[];
  shouldMarkItemsComplete: boolean;
}

export const Items = memo(function Items({ isStatic, items, shouldMarkItemsComplete }: ItemsProps) {
  const search = useContext(SearchContext);
  const { view } = useContext(KanbanContext);
  const boardView = view.useViewState(frontmatterKey);

  return (
    <>
      {items.map((item, i) => {
        return search?.query && !search.items.has(item) ? null : (
          <DraggableItem
            key={boardView + item.id}
            item={item}
            itemIndex={i}
            shouldMarkItemsComplete={shouldMarkItemsComplete}
            isStatic={isStatic}
          />
        );
      })}
    </>
  );
});
