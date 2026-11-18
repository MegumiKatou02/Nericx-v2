/**
 * Config rows written by both processes. The renderer owns the Discord client,
 * but the tray menu offers the same switch, so the key cannot live only in the
 * renderer module.
 */
export const DISCORD_ENABLED_KEY = 'discordEnabled'

/** Close-to-tray versus quit-on-close, read by the main process at startup. */
export const CLOSE_TO_TRAY_KEY = 'closeToTray'
