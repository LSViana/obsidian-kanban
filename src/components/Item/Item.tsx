import classcat from 'classcat';
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

import { KanbanContext, SearchContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';
import { CardModalPortal, useOpenCardOnClick } from './CardModal';
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

  const onContextMenu: JSX.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (isEditing(editState)) return;
      if (
        e.targetNode.instanceOf(HTMLAnchorElement) &&
        (e.targetNode.hasClass('internal-link') || e.targetNode.hasClass('external-link'))
      ) {
        return;
      }
      showItemMenu(e);
    },
    [showItemMenu, editState]
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
      onClick={onCardClick}
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
        <ItemMenuButton editState={editState} setEditState={setEditState} showMenu={showItemMenu} />
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

  const { itemIndex, ...innerProps } = props;

  const bindHandle = useDragHandle(measureRef, measureRef);

  const isMatch = search?.query ? innerProps.item.data.titleSearch.includes(search.query) : false;
  const classModifiers: string[] = getItemClassModifiers(innerProps.item);

  return (
    <div
      ref={(el) => {
        measureRef.current = el;
        bindHandle(el);
      }}
      className={c('item-wrapper')}
    >
      <div ref={elementRef} className={classcat([c('item'), ...classModifiers])}>
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
