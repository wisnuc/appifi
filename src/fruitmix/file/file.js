const Promise = require('bluebird')
const path = require('path')
const EventEmitter = require('events')
const E = require('../lib/error')
const pretty = require('prettysize')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const log = require('winston')

const hash = require('./worker/hash')
const identify = require('./identify')
const probe = require('./probe')

/**
This module is the core module for fruitmix virtual file system.

@module file
*/

/**
Abstract base class for tree node
*/
class Node {

  /**
  @param {Object} ctx - Context, fileData singleton
  */
  constructor(ctx) {
    this.ctx = ctx
    this.worker = null
    this.parent = null
  }

  /**
  return true if this node is a FileNode
  */
  isFile() {
    return this instanceof FileNode
  }

  /**
  return true if this node is a DirectoryNode
  */
  isDirectory() {
    return this instanceof DirectoryNode
  }

  /**
  return true if this node is a DriveNode
  */
  isDrive() {
    return this instanceof DriveNode
  }

  /**
  return root node of this node
  */
  root() {
    let node = this
    while (node.parent !== null) node = node.parent
    return node
  }

  /**
  return drive UUID of this node
  @throws When root node is not a DriveNode
  */
  driveUUID() {
    if (!this.root().isDrive()) 
      throw new Error('root node is not a DriveNode') 
    return this.root().driveUUID
  }

  /**
  return node array starting from root
  @throws When root node is not a DriveNode
  */
  nodepath() {

    let node, q = []
    for (node = this;;node = node.parent) {
      q.unshift[node]
      if (node.parent === null) { // this is root node
        if (!node.isDrive())
          throw new Error('root node is not a DriveNode')
        return q 
      }
    }
  }   

  /**
  return absolute path 
  @throws When root node is not a DriveNode
  */
  abspath() { 
    return path.join(this.ctx.dir, ...this.nodepath().map(n => n.name))
  }

  /**
  Attach this node to a parent node
  @param {DirectoryNode} parent - parent node to attach 
  @throws When node is already attached, or, parent is not a DirectoryNode
  */
  attach(parent) {
    if (this.parent !== null) throw new Error('node is already attached') 
    if (!(parent instanceof DirectoryNode)) throw new Error('parent is not a directory node')
    this.parent = parent
    parent.setChild(this)
    this.ctx.nodeAttached(this)
  } 

  /**
  Detach this node from parent node
  */
  detach() {
    this.ctx.nodeDetaching(this)
    if (this.parent === null) throw new Error('node is already detached')
    this.parent.unsetChild(this)
    this.parent = null
  }

  /**
  Pre-visitor

  @param {function} func - function applied to each node
  */
  preVisit(func) {
    func(this)
    if (this.children) this.children.forEach(child => child.preVisit(func)) 
  }

  /**
  Post-visitor

  @param {function} func - function applied to each node
  */
  postVisit(func) {
    if (this.children)
      this.children.forEach(child => child.postVisit(func))
    func(this) 
  }

  walkdown(names) {
    // TODO
  }

  /**
  Abort worker
  */
  abort() {
    if (this.worker) {
      this.worker.abort()
      this.worker = null
    }
  }

  /*
  Generate an JavaScript object, for debugging
  genObject() {
    return this
      .children
      .reduce((acc, c) => {
        acc[c.name] = c.genObject() 
        return acc
      }, {})
  }
  */
}

/**
FileNode is a tree node representing a regular file.

If a file has a interested magic but no hash, hash should be calculated.
If a file has a hash and (externally) meta has not been extracted yet, meta should be extracted.
*/
class FileNode extends Node {

  // create file node
  constructor(ctx, xstat) {
    super(ctx)

    this.uuid = xstat.uuid
    this.name = xstat.name 
    this.mtime = xstat.mtime
    this.size = xstat.size
    this.magic = xstat.magic
    this.hash = xstat.hash
  }

  identify() {
    this.worker = identify(this.abspath(), this.uuid, this.hash)
    this.worker.on('error', err => {
      this.worker = null
      this.ctx.identifyStopped(this)
    })

    this.worker.on('finish', metadata => {
      this.worker = null
      this.ctx.identifyStopped(this)
      this.ctx.emit('mediaIdentified', this, metadata)
    })

    this.worker.start()
    // this.worker = this.createIdentifyWorker(() => {
    //   this.worker = null
    //   if (err) return // TODO:
    //   this.ctx.emit('mediaIdentified', this, metadata)
    // })
  }

  // before update
  updating(xstat) {
    this.abort()
    if (this.magic && this.hash) {                  // already appeared
      if (!xstat.magic || xstat.hash !== this.hash) // not media or hash changed
        this.ctx.emit('mediaDisappearing', this)
    }
  }

  // after update
  updated() {

    if (typeof this.magic !== 'string') return

    if (this.hash && this.magic) 
      this.ctx.emit('mediaAppeared', this)
    else {
      this.worker = hash(this.abspath(), this.uuid)
      this.worker.on('error', err => {
        this.worker = null
        this.ctx.hashStopped(this)
      })

      this.worker.on('finish', xstat => {
        this.worker = null
        this.ctx.hashStopped(this)
        this.update(xstat)
      })

      this.worker.start()
    }
  }

  // attach
  attach(parent) {
    super.attach(parent)
    this.updated()
  }

  update(xstat) {

    if ( this.name === xstat.name
      && this.mtime === xstat.mtime
      && this.size === xstat.size
      && this.magic === xstat.magic
      && this.hash === xstat.hash)
      return

    this.updating(xstat)

    this.name = xstat.name
    this.mtime = xstat.mtime
    this.size = xstat.size
    this.magic = xstat.magic
    this.hash = xstat.hash

    this.updated()
  }

  detach() {
    this.abort()
    if (this.magic && this.hash)      
      this.ctx.emit('mediaDisappearing', this)
    super.detach()
  }

  isFile() {
    return true
  }

  genObject() {
    // return pretty(this.size) + ' ' + (this.hash ? this.hash.slice(0, 8) : '')
  }
}

/**
DirectoryNode is a tree node representing a directory.
*/
class DirectoryNode extends Node {

  constructor(ctx, xstat) {
    super(ctx)
    this.children = []
    this.uuid = xstat.uuid
    this.name = xstat.name
    this.mtime = -xstat.mtime
  }

  isDirectory() {
    return true
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
    if (index === -1) throw new Error('Node has no given child')
    this.children.splice(index, 1)
  }

  merge(mtime, xstats) {

    let map = new Map(xstats.map(x => [x.uuid, x]))
    let children = this.children

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

  /**
  Inherits base class method, start probing
  */
  attach(parent) {
    super.attach(parent) 
    this.probe()
  }

  update(xstat) {
    this.name = xstat.name   
    if (this.mtime !== xstat.mtime) this.probe()
  }

  /**
  Inherits base class method, recursively detaching children, abort probing if any
  */
  detach() {
    [...this.children].forEach(c => c.detach())
    this.abort()
    super.detach()
  }

}

class DriveNode extends DirectoryNode {

  constructor(ctx, xstat, drive) {
    super(ctx, xstat)
    this.driveUUID = driveUUID
  }
}

class File extends EventEmitter {

  constructor() {
    super()
  }

  async initAsync(drivesDir, tmpDir) {

    this.dir = drivesDir
    this.roots = []
    this.uuidMap = new Map()
  }

  findNodeByUUID(uuid) {
    return this.uuidMap.get(uuid)   
  }

  createDrive(driveUUID) {
    let dir = path.join(this.dir, driveUUID)   
    mkdirp(dir, err => {
      if (err) return console.log(err)
      forceDriveXstat(dir, driveUUID, (err, xstat) => {
        if (err) return console.log(err) 
        let node = new DriveNode(this, xstat, driveUUID)
        node.attach(this.root)
      })
    })
  }    

  deleteDrive(driveUUID) {

  } 

  nodeAttached(node) {
    this.uuidMap.set(node.uuid, node)
  } 

  nodeDetaching(node) {
    this.uuidMap.delete(node.uuid)
  } 
}

module.exports = new File()
