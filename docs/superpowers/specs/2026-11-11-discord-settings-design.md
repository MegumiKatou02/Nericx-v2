# Discord settings — design

## Intent

Discord Rich Presence currently starts on its own every launch and cannot be
configured from the Settings tab. Give the user two controls there:

1. Whether Discord RPC is on when the app opens (and remember it).
2. Whether each of the two presence buttons ("Xem Beatmap", "Github") is shown.

## Why

The presence is opt-in for many people (it broadcasts what they listen to). Today
the only way to stop it is to click the toggle in the music tab again after every
restart, and the buttons are hard-coded in the main process.

## Goals

- A `Discord` section in the Settings tab with three toggles: Rich Presence,
  "Nút Xem Beatmap", "Nút Github".
- The presence on/off state persists and is honoured at startup instead of always
  connecting.
- Button visibility persists and is applied to the next presence update.
- The music tab button and the Settings toggle stay in sync (one source of truth).

## Non-goals

- Editing button labels or URLs (labels stay `Xem Beatmap` / `Github`).
- More than two buttons, or buttons for songs without a beatmapset.
- Changing cover / timestamp / video-badge behaviour.

## Decisions

- **Defaults are all ON.** First launch (no stored config) behaves exactly like
  today, so an existing user does not silently lose their presence.
- **Github button keeps its current attach rule:** buttons are only sent for songs
  with a `beatmapsetId`. Turning the beatmap button off while Github is on shows
  only Github, and vice versa; both off drops the buttons field.
- **One shared reactive store**, `src/ui/discordSettings.ts`, imported by both
  `MusicTab.vue` (owns the RPC client lifecycle) and `SettingTab.vue` (owns the
  UI). The main process stays stateless: `buildActivity()` just receives two
  flags.

## Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| Shared UI store + flags in the IPC payload | One source of truth, no extra IPC, no DB reads per presence update | **chosen** |
| Main process reads config from SQLite on every presence update | Opens the DB on play/pause/seek; UI still needs its own copy of the state | rejected |
| State provided from `App.vue` via `provide`/`inject` | Same as chosen but grows an already large `App.vue` and mixes Discord into app shell concerns | rejected |

## Design

`src/ui/discordSettings.ts`

- Config keys: `discordEnabled`, `discordBeatmapButton`, `discordGithubButton`.
- `DEFAULT_DISCORD_SETTINGS = { enabled: true, beatmapButton: true, githubButton: true }`.
- `parseStoredBoolean(raw, fallback)` — `config` rows are TEXT and `getConfig`
  returns `null` for a missing key, so absent/garbage values fall back.
- `discordSettings` — module-level `reactive` object, the single source of truth.
- `loadDiscordSettings()` — reads the three keys once.
- `setDiscordEnabled/BeatmapButton/GithubButton(value)` — update the store then
  persist.

`src/electron/discordActivity.ts`

- `DiscordSongInfo` gains `beatmapButton?: boolean` and `githubButton?: boolean`.
- `buildActivity` omits each button when its flag is `false`; `undefined` keeps the
  old always-on behaviour. The `buttons` field is dropped entirely when both are
  hidden.

`src/ui/components/MusicTab.vue`

- Replaces the local `discordEnabled` ref with `discordSettings.enabled`.
- `loadSongs()` no longer starts Discord (it is skipped on a warm cache anyway);
  `onMounted` loads the settings, then syncs the client once.
- A `watch` on `discordSettings.enabled` starts or stops the client, so toggling in
  Settings and toggling in the music tab run the same code path.
- `toggleDiscord()` now only flips the persisted setting (the watcher handles the
  client); loading/cooldown UI is unchanged.
- `updateDiscordStatus()` forwards the two button flags.
- A `watch` on the two button flags re-sends the presence so a toggle shows up
  immediately.

`src/ui/components/SettingTab.vue`

- New `Discord` section, three toggles in the existing `.setting-option` style.
- Loads the settings on mount and calls the setters on click.

`tests/`

- `discordSettings.test.mjs` — boolean parsing (null/empty/garbage/legacy values).
- `discordActivity.test.mjs` — each button flag, both off, and defaults unchanged.
