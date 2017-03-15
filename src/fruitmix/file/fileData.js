import EventEmitter from 'events'

class FileData extends EventEmitter {

  constructor(driveDir, model) {

    this.dir = driveDir
    this.model = model
    this.root = new Node()
    this.uuidMap = new Map()

    // drives created and deleted are processed in batch
    // it is easier to do assertion after change
    model.on('drivesCreated', drives => 
      drives.forEach(drv => { 
        let target = path.join(this.driveDir, drv.uuid)
        mkdirp(target, err => {
          if (err) return // TODO LOG
          forceDriveXstat(target, drv.uuid, (err, xstat) => {
            if (err) return
            let drvNode = new DriveNode(ctx, xstat, drv)
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
      if (node) node.update( 
    })
  }

  nodeAttached(node) {
    this.uuidMap.set(node.uuid, node)
  }

  nodeDetaching(node) {
    this.uuidMap.delete(node.uuid)
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
        throw //TODO
    } 

    this.uuidMap.set(uuid, node)
    node.attach(parent)
  }

  // update means props changed
  updateNode(node, props) {
    node.update(props)
  }

  deleteNode(node) {
    node.postVisit(n => {
      n.detach()
      this.uuid...
    })
  }

  deleteNodeByUUID(uuid) {
  }

  findNodeByUUID(uuid) {
  }
}

export default () => new FileData()




