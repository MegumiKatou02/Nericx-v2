/**
 * Config rows written by both processes.
 *
 * `discordEnabled` is only read when the app starts: it seeds whether presence
 * connects for that launch. The music tab's toggle changes the running presence
 * without writing this row, so the next launch still follows the Settings tab.
 */
export const DISCORD_ENABLED_KEY = 'discordEnabled'

/** Close-to-tray versus quit-on-close, read by the main process at startup. */
export const CLOSE_TO_TRAY_KEY = 'closeToTray'
