# Progress

Shared cross-session notes: open gaps + decisions. No per-session state here (that goes in `session-handoff.md`, gitignored). Current version/HEAD: read from git, not this file. Caveman full style (see `AGENTS.md`).

## Baselines

- `npm run typecheck`: 41 errors, all pre-existing.
- `npm run lint`: pre-existing CRLF linebreak errors.

## Known gaps / ideas (not started, not approved)

- Card pop-up: done checkbox + card menu inside pop-up, side panel mode, "Open card" hotkey command, editable date chips, mobile + pop-out window testing, translations (only `en.ts` has new strings).
- Multi-select: Shift+click range select, "Move selected cards to list..." command (upstream issue #481).
- Click-outside save (feat-002) ignores pop-out windows.
- Lane titles: explicit line breaks still break even with ellipsis on.
- Board footer may still list duplicate tags (pop-up footer fixed only).
- Some sizes still fixed, not following font size setting: footer metadata/dates/tags 12px, metadata table 0.75rem, lane count 13px, lane title edit 0.875rem.

## Decisions

- Card edit on outside click saves (not discards), like Enter.
- New settings default off, global + per board.
- Release notes hand-written, user-facing, grouped by area.
- No GitHub releases: Actions disabled on fork. Tag push only.
- Drag and drop: drop target updates during auto-scroll too. Empty space below list end (same column, 200px reach) counts as list end (feat-014).
