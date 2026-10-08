import update from 'immutability-helper';
import { moment } from 'obsidian';
import { KanbanView } from 'src/KanbanView';
import { StateManager } from 'src/StateManager';
import { Path } from 'src/dnd/types';
import {
  appendEntities,
  getEntityFromPath,
  insertEntity,
  moveEntity,
  prependEntities,
  removeEntity,
  updateEntity,
  updateParentEntity,
} from 'src/dnd/util/data';

import { resolveSelection } from '../components/Selection/SelectionManager';
import { generateInstanceId, maybeCompleteForMove } from '../components/helpers';
import { Board, DataTypes, Item, Lane } from '../components/types';
import { getTaskStatusDone, toggleTask } from '../parsers/helpers/inlineMetadata';

export interface BoardModifiers {
  appendItems: (path: Path, items: Item[]) => void;
  prependItems: (path: Path, items: Item[]) => void;
  insertItems: (path: Path, items: Item[]) => void;
  replaceItem: (path: Path, items: Item[]) => void;
  splitItem: (path: Path, items: Item[]) => void;
  moveItemToTop: (path: Path) => void;
  moveItemToBottom: (path: Path) => void;
  addLane: (lane: Lane) => void;
  insertLane: (path: Path, lane: Lane) => void;
  updateLane: (path: Path, lane: Lane) => void;
  archiveLane: (path: Path) => void;
  archiveLaneItems: (path: Path) => void;
  deleteEntity: (path: Path) => void;
  updateItem: (path: Path, item: Item) => void;
  archiveItem: (path: Path) => void;
  duplicateEntity: (path: Path) => void;
  // Bulk actions on selected cards. Each one is a single board update (one save).
  moveItemsToLane: (ids: Set<string>, laneIndex: number) => void;
  archiveItems: (ids: Set<string>) => void;
  deleteItems: (ids: Set<string>) => void;
  setItemsDone: (ids: Set<string>, done: boolean) => void;
  setItemsBlockIds: (blockIds: Map<string, string>) => void;
}

export function getBoardModifiers(view: KanbanView, stateManager: StateManager): BoardModifiers {
  const appendArchiveDate = (item: Item) => {
    const archiveDateFormat = stateManager.getSetting('archive-date-format');
    const archiveDateSeparator = stateManager.getSetting('archive-date-separator');
    const archiveDateAfterTitle = stateManager.getSetting('append-archive-date');

    const newTitle = [moment().format(archiveDateFormat)];

    if (archiveDateSeparator) newTitle.push(archiveDateSeparator);

    newTitle.push(item.data.titleRaw);

    if (archiveDateAfterTitle) newTitle.reverse();

    const titleRaw = newTitle.join(' ');
    return stateManager.updateItemContent(item, titleRaw);
  };

  return {
    appendItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => appendEntities(boardData, path, items));
    },

    prependItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => prependEntities(boardData, path, items));
    },

    insertItems: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => insertEntity(boardData, path, items));
    },

    replaceItem: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) =>
        insertEntity(removeEntity(boardData, path), path, items)
      );
    },

    splitItem: (path: Path, items: Item[]) => {
      stateManager.setState((boardData) => {
        return insertEntity(removeEntity(boardData, path), path, items);
      });
    },

    moveItemToTop: (path: Path) => {
      stateManager.setState((boardData) => moveEntity(boardData, path, [path[0], 0]));
    },

    moveItemToBottom: (path: Path) => {
      stateManager.setState((boardData) => {
        const laneIndex = path[0];
        const lane = boardData.children[laneIndex];
        return moveEntity(boardData, path, [laneIndex, lane.children.length]);
      });
    },

    addLane: (lane: Lane) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('list-collapse') || [];
        const op = (collapseState: boolean[]) => {
          const newState = [...collapseState];
          newState.push(false);
          return newState;
        };

        view.setViewState('list-collapse', undefined, op);
        return update<Board>(appendEntities(boardData, [], [lane]), {
          data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    insertLane: (path: Path, lane: Lane) => {
      stateManager.setState((boardData) => {
        const collapseState = view.getViewState('list-collapse');
        const op = (collapseState: boolean[]) => {
          const newState = [...collapseState];
          newState.splice(path.last(), 0, false);
          return newState;
        };

        view.setViewState('list-collapse', undefined, op);

        return update<Board>(insertEntity(boardData, path, [lane]), {
          data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
        });
      });
    },

    updateLane: (path: Path, lane: Lane) => {
      stateManager.setState((boardData) =>
        updateParentEntity(boardData, path, {
          children: {
            [path[path.length - 1]]: {
              $set: lane,
            },
          },
        })
      );
    },

    archiveLane: (path: Path) => {
      stateManager.setState((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        try {
          const collapseState = view.getViewState('list-collapse');
          const op = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            newState.splice(path.last(), 1);
            return newState;
          };
          view.setViewState('list-collapse', undefined, op);

          return update<Board>(removeEntity(boardData, path), {
            data: {
              settings: { 'list-collapse': { $set: op(collapseState) } },
              archive: {
                $unshift: stateManager.getSetting('archive-with-date')
                  ? items.map(appendArchiveDate)
                  : items,
              },
            },
          });
        } catch (e) {
          stateManager.setError(e);
          return boardData;
        }
      });
    },

    archiveLaneItems: (path: Path) => {
      stateManager.setState((boardData) => {
        const lane = getEntityFromPath(boardData, path);
        const items = lane.children;

        try {
          return update(
            updateEntity(boardData, path, {
              children: {
                $set: [],
              },
            }),
            {
              data: {
                archive: {
                  $unshift: stateManager.getSetting('archive-with-date')
                    ? items.map(appendArchiveDate)
                    : items,
                },
              },
            }
          );
        } catch (e) {
          stateManager.setError(e);
          return boardData;
        }
      });
    },

    deleteEntity: (path: Path) => {
      stateManager.setState((boardData) => {
        const entity = getEntityFromPath(boardData, path);

        if (entity.type === DataTypes.Lane) {
          const collapseState = view.getViewState('list-collapse');
          const op = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            newState.splice(path.last(), 1);
            return newState;
          };
          view.setViewState('list-collapse', undefined, op);

          return update<Board>(removeEntity(boardData, path), {
            data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
          });
        }

        return removeEntity(boardData, path);
      });
    },

    updateItem: (path: Path, item: Item) => {
      stateManager.setState((boardData) => {
        return updateParentEntity(boardData, path, {
          children: {
            [path[path.length - 1]]: {
              $set: item,
            },
          },
        });
      });
    },

    archiveItem: (path: Path) => {
      stateManager.setState((boardData) => {
        const item = getEntityFromPath(boardData, path);
        try {
          return update(removeEntity(boardData, path), {
            data: {
              archive: {
                $push: [
                  stateManager.getSetting('archive-with-date') ? appendArchiveDate(item) : item,
                ],
              },
            },
          });
        } catch (e) {
          stateManager.setError(e);
          return boardData;
        }
      });
    },

    duplicateEntity: (path: Path) => {
      stateManager.setState((boardData) => {
        const entity = getEntityFromPath(boardData, path);
        const entityWithNewID = update(entity, {
          id: {
            $set: generateInstanceId(),
          },
        });

        if (entity.type === DataTypes.Lane) {
          const collapseState = view.getViewState('list-collapse');
          const op = (collapseState: boolean[]) => {
            const newState = [...collapseState];
            newState.splice(path.last(), 0, collapseState[path.last()]);
            return newState;
          };
          view.setViewState('list-collapse', undefined, op);

          return update<Board>(insertEntity(boardData, path, [entityWithNewID]), {
            data: { settings: { 'list-collapse': { $set: op(collapseState) } } },
          });
        }

        return insertEntity(boardData, path, [entityWithNewID]);
      });
    },

    // Cards already in the target list stay where they are. The others keep their board order.
    moveItemsToLane: (ids: Set<string>, laneIndex: number) => {
      stateManager.setState((boardData) => {
        const toMove = resolveSelection(boardData, ids).filter((s) => s.path[0] !== laneIndex);
        if (!toMove.length || !boardData.children[laneIndex]) return boardData;

        const moved: Item[] = [];
        const replacements: Array<Item | undefined> = [];

        toMove.forEach(({ item, path }) => {
          const { next, replacement } = maybeCompleteForMove(
            stateManager,
            boardData,
            path,
            stateManager,
            boardData,
            [laneIndex, 0],
            item
          );
          moved.push(next);
          replacements.push(replacement);
        });

        let board = boardData;
        // Remove from the end so earlier paths stay valid
        for (let i = toMove.length - 1; i >= 0; i--) {
          board = removeEntity(board, toMove[i].path, replacements[i]) as Board;
        }

        const insertionMethod = stateManager.getSetting('new-card-insertion-method') || 'append';
        // These helpers take a child path; the last index is ignored
        board = (
          insertionMethod === 'append'
            ? appendEntities(board, [laneIndex, 0], moved)
            : prependEntities(board, [laneIndex, 0], moved)
        ) as Board;

        if (board.children[laneIndex].data.sorted !== undefined) {
          board = updateEntity(board, [laneIndex], { data: { $unset: ['sorted'] } }) as Board;
        }

        return board;
      });
    },

    archiveItems: (ids: Set<string>) => {
      stateManager.setState((boardData) => {
        const selected = resolveSelection(boardData, ids);
        if (!selected.length) return boardData;

        try {
          let board = boardData;
          for (let i = selected.length - 1; i >= 0; i--) {
            board = removeEntity(board, selected[i].path) as Board;
          }

          const withDate = stateManager.getSetting('archive-with-date');
          return update(board, {
            data: {
              archive: {
                $push: selected.map(({ item }) => (withDate ? appendArchiveDate(item) : item)),
              },
            },
          });
        } catch (e) {
          stateManager.setError(e);
          return boardData;
        }
      });
    },

    deleteItems: (ids: Set<string>) => {
      stateManager.setState((boardData) => {
        const selected = resolveSelection(boardData, ids);
        let board = boardData;
        for (let i = selected.length - 1; i >= 0; i--) {
          board = removeEntity(board, selected[i].path) as Board;
        }
        return board;
      });
    },

    // Same toggle as the card checkbox, including recurring tasks from the Tasks plugin
    setItemsDone: (ids: Set<string>, done: boolean) => {
      stateManager.setState((boardData) => {
        const selected = resolveSelection(boardData, ids);
        let board = boardData;

        for (let i = selected.length - 1; i >= 0; i--) {
          const { item, path } = selected[i];
          if (!!item.data.checked === done) continue;

          const updates = toggleTask(item, stateManager.file);
          if (updates) {
            const [itemStrings, checkChars, thisIndex] = updates;
            const replacements: Item[] = itemStrings.map((str, j) => {
              const next = stateManager.getNewItem(str, checkChars[j]);
              if (j === thisIndex) next.id = item.id;
              return next;
            });
            board = insertEntity(removeEntity(board, path), path, replacements) as Board;
          } else {
            board = updateEntity(board, path, {
              data: {
                checked: { $set: done },
                checkChar: { $set: done ? getTaskStatusDone() : ' ' },
              },
            }) as Board;
          }
        }

        return board;
      });
    },

    // Adds block ids (card id -> block id) to cards that don't have one yet
    setItemsBlockIds: (blockIds: Map<string, string>) => {
      stateManager.setState((boardData) => {
        const selected = resolveSelection(boardData, new Set(blockIds.keys())).filter(
          ({ item }) => !item.data.blockId
        );
        if (!selected.length) return boardData;

        let board = boardData;
        selected.forEach(({ item, path }) => {
          const next = stateManager.updateItemContent(
            update(item, { data: { blockId: { $set: blockIds.get(item.id) } } }),
            item.data.titleRaw
          );
          board = updateParentEntity(board, path, {
            children: { [path[path.length - 1]]: { $set: next } },
          }) as Board;
        });

        return board;
      });
    },
  };
}
