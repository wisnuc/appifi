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
}

module.exports = Node
