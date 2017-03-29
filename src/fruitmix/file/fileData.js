import path from 'path'
import EventEmitter from 'events'

import mkdirp from 'mkdirp'

import { forceDriveXstat } from './xstat'
import Node from './node'
import DriveNode from './driveNode'

class FileData extends EventEmitter {

  constructor(driveDir, model) {
    super()
    this.dir = driveDir
    this.model = model
    this.root = new Node(this)
    this.uuidMap = new Map()

    // drives created and deleted are processed in batch
    // it is easier to do assertion after change
    model.on('drivesCreated', drives => 
      drives.forEach(drv => { 
        let target = path.join(this.dir, drv.uuid)
        mkdirp(target, err => {
          if (err) return // TODO LOG
          forceDriveXstat(target, drv.uuid, (err, xstat) => {
            if (err) return

            let drvNode = new DriveNode(this, xstat, drv)
            drvNode.attach(this.root)
          })
        })
      }))

    model.on('drivesDeleted', drives => 
      this.root.getChilren
        .filter(node => drives.map(d => d.uuid).includes(node.uuid))
        .forEach(node => node.detach()))

    model.on('driveUpdated', drive => {
      let node = this.root.getChildren.find(n => n.uuid === drive.uuid)
      if (node) node.update(drive)
    })
  }

  nodeAttached(node) {
    this.uuidMap.set(node.uuid, node)
  }

  nodeDetaching(node) {
    this.uuidMap.delete(node.uuid)
  }

  probeStarted(node) {
    console.log(`node ${node.uuid} ${node.name} probe started`)
  }

  probeStopped(node) {
    console.log(`node ${node.uuid} ${node.name} probe stopped`)
  }

  hashStarted(node) {
    console.log(`node ${node.uuid} ${node.name} hash started`)
  }

  hashStopped(node) {
    console.log(`node ${node.uuid} ${node.name} hash stopped`)
  }

  createNode(parent, props) {
    let node

    switch(props.type) {
      case 'directory':
        node = new DirectoryNode(this, props)        
        break
      case 'file':
        node = new FileNode(this, props)
        break
      default:
        throw 'bad props' //TODO
    } 

    // this.uuidMap.set(uuid, node)
    node.attach(parent)
  }

  // update means props changed
  updateNode(node, props) {
    node.update(props)
  }

  deleteNode(node) {
    node.postVisit(n => {
      n.detach()
      // this.uuid...
    })
  }

  deleteNodeByUUID(uuid) {
  }

  findNodeByUUID(uuid) {
  }

  userPermittedToRead(userUUID, node) {
    return true // FIXME
  }

  userPermittedToReadByUUID(userUUID, nodeUUID) {
    return true // FIXME
  }

  userPermittedToWrite(userUUID, node) {
    return true // FIXME
  }

  userPermittedToWriteByUUID(userUUID, nodeUUID) {
    return true // FIXME
  }

  userPermittedToShare(userUUID, node) {
    return true // FIXME
  }
  
  userPermittedToShareByUUID(userUUID, nodeUUID) {
    return true // FIXME
  }
}

export default FileData

