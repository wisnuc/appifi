const fs = require('fs')
const fileType = require('file-type')

const MAGICVER = 2

const probe = (filePath, callback) => 
  fs.open(filePath, 'r', (err, fd) => err 
    ? callback(err) 
    : fs.read(fd, Buffer.alloc(4100), 0, 4100, 0, (err, bytesRead, buffer) => err 
      ? callback(err)
      : callback(null, fileType(buffer.slice(0, bytesRead)))))

const names = [
  // image
  'jpg', 'png', 'bmp', 'tif', 'webp', 'jp2', 'jpm', 'jpx', 'gif', 'heic',
  // video
  'mp4', 'm4v', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'mpg', '3gp', 'flv',
  // audio
  'mp2', 'mp3', 'm4a', 'flac', 'wav',
  // document
  'docx', 'xlsx', 'pptx', 'pdf' 
]

const f = (filePath, callback) => {
  probe(filePath, (err, t) => {
    if (err) return callback(err)

    if (t) {
      let index = names.indexOf(t.ext)
      if (index !== -1) {
        if (t.ext === 'jpg') {
          return callback(null, 'JPEG')
        } else if (t.ext === 'wmv') {
          return callback(null, 'WM')
        } else {
          return callback(null, names[index].toUpperCase())
        }
      }
    }

    // here we need to support
    // video: real video (rmv)
    // audio: ape, real audio (rma) 
    // document: doc, xls, ppt
    // 
    child.exec(`file -b '${filePath}'`, (err, stdout) => {
      if (err) return callback(err)

      let x = stdout.toString()
      if (x.startsWith('Composite Document File V2 Document')) {        // MS OFFICE OLD
        child.exec(`file -b --mime-type '${filePath}'`, (err, stdout) => {
          let mime = stdout.toString().trim()
          if (mime === 'application/msword') {
            callback(null, 'DOC')
          } else if (mime === 'application/vnd.ms-excel') {
            callback(null, 'XLS')
          } else if (mime === 'application/vnd.ms-powerpoint') {
            callback(null, 'PPT')
          } else {
            callback(null, '')
          }
        })
      } else if (x.startsWith('Monkey\'s Audio compressed format')) {   // APE
        callback(null, 'APE') 
      } else if (x.startsWith('RealMedia file')) {
        callback(null, 'RM')
      } else {
        callback(null, '')
      }
    })
  })
}

module.exports = (fpath, callback) => 
  readChunk(fpath, 0, 4100)
    .then(buf => callback(null, fileType(buf)))
    .catch(e => callback(e))



