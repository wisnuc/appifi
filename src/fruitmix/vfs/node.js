const path = require('path')

/**
Abstract base class for file system tree node.
*/
class Node {

  /**
  Constructs a new Node
  @param {Forest} ctx - Forest singleton
  */
  constructor(parent) {
    if (parent) {
      this.attach(parent)
    } else {
      this.parent = null
    }
  }

  /**
  Returns the tree root. Tree root is not necessarily a drive root.
  */
  root() {
    let n = this   
    while (n.parent !== null) n = n.parent
    return n
  }

  /**
  Attaches this node to a parent node

  @throws When node is already attached
  */
  attach(parent) {
    if (this.parent !== null) throw new Error('node is already attached')
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

    let index = this.parent.children.indexOf(this) 
    if (index === -1) throw new Error("`this` is not in parent's children list")
    this.parent.children.splice(index, 1)
    this.parent = null
  }

  /**
  pre-visitor
  */
  preVisit(func) {
    func(this)
    if (this.children) this.children.forEach(c => c.preVisit(func)) 
  }

  /**
  post-visitor
  */
  postVisit(func) {
    if (this.children) this.children.forEach(c => c.postVisit(func))
    func(this) 
  }

  nodepath() {
    let q = []
    for (let n = this; n !== null; n = n.parent) q.unshift(n)
    return q 
  }

}

module.exports = Node
