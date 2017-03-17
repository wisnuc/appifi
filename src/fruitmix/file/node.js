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
    this.ctx.nodeAttached()
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

  abspath() {
  }

  nodepath() {
    let q = []
    this.upEach(node => q.unshift(node))
    return q
  } 

  namepath() {
    return path.join(...this.nodepath().map(n => n.name))
  }

  walkdown(names) {
    // TODO
  }

  // abort workers
  abort() {
    if (this.worker) this.worker.abort()
    
  }

}







