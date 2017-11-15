
class Base {

  constructor(dir) {
    this.dir = dir
    this.enter()
  }

  enter () {}
  exit () {}
}

class Pending extends Base {

  enter () {
  }

  exit () {
  }
}

class Running extends Base {

  constructor(dir) {
    super(dir)
  }

  enter () {

    let srcRootDir = 

    mkdirp(
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
    this.src.uuid = uuid    // srcDirUUID
    this.src.name = name
  }

  destroy () {
  }
} 

DirectoryFF.Idle = 
DirectoryFF.Running = Running
