class XCopy {

  constructor (fruit) {

    this.root = new Directory()
    this.fruit = fruit
    this.vfs = vfs
    this.srcDriveUUID
    this.dstDriveUUID
    this.user = user

    this.filePending = new Set()
    this.fileWorking = new Set()
    this.fileConflict = new Set()
    this.fileFailed = new Set()

    this.dirPending = new Set()
    this.dirMkdir = new Set()
    this.dirConflict = new Set()
    this.dirReaddir = new Set()
    this.dirFailed = new Set()

  }

  readdir (dir, callback) {
    if (this.user) {
    } else {
      this.vfs
    }
  } 

  indexPendingFile (file) {
  }

  unindexPendingFile (file) {
  }

  indexWorkingFile (file) {
  }

  unindexWorkingFile (file) {
  }

  indexFailedFile (file) {
  }

  unindexFailedFile (file) {
  }

  indexPendingDir (dir) {
  }

  unindexPendingDir (dir) {
  }

  indexMkdir (dir) {
  }

  unindexMkdir (dir) {
  }

  indexConflictDir (dir) {
  }

  unindexConflictDir (dir) {
  }

  indexReaddir (dir) {
  }

  unindexReaddir (dir) {
  }

  indexFailedDir (dir) {
  }

  unindexFailedDir (dir) {
  }

  destroy () {
    this.root.destroy()
    this.root = null
  }
}

const createXcopy = (fruit, something) => {}

module.exports = XCopy


