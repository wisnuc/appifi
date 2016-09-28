import path from 'path'
import fs from 'fs'

import Promise from 'bluebird'

Promise.promisifyAll(fs)

const listAsync = async (target, level = 0) => {

  let stat = await fs.lstatAsync(target)
  if (stat.isDirectory() || stat.isFile())
    return Object.assign({
        path: target,
        type: stat.isDirectory() ? 'folder' : 'file',
        mtime: stat.mtime.getTime(),
        size: stat.size
      }, 
      (level === 0 || !stat.isDirectory()) ? {} : {
        children: await fs.readdirAsync(target)
          .map(entry => listAsync(path.join(target, entry), level - 1))
          .filter(item => !!item)
      })
}

/**
export default (target, level, callback) => 
  listAsync(target, level).asCallbacek(callback) 
**/

const list = (target, level, callback) => {

  fs.lstat(target, (err, stat) => {

    if (err) return callback(err)
    if (!stat.isDirectory() && !stat.isFile()) return callback()

    let node = {
      path: target,
      type: stat.isDirectory() ? 'folder' : 'file',
      name: path.basename(target)
    }
  
    if (stat.isFile()) {
      node.mtime = stat.mtime.getTime(),
      node.size = stat.size
    }

    if (level === 0 || !stat.isDirectory()) return callback(null, node)

    fs.readdir(target, (err, entries) => {

      if (err || entries.length === 0) return callback(null, node)

      let count = entries.length 
      entries.forEach(entry => {

        list(path.join(target, entry), level - 1, (err, child) => {

          if (err) {
            if (!--count) return callback(null, node)            
          }            
          else {
            if (child) {
              if (node.children) {
                node.children.push(child)
              } 
              else {
                node.children = [child]
              }
            }
            if (!--count) return callback(null, node)
          }

        })
      })
    })
  })
}

/**
listAsync('tmptest', 1).asCallback((err, node) => console.log(err || JSON.stringify(node, null, '  ')))
**/

/**
list('node_modules', 10, (err, node) => {
  console.log(err || JSON.stringify(node, null, '  '))
})
**/

export { list }


