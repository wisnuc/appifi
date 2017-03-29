import fs from 'fs'
import { readXstat } from './xstat'

class FileService {

  constructor(froot, data, shareData) {
    this.froot = froot
    this.data = data 
    this.shareData = shareData
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
  list({ userUUID, dirUUID }, callback) {

    let node = this.data.findNodeByUUID(dirUUID)
    if (!node) throw new Error('TODO') // FIXME
    if (!(node instanceof DirectoryNode)) throw new Error('TODO')
    if (!(userCanRead(userUUID, node))) throw new Error('TODO')

    return node.getChildren().map(n => nodeProps(n))
  }

  // list all items inside a directory, with given
  // TODO modified by jianjin.wu
  navList({ userUUID, dirUUID, rootUUID }, callback) {

    let node = this.data.findNodeByUUID(dirUUID)

    if (!node) {
      let e = new Error(`navList: ${dirUUID} not found`)
      e.code = 'ENOENT'
      return callback(e)
    }

    if (!node.isDirectory()) {
      let e = new Error(`navList: ${dirUUID} is not a folder`)
      e.code = 'ENOTDIR'
      return callback(e)
    }

    let root = this.data.findNodeByUUID(rootUUID)
    if (!root) {
      let e = new Error(`navList: ${rootUUID} not found`)
      e.code = 'ENOENT'
      return callback(e)
    }

    let path = node.nodepath()
    let index = path.indexOf(root)

    if (index === -1) {
      let e = new Error(`navList: ${rootUUID} not an ancestor of ${dirUUID}`)
      e.code = 'EINVAL'
      return callback(e)
    }

    let subpath = path.slice(index)
    if (!subpath.every(n => n.userReadable(userUUID))) {
      let e = new Error(`navList: not all ancestors accessible for given user ${userUUID}`)
      e.code = 'EACCESS'
      return callback(e)
    }

    return callback(null, {
      path: subpath.map(n => nodeProps(n)),
      children: node.getChildren().map(n => nodeProps(n))
    })
  }

  tree(userUUID, dirUUID) {
  }

  navTree(userUUID, dirUUID, rootUUID) {
  }

  // return abspath of file
  // TODO modified by jianjin.wu
  readFile({ userUUID, fileUUID }, callback) {

    let node = this.data.findNodeByUUID(fileUUID)
    let result
    if (!node) {
      result = 'ENOENT'
    }

    if (!node.isFile()) {
      result = 'EINVAL'
    }

    if (!node.userReadable(userUUID)) {
      result = 'EACCESS'
    }

    result = result || node.namepath()

    return callback(null, result)
  }

  // dump a whole drive
  dumpDrive(userUUID, driveUUID) {
  }

  // create new directory inside given dirUUID
  createDirectory({ userUUID, dirUUID, name }, callback) {

    // permission check
    let node = this.data.findNodeByUUID(dirUUID)
    if (!targetNode.isDirectory()) {
      let error = new Error('createFolder: target should be a folder')
      error.code = 'EINVAL' 
      return process.nextTick(callback, error)
    }

    // if not writable, EACCESS
    if (!targetNode.userWritable(userUUID)) {
      let error = new Error('createFolder: operation not permitted')
      error.code = 'EACCESS'
      return process.nextTick(callback, error)
    }

    // if already exists, EEXIST
    if (this.list(userUUID, dirUUID).find(child => child.name == name)) {
      let error = new Error('createFolder: file or folder already exists')
      error.code = 'EEXIST'
      return process.nextTick(callback, error)
    }

    //create new folder
    fs.mkdir(targetpath, err => {
      if(err) return callback(err)
      readXstat(targetpath, (err, xstat) => {
        //create new node
        let node = this.data.createNode(targetNode, xstat)
        callback(null, node)
      })
    })

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

    //rename file 
    fs.rename(srcpath, targetpath, err => {
      if (err) return callback(err)
      readXstat(targetpath, (err, xstat) => {
        //create new node
        let node = this.data.createNode(targetNode, xstat)
        callback(null, node)
      })
    })

  }

  // create new file before check
  createFileCheck(args, callback){
    let { userUUID, dirUUID, name } = args
    let node = this.data.findNodeByUUID(dirUUID)
    if(!node || userCanRead(userUUID, node))
      return callback(new Error('Permission denied'))
    if(node.isDirectory() && this.list(userUUID, dirUUID).find(child => child.name == name && child.type === 'file'))
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
  del({ userUUID, targetUUID }, callback) {

  }

  register(ipc){
    ipc.register('createFileCheck', this.createFileCheck.bind(this))
    ipc.register('createFile', this.createFile.bind(this))
    ipc.register('createDirectory', this.createDirectory.bind(this))
    ipc.register('overwriteFile', this.overwriteFile.bind(this))
    ipc.register('list', this.list.bind(this))
    ipc.register('navList', this.navList.bind(this))
    ipc.register('readFile', this.readFile.bind(this))
    ipc.register('del', this.del.bind(this))
  }
}

export default FileService
