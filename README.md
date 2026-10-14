
# Obsidian Kanban Plugin

## New features in fork

This fork adds the features below on top of the original plugin. Each item shows the version it first shipped in. "Unreleased" means it is on the main branch but not in a release yet.

New settings are off by default unless noted. You can find them in the plugin settings, and most of them can also be set per board from the board settings.

### Card pop-up

<!-- ![Card pop-up](docs/Assets/fork-card-popup.png) -->

- **Open a card in a pop-up (2.1.0).** Right-click a card and pick "Open card" to edit it in a larger window. The pop-up shows the card's dates, tags and linked note. Changes save as you type. Press Esc or Ctrl+Enter, or click outside, to close it.
- **Open on single click (2.1.0).** Turn on "Open card on single click" to open the pop-up with one click. Double-click still edits the card in place.
- **Title bar and tag footer (2.1.0).** The pop-up shows the list name at the top and the card's tags at the bottom. Each tag is shown once.
- **Hotkeys work in the pop-up (2.1.0).** Your Obsidian hotkeys keep working while the pop-up is open.
- **Search inside a card (2.1.0).** Press Ctrl+F (or your "Search current file" hotkey), or click the search button in the pop-up header, to search the card text. Search and replace works too.

### Showing cards

- **Show only the card title (2.1.0).** Turn on "Show only the first line of cards" to keep long cards short. If a card has a blank line, the board shows only the lines above it, plus a faint "..." to hint at more. The rest is still there in the pop-up. Cards without a blank line show in full. In the unreleased version, every line above the blank line counts as the title, not only the first one.

### Parent and child cards

<!-- ![Parent and child cards](docs/Assets/fork-child-cards.png) -->

- **Link cards as parent and child (2.1.0).** Right-click a card and pick "Add child card", "Set parent…" or "Remove parent". A child card stores a `parent::` link to its parent in its text.
- **Family badges (2.1.0).** A child shows a badge for its parent. A parent shows how many children are done, like "2/5 done". The badge turns green when all children are done.
- **Highlight on hover (2.1.0, refined in unreleased).** Hover a parent badge to light up the card, its siblings and its parents. Hover the "n/m done" badge to light up the card and all its children.
- **Archived children (2.1.0).** Archived child cards still count toward the parent's total. Turn on "Count archived child cards as done" to also count them as done.
- **Child list (2.2.0).** Click the "n/m done" badge to see the children, grouped by list, plus archived ones. Pick a child to jump to it. If card checkboxes are shown, you can check children off from the list.
- **Room to type for new children (2.2.0).** "Add child card" opens with the cursor ready. If you leave it empty or press Esc, the new card is removed.

### Selecting several cards

<!-- ![Selecting cards](docs/Assets/fork-multi-select.png) -->

- **Select cards (2.1.0).** Ctrl+click (Cmd+click on macOS) cards, or drag a box on empty board space. Right-click a selected card to copy links, mark done, move to a list, archive or delete them all at once. Drag a selected card to move the whole group.
- **Delete key (2.2.0).** Press Del (Backspace on macOS) to delete the selected cards. It asks first when more than one card is selected.
- **Copy by dragging (2.2.0).** Hold Alt (Option on macOS) while dragging to copy cards instead of moving them. Copied parent and child cards stay linked. This works within the same board.

### Archive

<!-- ![Archived column](docs/Assets/fork-archived-column.png) -->

- **Archived column (unreleased).** Click the archive button in the board header, or use the board menu, to show an "Archived" column after your lists. It shows the newest cards first and loads more as you scroll. You can open, edit, check and select archived cards, but not drag them. Right-click a card to unarchive it into a list you pick (it goes to the bottom), edit it, open it or delete it. The column menu can unarchive the selected cards, or all of them after asking. Each board remembers whether the column is shown. The "Show archived cards" setting hides the header button. It is on by default.
- **Archive keeps card order (unreleased).** "Archive cards" and "Archive list" now add cards to the archive in list order, so the oldest ones are trimmed first when the archive is full.
- **Clearer confirmations (unreleased).** "Archive cards", "Archive list" and "Delete list" now ask in a centered dialog instead of a box under the list header.

### Editing cards

- **Click outside to save (2.1.0).** Clicking outside a card you are editing saves it, just like Enter. The same goes for the "Add a card" form. Only one card can be in edit mode at a time.
- **Same text size while editing (2.1.0).** Card text no longer shrinks when you start editing it.

### New notes from cards

- **Choose where the note opens (2.1.0).** The "Open new note in" setting picks where "New note from card" opens the note: Split right (default), Split below, New tab, Same tab or New window. Holding Ctrl/Cmd (with Alt, or Alt+Shift) when you click works like it does for Obsidian links.
- **Move the card body into the note (2.2.0).** Turn on "Move card body to new note" to move the text below the card's first blank line into the new note. The lines above it stay on the card, and the first line becomes a link to the note.

### Lists

- **Short list titles (2.1.0).** Turn on "Truncate long list titles" to keep long list titles on one line, ending with "...". You see the full title when you edit it.
- **Drop at the end of long lists (unreleased).** Dragging a card to the bottom of a long, scrolling list now drops it at the end instead of snapping back.

### Tags and search

- **Iconic plugin support (2.1.0).** Tags show the icons and colors from the Iconic plugin, at the same height as the tag text.
- **Number-only tags (2.1.0).** Hashtags made only of numbers, like `#1`, stay plain text, the same as in Obsidian.
- **Clearer search highlight (2.1.0).** Search matches in card text and tags use a solid yellow highlight that is easy to read in light and dark themes.

### Settings and menus

- **Settings apply right away (2.1.0).** Changes in the settings show up on the board as soon as you make them.
- **Red delete actions (2.2.0).** Delete actions in menus are shown in red, like in Obsidian's own menus.

---

**The Kanban plugin is looking for new maintainers.** Interested? [Read more here.](https://github.com/mgmeyers/obsidian-kanban/blob/main/MAINTAINERS.md)

---

Create markdown-backed Kanban boards in [Obsidian](https://obsidian.md/)

- [Bugs, Issues, & Feature Requests](https://github.com/mgmeyers/obsidian-kanban/issues)
- [Development Roadmap](https://github.com/mgmeyers/obsidian-kanban/projects/1)

![Screen Shot 2021-09-16 at 12.58.22 PM.png](https://github.com/mgmeyers/obsidian-kanban/blob/main/docs/Assets/Screen%20Shot%202021-09-16%20at%2012.58.22%20PM.png)

![Screen Shot 2021-09-16 at 1.10.38 PM.png](https://github.com/mgmeyers/obsidian-kanban/blob/main/docs/Assets/Screen%20Shot%202021-09-16%20at%201.10.38%20PM.png)

## Documentation

Find the plugin documentation here: [Obsidian Kanban Plugin Documentation](https://publish.obsidian.md/kanban/)
