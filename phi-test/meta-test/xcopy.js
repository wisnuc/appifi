// an inefficient way to deep clone
const deep = obj => JSON.parse(JSON.stringify(obj))

/**
There are three kinds of node, in xtree

1) a s node which has a st and a dt
2) if 
*/


class Node {
}


/**

*/
class StageNode extends Node {
  constructor (st, dt, entries) {
    this.st = deep(st)
    this.dt = deep(dt)
    if (entries) this.entries = entries
  }
}

class PolicyNode extends Node {
}

const generatePolicyList = (type, ecode) => {
}

const previsit = (node, f) => {
  f(node)
  if (f.children) f.children.forEach(c => visit(c, f))
}

const extractConflictNodes = root => {
  let arr = []
  previsit(root, node => node.conflict && arr.push(node))
  return arr
}

class Holmes {
  constructor (st, dt, type) {
    this.st = st
    this.dt = dt
    this.entries = entries
    this.root = new StageNode(st, dt)
  }

  
}



