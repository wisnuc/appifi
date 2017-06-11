const path = require('path')

/**
Abstract base class for file system tree node
*/
class Node {

  /**
  @param {Forest} ctx - Context, forest singleton
  */
  constructor(ctx, paused) {

    this.ctx = ctx
    this.parent = null
    this.paused = paused
  }

  /**
  Return tree root 
  */
  root() {
    let node = this   
    while (node.parent !== null) node = node.parent
    return node
  }

  /**
  Attach this node to a parent node
  */
  attach(parent) {
    
    if (this.parent !== null)
      throw new Error('node is already attached')

    this.parent = parent
    if (parent) parent.setChild(this)
  } 

  /**
  Detach this node from parent node
  */
  detach() {
    if (this.parent === null) throw new Error('node is already detached')
    this.parent.unsetChild(this)
    this.parent = null
  }

  /**
  pre-visitor
  */
  preVisit(func) {
    func(this)
    if (this.children) 
      this.children.forEach(child => child.preVisit(func)) 
  }

  /**
  post-visitor
  */
  postVisit(func) {

    if (this.children)
      this.children.forEach(child => child.postVisit(func))
    func(this) 
  }

  /**
  return node array starting from root
  */
  nodepath() {

    let q = []
    for (let node = this; node !== null; node = node.parent) 
      q.unshift(n)

    return q
  } 

  /**
  FIXME
  */
  getDrive() { 

    for (let n = this; n !== null; n = n.parent) {
      if (n.parent === this.ctx.root) return n.drive
    }
    
    throw new E.ENODEDETACHED()
  }

  /**
  FIXME
  */
  abspath() { 
    return path.join(this.ctx.dir, ...this.nodepath().map(n => n.name))
  }

  /**
  */
  walkdown(names) {
    // TODO
  }

  /**
  whether a 
  */
  isPaused() {
    if (this.paused) return true
    return this.children
      ? this.children.some(child => child.isPaused())
      : false
  }

  /**
  pause
  */
  pause() {
  }

  /**
  resume
  */
  resume() {
  }
}

module.exports = Node
