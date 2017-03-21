import fs from 'fs'

class FileService {

  constructor(froot) {
    this.froot = froot
    this.data = data 
  }

  nodeProps(node) {
    if (node instanceof DirectoryNode) {
      return {
        uuid: node.uuid,
        type: 'folder',
        name: node.name,
        mtime: node.mtime
      }
    }
    else if (node instanceof FileNode) {
      return {
        uuid: node.uuid,
        type: 'file',
        name: node.name,
        size: node.size,
        mtime: node.mtime, // FIXME need change mtime definition
        
      }
    }
  }

  // list all items inside a directory
  list(userUUID, dirUUID) {

    let node = this.data.findNodeByUUID(dirUUID)
    if (!node) throw
    if (!(node instanceof DirectoryNode)) throw
    if (!(userCanRead(userUUID, node)) throw

    return node.getChildren().map(n => nodeProps(n))
  }

  // list all items inside a directory, with given 
  navList(userUUID, dirUUID, rootUUID) {

    let node = this.data.findNodeByUUID(dirUUID)
  }

  tree(userUUID, dirUUID) {
  }

  navTree(userUUID, dirUUID, rootUUID) {
  }

  // return abspath of file
  readFile(userUUID, fileUUID) {
  }

  // dump a whole drive
  dumpDrive(userUUID, driveUUID) {
  }

  // create new directory inside given dirUUID
  createDirectory({ userUUID, dirUUID, name }, callback) {

    // permission check
    let node = this.data.findNodeByUUID(dirUUID)
  }

  // create new file inside given dirUUID, 
  createFile(args, callback) {
    let  { userUUID, srcpath, dirUUID, name, sha256 } = args
    let targetNode = this.data.findNodeByUUID(dirUUID)

    if (!targetNode.isDirectory()) {
      let error = new Error('createFile: target must be a folder')
      error.code = 'EINVAL'
      return process.nextTick(callback, error)
    }

    // user permission check
    if (!targetNode.userWritable(userUUID)) {
      let error = new Error('createFile: operation not permitted')
      error.code = 'EACCESS'
      return process.nextTick(callback, error)
    } 

    if (this.list(userUUID, dirUUID).find(child => child.name == name)) {
      let error = new Error('createFile: file or folder already exists')
      error.code = 'EEXIST'
      return process.nextTick(callback, error)
    }

    let targetpath = path.join(targetNode.namepath(), name)

    fs.rename()

  }

  // create new file before check
  createFileCheck(args, callback){
    let { userUUID, dirUUID, name } = args
    let node = this.data.findNodeByUUID(dirUUID)
    if(!node || userCanRead(userUUID, node))
      return callback(new Error('Permission denied'))
    if(this.list(userUUID, dirUUID).find(child => child.name == name && child.type === 'file'))
      return callback(new Error('File exist')) // TODO
    callback(null, node)
  }

  // overwrite existing file
  overwriteFile({ userUUID, srcpath, fileUUID }, callback) {
  }

  // rename a directory or file
  rename(userUUID, targetUUID, name, callback) {
  }

  // move a directory or file into given dirUUID
  move(userUUID, srcUUID, dirUUID, callback) {
  }

  // delete a directory or file
  del(userUUID, targetUUID, callback) {
  }

  register(ipc){
    ipc.register('createFileCheck', this.createFileCheck.bind(this))
    ipc.register('createFile', this.createFile.bind(this))
    ipc.register('createDirectory', this.createDirectory.bind(this))
    ipc.register('overwriteFile', this.overwriteFile.bind(this))
  }
}

export default 
