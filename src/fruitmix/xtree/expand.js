const autoname = require('src/lib/autoname')

/**
TODO

The spec for auto rename is buggy.
*/
const copy = node => {
  let { st, dt, name } = node
  let ps  
  if (st.type === dt.type && st.name === '') {
    ps = ['keep-']
  } else if (st.type === dt.type) {
    ps = ['keep-', 'skip-', 'replace-', 'rename-']
  } else {
    ps = ['-skip', '-replace', '-rename']
  }

  node.rs = ps.reduce((rs, p) => {
    if (p === 'keep-') {
      let cs = []
      st.children.forEach(sc => {
        let dc = dt.children.find(dc => sc.name === dc.name)
        if (dc) {
          cs.push(copy({ st: sc, dt: dc, name: autoname(sc.name, dt.children.map(x => x.name)) }))
        } else {
          cs.push(sc) // same
        }
      })
      dt.children.forEach(dc => st.children.find(sc => sc.name === dc.name) || cs.push(dc))
      cs.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1)
      rs[p] = { st, dt: Object.assign({}, dt, { children: cs }) }
    } else if (p.includes('skip')) {
      rs[p] = { st, dt: null }
    } else if (p.includes('replace')) {
      rs[p] = { st, dt: st }
    } else if (p.includes('rename')) {
      rs[p] = { st, dt: Object.assign({}, st, { name }) }
    } else {
      throw new Error('invalid policy')
    }
    return rs
  }, {})

  return node
}

const move = node => {
  let { st, dt, name } = node
  let ps
  if (st.type === dt.type && st.name === '') {
    ps = ['keep-']
  } else if (st.type === dt.type) {
    ps = ['keep-', 'skip-', 'replace-', 'rename-']
  } else {
    ps = ['-skip', '-replace', '-rename']
  }

  node.rs = ps.reduce((rs, p) => {
    if (p === 'keep-') {
      let cs = []
      
    }
  })
}


// by stage, previsit to return all reducibles, return a list of reducibles
const reducibles = (acc, node) => {
  if (node.st.name !== node.dt.name) throw new Error('non-conflict node')
  if (node.rs) {
    acc.push(node)
  } else {
    node.dt.children.forEach(n => reducibles(acc, n)) 
  }
}

// node is an xtree node
const findReducible = node => node.rs ? node : node.dt.children.find(x => find.Reducible(x))

const contains = (tree, node) => {
  if (tree === node) return true
//  return tree.dt.children.filter(
}

// clone a node (tree), replace oldNode with newNode
const clone = (node, oldNode, newNode) => {
  if (node === oldNode) return newNode 

  let index = node.dt.children.indexOf(oldNode)
  if (index === -1) {
    return {
      st: node.st,
      dt: Object.assign({}, node.dt, {
        children: node.dt.children.map(c => c.contains(oldNode) ? clone(c, oldNode, newNode) : c)
      })
    }
  } else {
    return {
      st: node.st,
      dt: Object.assign({}, node.dt, {
        children: [...node.dt.children.slice(0, index), newNode, ...node.dt.children.slice(index + 1)]
      })
    }
  }
}

// reduce single node with given policy
const expand = (gnode) => {

  let { xtree } = gnode
  let reducible = findReducible(gnode.xtree)
  if (!reducible) return

  gnode.children = reduce(xtree, reducible)
}

// reduce all nodes that can be reduces with given policy
const reduceMulti = (root, node, policy) => {
}

module.exports = {
  copy,
  expand,
  reducibles
}
