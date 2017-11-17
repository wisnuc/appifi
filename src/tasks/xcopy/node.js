const EventEmitter = require('events')

class Node extends EventEmitter {

  constructor (ctx, parent) {
    super()
    this.ctx = ctx
    this.parent = null
    
    this.attach(parent)
  }

  destroy (detach) {
    this.ctx = null
    if (detach) this.detach()
  }

  attach (parent) {
    if (parent) {
      this.parent = parent   
      parent.children.push(this)
    }
  }

  detach () {
    console.log('detach')
    let index = this.parent.children.indexOf(this)
    if (index === -1) throw new Error('xcopy.node.detach failed') 
    this.parent.children.splice(index, 1)
    this.parent = null
  }

  root () {
    let node = this
    while (node.parent !== null) node = node.parent
    return node
  }

  view () {

  }

  visit (f) {
    f(this)
    if (this.children) this.children.forEach(c => c.visit(f)) 
  }

  find (f) {
    if (f(this) === true) return this
    if (this.children) return this.children.find(c => c.find(f))
  }

  resolveFileConflict () {
    if (this.policies && this.policies.file) return this.policies.file

    let parent = this.parent
    if (parent.policies && parent.policies.file) return this.policies.file

    // a for ancestor
    for (let a = parent.parent; a !== null; a = a.parent) {
      if (a.policies && a.policies.file && a.policies.fileRecursive)
        return a.policies.file
    }
  
    return null
  }

  resolveDirConflict () {
    if (this.policies && this.policies.dir) return this.policies.dir

    for (let a = this.parent; a !== null; a = a.parent) {
      if (a.policies && a.policies.dir && a.policies.dirRecursive) 
        return a.policies.dir
    }

    return null
  }
}

module.exports = Node
