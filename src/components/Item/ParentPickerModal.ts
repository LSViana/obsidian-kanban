import update from 'immutability-helper';
import { App, FuzzySuggestModal, Menu } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';
import { parentFieldRegex } from 'src/parsers/formats/list';

import { BoardModifiers } from '../../helpers/boardModifiers';
import { generateInstanceId } from '../helpers';
import { Item } from '../types';
import { getFamilyIds, getFamilyIndex, getPlainTitle } from './FamilyBadges';

interface FamilyMenuParams {
  item: Item;
  path: Path;
  stateManager: StateManager;
  boardModifiers: BoardModifiers;
}

interface CardChoice {
  item: Item;
  path: Path;
  title: string;
  laneTitle: string;
}

function removeParentField(titleRaw: string) {
  return titleRaw
    .replace(parentFieldRegex, (_, lead) => (lead === '\n' ? lead : ''))
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '');
}

function setParentField(titleRaw: string, blockId: string) {
  const lines = removeParentField(titleRaw).split('\n');
  const field = `parent:: [[#^${blockId}]]`;
  lines[0] = lines[0] ? `${lines[0]} ${field}` : field;
  return lines.join('\n');
}

// Returns the card's block ID, adding one to the card if it has none
function ensureBlockId(params: FamilyMenuParams, target: Item, targetPath: Path) {
  if (target.data.blockId) return target.data.blockId;

  const { stateManager, boardModifiers } = params;
  const id = generateInstanceId(6);

  boardModifiers.updateItem(
    targetPath,
    stateManager.updateItemContent(
      update(target, { data: { blockId: { $set: id } } }),
      target.data.titleRaw
    )
  );

  return id;
}

class ParentPickerModal extends FuzzySuggestModal<CardChoice> {
  constructor(
    app: App,
    private choices: CardChoice[],
    private onPick: (choice: CardChoice) => void
  ) {
    super(app);
    this.setPlaceholder(t('Choose a parent card'));
  }

  getItems() {
    return this.choices;
  }

  getItemText(choice: CardChoice) {
    return `${choice.title} (${choice.laneTitle})`;
  }

  onChooseItem(choice: CardChoice) {
    this.onPick(choice);
  }
}

function getParentChoices(params: FamilyMenuParams): CardChoice[] {
  const board = params.stateManager.state;
  const index = getFamilyIndex(board);
  // A card can't be the parent of itself or of one of its ancestors
  const excluded = new Set(
    [...getFamilyIds(index, params.item.id)].filter(
      (id) => id === params.item.id || isDescendant(index, params.item.id, id)
    )
  );

  const choices: CardChoice[] = [];
  board.children.forEach((lane, laneIndex) => {
    lane.children.forEach((item, itemIndex) => {
      if (excluded.has(item.id)) return;
      choices.push({
        item,
        path: [laneIndex, itemIndex],
        title: getPlainTitle(item) || t('Untitled card'),
        laneTitle: lane.data.title,
      });
    });
  });

  return choices;
}

function isDescendant(index: ReturnType<typeof getFamilyIndex>, rootId: string, id: string) {
  let current = index.get(id)?.parentId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    if (current === rootId) return true;
    seen.add(current);
    current = index.get(current)?.parentId;
  }
  return false;
}

export function addFamilyMenuItems(menu: Menu, params: FamilyMenuParams) {
  const { item, path, stateManager, boardModifiers } = params;

  menu.addItem((i) => {
    i.setIcon('lucide-list-tree')
      .setTitle(t('Add child card'))
      .onClick(() => {
        const blockId = ensureBlockId(params, item, path);
        const newPath = [...path];
        newPath[newPath.length - 1] = newPath[newPath.length - 1] + 1;

        boardModifiers.insertItems(newPath, [
          stateManager.getNewItem(`parent:: [[#^${blockId}]]`, ' ', true),
        ]);
      });
  });

  menu.addItem((i) => {
    i.setIcon('lucide-corner-down-right')
      .setTitle(t('Set parent…'))
      .onClick(() => {
        new ParentPickerModal(stateManager.app, getParentChoices(params), (choice) => {
          const blockId = ensureBlockId(params, choice.item, choice.path);
          boardModifiers.updateItem(
            path,
            stateManager.updateItemContent(item, setParentField(item.data.titleRaw, blockId))
          );
        }).open();
      });
  });

  if (item.data.metadata.parentBlockId) {
    menu.addItem((i) => {
      i.setIcon('lucide-unlink')
        .setTitle(t('Remove parent'))
        .onClick(() => {
          boardModifiers.updateItem(
            path,
            stateManager.updateItemContent(item, removeParentField(item.data.titleRaw))
          );
        });
    });
  }
}
