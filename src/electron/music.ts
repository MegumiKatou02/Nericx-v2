import { join } from 'path'
import { readdirSync, statSync, existsSync } from 'fs'
import type { Song } from './type.js'
import * as mm from 'music-metadata'
import { EventEmitter } from 'events'

export class MusicPlayer extends EventEmitter {
  private songsData: Song[] = []
  private filteredSongs: Song[] = []
  private shuffleMode: boolean = false
  private repeatOne: boolean = false

  constructor() {
    super()
  }

  async loadSongs(osuPath: string): Promise<{ success: boolean; message: string; songs?: Song[] }> {
    const songsPath = join(osuPath, 'Songs')
    this.songsData = []

    if (!existsSync(songsPath)) {
      return { success: false, message: 'Không tìm thấy thư mục Songs!' }
    }

    try {
      const songFolders = readdirSync(songsPath)
      const songPromises: Promise<void>[] = []

      for (const songFolder of songFolders) {
        const folderPath = join(songsPath, songFolder)

        if (statSync(folderPath).isDirectory()) {
          const beatmapsetId = songFolder.includes(' ') ? songFolder.split(' ')[0] : undefined

          const imageFiles = readdirSync(folderPath)
            .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
          
          const backgroundImages = imageFiles
            .filter(f => /bg|background/i.test(f))

          const imagePath = backgroundImages.length > 0 
            ? join(folderPath, backgroundImages[0])
            : imageFiles.length > 0 
              ? join(folderPath, imageFiles[0]) 
              : undefined

          const audioFiles = readdirSync(folderPath)
            .filter(f => f.toLowerCase().endsWith('.mp3') || f.toLowerCase() === 'audio.ogg')

          for (const audioFile of audioFiles) {
            const songPath = join(folderPath, audioFile)
            const namePart = songFolder.split(' ').slice(1).join(' ')
            
            let artist = '', title = ''
            if (namePart.includes(' - ')) {
              [artist, title] = namePart.split(' - ', 2)
            } else {
              title = namePart
            }

            const song: Song = {
              name: namePart,
              path: songPath,
              beatmapsetId,
              image: imagePath,
              artist: artist.trim(),
              title: title.trim(),
              duration: 0
            }

            this.songsData.push(song)

            const metadataPromise = async () => {
              try {
                const metadata = await mm.parseFile(songPath)
                song.duration = metadata.format.duration || 0
  
                this.emit('metadataUpdated', song)
              } catch (error) {
                console.error(`Không thể đọc metadata của file ${songPath}:`, error)
              }
            }

            songPromises.push(metadataPromise())
          }
        }
      }

      this.songsData.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      this.filteredSongs = [...this.songsData]

      const result = { 
        success: true, 
        message: 'Đã tải danh sách bài hát', 
        songs: this.filteredSongs 
      }

      Promise.all(songPromises).then(() => {
        this.songsData.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        this.filteredSongs = [...this.songsData]
        this.emit('allMetadataUpdated', this.filteredSongs)
      })

      return result

    } catch (error) {
      return { 
        success: false, 
        message: `Lỗi khi tải danh sách bài hát: ${error instanceof Error ? error.message : String(error)}` 
      }
    }
  }

  setPlaybackMode(shuffle: boolean, repeatOne: boolean) {
    this.shuffleMode = shuffle
    this.repeatOne = repeatOne
  }

  getSongList(): string[] {
    return this.songsData.map(song => song.name)
  }

  getSongByName(name: string): Song | null {
    return this.songsData.find(song => song.name === name) || null
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  filterSongs(query: string) {
    if (!query || query.trim() === '') {
      this.filteredSongs = [...this.songsData]
    } else {
      const searchTerm = query.toLowerCase().trim()
      this.filteredSongs = this.songsData.filter(song =>
        song.name.toLowerCase().includes(searchTerm) ||
        song.artist.toLowerCase().includes(searchTerm) ||
        song.title.toLowerCase().includes(searchTerm)
      )
    }
  }

  getFilteredSongs(): Song[] {
    return this.filteredSongs
  }
} 