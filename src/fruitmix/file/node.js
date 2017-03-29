import path from 'path'

class Node {

  constructor(ctx) {
    this.ctx = ctx
    this.worker = null
    this.parent = null
  }

  root() {
    let node = this   
    while (node.parent !== null) node = node.parent
    return root
  }

  setChild(child) {
    this.children 
      ? this.children.push(child) 
      : this.children = [ child ]
  }

  unsetChild(child) {
    let children = this.children
    if (children === undefined) throw new Error('Node has no children')
    let index = children.findIndex(c => c === child)
    if (index === -1) throw new Error('Node has no such child')
    children.splice(index, 1)
    if (children.length === 0) delete this.children 
  }

  getChildren() {
    return this.children
      ? this.children
      : []
  }

  attach(parent) {

    if (this.parent) throw new Error('node is already attached')
    this.parent = parent
    if (parent) parent.setChild(this)
    this.ctx.nodeAttached(this)
  } 

  detach() {

    this.ctx.nodeDetaching(this)
    if (this.parent === null) throw new Error('node is already detached')
    this.parent.unsetChild(this)
    this.parent = null
  }

  upEach(func) {
    let node = this
    while (node !== null) {
      func(node)
      node = node.parent
    }
  }

  upFind(func) {
    let node = this
    while (node !== null) {
      if (func(node)) return node
      node = node.parent
    }
  }

  preVisit(func) {

    func(this)
    if (this.children) 
      this.children.forEach(child => child.preVisit(func)) 
  }

  postVisit(func) {

    if (this.children)
      this.children.forEach(child => child.postVisit(func))
    func(this) 
  }

  // return node array starting from drive node 
  nodepath() {

    let q = []
    for (let n = this; n !== null; n = n.parent) {
      if (n === this.ctx.root) return q
      q.unshift(n)
    }

    throw new Error('the node is off-tree')
  } 

  // return drive node
  getDrive() { 

    for (let n = this; n !== null; n = n.parent) {
      if (n.parent === this.ctx.root) return n.drive
    }
    
    throw new Error('the node is off-tree')
  }

  abspath() { 

    return path.join(this.ctx.dir, ...this.nodepath().map(n => n.name))
  }

  namepath() {

    return path.join(...this.nodepath().map(n => n.name))
  }

  walkdown(names) {
    // TODO
  }

  // abort workers // TODO nullify worker?
  abort() {
    if (this.worker) this.worker.abort()
  }

  isFile() {
    return false
  }

  isDirectory() {
    return false
  }

}


export default Node




