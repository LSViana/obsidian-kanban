# AGENTS.md

Fork of Obsidian Kanban plugin (markdown-backed Kanban boards). Upstream code plus own features on top. Repo lives inside dev vault plugin folder (`<vault>/.obsidian/plugins/obsidian-kanban`), so build output is live plugin Obsidian loads.

## Doc rule

Any update to `.md` files of this harness (`AGENTS.md`, `progress.md`, local `session-handoff.md`) must use caveman skill, `full` level. Same terse style for text fields in `feature_list.json`. Keep technical literals exact (paths, commands, setting keys, SHAs). Do not recompress text already compliant.

Not covered: `README.md`, `release-notes.md`, `docs/` (user-facing, normal prose).

## Startup

1. Read this file.
2. Read `feature_list.json` (feature map: what exists, where) and `progress.md` (baselines, open gaps, decisions).
3. `git log --oneline -10` and `git status`. Read `session-handoff.md` if present (local, gitignored, left by earlier session in this checkout).
4. Run `./init.sh` (Git Bash on Windows) or commands below. Repair baseline first if worse than known baseline.

Worktrees: only main checkout folder is live plugin in dev vault. Worktree build output is not loaded by Obsidian; user tests after change lands in main checkout (or copy `main.js` + `styles.css` there, only if user asks).

## Layout

- `src/main.ts` plugin entry. `src/KanbanView.tsx` view. `src/StateManager.ts` board state + settings resolution.
- `src/Settings.ts` global + per-board settings UI. Keys and defaults live here. Labels in `src/lang/locale/en.ts`.
- `src/components/` Preact UI: `Kanban.tsx` board, `Lane/`, `Item/` (cards), `Selection/` (multi-select), `Table/`, `Editor/`.
- `src/helpers/boardModifiers.ts` board mutations. `src/parsers/` markdown parse/serialize (`formats/list.ts`, `extensions/tag.ts`).
- `src/DragDropApp.tsx` + `src/dnd/` drag and drop.
- `src/styles.less` all CSS. Fork blocks often near file end, one block per feature.
- `docs/` upstream help vault (Obsidian Publish). Not agent docs.

## Build and verify

Use npm, not yarn (some package scripts call `yarn`; run their steps by hand with npm/node).

- `npm install` once. Also rewrites `yarn.lock`; leave that change uncommitted.
- `npm run build` production build. Writes `main.js` + `styles.css` to repo root (gitignored).
- `npm run dev` watch build.
- `npm run typecheck` baseline: 41 errors, all pre-existing. Pass = still 41, none in touched files.
- `npm run lint` has pre-existing CRLF linebreak errors. Only judge lint on touched lines.
- No unit tests. UI behavior verified by user in Obsidian: build, then command palette "Reload app without saving", then test in dev vault board.

Definition of done: build OK, typecheck still 41, user confirmed behavior in Obsidian, `feature_list.json` + `progress.md` updated.

## Rules

- One feature at a time. No drive-by refactors.
- New setting: add to `Settings.ts` (global + per board when it makes sense), default off, label in `en.ts`.
- Do not commit `data.json` (local plugin settings, untracked) or `yarn.lock` changes.
- Commits: Conventional Commits (`feat(item): ...`, `fix(tags): ...`), author `LSViana`. Body says why.

## Release

1. Bump `version` in `package.json` and `manifest.json`, add `"<version>": "1.0.0"` (minAppVersion) to `versions.json`. Or set `version` in `package.json`, then PowerShell `$env:npm_package_version='<version>'; node version-bump.mjs` updates other two. Semver: new features = minor bump.
2. Write `release-notes.md` by hand: user-facing changes since last version, grouped by area. (`rlnotes` script dumps raw commit list; not used.)
3. Commit message = bare version (`2.2.0`). Lightweight tag = bare version, no `v`.
4. Push `main` + tag to `origin`. `.github/workflows/release.yml` would build and create GitHub release on tag push, but Actions disabled on fork, so no release appears.

Remotes: `origin` = `LSViana/obsidian-kanban` (fork, push here). `upstream` = `community-archive/obsidian-kanban`. Fork base = `5134c05`.

## Files: tracked vs local

- Tracked (shared across sessions, clones, worktrees): `AGENTS.md`, `feature_list.json`, `progress.md`, `init.sh`.
- Local only (gitignored): `session-handoff.md`. Per-session state for one checkout. Sections: objective + feature id, done, verification (build, typecheck, Obsidian check), files changed, decisions, blockers, next step. Delete when work lands.

## End of session

Update `feature_list.json` (new feature entry, or files/commits changed) and `progress.md` (new gaps, decisions, baseline changes). Unfinished multi-session work: write `session-handoff.md`.
