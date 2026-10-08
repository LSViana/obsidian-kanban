# 2.1.0

First release of Lucas Viana's fork of the Kanban plugin. It builds on upstream 2.0.51.

## Card pop-up
- Click a card to open it in a pop-up editor. Double-click still edits it inline.
- The pop-up has a title bar and a footer that lists the card's tags, each tag shown once.
- The pop-up stays near the top of the screen with a fixed width.
- App hotkeys work inside the pop-up, and Iconic tag icons show in its editor.
- Search and replace text inside the card pop-up with Ctrl+F (or your search hotkey) or the search button in its header.

## Editing cards
- Clicking outside a card you are editing saves it. The same goes for the new card form.
- Only one card can be in inline edit at a time.
- Cards keep the same font size in edit mode.
- New setting to choose where "New note from card" opens.

## Child cards
- Link child cards to a parent card.
- Hovering a child card's badge also highlights its siblings.
- The parent badge turns green when all its children are done.
- Archived child cards count toward the parent's total. A new setting (off by default) also counts them as done.

## Selecting cards
- Select multiple cards and act on them together, including dragging them as a group.

## Lanes and display
- Long lane titles are cut off with an ellipsis, with a setting to turn this off.
- New option to show only the first line of each card.

## Tags and search
- Number-only hashtags like #123 are no longer treated as tags, matching Obsidian.
- Footer tags show Iconic icons and colors, and Iconic icons match the tag text height.
- Search matches are easier to see on cards and tags.

## Settings
- Setting changes apply right away and are saved when you close the settings.