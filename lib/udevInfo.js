'use strict'

var child = require('child_process')
var async = require('async')

/*
 * This function accepts a sysfspath, returns udevadm info 
 * results, parsed to js object.
 */
function udevinfo(sysfspath, callback) {

  function parser(error, stdout, stderr) {

    if (error) return callback(error, { stdout, stderr })

    // The P, S, E, N prefix is `query type`, see manpage 
    let result = { path: null, symlinks: [], name: null, props: {} }

    stdout.toString().split(/\n/).filter(l => l.length)
    .forEach(line => {

      let prefix = line.slice(0, 1)
      let content = line.slice(3)

      switch (prefix) {
        case 'P':
          result.path = content
          break
        case 'S':
          result.symlinks.push(content)
          break
        case 'E':
          let tmp = content.split('=')
          result.props[tmp[0].toLowerCase()] = tmp[1]
          break
	      case 'N':
          result.name = content
          break  

        default:
          break
      }
    })

    callback(null, result)
  }

  child.exec('udevadm info ' + sysfspath, parser)
}

function udevinfo_attrwalk(sysfspath, callback){

  function parser(error, stdout, stderr) {

    if (error) return callback(error, { stdout, stderr })

    let props = [], p = null

    stdout.toString().split(/\n/).filter(l => l.length)
    .filter(l => l.startsWith(' '))
    .map(l => l.trim())
    .forEach(l => {
      
      if (l.startsWith('looking')) {
        if (p) props.push(p)
        p = {
          path: l.split("'")[1],
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
    callback(null, props)
  }  

  child.exec('udevadm info -a ' + sysfspath, parser)
}

/*
 * This function is factored because:
 * 1. we may change find command to native node api to retrieve paths
 * 2. it's easier to provide options, query device info, or attribute, for 
 *    some but not all block devices
 */
module.exports = (paths, callback) => {

  // FIXME should validate paths, and callback
	function pathIteratee(path, callback) {

		let tasks = [	callback => udevinfo(path, callback),
								callback => udevinfo_attrwalk(path, callback) ]

		async.parallel(tasks, (error, result) => {
      result[0].sysfsProps = result[1]
			callback(error, result[0])
		}) 
	}

	async.map(paths, pathIteratee, (e, r) => callback(e, r)) 
}


