var child = require('child_process')

async function udevInfo(sysfspath) {

  // The P, S, E, N prefix is `query type`, see manpage 
  let result = { path: null, symlinks: [], name: null, props: {} }

  let output = await new Promise((resolve, reject) => 
      child.exec('udevadm info ' + sysfspath, 
        (err, stdout, stderr) => 
          err ? reject({err, stdout, stderr}) : 
            resolve(stdout)))

  output.toString().split(/\n/).filter(l => l.length)
    .forEach(line => {
      let prefix = line.slice(0, 1)
      let content = line.slice(3)
      let tmp
      switch (prefix) {
      case 'P':
        result.path = content
        break
      case 'S':
        result.symlinks.push(content)
        break
      case 'E':
        tmp = content.split('=')
        result.props[tmp[0].toLowerCase()] = tmp[1]
        break
      case 'N':
        result.name = content
        break  

      default:
        break
      }
    })

  return result
}

const udevInfoAttr = async (sysfspath) => {

  let props = [], p = null
  let output = await new Promise((resolve, reject) =>
      child.exec('udevadm info -a ' + sysfspath,
        (err, stdout, stderr) =>
          err ? reject({err, stdout, stderr}) :
            resolve(stdout)))

  output.toString().split(/\n/).filter(l => l.length)
    .filter(l => l.startsWith(' '))
    .map(l => l.trim())
    .forEach(l => {
      
      if (l.startsWith('looking')) {
        if (p) props.push(p)
        p = {
          path: l.split('\'')[1],
          attrs: {} 
        }
      }
      else if (l.startsWith('ATTRS')) { // some are in form of ATTRS{...}
        p.attrs[l.slice(6).split('}')[0].toLowerCase()] = l.split('==')[1].slice(1,-1)
      }
      else if (l.startsWith('ATTR')) { // some are in form of ATTR{...}
        p.attrs[l.slice(5).split('}')[0].toLowerCase()] = l.split('==')[1].slice(1,-1)
      }
      else {
        p[l.split('==')[0].toLowerCase()] = l.split('==')[1].slice(1,-1)
      }
    })

  if (p) props.push(p) // the last one
  return props  
}

const udevInfoBoth = async (sysfspath) => {

  let info = await udevInfo(sysfspath)
  let attr = await udevInfoAttr(sysfspath)
  return Object.assign({}, info, {sysfsProps: attr})
}

const udevInfoBatch = async (paths) => {

  let e = new Error('paths must be non-empty string array')
  e.code = 'EINVAL'

  if (!Array.isArray(paths)) throw e
  if (!paths.length) throw e
  if (!paths.every(path => (typeof path === 'string' || path instanceof String))) throw e
  
  return  Promise.all(paths.map(path => udevInfoBoth(path)))
}

module.exports = udevInfoBatch

