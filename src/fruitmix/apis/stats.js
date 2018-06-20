// This list must be kept in sync with that in file meta

const ImageTypes = ['JPEG', 'PNG', 'GIF', 'BMP', 'TIFF']
const VideoTypes = ['RM', 'RMVB', 'WMV', 'AVI', 'MPEG', 'MP4', '3GP', 'MOV', 'FLV', 'MKV']
const AudioType = ['RA', 'WMA', 'MP3', 'OGG', 'MKA', 'WAV', 'APE', 'FLAC']
const DocType = ['DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'PDF']

class Stats {
  constructor (vfs) {
    this.vfs = vfs
  }

  GET (user, props, callback) {
    let image = { count: 0, totalSize: 0 }
    let video = { count: 0, totalSize: 0 }
    let audio = { count: 0, totalSize: 0 }
    let document = { count: 0, totalSize: 0 }

    let map = this.vfs.forest.fileMap     
    for (const [uuid, file] of map) {
      let type = file.metadata.type
      if (ImageTypes.includes(type)) {
        image.count++
        image.totalSize += file.size
      } else if (VideoTypes.includes(type)) {
        video.count++
        video.totalSize += file.size
      } else if (AudioTypes.includes(type)) {
        audio.count++
        audio.totalSize += file.size
      } else if (DocType.includes(type)) {
        document.count++
        document.totalSize += file.size
      }
    }

    process.nextTick(() => callback(null, { image, video, audio, document }))
  }
}

module.exports = Stats
