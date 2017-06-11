const Node = require('./node')
const Readdir = require('./readdir')

/**

readdir state:
+ running (requested, callbacks, worker)
+ 

*/
class Directory extends Node {
 
  /**
  @param {Forest} ctx - reference to forest
  @param {xstat} xstat - an xstat object, must be directory 
  */ 
  constructor(ctx, xstat) {

    if (xstat.type !== 'directory') 
      throw new Error('xstat is not a directory')
    
    super(ctx)

    /**
    array of child directory
    */
    this.children = []

    /**
    uuid
    */
    this.uuid = xstat.uuid

    /**
    directory name
    */
    this.name = xstat.name

    /**
    directory timestamp
    */
    this.mtime = xstat.mtime

    /**
    probe timer
    */
    this.timer = -1
    
    /**
    pending read request
    */
    this.pending = false

    /**
    readdir callbacks
    */
    this.queue = []

    /**
    readdir worker
    */
    this.reader = null

    /**
    readdir count in subtree
    */
    this.count = 0
  }

  isDrive() {
    return !!this.basePath 
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
  Attach this dir to a parent dir
  @param {(null|Dir)} parent - parent node to attach, or null
  @throws When node is already attached, or, parent is not a DirectoryNode
  */
  attach(parent) {

    if (this.parent !== null) throw new Error('node is already attached') 

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
  */
  detach() {
    [...this.children].forEach(child => child.detach)
    [...this.files].forEach(file => file.detach)
     
  }

  /**
  return node array starting from root
  */
  nodepath() {

    let q = []
    for (let node = this; node !== null; node = node.parent)
      q.unshift(node)

    return q
  }   

  /**
  return absolute path 

  @throws When root node is not a Drive
  */
  abspath() {
    return path.join(this.root().basePath, ...this.nodepath().map(n => n.name))
  }

  // error handling
  childMissing(code) {
  }

  // error handling
  fileMissing(code) {
  }

  readAfter(n = 1) {

    clearTimeout(this.timer)
    this.timer = setTimeout(() => {

      if (this.paused) return this.readAfter()

      readXstat(this.abspath(), (err, xstat) => {

        if (this.paused) return this.readAfter()

        if (err) return // TODO
        if (xstat.mtime !== this.mtime) this.readdir()
      })
    }, n * 128)
  }

  startReader() {

    // clear pending
    this.pending = false

    this.queue = []
    this.worker = Readdir(this.abspath(), this.uuid, (err, xstats, mtime, transient) => {

      // fires all callbacks
      this.queue.forEach(cb => cb(err))
      this.queue = []
      this.worker = null
      
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === 'EINSTANCE')) {
        // suicide

        return
      }

      if (err && err.code === 'EABORT') {
        // nothing to do
        return
      }
     
      if (err) { // other io error
        if (this.request) {
          this.enterRunning()
        } 
        else {
          this.requestProbe()
        }
        return
      }

      this.update(xstats, mtime)

      // here we take request, timer, and transient into consideration
      // if request, re-run anyway, until there is no further requests
      if (this.request) {
        this.enterRunning()
        return
      }

      this.mtime = mtime
      this.requestProbe()
    })
  }

  stopReader() { 
    
  }

  /**
  read (for all states)
  */
  read(callback) {

    if (this.paused) {

      if (callback) return callback(new Error('EAGAIN'))    // TODO
      this.pending = true
      return
    }

    if (this.reader) {                      // running state

      if (callback) 
        this.queue.push(callback)
      else
        this.pending = true
      return
    }

    this.startReader()
  }

  /**
  pause only applicable for free-idle and running states
  */
  pause() { 

    if (this.paused) throw new Error('already paused')

    if (this.reader) {  
      this.stopReader()
      this.pending = true
    }
    this.paused = true
  }

  /**
  resume only applicable for paused-idle and pending states
  */
  resume() {

    if (!this.paused) throw new Error('not paused') 

    this.paused = false
    if (this.pending) this.startReader()
  }

  /**
  This is 
  */
  async readdirAsync() {

    return await new Promise((resolve, reject) => 
      this.readdir((err, xstats) =>
        err ? reject(err) : resolve(xstats)))
  }
}

module.exports = Directory





