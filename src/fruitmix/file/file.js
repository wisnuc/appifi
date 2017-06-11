const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const E = require('../lib/error')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const log = require('winston')

const hash = require('../worker/hash')
const probe = require('../worker/probe')

/*
File module cache a dir node tree in memory. 

Different from previous version, only interested file node are kept in memory.

File operation have three contexts:

1. drive, dir, and file

File operation should be considered to have three steps:

First, check parent directory, this confirms the dir context. If the dir changed, even if the file path exists, we consider it an error.

In this stage, if error occurs:

1. stats is file
2. ENOENT, which means parent directory disappears. 
3. ENOTDIR, which means there is an entry along path that is not a directory. 

In these cases, parent node should be removed immediately.

Second, do operation, create or rename

...


*/

const { 
  readXstatAsync,
  forceDriveXstatAsync 
} = require('./xstat')


/**
  
*/
class File {

  constructor(dir, xstat) {

    if (typeof xstat.magic !== 'string') throw new Error('MediaFile must have magic string')

    this.dir = dir                  // parent folder, fixed
    this.uuid = xstat.uuid
    this.name = xstat.name
    this.magic = xstat.magic        // maybe a string or number
    this.hash = xstat.hash          // optional
    this.hash ? this.enterHashed() : this.enterHashless()
    this.pause = dir.pause
  }

  state() {
    return this.hash ? 'hashed' : 'hashless'
  }

  enter() { 
    switch(this.state()) {
    case 'hashless':
      break
    case 'hashed':
      this.dir.ctx.indexMedia(this)
      break
    default:
      break
    }
  }

  exit() {
    switch(this.state()) {
    case 'hashless':
      break
    case 'hashed':
      this.dir.ctx.unindexMedia(this)
      break
    default:
      break
    }
  }

  update(xstat) {
 
    if (xstat.magic !== 'string') throw new Error('MediaFile must have magic string')    
    if (xstat.uuid !== this.uuid) throw new Error('MediaFile uuid cannot be changed')

    // nothing to do
    if (this.name === xstat.name && this.hash === xstat.hash) return
    
    if (this.state() === 'hashed') {
      this.name = xstat.name 
      if (!xstat.hash) {          // hash dropped, state transfer
        this.exit()
        delete this.hash
        this.enter()
      }
      else {
        this.hash = xstat.hash    // this is curious, but possible
      }
      return
    }

    if (this.state() === 'hashless') {
      if (!xstat.hash) {          // still no hash, then name must be changed
         
      } 
    }
  }

  pause() {
    if (this.state() === 'hashless') {
      this.worker.abort()
      this.worker = null
    }
    this.pause = true
  }

  resume() {
    this.pause = false
    if (this.state() === 'hashed') {
    }
  }
}

/**
*/
class Directory {

  constructor(ctx, xstat, dirty = true) {

    /**
    context

    @type {string}
    */
    this.ctx = ctx

    // recursive structure
    this.parent = null
    this.children = []

    // files
    this.files = []

    // identity
    this.uuid = xstat.uuid
    this.name = xstat.name

    // mtime
    this.mtime = xstat.mtime
    this.dirty = dirty
    this.probeCount = 0

    this.worker = null
  } 

  /**
  Add a child node
  */
  setChild(child) {
    this.children.push(child) 
  }

  /**
  Remove a child node
  */
  unsetChild(child) {
    let index = this.children.findIndex(c => c === child)
    if (index === -1) throw new Error('Directory has no given child')
    this.children.splice(index, 1)
  }

  /**
  attach this dir to a parent dir
  @param {(null|Dir)} parent - parent node to attach, or null
  @throws When node is already attached, or, parent is not a DirectoryNode
  */
  attach(parent) {

    if (this.parent !== null) 
      throw new Error('node is already attached') 

    if (parent === null) {
    }
    else {
      if (!(parent instanceof Directory)) 
        throw new Error('parent is not a node')
      this.parent = parent
      parent.setChild(this)
    }

    this.ctx.nodeAttached(this)
  } 

  /**
  return node array starting from root
  @throws When root node is not a DriveNode
  */
  nodepath() {

    let q = []
    for (let node = this; node !== null; node = node.parent)
      q.unshift(node)

    return q
  }   

  /**
  return absolute path 
  @throws When root node is not a DriveNode
  */
  abspath() { 
    return path.join(this.ctx.dir, ...this.nodepath().map(n => n.name))
  }

  /**
  merge probed result to update
  */
  merge(mtime, xstats) {

    let map = new Map(xstats.map(x => [x.uuid, x]))
    let children = this.getChildren()

    let lost = []
    children.forEach(c => {
      let xstat = map.get(c.uuid)
      if (!xstat) return lost.push(c)
      c.update(xstat)
      map.delete(c.uuid)
    })

    lost.forEach(l => l.detach())

    // found
    map.forEach(xstat => {

      let node = xstat.type === 'directory' 
        ? new DirectoryNode(this.ctx, xstat)
        : xstat.type === 'file' 
          ? new FileNode(this.ctx, xstat)
          : undefined
        
      node && node.attach(this)
    })

    this.mtime = mtime 
  }

  mergeDstats(dstats) {

    this.children
      .reduce((lost, child) => {
        let xstat = dstats.find(xstat => xstat.uuid === child.uuid)
        if (xstat) 
          child.update(xstat)
        else 
          lost.push(child)
        return lost
      }, [])
      .forEach(x => x.detach())


    dstats
      .filter(x => !this.children.find(y => y.uuid === x.uuid))
      .forEach(x => new Directory(this.ctx, x).attach(this))
  }

  mergeFstats(fstats) {

    let remain = this.children.filter(x => fstats.find(y => y.uuid === x.uuid))

    let lost = this.children.filter(x => !fstats.find(y => y.uuid === x.uuid))

    let found = fstats.filter(x => !this.children.find(y => y.uuid === x.uuid))
  }

  merge2(mtime, xstats) {
   
    let fstats = xstats.filter(x => x.type === 'file' && typeof x.magic === 'string') 
    let dstats = xstats.filter(x => x.type === 'directory')

    dstats.forEach(dstat => {
       
    })

    fstats.forEach(fstat => {
    })
  }

  /**
  probe is the core function to update (reconciliate) the tree
  */
  probe() {

    if (this.worker) return this.worker.request()

    let dpath = this.abspath()
    let uuid = this.uuid
    let mtime = this.mtime
    let delay = mtime < 0 ? 0 : 500

    this.ctx.probeStarted(this) // audit
    this.worker = probe(dpath, uuid, mtime, delay)

    // 
    this.worker.on('error', (err, again) => {
      
      this.worker = null
      this.ctx.probeStopped(this) // audit

      if (err.code === 'EABORT') return

      // if parent`s exist 
      this.parent ? this.parent.probe() : this.probe()
      return
    })

    this.worker.on('finish', (data, again) => {

      this.worker = null
      this.ctx.probeStopped(this) // audit

      if (data) this.merge(data.mtime, data.xstats)
      if (again) this.probe()
    })

    this.worker.start()
  }
}

class Forest extends EventEmitter {

  constructor() {
    super()
  }

  async initAsync(drivesDir, tmpDir) {

    this.dir = drivesDir
    this.roots = []
    this.uuidMap = new Map()
    this.hashMap = new Map()
  }

  findDirectoryByUUID(uuid) {
    return this.uuidMap.get(uuid)   
  }

  /**
  given a dir path, returns xstat lists.
  */
  async listDirAsync(dirPath) {

    let entries = await fs.readdirAsync(dirPath) 

    return await Promise
      .map(entries, entry => new Promise((resolve, reject) => {
        readXstatAsync(path.join(dirPath, entry))
          .then(x => resolve(x))
          .catch(e => resolve(null))
      }))
      .filter(x => !!x)
  }

  /**
  */
  async scanNewDirAsync(dir) {
    
    let xstats = await this.listDirAsync(dir.abspath())
    xstats.filter(x => x.type === 'directory')
      .forEach(x => {
        let child = new Directory(this, x, false)
        child.attach(dir)
      })

    await Promise.map(dir.children, child => this.scanNewDirAsync(child))
  }

  async createDriveAsync(drive, scanDone) {

    let driveUUID = drive.uuid
    let dirPath = path.join(this.dir, driveUUID)   
    await mkdirpAsync(dirPath)
    let xstat = await forceDriveXstatAsync(dirPath, driveUUID)
    let dir = new Directory(this, xstat, false)
    dir.attach(null)
    this.roots.push(dir)
    this.scanNewDirAsync(dir)
      .then(() => scanDone && scanDone())
      .catch(e => console.log(e))
  }    

  deleteDrive(driveUUID) {
     
  } 

  nodeAttached(node) {
    this.uuidMap.set(node.uuid, node)
  } 

  nodeDetaching(node) {
    this.uuidMap.delete(node.uuid)
  } 

  mediaFound(file) {

    if (this.hashMap.has(file.hash)) 
      this.hashMap.get(file.hash).add(file)
    else 
      this.hashMap.set(file.hash, new Set([file]))
  }

  mediaLost(file) {
    this.hashMap.get(file.hash).delete(file)
  }

  async mkdirAsync(parent, name) {

    if (!parent instanceof Directory) throw new Error('mkdirAsync: parent is not a dir node')

    let dirPath = path.join(parent.abspath(), name)
    await fs.mkdirAsync(dirPath)
    let xstat = await readXstatAsync(dirPath)
    let node = new Directory(this, xstat)
    node.attach(parent)
    return node
  }

  async renameDirAsync(node, name) {

    let oldPath = node.abspath()
    let newPath = path.join(path.dirname(oldPath), name)
    await fs.renameAsync(oldPath, newPath)
    let xstat = await readXstatAsync(newPath)

    // TODO node.uuid === xstat.uuid ?
   
    node.name = xstat.name
    return node
  }
}

module.exports = new Forest()

