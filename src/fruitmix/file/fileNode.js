import Node from './node'

const createHashWorker = (callback) {
}

class FileNode extends Node {

  constructor(props) {
    super()
    this.worker = null 
  }

  request() {

    if (this.worker) return

    if (this.hash) {
      this.worker = createHashWorker
    }
    else {
      this.worker = createIdentifyWorker
    }
  }
}
