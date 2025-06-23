export interface Song {
    name: string
    path: string
    beatmapsetId?: string
    image?: string
    video?: string
    artist: string
    title: string
    duration: number
    bitrate: number
    fileSize?: number
    totalAudioFiles?: number
}