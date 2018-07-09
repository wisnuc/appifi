const EventEmitter = require('events')

const sortF = (a, b) => a.type !== b.type
  ? a.type === 'directory' ? -1 : 1
  : a.src.name.localeCompare(b.src.name)

/**
The base class for xdir and xfile
*/
class XNode extends EventEmitter {
  /**
  Create a node
  @param {object} ctx - ctx should be the containing task.
  @param {object} parent - parent directory or null.
  */
  constructor (ctx, parent = null) {
    super()
    this.ctx = ctx
    this.parent = parent
    this.policy = []
  }

  /**
  Destroy a node.
  ctx is reset and could be used to determine if a node is destroyed.
  */
  destroy () {
    this.state.destroy()
    this.ctx = null
  }

  /**
  Returns whether the node is already destroyed
  */
  isDestroyed () {
    return this.ctx === null
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
  pre-visit all nodes with function f.
  */
  visit (f) {
    if (this.children) {
      let children = this.children
      children.sort(sortF)
      children.forEach(c => c.visit(f))
    }
    f(this)
  }

  /**
  Visit tree nodes with function f and returns the first node on which f evaluates true.
  @param {function} f - function that applys to node, return truthy or falsy value
  */
  find (f) {
    if (f(this)) return this
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        let found = this.children[i].find(f)
        if (found) return found
      }
    }
  }

  /**
  Returns current state name
  */
  stateName () {
    return this.state.constructor.name
  }

  /**
  Set state by state name

  @param {string} state - state name
  */
  setState (state) {
    this.state.setState(state)
  }

  /**
  namepath is used for vfs/nfs operation
  */
  namepath () {
    let arr = []
    for (let n = this; n; n = n.parent) arr.unshift(n.src.name)
    if (arr[0] === '') arr = arr.slice(1)
    return arr.join('/')
  }

  /**
  relpath is used for view
  */
  relpath () {
    if (!this.parent) return ''
    let arr = []
    for (let n = this; n.parent; n = n.parent) arr.unshift(n.src.name)
    return arr.join('/')
  }

  /**
  dstNamePath is used for vfs/nfs operation
  */
  dstNamePath () {
    let arr = []
    for (let n = this; n; n = n.parent) arr.unshift(n.dst.name)
    if (arr[0] === '') arr = arr.slice(1)
    return arr.join('/')
  }

  /**
  update policy, policy may be undefined (global policy updated)
  */
  updatePolicy (policy) {
    this.state.updatePolicy(policy)
  }

  /**
  Go to Working state
  if current state is Conflict or Failed. Otherwise, do nothing.
  */
  retry () {
    let s = this.stateName()
    if (s === 'Conflict') {
      // FIXME
      this.setState('Working')
    }
  }

  /**
  Returns view
  */
  view () {
    return Object.assign({
      type: this.type,
      parent: this.parent && this.parent.src.uuid,
      src: Object.assign({}, this.src, { path: this.relpath() }),
      dst: this.dst,
      policy: this.policy,
      state: this.stateName()
    }, this.state.view())
  }
}

module.exports = XNode
