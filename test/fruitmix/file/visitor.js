const fs = require('fs')
const path = require('path')
import { readXstat } from '../../../src/fruitmix/file/xstat'

class Node {
  constructor(name, type, parent){
    this.name = name
    this.parent = parent
    this.child = []
    this.type = type
  }
}

function visit(dir, dirContext, func, done) {
  fs.readdir(dir, (err, entries) => {
    if (err || entries.length === 0) return done()
    let count = entries.length
    entries.forEach(entry => {
      func(dir, dirContext, entry, (entryContext) => {
        if (entryContext) {
          visit(path.join(dir, entry), entryContext, func, () => {
            count--
            if (count === 0) done()
          })
        }
        else {
          count --
          if (count === 0) done()
        }
      })
    })
  })
}

let num = 0
let map = new Map()
// let u = false
const clean = (dir, dirContext, entry, callback) => {
  console.log(num++)
  let fpath = path.join(dir, entry)

  readXstat(fpath, (err, xstat) => {
    fs.lstat(fpath, (err, stats) => {
      if(err) return callback(err)
      if(stats.isFile()){
        let node = new Node(entry, 'file')
        node.uuid = xstat.uuid
        map.set(node.uuid, node)
        dirContext.child.push(node)
        callback() 
      }else if(stats.isDirectory()){
        let node = new Node(entry, 'folder')
        node.uuid = xstat.uuid
        map.set(node.uuid, node)
        dirContext.child.push(node)
        callback(node)
      }else{
        let node = new Node(entry, 'unknown')
        node.uuid = xstat.uuid
        // u = node.uuid
        map.set(node.uuid, node)
        dirContext.child.push(node)
        callback(node)
      }
    })
  })
}

function visitor(dir) {
  map = new Map()
  num = 0
  let n = new Node(path.basename(dir), 'folder')
  readXstat(dir, (err, xstat) => {
    if(err) console.log(err)
    n.uuid = xstat.uuid
    map.set(n.uuid, n)
  })

  visit(dir, n, clean, () => {
    console.log('----------------------------',map.size)
    console.log(map.get(n.uuid))
  })
  return map
}

// let p = path.join('/home/laraine/Projects/appifi/tmptest/', 'c3256d90-f789-47c6-8228-9878f2b106f6')
// let a = visitor(p)
// console.log(a.has('7a07cd94-547a-48ce-8990-74e9c0651685'))
// process.nextTick(() => console.log(a))

module.exports = { visitor }
