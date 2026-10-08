import { EditorView } from '@codemirror/view';
import Mark from 'mark.js';
import { Component, MarkdownRenderer as ObsidianRenderer } from 'obsidian';
import { memo } from 'preact/compat';
import {
  Dispatch,
  StateUpdater,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'preact/hooks';
import { StateManager } from 'src/StateManager';
import { useNestedEntityPath } from 'src/dnd/components/Droppable';
import { Path } from 'src/dnd/types';
import { parentFieldRegex } from 'src/parsers/formats/list';
import { getTaskStatusDone, toggleTaskString } from 'src/parsers/helpers/inlineMetadata';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import {
  MarkdownClonedPreviewRenderer,
  MarkdownRenderer,
} from '../MarkdownRenderer/MarkdownRenderer';
import { KanbanContext, SearchContext } from '../context';
import { c, useGetDateColorFn, useGetTagColorFn } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';
import { DateAndTime, RelativeDate } from './DateAndTime';
import { InlineMetadata } from './InlineMetadata';
import {
  constructDatePicker,
  constructMenuDatePickerOnChange,
  constructMenuTimePickerOnChange,
  constructTimePicker,
} from './helpers';

export function useDatePickers(item: Item, explicitPath?: Path) {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const path = explicitPath || useNestedEntityPath();

  return useMemo(() => {
    const onEditDate = (e: MouseEvent) => {
      constructDatePicker(
        e.view,
        stateManager,
        { x: e.clientX, y: e.clientY },
        constructMenuDatePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasDate: true,
          path,
        }),
        item.data.metadata.date?.toDate()
      );
    };

    const onEditTime = (e: MouseEvent) => {
      constructTimePicker(
        e.view, // Preact uses real events, so this is safe
        stateManager,
        { x: e.clientX, y: e.clientY },
        constructMenuTimePickerOnChange({
          stateManager,
          boardModifiers,
          item,
          hasTime: true,
          path,
        }),
        item.data.metadata.time
      );
    };

    return {
      onEditDate,
      onEditTime,
    };
  }, [boardModifiers, path, item, stateManager]);
}

export interface ItemContentProps {
  item: Item;
  setEditState: Dispatch<StateUpdater<EditState>>;
  searchQuery?: string;
  showMetadata?: boolean;
  editState: EditState;
  isStatic: boolean;
  firstLineOnly?: boolean;
}

// Splits card text into its first non-empty line and everything after it. The rest only
// counts as separate when a blank line follows the first line; otherwise nothing is split.
function splitFirstLine(text: string) {
  const lines = text.split(/\r?\n/g);
  const index = lines.findIndex((line) => line.trim() !== '');
  if (index === -1 || index + 1 >= lines.length || lines[index + 1].trim() !== '') {
    return { first: text, rest: '' };
  }

  const rest = lines.slice(index + 1).join('\n');
  return { first: lines.slice(0, index + 1).join('\n'), rest: rest.trim() ? rest : '' };
}

function checkCheckbox(stateManager: StateManager, title: string, checkboxIndex: number) {
  let count = 0;

  const lines = title.split(/\n\r?/g);
  const results: string[] = [];

  lines.forEach((line) => {
    if (count > checkboxIndex) {
      results.push(line);
      return;
    }

    const match = line.match(/^(\s*>)*(\s*[-+*]\s+?\[)([^\]])(\]\s+)/);

    if (match) {
      if (count === checkboxIndex) {
        const updates = toggleTaskString(line, stateManager.file);
        if (updates) {
          results.push(updates);
        } else {
          const check = match[3] === ' ' ? getTaskStatusDone() : ' ';
          const m1 = match[1] ?? '';
          const m2 = match[2] ?? '';
          const m4 = match[4] ?? '';
          results.push(m1 + m2 + check + m4 + line.slice(match[0].length));
        }
      } else {
        results.push(line);
      }
      count++;
      return;
    }

    results.push(line);
  });

  return results.join('\n');
}

export function Tags({
  tags,
  searchQuery,
  alwaysShow,
}: {
  tags?: string[];
  searchQuery?: string;
  alwaysShow?: boolean;
}) {
  const { stateManager } = useContext(KanbanContext);
  const getTagColor = useGetTagColorFn(stateManager);
  const search = useContext(SearchContext);
  const shouldShow = stateManager.useSetting('move-tags') || alwaysShow;

  if (!tags.length || !shouldShow) return null;

  return (
    <div className={c('item-tags')}>
      {tags.map((tag, i) => {
        const tagColor = getTagColor(tag);

        return (
          <TagLink
            key={i}
            tag={tag}
            color={tagColor?.color}
            backgroundColor={tagColor?.backgroundColor}
            isSearchMatch={!!searchQuery && tag.toLocaleLowerCase().contains(searchQuery)}
            searchQuery={searchQuery}
            onClick={(e) => {
              e.preventDefault();

              const tagAction = stateManager.getSetting('tag-action');
              if (search && tagAction === 'kanban') {
                search.search(tag, true);
                return;
              }

              (stateManager.app as any).internalPlugins
                .getPluginById('global-search')
                .instance.openGlobalSearch(`tag:${tag}`);
            }}
          />
        );
      })}
    </div>
  );
}

// Footer tags go through Obsidian's markdown renderer so that markdown post-processors
// from other plugins (for example Iconic's tag icons and colors) also apply to them.
function TagLink({
  tag,
  color,
  backgroundColor,
  isSearchMatch,
  searchQuery,
  onClick,
}: {
  tag: string;
  color?: string;
  backgroundColor?: string;
  isSearchMatch: boolean;
  searchQuery?: string;
  onClick: (e: MouseEvent) => void;
}) {
  const { stateManager, filePath } = useContext(KanbanContext);
  const elRef = useRef<HTMLSpanElement>();
  const tagElRef = useRef<HTMLElement>();
  const searchRef = useRef({ isSearchMatch, searchQuery });
  searchRef.current = { isSearchMatch, searchQuery };

  // Highlight the matching part of the tag name the same way card text is highlighted.
  const applySearch = (tagEl: HTMLElement) => {
    const { isSearchMatch, searchQuery } = searchRef.current;
    tagEl.toggleClass('is-search-match', isSearchMatch);
    const mark = new Mark(tagEl);
    mark.unmark();
    if (searchQuery && searchQuery.trim()) mark.mark(searchQuery);
  };

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    let cancelled = false;
    const component = new Component();
    component.load();

    const applyKanbanState = (tagEl: HTMLElement) => {
      tagEl.addClass(c('item-tag'));
      if (color) tagEl.style.setProperty('--tag-color', color);
      if (backgroundColor) tagEl.style.setProperty('--tag-background', backgroundColor);
    };

    const renderEl = createDiv();
    ObsidianRenderer.render(stateManager.app, tag, renderEl, filePath, component)
      .catch(() => null)
      .then(() => {
        if (cancelled) return;
        let tagEl = renderEl.querySelector<HTMLElement>('a.tag');
        if (!tagEl) {
          tagEl = createEl('a', { cls: 'tag', href: tag, text: tag });
        }
        applyKanbanState(tagEl);
        applySearch(tagEl);
        tagElRef.current = tagEl;
        el.empty();
        el.append(tagEl);
      });

    return () => {
      cancelled = true;
      component.unload();
    };
  }, [tag, color, backgroundColor, filePath]);

  useEffect(() => {
    if (tagElRef.current) applySearch(tagElRef.current);
  }, [isSearchMatch, searchQuery]);

  return <span ref={elRef} onClick={onClick} />;
}

// True for text that holds nothing but a `parent::` field
function isOnlyParentField(text: string) {
  return parentFieldRegex.test(text) && !text.replace(parentFieldRegex, '$1').trim();
}

export const ItemContent = memo(function ItemContent({
  item,
  editState,
  setEditState,
  searchQuery,
  showMetadata = true,
  isStatic,
  firstLineOnly = false,
}: ItemContentProps) {
  const { stateManager, filePath, boardModifiers } = useContext(KanbanContext);
  const getDateColor = useGetDateColorFn(stateManager);
  const titleRef = useRef<string | null>(null);

  const displayParts = useMemo(() => splitFirstLine(item.data.title), [item.data.title]);
  const rawParts = useMemo(() => splitFirstLine(item.data.titleRaw), [item.data.titleRaw]);
  const editFirstLineOnly = firstLineOnly && !!rawParts.rest;
  const hiddenLinesMatchSearch =
    !!searchQuery && displayParts.rest.toLocaleLowerCase().includes(searchQuery);
  const hideRest = firstLineOnly && !!displayParts.rest && !hiddenLinesMatchSearch;
  const displayMarkdown = hideRest ? displayParts.first : item.data.title;
  const markdownClassName = hideRest ? `${c('item-markdown')} has-hidden-lines` : c('item-markdown');

  // A child card just added from the menu. It opens with two blank lines above the
  // parent field so the user can type right away, and is removed if left empty.
  const isNewChild = !!item.data.forceEditMode && isOnlyParentField(item.data.titleRaw);
  const wasEditingRef = useRef(false);

  useEffect(() => {
    if (isEditing(editState)) {
      wasEditingRef.current = true;
      return;
    }

    const removeIfEmpty = isNewChild && wasEditingRef.current;
    wasEditingRef.current = false;

    if (editState === EditingState.complete) {
      if (removeIfEmpty && isOnlyParentField(titleRef.current ?? item.data.titleRaw)) {
        boardModifiers.deleteItems(new Set([item.id]));
      } else if (titleRef.current !== null) {
        let nextTitle = titleRef.current;
        if (editFirstLineOnly) {
          nextTitle = nextTitle ? `${nextTitle}\n${rawParts.rest}` : rawParts.rest;
        }
        boardModifiers.updateItem(path, stateManager.updateItemContent(item, nextTitle));
      }
      titleRef.current = null;
    } else if (editState === EditingState.cancel) {
      if (removeIfEmpty) boardModifiers.deleteItems(new Set([item.id]));
      titleRef.current = null;
    }
  }, [editState, stateManager, item, editFirstLineOnly, rawParts, isNewChild]);

  const path = useNestedEntityPath();
  const { onEditDate, onEditTime } = useDatePickers(item);
  const onEnter = useCallback(
    (cm: EditorView, mod: boolean, shift: boolean) => {
      if (!allowNewLine(stateManager, mod, shift)) {
        setEditState(EditingState.complete);
        return true;
      }
    },
    [stateManager]
  );

  const onWrapperClick = useCallback(
    (e: MouseEvent) => {
      if (e.targetNode.instanceOf(HTMLElement)) {
        if (e.targetNode.hasClass(c('item-metadata-date'))) {
          onEditDate(e);
        } else if (e.targetNode.hasClass(c('item-metadata-time'))) {
          onEditTime(e);
        }
      }
    },
    [onEditDate, onEditTime]
  );

  const onSubmit = useCallback(() => setEditState(EditingState.complete), []);

  const onEscape = useCallback(() => {
    setEditState(EditingState.cancel);
    return true;
  }, [item]);

  const onCheckboxContainerClick = useCallback(
    (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      if (target.hasClass('task-list-item-checkbox')) {
        if (target.dataset.src) {
          return;
        }

        const checkboxIndex = parseInt(target.dataset.checkboxIndex, 10);
        const checked = checkCheckbox(stateManager, item.data.titleRaw, checkboxIndex);
        const updated = stateManager.updateItemContent(item, checked);

        boardModifiers.updateItem(path, updated);
      }
    },
    [path, boardModifiers, stateManager, item]
  );

  if (!isStatic && isEditing(editState)) {
    return (
      <div className={c('item-input-wrapper')}>
        <MarkdownEditor
          editState={editState}
          className={c('item-input')}
          onEnter={onEnter}
          onEscape={onEscape}
          onSubmit={onSubmit}
          value={
            isNewChild
              ? `\n\n${item.data.titleRaw}`
              : editFirstLineOnly
                ? rawParts.first
                : item.data.titleRaw
          }
          onChange={(update) => {
            if (update.docChanged) {
              titleRef.current = update.state.doc.toString().trim();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div onClick={onWrapperClick} className={c('item-title')}>
      {isStatic ? (
        <MarkdownClonedPreviewRenderer
          entityId={item.id}
          className={markdownClassName}
          markdownString={displayMarkdown}
          searchQuery={searchQuery}
          onPointerUp={onCheckboxContainerClick}
        />
      ) : (
        <MarkdownRenderer
          entityId={item.id}
          className={markdownClassName}
          markdownString={displayMarkdown}
          searchQuery={searchQuery}
          onPointerUp={onCheckboxContainerClick}
        />
      )}
      {showMetadata && (
        <div className={c('item-metadata')}>
          <RelativeDate item={item} stateManager={stateManager} />
          <DateAndTime
            item={item}
            stateManager={stateManager}
            filePath={filePath}
            getDateColor={getDateColor}
          />
          <InlineMetadata item={item} stateManager={stateManager} />
          <Tags tags={item.data.metadata.tags} searchQuery={searchQuery} />
        </div>
      )}
    </div>
  );
});
