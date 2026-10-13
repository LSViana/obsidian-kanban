import classcat from 'classcat';
import { memo, useContext, useEffect, useMemo, useRef, useState } from 'preact/compat';
import { t } from 'src/lang/helpers';

import { Icon } from '../Icon/Icon';
import { ItemInner } from '../Item/Item';
import { getItemClassModifiers } from '../Item/helpers';
import { useIsSelected } from '../Selection/SelectionManager';
import { ArchivedItemContext, KanbanContext, SearchContext, SelectionContext } from '../context';
import { c } from '../helpers';
import { Item } from '../types';
import { showArchiveColumnMenu } from './ArchiveMenu';

const PAGE_SIZE = 20;

interface ArchivedCardProps {
  item: Item;
  searchQuery?: string;
}

// Same card as in the lists (click, double-click, menu, selection), without drag and drop
const ArchivedCard = memo(function ArchivedCard({ item, searchQuery }: ArchivedCardProps) {
  const selection = useContext(SelectionContext);
  const isSelected = useIsSelected(selection, item.id);
  const isMatch = searchQuery ? !!item.data.titleSearch?.includes(searchQuery) : false;

  return (
    <div className={c('item-wrapper')} data-selectable-id={selection ? item.id : undefined}>
      <div
        className={classcat([
          c('item'),
          c('archived-item'),
          ...getItemClassModifiers(item),
          { 'is-selected': isSelected },
        ])}
      >
        <ItemInner item={item} isMatch={isMatch} searchQuery={searchQuery} />
      </div>
    </div>
  );
});

/**
 * A column that lists the board's archived cards, newest first. It renders one page of
 * cards and adds the next page when the user scrolls near the end of the list.
 */
export function ArchiveColumn() {
  const { stateManager, boardModifiers, view } = useContext(KanbanContext);
  const search = useContext(SearchContext);
  const selection = useContext(SelectionContext);
  const board = stateManager.useState();
  const laneWidth = stateManager.useSetting('lane-width');

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const archive = board?.data.archive ?? [];
  const query = search?.query;

  // The archive keeps the oldest card first, so reverse it to show the newest first
  const newestFirst = useMemo(() => {
    const items = [...archive].reverse();
    if (!query) return items;
    return items.filter((item) =>
      (item.data.titleSearch || item.data.titleRaw.toLocaleLowerCase()).includes(query)
    );
  }, [archive, query]);

  const visibleItems = newestFirst.slice(0, visibleCount);
  const hasMore = visibleCount < newestFirst.length;

  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;

    const win = root.win as Window & typeof globalThis;
    const observer = new win.IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => count + PAGE_SIZE);
        }
      },
      { root, rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  return (
    <div
      className={classcat([c('lane-wrapper'), c('archive-lane-wrapper')])}
      style={laneWidth ? { width: `${laneWidth}px` } : undefined}
    >
      <div className={classcat([c('lane'), c('archive-lane')])}>
        <div className={c('lane-header-wrapper')}>
          <Icon name="lucide-archive" />
          <div className={c('lane-title')}>
            <div className={c('lane-title-text')}>{t('Archived')}</div>
          </div>
          <div className={c('lane-title-count')}>{archive.length}</div>
          <div className={c('lane-settings-button-wrapper')}>
            <a
              aria-label={t('More options')}
              className={`${c('lane-settings-button')} clickable-icon`}
              onClick={(e) =>
                showArchiveColumnMenu(
                  { x: e.clientX, y: e.clientY },
                  {
                    stateManager,
                    boardModifiers,
                    selection,
                    hideColumn: () => view.toggleArchivedColumn(),
                  }
                )
              }
            >
              <Icon name="lucide-more-vertical" />
            </a>
          </div>
        </div>
        <ArchivedItemContext.Provider value={true}>
          <div ref={listRef} className={classcat([c('lane-items'), c('archive-lane-items')])}>
            {visibleItems.map((item) => (
              <ArchivedCard key={item.id} item={item} searchQuery={query} />
            ))}
            {!newestFirst.length && (
              <div className={c('archive-lane-empty')}>{t('No archived cards')}</div>
            )}
            {hasMore && <div ref={sentinelRef} className={c('archive-lane-sentinel')} />}
          </div>
        </ArchivedItemContext.Provider>
      </div>
    </div>
  );
}
