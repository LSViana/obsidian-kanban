import { Menu, Platform } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { t } from 'src/lang/helpers';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { confirmIfMany } from '../Selection/BulkMenu';
import { SelectionManager } from '../Selection/SelectionManager';
import { c } from '../helpers';

interface ArchiveMenuParams {
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
}

// Archived cards from ids that are still in the archive
function countArchived(stateManager: StateManager, ids: Set<string>) {
  return stateManager.state.data.archive.filter((item) => ids.has(item.id)).length;
}

// Adds a "pick a list" entry. Desktop shows the lists in a submenu, phones show them inline.
function addUnarchiveToList(
  menu: Menu,
  title: string,
  stateManager: StateManager,
  onPick: (laneIndex: number) => void
) {
  const lanes = stateManager.state.children;
  const addLanes = (target: Menu) => {
    lanes.forEach((lane, laneIndex) => {
      target.addItem((i) =>
        i
          .setIcon('lucide-square-kanban')
          .setTitle(lane.data.title)
          .onClick(() => onPick(laneIndex))
      );
    });
  };

  if (!lanes.length || Platform.isPhone) {
    menu.addItem((i) => i.setIcon('lucide-archive-restore').setTitle(title).setDisabled(true));
    addLanes(menu);
    menu.addSeparator();
    return;
  }

  menu.addItem((i) => {
    const submenu = (i as any).setTitle(title).setIcon('lucide-archive-restore').setSubmenu();
    addLanes(submenu);
  });
}

/** Deletes archived cards. Asks first when more than one card is affected. */
export function deleteArchivedCards(
  { stateManager, boardModifiers }: ArchiveMenuParams,
  ids: Set<string>
) {
  const count = countArchived(stateManager, ids);
  if (!count) return;

  confirmIfMany(
    stateManager.app,
    count,
    t('Delete the selected archived cards? This cannot be undone.'),
    `${t('Delete')} ${count}`,
    () => boardModifiers.deleteArchivedItems(ids)
  );
}

interface ArchivedCardsMenuParams extends ArchiveMenuParams {
  ids: Set<string>;
  openCard?: () => void;
  editCard?: () => void;
}

/** Card menu for one archived card, or for every selected archived card. */
export function showArchivedCardsMenu(
  position: { x: number; y: number },
  params: ArchivedCardsMenuParams
) {
  const { stateManager, boardModifiers, ids, openCard, editCard } = params;
  const count = countArchived(stateManager, ids);
  if (!count) return;

  const menu = new Menu();

  if (count > 1) {
    menu.addItem((i) => {
      i.setIcon('lucide-info')
        .setTitle(`${count} ${t('cards selected')}`)
        .setDisabled(true);
      (i as any).dom?.addClass(c('menu-note'));
    });
    menu.addSeparator();
  }

  addUnarchiveToList(
    menu,
    count > 1 ? t('Unarchive cards') : t('Unarchive card'),
    stateManager,
    (laneIndex) => boardModifiers.restoreArchivedItems(ids, laneIndex)
  );

  menu.addItem((i) =>
    i
      .setIcon('lucide-edit')
      .setTitle(t('Edit card'))
      .setDisabled(count > 1 || !editCard)
      .onClick(() => editCard?.())
  );
  menu.addItem((i) =>
    i
      .setIcon('lucide-maximize-2')
      .setTitle(t('Open card'))
      .setDisabled(count > 1 || !openCard)
      .onClick(() => openCard?.())
  );

  menu.addSeparator();

  menu.addItem((i) =>
    i
      .setIcon('lucide-trash-2')
      .setTitle(count > 1 ? t('Delete cards') : t('Delete card'))
      .setWarning(true)
      .onClick(() => deleteArchivedCards(params, ids))
  );

  menu.showAtPosition(position);
}

interface ArchiveColumnMenuParams extends ArchiveMenuParams {
  selection: SelectionManager | null;
  hideColumn: () => void;
}

/** Menu of the Archived column header. */
export function showArchiveColumnMenu(
  position: { x: number; y: number },
  { stateManager, boardModifiers, selection, hideColumn }: ArchiveColumnMenuParams
) {
  const archive = stateManager.state.data.archive;
  const hasSelection = !!selection?.isArchived;
  // Selected archived cards when there are any, otherwise the whole archive
  const ids = hasSelection ? selection.getIds() : new Set(archive.map((item) => item.id));
  const count = countArchived(stateManager, ids);

  const menu = new Menu();

  menu.addItem((i) =>
    i.setIcon('lucide-eye-off').setTitle(t('Hide archived cards')).onClick(hideColumn)
  );

  if (count) {
    addUnarchiveToList(menu, t('Unarchive cards'), stateManager, (laneIndex) => {
      if (hasSelection) {
        boardModifiers.restoreArchivedItems(ids, laneIndex);
        return;
      }
      confirmIfMany(
        stateManager.app,
        count,
        t('Unarchive all archived cards?'),
        `${t('Unarchive')} ${count}`,
        () => boardModifiers.restoreArchivedItems(ids, laneIndex)
      );
    });
  } else {
    menu.addItem((i) =>
      i.setIcon('lucide-archive-restore').setTitle(t('Unarchive cards')).setDisabled(true)
    );
  }

  menu.addItem((i) => {
    i.setIcon('lucide-info')
      .setTitle(t('Cards are sorted by archive date (newest first).'))
      .setDisabled(true);
    (i as any).dom?.addClass(c('menu-note'), c('menu-note-footer'), c('menu-note-secondary'));
  });

  menu.showAtPosition(position);
}
