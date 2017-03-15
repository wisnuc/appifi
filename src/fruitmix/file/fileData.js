import EventEmitter from 'events'

class FileData extends EventEmitter {

  constructor(drvdir) {

    this.drvdir = dir

    this.uuidMap = new Map()
    this.drives = []
  }

  deleteDrive(drive) {
    let index = this.drives.indexOf(drive)
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

  createDrive(props) {

    let { uuid } = props
    let drive = new DriveNode(props, this.dir) 
    
    this.drive.push(drive)
    this.uuidMap.set(uuid, drive)

    drive.probe() // should be instant! TODO
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




