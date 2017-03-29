import path from 'path'
import EventEmitter from 'events'

import mkdirp from 'mkdirp'

import E from '../lib/error'

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

    let drive = node.getDrive()
    switch (drive.type) {
    case 'private':
      return userUUID === drive.owner
    case 'public':
      return drive.writelist.includes(userUUID) || drive.readlist.includes(userUUID)
    default:
      throw new Error('invalid drive type', drive)
    }
  }

  userPermittedToReadByUUID(userUUID, nodeUUID) {
    
    let node = this.findNodeByUUID(nodeUUID)
    if (!node) throw new E.ENODENOTFOUND()
    return this.userPermittedToRead(userUUID, node.uuid)
  }

  userPermittedToWrite(userUUID, node) {

    let drive = node.getDrive()
    switch (drive.type) {
    case 'private':
      return userUUID === drive.owner
    case 'public':
      return drive.writelist.includes(userUUID)
    default:
      throw new Error('invalid drive type', drive)
    }
  }

  userPermittedToWriteByUUID(userUUID, nodeUUID) {

    let node = thsi.findNodeByUUID(nodeUUID)
    if (!node) throw new E.ENODENOTFOUND()
    return this.userPermittedToWrite(userUUID, node.uuid)
  }

  userPermittedToShare(userUUID, node) {

    let drive = node.getDrive()
    switch (drive.type) {
    case 'private':
      return userUUID === drive.owner
    case 'public':
      return drive.shareAllowed
    default:
      throw new Error('invalid drive type', drive)
    }
  }
  
  userPermittedToShareByUUID(userUUID, nodeUUID) {

    let node = this.findNodeByUUID(nodeUUID)
    if (!node) throw new E.ENODENOTFOUND()
    return this.userPermittedToShareByUUID(userUUID, node)
  }
}

export default FileData

