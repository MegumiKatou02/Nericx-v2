import path from 'path'
import { app } from 'electron'
import { isDev } from './util.js'

export function getPreloadPath() {
    if (isDev()) {
        return path.join(
            app.getAppPath(),
            'dist-electron/preload.cjs'
        )
    } else {
        // Trong production, preload.cjs được unpack từ asar :v
        return path.join(
            app.getAppPath(),
            'dist-electron/preload.cjs'
        )
    }
}
