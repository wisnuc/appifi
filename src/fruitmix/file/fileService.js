const path = require('path')
const rimraf = require('rimraf')
const fs = Promise.promisifyAll(require('fs'))
import { readXstat, readXstatAsync, updateFileHashAsync } from './xstat'
import DirectoryNode from './directoryNode'
import FileNode from './fileNode'
import E from '../lib/error'
import { rimrafAsync, mkdirpAsync } from '../util/async'

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
        mtime: node.mtime // FIXME: need change mtime definition      
      }
    }
  }

  userReadable(userUUID, node) {

    return this.data.userPermittedToRead(userUUID, node)
      || this.shareData.userAuthorizedToRead(userUUID, node)
  }

  userWritable(userUUID, node) {
    return this.data.userPermittedToWrite(userUUID, node)
      || this.shareData.userAuthorizedToWrite(userUUID, node)
  }  

  // list all items inside a directory
  async list({ userUUID, dirUUID }) {

    let shareCollection = this.shareData.findShareCollectionByUUID(dirUUID)
    if (shareCollection) {
      return shareCollection.map(n => this.nodeProps(n))
      
    } else {
      let node = this.data.findNodeByUUID(dirUUID)
      if (!node) throw new E.ENODENOTFOUND() 
      if (!node.isDirectory()) throw new E.ENOTDIR()
      if (!(this.userReadable(userUUID, node))) throw new E.EACCESS()

      return node.getChildren().map(n => this.nodeProps(n))

    }
  }

  // list all items inside a directory, with given
  // dirUUID must be a virtual drive uuid 
  // rootUUID can be a fileshare uuid or virtual drive uuid.
  async navList({ userUUID, dirUUID, rootUUID }) {

    let node = this.data.findNodeByUUID(dirUUID)
    if (!node) throw new E.ENODENOTFOUND()
    if (!node.isDirectory()) throw new E.ENOTDIR()
    if (!(this.userReadable(userUUID, node))) throw new E.EACCESS()

    let share = this.shareData.findShareByUUID(rootUUID)
    if (share) {
      
      let path = this.shareData.findSharePath(rootUUID,dirUUID)
      return {
        path: path,
        entries: node.getChildren().map(n => this.nodeProps(n))
      } 
      
    } else {
      
      let root = this.data.findNodeByUUID(rootUUID)
      if (!root) throw new E.ENODENOTFOUND()

      let path = node.nodepath()
      let index = path.indexOf(root)

      if (index === -1) throw new E.ENOENT()
      let subpath = path.slice(index)

      return {
        path: subpath.map(n => this.nodeProps(n)),
        entries: node.getChildren().map(n => this.nodeProps(n))
      }    
    } 
  }

  // list all descendant inside a directory
  async tree({ userUUID, dirUUID }) {

    let queue = []
    let shareCollection = this.shareData.findShareCollectionByUUID(dirUUID)
    if (shareCollection) {
      shareCollection.map(n => {
        let tempArr = []
        n.preVisit(n => {
          tempArr.push(this.nodeProps(n))
        })
        queue.push(tempArr)
      })
    } else {
      let node = this.data.findNodeByUUID(dirUUID)
      if (!node) throw new E.ENODENOTFOUND() 
      if (!node.isDirectory()) throw new E.ENOTDIR()
      if (!(this.userReadable(userUUID, node))) throw new E.EACCESS()

      node.getChildren().map(n => {
        let tempArr = []
        n.preVisit(n => {
          tempArr.push(this.nodeProps(n))
        })
        queue.push(tempArr)
      })
    }
    return queue
  }

  // list all descendant inside a directory, with given
  // dirUUID must be a virtual drive uuid
  // rootUUID must be a fileshare uuid or virtual drive uuid.
  async navTree({ userUUID, dirUUID, rootUUID }) {

    let queue = []
    let newPath
    let node = this.data.findNodeByUUID(dirUUID)
    if (!node) throw new E.ENODENOTFOUND()
    if (!node.isDirectory()) throw new E.ENOTDIR()
    if (!(this.userReadable(userUUID, node))) throw new E.EACCESS()

    let share = this.shareData.findShareByUUID(rootUUID)
    //get the path
    if (share) {
      newPath = this.shareData.findSharePath(rootUUID,dirUUID)
    } else {
      let root = this.data.findNodeByUUID(rootUUID)
      if (!root) throw new E.ENODENOTFOUND()

      let path = node.nodepath()
      let index = path.indexOf(root)

      if (index === -1) throw new E.ENOENT()
      let subpath = path.slice(index)
      newPath = subpath.map(n => this.nodeProps(n))
    } 

    node.getChildren().map(n => {
      let tempArr = []
      n.preVisit(n => {
        tempArr.push(this.nodeProps(n))
      })
      queue.push(tempArr)
    })
    return {
      path: newPath,
      entries: queue
    }   
  }

  // return abspath of file
  async readFile({ userUUID, dirUUID, fileUUID }) {

    let dirNode = this.data.findNodeByUUID(dirUUID)
    let fileNode = this.data.findNodeByUUID(fileUUID)

    if (!dirNode || !fileNode) throw new E.ENODENOTFOUND() 
    if (!dirNode.isDirectory()) throw new E.ENOTDIR()
    if (!fileNode.isFile()) throw new E.ENOENT()
    if (!(this.userReadable(userUUID, dirNode))) throw new E.EACCESS()

    return fileNode.abspath()
  }

  // dump a whole drive
  dumpDrive(userUUID, driveUUID) {
  }

  // create new directory inside given dirUUID
  // dirUUID cannot be a fileshare UUID
  async createDirectory({ userUUID, dirUUID, dirname }) {

    let node = this.data.findNodeByUUID(dirUUID)

    if (!node) throw new E.ENODENOTFOUND() 
    if (!node.isDirectory()) throw new E.ENOTDIR()
    // permission check
    if (!(this.userWritable(userUUID, node))) throw new E.EACCESS()

    // if already exists, EEXIST
    if (node.getChildren().find(child => child.name === dirname)) {
      throw new E.EEXIST()
    }
    
    try {
      //create new createDirectory
      let targetpath = path.join(node.abspath(), dirname)
      await fs.mkdirAsync(targetpath)
      let xstat = await readXstatAsync(targetpath)
      return this.data.createNode(node, xstat)
    }
    catch (err) {
      throw err
    }
    finally {
      if (node.parent) this.data.requestProbeByUUID(node.parent)
    }
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

  /**
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
  **/

  // check must be provided as boolean
  // early return null if check is true
  // name must be valid filename, this can be asserted with sanitize-filename TODO
  // src must be absolute path
  // hash is optional, if it is provided, it is trusted
  async createFileAsync(args) {

    let { userUUID, dirUUID, name, src, hash, check } = args

    // if check is true
    // userUUID, dirUUID, name, mandatory  
    // if check is false
    // userUUID, dirUUID, name, src, mandatory; hash optional

    let node = this.data.findNodeByUUID(dirUUID)
    if (!node) throw new E.ENODENOTFOUND()
    if (!node.isDirectory()) throw new E.ENOTDIR()
    if (!this.userWritable(userUUID, node)) throw new E.EACCESS()
    if (node.getChildren().map(n => n.name).includes(name)) throw new E.EEXIST()

    if (check === true) return null

    let dst = path.join(node.abspath(), name)

    try {

      // if failed, it is highly likely the path is invalid, so dir node should be probed
      await fs.renameAsync(src, dst)

      // read xstat
      let xstat = await readXstatAsync(dst) 

      // update hash if available
      if (hash) { 
        // no need to try / catch, we probe anyway
        xstat = await updateFileHashAsync(dst, xstat.uuid, hash, xstat.mtime)
      }

      // create node
      return this.data.createNode(node, xstat)
    }
    catch (e) {
      throw e
    }
    finally {
      this.data.requestProbeByUUID(dirUUID)
    }
  }

  // create file or check in user's library  
  async createLibraryFileAsync(args) {

    let { sha256, libraryUUID, src, check } = args

    let libraryNode = this.data.findNodeByUUID(libraryUUID)
    if(typeof sha256 !== 'string') throw new E.EINVAL()
    if (!libraryNode) throw new E.ENODENOTFOUND()
    if (!libraryNode.isDirectory()) throw new E.ENOTDIR()

    let node = libraryNode.getChildren()
      .find( l => l.name === sha256.slice(0, 2))

    if(node && node.isDirectory() && node.getChildren().map(l => l.name).includes(sha256.slice(2))) {
      throw new E.EEXIST()
    }
    if(check === true) return null

    let dstFolder = path.join(libraryNode.abspath(),sha256.slice(0, 2))    
    let dst = path.join(dstFolder, sha256.slice(2))
    try{
      await mkdirpAsync(dstFolder)
      await fs.renameAsync(src, dst)
       // read xstat
      let xstat = await readXstatAsync(dst) 

      //set xstat
      xstat = await updateFileHashAsync(dst, xstat.uuid, sha256, xstat.mtime)

      return xstat
    }catch(e){
      throw e
    }finally{
      this.data.requestProbeByUUID(libraryUUID)
    }
  }

  // overwrite existing file
  async overwriteFileAsync({ userUUID, srcpath, fileUUID, hash }) {
    let node = this.data.findNodeByUUID(fileUUID)
    if (!node) throw new E.ENODENOTFOUND()
    if (!node.isFile()) throw new E.ENOTDIR()
    if (!this.userWritable(userUUID, node)) throw new E.EACCESS()
    // if (node.getChildren().map(n => n.name).includes(name)) throw new E.EEXIST()
    let dst = node.abspath()
    try {

      //TODO remove old file

      await fs.renameAsync(srcpath, dst)

      let xstat = await readXstatAsync(dst) 

      // update hash if available
      if (hash) { 
        // no need to try / catch, we probe anyway
        xstat = await updateFileHashAsync(dst, xstat.uuid, hash, xstat.mtime)
      }

      // create node
      return this.data.createNode(node, xstat)
    }
    catch (e) {
      throw e
    }
    finally {
      this.data.requestProbeByUUID(fileUUID)
    }
  }

  // rename a directory or file
  async renameAsync({ userUUID, targetUUID, dirUUID, name }) {

    let dirnode = this.data.findNodeByUUID(dirUUID)
    let node = this.data.findNodeByUUID(targetUUID)
    if (!dirnode) throw new E.ENODENOTFOUND()

    if (!this.userWritable(userUUID, dirnode)) throw new E.EACCESS()
    if(typeof name !== 'string' || path.basename(path.normalize(name)) !== name) throw new E.EINVAL

    let newPath = path.join(path.dirname(node.abspath()), name)
    try{
      await fs.renameAsync(node.abspath(), newPath)
      let xstat = await readXstatAsync(newPath)
      this.data.updateNode(node, xstat)
      return node
    }catch(e){
      throw e
    }finally{
      if(node.parent) this.data.requestProbeByUUID(node.parent)
      else if(node.isDirectory()) this.data.requestProbeByUUID(targetUUID)
    }
    
  }

  // TODO: move a directory or file into given dirUUID
  move(userUUID, srcUUID, dirUUID, callback) {
    
  }
  
  // delete a directory or file
  // dirUUID cannot be a fileshare UUID
  async del({ userUUID, dirUUID, nodeUUID }) {
    
    let share = this.shareData.findShareByUUID(dirUUID)
    if (share) throw new E.ENOENT()

    let dirNode = this.data.findNodeByUUID(dirUUID)
    if (!dirNode) throw new E.ENODENOTFOUND()
    if (!dirNode.isDirectory()) throw new E.ENOTDIR() 

    let node = this.data.findNodeByUUID(nodeUUID)
    if (!node) throw new E.ENODENOTFOUND()

    if (!this.userWritable(userUUID, node)) throw new E.EACCESS()

    try {
      await rimrafAsync(node.abspath())
      await this.data.deleteNode(node)
      return 
    } 
    catch (err) {
      throw err
    } 
    finally {
      if (node.parent) this.data.requestProbeByUUID(node.parent)
    }
  }

  // for debug
  printFiles(args, callback) {
    let data = this.data.print()
    console.log('printFiles', data)
    process.nextTick(() => callback(null, data))
  }

  register(ipc){

    // ipc.register('createFileCheck', this.createFileCheck.bind(this))

    // ipc.register('createFile', this.createFile.bind(this))
    ipc.register('createFile', (args, callback) => 
      this.createFileAsync(args).asCallback(callback))
    ipc.register('createLibraryFile', (args, callback) =>
       this.createLibraryFileAsync(args).asCallback(callback))
    ipc.register('rename', (args, callback) => this.renameAsync(args).asCallback(callback))
    ipc.register('createDirectory', (args, callback) => this.createDirectory(args).asCallback(callback))
    ipc. register('overwriteFile', (args, callback) => this.overwriteFileAsync(args).asCallback(callback))
    ipc.register('list', (args, callback) => this.list(args).asCallback(callback))
    ipc.register('navList', (args, callback) => this.navList(args).asCallback(callback))
    ipc.register('tree', (args, callback) => this.tree(args).asCallback(callback))
    ipc.register('navTree', (args, callback) => this.navTree(args).asCallback(callback))
    ipc.register('readFile', (args, callback) => this.readFile(args).asCallback(callback))
    ipc.register('del', (args, callback) => this.del(args).asCallback(callback))

    ipc.register('printFiles', this.printFiles.bind(this)) 
  }
}

export default FileService
