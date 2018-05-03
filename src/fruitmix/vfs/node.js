const path = require('path')

/**
Abstract base class for file system tree node.
*/
class Node {

  /**
  Constructs a new Node
  @param {Forest} ctx - Forest singleton
  */
  constructor(ctx, parent) {
    this.ctx = ctx
    this.parent = null
    this.attach(parent)
  }

  /**
  Destroys the node
  */
  destroy (detach) { 
    this.ctx = null
    if (detach) this.detach()
  }

  /**
  Returns the tree root. Tree root is not necessarily a drive root.
  */
  root () {
    let node = this   
    while (node.parent !== null) node = node.parent
    return node
  }

  /**
  Attaches this node to a parent node

  @throws When node is already attached
  */
  attach (parent) {
    if (this.parent !== null) throw new Error('node.attach: node is already attached')
    if (parent) {
      this.parent = parent
      parent.children.push(this)
    }
  } 

  /**
  Detaches this node from the parent node

  @throws When node is not in parent's children list
  */
  detach () {
    if (this.parent === null) return 
    let index = this.parent.children.indexOf(this)
    if (index === -1) throw new Error("node.detach: node is not in parent's children list")
    this.parent.children.splice(index, 1)
    this.parent = null
    // console.log('after detach :', this)
  }

  isAttached () {
    return this.parent instanceof Node
  }

  isDetached () {
    return this.parent === null
  }

  reattach (parent) {
    this.detach()
    this.attach(parent)
    this.updateName()
  }

  /**
  pre-visitor
  */
  preVisit(func) {
    func(this)
    if (this.children) this.children.forEach(c => c.preVisit(func)) 
  }

  /**
  return node array by previsit
  */
  linearize() {
    let ns = []
    this.preVisit(n => ns.push(n))
    return ns
  }

  /**
  post-visitor
  */
  postVisit(func) {
    if (this.children) this.children.forEach(c => c.postVisit(func))
    func(this) 
  }

  /**
  Returns an array of node along path, starting from root node
  */
  nodepath() {
    if (!this.ctx) throw new Error('node.nodepath: node is already destroyed')
    let q = []
    for (let n = this; n !== null; n = n.parent) q.unshift(n)
    return q 
  }

  reverseNodePath () {
    if (!this.ctx) throw new Error('node.nodepath: node is already destroyed')
    let q = []
    for (let n = this; n !== null; n = n.parent) q.push(n)
    return q
  }

  /**
  Return Absolute path of the node

  @throws When node has been destroyed or disconnected from a drive root
  */
  abspath() { 
    if (!this.ctx) throw new Error('node.abspath: node is already destroyed')
    let q = [] 
    for (let n = this; n !== null; n = n.parent) q.unshift(n)
    return path.join(this.ctx.dir, ...q.map(n => n.name))
  }

  /**
  Return the relative node path from ancestor to this node
  */
  relpath(ancestor) {
    let q = [] 
    for (let n = this; n !== ancestor; n = n.parent) {
      if (n === null) return
      q.unshift(n)
    }
    return q
  }
}

module.exports = Node
