class FileState {

  constructor(file) {
    this.file = file
    this.enter()
  }
  
  destroy () {
    this.exit()
  }

  setState (NextState) {
    this.exit()
    new NextState(this.file)
  }

  enter () {}
  exit () {}
}

class FilePending extends Base {

  enter () {
    this.dir.ctx.indexPendingFile(this.file)
  }

  exit () {
    this.dir.ctx.unindexPendingFile(this.file)
  }
}

class FileWorking extends Base {
  
  enter () {
    this.dir.ctx.indexWorkingFile(this.file)

    try {
      let { srcPath, dstPath } = this.file.ctx.getFilePathsSync(this.file)
    } catch (e) {
      
    }
  }

  exit () {
    this.dir.ctx.unindexWorkingFile(this.file)
  }
}

class FileFailed extends Base {

  enter () {
    this.dir.ctx.indexFailedFile(this.file)
  }

  exit () {
    this.dir.ctx.unindexFailedFile(this.file)
  }
}


class File {

  constructor(ctx, parent, name) {
    this.ctx = ctx
    this.parent = parent    // Directory object
    this.uuid = uuid        // src uuid
    this.name = name        // src name

    this.state = new FilePending(this)
  }

  copy () {
    try {
      let srcPath = this.vfs.getDirPathSync(this.parent.srcDirUUID, name)
      let dstPath = this.vfs.getDirPathSync(this.parent.dstDirUUID, name)
    } catch (e) {
       
    }
  } 

  setState(next) {
  }

  destroy () {
    
  }
}

// a directory has
// srcDriveUUID
// srcDirUUID
// dstDriveUUID
// dstDirUUID ?
class DirectoryFF {

  constructor(ctx, xstat) {
    super(ctx)
    this.srcDirUUID = uuid
    this.dstDirUUID = uuid
  }

  readSrcDir () {
    this.ctx.vfs.readdir(this.src.uuid, (err, xstats) => {
      if (err) return      
      this.children = []
      xstats.forEach(x => {
        if (x.type === 'directory') {
          this.children.push(new DirectoryFF(this.ctx))
        }

        if (x.type === 'file') {
          this.children.push(new FileFF(this.vfs, this))
        }
      })
    })
  }

  destroy () {
  }
} 

DirectoryFF.Idle = 
DirectoryFF.Running = Running

// ctx
// srcDriveUUID
// dstDriveUUID
// vfs
