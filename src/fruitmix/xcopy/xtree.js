const path = require('path')

const autoname = require('../../lib/autoname')

const clone = x => JSON.parse(JSON.stringify(x))

const sortF = (a, b) => a.type !== b.type
  ? a.type === 'directory' ? -1 : 1
  : a.name.localeCompare(b.name)

const J = x => JSON.stringify(x, null, '  ')

const dirname = x => path.dirname(x)

// annotate and sort
const prepare = (node, parent) => {
  // directory must have children
  if (node.type === 'directory') node.children = node.children || []

  // annotate path
  node.path = parent ? path.join(parent.path, node.name) : '/'

  // recursion
  if (node.type === 'directory') {
    node.children.sort(sortF)
    node.children.forEach(child => prepare(child, node))
  } else {
    delete node.chilidren
  }

  return node
}

/**
1. annotate st, dt (path & children)
2. normalize policies 
3. mark st root as 'kept'
4. first copy or move action

@param {object} arg
@returns the first stopped stage (either conflict or finished)
*/
const init = arg => {
  let arg2 = clone(arg)
  let st = prepare(arg2.st)
  let dt = prepare(arg2.dt)
  let policies = arg2.policies || { dir: [null, null], file: [null, null] }

  // resolve manually
  st.status = 'kept'

  return copymove({ st, dt, policies })
}

/**

@param {object} t - src tree
@param {node[]} acc - recurisive parameter (not used by top-level caller)
@returns an array of conflict nodes in previsit order
*/
const getConflicts = (t, acc = []) => {
  if (!t.status) throw new Error('no status')
  if (t.status === 'conflict') {
    acc.push(t)
  } else if (t.status === 'kept') {
    if (t.type !== 'directory') throw new Error('kept node is not a directory')
    t.children.forEach(c => getConflicts(c, acc))
  }

  return acc
}

/**
@param {object} t - src tree or dst tree
@param {string} path - tree node path
@returns node with given path, or null
*/

/**
const findByPath = (t, path) => 
  t.path === path ? t : t.type === 'directory' ? t.children.find(c => findByPath(c, path)) : null
*/

const findByPath = (t, path) => {
  if (t.path === path) return t
  if (t.type === 'directory') {
    for (let i = 0; i < t.children.length; i++) {
      let x = findByPath(t.children[i], path)
      if (x) return x
    }
  }
}

/**
copy all copi
*/
const copymove = si => {
  let { st, dt, policies } = si

  // resolve
  const resolve = (sc, dc) => {
    let p
    if (sc.policy) {
      p = sc.policy[0] || sc.policy[1]
    } else if (sc.type === 'directory') {
      if (dc.type === 'directory') {
        if (policies.dir[0]) p = policies.dir[0]
      } else if (dc.type === 'file') {
        if (policies.dir[1]) p = policies.dir[1]
      } else {
        throw new Error('bad dc type')
      }
    } else if (sc.type === 'file') {
      if (dc.type === 'file') {
        if (policies.file[0]) p = policies.file[0]
      } else if (dc.type === 'directory') {
        if (policies.file[1]) p = policies.file[1]
      } else {
        throw new Error('bad dc type')
      }
    } else {
      throw new Error('bad sc type')
    }

    if (p === 'keep') {
      sc.status = 'kept'
      visit(sc)
    } else if (p === 'skip') {
      sc.status = 'skipped'
    } else if (p === 'replace') {
      delete sc.status
      Object.keys(dc).forEach(k => delete dc[k])
      Object.assign(dc, sc)
      sc.status = 'copied'
    } else if (p === 'rename') {
      delete sc.status
      let sp = findByPath(st, dirname(sc.path))
      if (!sp) throw new Error('sp not found')
      let dp = findByPath(dt, dirname(sc.path))
      if (!dp) throw new Error('dp not found')
      let name = autoname(sc.name, dp.children.map(x => x.name))
      dp.children.push(Object.assign({}, sc, { name }))
      dp.children.sort(sortF)
      sc.rename = name
      sc.status = 'copied'
    } else if (p) {
      throw new Error('bad policy')
    }
  }

  // dir only recursion
  const visit = s => {
    if (s.status !== 'kept') throw new Error('visiting node with non-kept status')

    let d = findByPath(dt, s.path)
    if (!d) throw new Error('no counterpart')

    s.children.forEach(sc => {
      if (sc.status) {
        if (sc.status === 'kept') {
          visit(sc)
        } else if (sc.status === 'conflict') {
          let dc = findByPath(dt, sc.path)
          if (!dc) throw new Error('dc not found')
          resolve(sc, dc)
        }
      } else {
        let dc = d.children.find(dc => dc.name === sc.name)
        if (!dc) {
          d.children.push(clone(sc))
          sc.status = 'copied'
        } else {
          sc.status = 'conflict'
          resolve(sc, dc)
        }
      }
    })

    d.children.sort(sortF)
  }

  visit(st)

  return { st, dt, policies }
}

/**

@returns an array of (duplicated si) with resolution for conflict node designated by given path
*/
const resolve = (si, path) => {
  let s = findByPath(si.st, path)
  if (!s) throw new Error('conflict src not found')
  let d = findByPath(si.dt, path)
  if (!d) throw new Error('conflict dst not found')
  if (s.name !== d.name) throw new Error('not a conflict')

  let names = ['skip', 'replace', 'rename']
  if (s.type === d.type && s.type === 'directory') names.unshift('keep')

  let resolutions = []
  names.map(name => s.type === d.type ? [name, null] : [null, name])
    .forEach(policy => {
      resolutions.push({ path, policy })

      let policies = clone(si.policies)
      let name = s.type === 'directory' ? 'dir' : 'file'
      if (!policies[name][0] && policy[0]) {
        policies[name][0] = policy[0]
        resolutions.push({ path, policy, applyToAll: true, policies })
      } else if (!policies[name][1] && policy[1]) {
        policies[name][1] = policy[1]
        resolutions.push({ path, policy, applyToAll: true, policies })
      }
    })

  return resolutions.map(r => {
    let st = clone(si.st)
    let dt = clone(si.dt)
    let policies = clone(si.policies)

    let s = findByPath(st, path)
    if (!s) throw new Error('s not found')
    let d = findByPath(dt, path)
    if (!d) throw new Error('d not found')

    // apply policy
    s.policy = r.policy
    if (r.applyToAll) policies = r.policies

    return Object.assign(copymove({ st, dt, policies }), { resolution: r })
  })
}

// remove copied
const shake = t => {
  // post visit
  const visit = n => {
    n.children.filter(c => c.type === 'directory').forEach(c => visit(c))
    n.children = n.children.filter(c => {
      if (c.status === 'copied') return false
      if (c.type === 'directory' && c.status === 'kept' && c.children.length === 0) return false
      return true
    })
  }
  visit(t)
  return t
}

/**

@param {object} arg
@param {object} arg.st
@param {object} arg.dt
@param {object} arg.policies
*/
const generate = arg => {
  let finished = []
  let working = [[init(arg)]]

  while (working.length) {
    let xs = working.shift()
    let last = xs[xs.length - 1]
    let conflicts = getConflicts(last.st)
    if (conflicts.length === 0) {
      finished.push(xs)
    } else {
      // resolve only the first conflict and push back to working queue
      resolve(last, conflicts[0].path).forEach(r => working.unshift([...xs, r]))
    }
  }

  return finished
}

module.exports = {
  clone,
  sortF,
  findByPath,
  init, // init s0 to stopped state
  getConflicts, // find the conflict one
  copymove,
  resolve, // resolve the conflict, generate result
  shake,
  generate // external method
}
