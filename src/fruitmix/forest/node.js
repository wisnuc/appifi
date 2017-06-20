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
  destroy() { 
    this.detach()
    this.ctx = null
  }

  /**
  Returns the tree root. Tree root is not necessarily a drive root.
  */
  root() {
    let node = this   
    while (node.parent !== null) node = node.parent
    return node
  }

  /**
  Attaches this node to a parent node

  @throws When node is already attached
  */
  attach(parent) {

    if (this.parent !== null) 
      throw new Error('node is already attached')

    if (parent) {
      this.parent = parent
      parent.children.push(this)
    }
  } 

  /**
  Detaches this node from the parent node

  @throws When node is not in parent's children list
  */
  detach() {

    if (this.parent === null) return 

    let index = this.parent.children.findIndex(child => child === this) 
    if (index === -1)
      throw new Error("`this` is not in parent's children list")

    this.parent.children.splice(index, 1)
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

  nodepath() {
    
    if (!this.ctx) throw new Error('nodepath: node is already destroyed')

    let q = []
    for (let node = this; node !== null; node = node.parent)
      q.unshift(node)

    return q 
  }

  /**
  Return Absolute path of the node

  @throws When node has been destroyed or disconnected from a drive root
  */
  abspath() { 

    if (!this.ctx) throw new Error('abspath: node is already destroyed')

    let q = []
    for (let node = this; node !== null; node = node.parent)
      q.unshift(node)

    // the first one must be root FIXME
//    if (!this.ctx.isRoot(q[0])) 
//      throw new Error('abspath: node is not a descendant of drive root')

    return path.join(this.ctx.dir, ...q.map(n => n.name))
  }
}

module.exports = Node
