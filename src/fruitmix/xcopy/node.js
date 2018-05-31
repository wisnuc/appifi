const EventEmitter = require('events')

/**
The abstract base class for different type of sub-tasks

@memberof XCopy
*/
class Node extends EventEmitter {

  /**
  Create a node
  @param {object} ctx - ctx should be the containing task.
  @param {object} parent - parent directory or null.
  */
  constructor (ctx, parent) {
    super()
    this.ctx = ctx
    if (parent) {
      this.attach(parent)
    } else {
      this.parent = null
    }
    this.policy = []
  }

  /**
  Destroy a node. 
  ctx is reset and could be used to determine if a node is destroyed.
  */
  destroy () {
    this.state.destroy()
    this.ctx = null
    if (this.parent) this.detach()
  }

  /**
  Returns whether the node is already destroyed
  */
  isDestroyed () {
    return this.ctx === null
  }

  /**
  Attach to parent node
  @param {object} parent - parent directory
  */
  attach (parent) {
    if (this.parent) {
      let err = new Error('not already attached')
      console.log(err)
      throw err
    }
    this.parent = parent   
    parent.children.push(this)
  }

  /**
  Detach from parent node
  */
  detach () {
    let index = this.parent.children.indexOf(this)
    if (index === -1) {
      let err = new Error("node not found in parent's children")  
      console.log(err)
      throw err
    }
    this.parent.children.splice(index, 1)
    this.parent = null
  }

  /**
  Returns root node
  */
  root () {
    let node = this
    while (node.parent !== null) node = node.parent
    return node
  }

  /**
  Visit all nodes with function f. Implemented as pre-visitor.
  */

/**
  visit (f) {
    f(this)
    if (this.children) this.children.forEach(c => c.visit(f)) 
  }
**/

  visit (f) {

    if (this.children) 
      for (let i = 0; i < this.children.length; i++) {
        let x = this.children[i].visit(f)
        if (x) return x
      }

    return f(this)
  }

  /**
  Visit tree nodes with function f and returns the first node on which f evaluates true.
  @param {function} f - function that applys to node
  */
  find (f) {
    if (f(this) === true) return this
    // if (this.children) return this.children.find(c => c.find(f))
    if (this.children) { 
      for (let index in this.children) {
        let obj = this.children[index].find(f)
        if(obj) return obj
      }
    }
  }

  /**
  Returns current state name
  */
  getState () {
    return this.state.getState()
  }

  /**
  Set state by state name

  @param {string} state - state name
  */
  setState (state) {
    this.state.setState(state)
  }

  /**
  Generate name path from root
  */
  namepath () {
    let arr = []
    for (let n = this; n; n = n.parent) arr.unshift(n.src.name)
    return arr.join('/')
  }

  /**
  Update this node's policy and retry
  */
  update (props) {
    let policy = props.policy 
    this.policy[0] = policy[0] || this.policy[0]
    this.policy[1] = policy[1] || this.policy[1]
    this.retry()
  }

  /**
  Go to Working state if current state is Conflict or Failed. Otherwise, do nothing. 
  */
  retry () {
    let s = this.getState()
    if (s === 'Conflict' || s === 'Failed') {
      this.setState('Working')
    }
  }

  /**
  Returns view
  */
  view () {
    let obj = {
      type: this.type,
      parent: this.parent && this.parent.src.uuid,
      src: this.src,
      dst: this.dst,
      policy: this.policy,
      state: this.state.getState()
    }

    return Object.assign(obj, this.state.view())    
  }
}

module.exports = Node
