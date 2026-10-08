import { useContext, useMemo } from 'preact/compat';
import { t } from 'src/lang/helpers';

import { Icon } from '../Icon/Icon';
import { KanbanContext, SearchContext, SelectionContext } from '../context';
import { c } from '../helpers';
import { showBulkMenu } from './BulkMenu';
import { resolveSelection, useSelectedIds } from './SelectionManager';

/** Shows how many cards are selected, with buttons for the bulk menu and to clear. */
export function SelectionBar() {
  const { stateManager, boardModifiers } = useContext(KanbanContext);
  const selection = useContext(SelectionContext);
  const search = useContext(SearchContext);
  const ids = useSelectedIds(selection);
  const board = stateManager.useState();

  const { count, hidden } = useMemo(() => {
    if (!board || !ids.size) return { count: 0, hidden: 0 };
    const selected = resolveSelection(board, ids);
    const hidden = search?.query
      ? selected.filter(({ item }) => !search.items.has(item)).length
      : 0;
    return { count: selected.length, hidden };
  }, [board, ids, search]);

  if (!selection || !count) return null;

  return (
    <div className={c('selection-bar')}>
      <span className={c('selection-bar-count')}>
        {count} {t('cards selected')}
        {hidden > 0 && ` (${hidden} ${t('hidden')})`}
      </span>
      {count > 1 && (
        <button
          className={c('selection-bar-button')}
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            showBulkMenu(
              { x: rect.left, y: rect.top },
              { stateManager, boardModifiers, selection }
            );
          }}
        >
          {t('Actions')}
        </button>
      )}
      <button
        className={`clickable-icon ${c('selection-bar-clear')}`}
        aria-label={t('Clear selection')}
        onClick={() => selection.clear()}
      >
        <Icon name="lucide-x" />
      </button>
    </div>
  );
}
