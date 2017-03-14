import { createFileNode, createDirectoryNode, createDriveNode } from './nodes'

class Forest {

  constructor() {
    this.uuidMap = new Map()
    this.roots = []
  }

  createDrive(props) {
    let root = createDriveNode(props)
    root.requestProbe()
    this.roots.push(root)
  }

  requestProbe(uuid) {
    
  }
}


