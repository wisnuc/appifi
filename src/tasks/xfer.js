class Node {

  constructor () {
     
  }

  attach (parent) {
    this.parent = parent
    parent.children.push(this)
  }

  detach () {
    let index = parent.children.indexOf(this)
    if (index === -1) throw new Error('structural error') // TODO
    parent.children.splice(index, 1)
    this.parent = null
  }

  previsit() {
  }

  schedule() {
  }

  fileConflict () {
    return this.parent ? this.parent.fileConflict() : this.fileConflictDefault
  }

  dirConflict () {
    return this.parent ? this.parent.dirConflict() : this.dirConflictDefault
  }

  destroy () {
  }
}

// state: failed, running, paused
class File extends Node {
  constructor () {
    super()
  }
 

  destroy () {
  }
}

class FileToExt extends File {

}

class FileFromExt extends File {

}

class FileE2F extends File {
}

class DirectoryBase extends Node {
  constructor() {
    super()
  }
}

class DirF2F extends Directory {
}

class DirF2E extends Directory {
}

class DirE2F extends Directory {
}




