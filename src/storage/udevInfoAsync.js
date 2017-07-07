const Promise = require('bluebird')
const child = Promise.promisifyAll(require('child_process'))

const udevInfo = async (sysfspath) => {
  // The P, S, E, N prefix is `query type`, see manpage
  let result = { path: null, symlinks: [], name: null, props: {} }
  let stdout = await child.execAsync(`udevadm info ${sysfspath}`)

  stdout.toString().split(/\n/).filter(l => l.length)
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
  let props = []
  let p = null
  let stdout = await child.execAsync(`udevadm info -a ${sysfspath}`)

  stdout.toString().split(/\n/).filter(l => l.length)
    .filter(l => l.startsWith(' '))
    .map(l => l.trim())
    .forEach(l => {
      if (l.startsWith('looking')) {
        if (p) props.push(p)
        p = {
          path: l.split('\'')[1],
          attrs: {}
        }
      } else if (l.startsWith('ATTRS')) { // some are in form of ATTRS{...}
        p.attrs[l.slice(6).split('}')[0].toLowerCase()] = l.split('==')[1].slice(1, -1)
      } else if (l.startsWith('ATTR')) { // some are in form of ATTR{...}
        p.attrs[l.slice(5).split('}')[0].toLowerCase()] = l.split('==')[1].slice(1, -1)
      } else {
        p[l.split('==')[0].toLowerCase()] = l.split('==')[1].slice(1, -1)
      }
    })

  if (p) props.push(p) // the last one
  return props
}

const udevInfoBoth = async path =>
  Object.assign({}, await udevInfo(path), {
    sysfsProps: await udevInfoAttr(path)
  })

// export default async paths => Promise.map(paths, path => udevInfoBoth(path))
module.exports = async paths => Promise.map(paths, path => udevInfoBoth(path))
