/**
Generate an unsupported file type error from fs.Stats

@param {fs.Stats} stat
*/
const EUnsupported = stat => {
  let err = new Error('target is not a regular file or directory')

  /** from nodejs 8.x LTS doc
  stats.isFile()
  stats.isDirectory()
  stats.isBlockDevice()
  stats.isCharacterDevice()
  stats.isSymbolicLink() (only valid with fs.lstat())
  stats.isFIFO()
  stats.isSocket()
  */
  if (stat.isBlockDevice()) {
    err.code = 'EISBLOCKDEV'
  } else if (stat.isCharacterDevice()) {
    err.code = 'EISCHARDEV'
  } else if (stat.isSymbolicLink()) {
    err.code = 'EISSYMLINK'
  } else if (stat.isFIFO()) {
    err.code = 'EISFIFO'
  } else if (stat.isSocket()) {
    err.code = 'EISSOCKET'
  } else {
    err.code = 'EISUNKNOWN'
  }

  err.xcode = 'EUNSUPPORTED'
  return err
}

module.exports = EUnsupported
