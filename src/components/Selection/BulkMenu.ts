import { App, Menu, Modal, Platform } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { t } from 'src/lang/helpers';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { c, generateInstanceId } from '../helpers';
import { SelectionManager, resolveSelection } from './SelectionManager';

class ConfirmModal extends Modal {
  constructor(
    app: App,
    private message: string,
    private confirmText: string,
    private onConfirm: () => void
  ) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass(c('confirm-modal'));
    this.setTitle(t('Confirm action'));
    this.contentEl.createEl('p', { text: this.message });

    const buttons = this.contentEl.createDiv('modal-button-container');
    const confirm = buttons.createEl('button', { text: this.confirmText, cls: 'mod-warning' });
    confirm.addEventListener('click', () => {
      this.close();
      this.onConfirm();
    });

    const cancel = buttons.createEl('button', { text: t('Cancel') });
    cancel.addEventListener('click', () => this.close());

    confirm.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}

function confirmIfMany(
  app: App,
  count: number,
  message: string,
  confirmText: string,
  action: () => void
) {
  if (count <= 1) {
    action();
    return;
  }
  new ConfirmModal(app, message, confirmText, action).open();
}

interface BulkMenuParams {
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
  selection: SelectionManager;
}

/**
 * Card menu for two or more selected cards. Actions run on every selected card as one board
 * update. Actions that only make sense for one card are shown disabled.
 */
export function showBulkMenu(position: { x: number; y: number }, params: BulkMenuParams) {
  const { stateManager, boardModifiers, selection } = params;
  const app = stateManager.app;
  const ids = selection.getIds();
  const selected = resolveSelection(stateManager.state, ids);
  const count = selected.length;
  if (!count) return;

  const anyNotDone = selected.some(({ item }) => !item.data.checked);

  const menu = new Menu();

  menu.addItem((i) => {
    i.setIcon('lucide-info')
      .setTitle(`${count} ${t('cards selected')}`)
      .setDisabled(true);
    (i as any).dom?.addClass(c('menu-note'));
  });
  menu.addSeparator();

  menu.addItem((i) => {
    i.setIcon('lucide-link')
      .setTitle(t('Copy links to cards'))
      .onClick(() => {
        const blockIds = new Map<string, string>();
        selected.forEach(({ item }) => {
          blockIds.set(item.id, item.data.blockId || generateInstanceId(6));
        });

        const links = selected.map(({ item }) =>
          app.fileManager.generateMarkdownLink(stateManager.file, '', '#^' + blockIds.get(item.id))
        );

        navigator.clipboard.writeText(links.join('\n'));
        boardModifiers.setItemsBlockIds(blockIds);
      });
  });

  menu.addSeparator();

  menu.addItem((i) => {
    i.setIcon(anyNotDone ? 'lucide-check-square' : 'lucide-square')
      .setTitle(anyNotDone ? t('Mark as done') : t('Mark as not done'))
      .onClick(() => boardModifiers.setItemsDone(ids, anyNotDone));
  });

  const addMoveToOptions = (target: Menu) => {
    const lanes = stateManager.state.children;
    lanes.forEach((lane, laneIndex) => {
      target.addItem((i) =>
        i
          .setIcon('lucide-square-kanban')
          .setChecked(selected.every(({ path }) => path[0] === laneIndex))
          .setTitle(lane.data.title)
          .onClick(() => boardModifiers.moveItemsToLane(ids, laneIndex))
      );
    });
  };

  if (stateManager.state.children.length > 1) {
    if (Platform.isPhone) {
      menu.addSeparator();
      addMoveToOptions(menu);
      menu.addSeparator();
    } else {
      menu.addItem((i) => {
        const submenu = (i as any)
          .setTitle(t('Move to list'))
          .setIcon('lucide-square-kanban')
          .setSubmenu();
        addMoveToOptions(submenu);
      });
    }
  }

  menu
    .addItem((i) => {
      i.setIcon('lucide-archive')
        .setTitle(t('Archive cards'))
        .onClick(() =>
          confirmIfMany(
            app,
            count,
            t('Archive the selected cards?'),
            `${t('Archive')} ${count}`,
            () => boardModifiers.archiveItems(ids)
          )
        );
    })
    .addItem((i) => {
      i.setIcon('lucide-trash-2')
        .setTitle(t('Delete cards'))
        .onClick(() =>
          confirmIfMany(
            app,
            count,
            t('Delete the selected cards? This cannot be undone.'),
            `${t('Delete')} ${count}`,
            () => boardModifiers.deleteItems(ids)
          )
        );
    });

  menu.addSeparator();

  const singleCardOnly: Array<[string, Parameters<typeof t>[0]]> = [
    ['lucide-edit', 'Edit card'],
    ['lucide-maximize-2', 'Open card'],
    ['lucide-file-plus-2', 'New note from card'],
    ['lucide-list-tree', 'Add child card'],
    ['lucide-list-start', 'Insert card before'],
    ['lucide-list-end', 'Insert card after'],
  ];

  singleCardOnly.forEach(([icon, title]) => {
    menu.addItem((i) => i.setIcon(icon).setTitle(t(title)).setDisabled(true));
  });

  // Same font and text indent as the items above, with a blank icon slot
  menu.addItem((i) => {
    i.setIcon('lucide-info').setTitle(t('Some actions work on one card only')).setDisabled(true);
    (i as any).dom?.addClass(c('menu-note'), c('menu-note-footer'));
  });

  menu.showAtPosition(position);
}
