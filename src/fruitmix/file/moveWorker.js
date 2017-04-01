import path from 'path'
import fs from 'fs'
import child from 'child_process'

import xattr from 'fs-xattr'

import E from '../lib/error'
import Worker from '../lib/worker'

class Hash extends Worker {
  constructor(src, dst) {
    super()
    this.src = src
    this.dst = dst
  }

  cleanUp() {

  }

  run() {
    let srcType = isFruitmix(this.src)
    let dstType = isFruitmix(this.dst)
    let modeType = srcType && dstType ? 'FF' : srcType && !dstType ?
                    'FE' : !srcType && dstType ? 'EF' : 'EE'
    switch(modeType){
      case 'FF':
      case 'FE':
      case 'EF':
      case 'EE':
      default:
    }
  }

  copy(callback) {
    child.exec(`cp -r --reflink=auto ${ this.src } ${ this.dst }`,(err, stdout, stderr) => {
      if(err) return callback(err)
      if(stderr) return callback(stderr)
      return callback(null, stdout)
    })
  }

  delete(callback) {
    child.exec(`rm -rf ${ this.src }`, (err, stdout, stderr) => {
      if(err) return callback(err)
      if(stderr) return callback(stderr)
      return callback(null, stdout)
    })
  }

  // visitor tree dump xattr
  cleanXattr(callback){
    // const clean = (dir, dirContext, entry, callback) => {
    //   let xattrType = dirContext.type
    //   let path = path.join(dir, entry)
    //   xattr.setSync(path, xattrType, JSON.stringify({}))
    //   fs.lstatSync(path).isFile() ? callback() : callback({ type: xattrType})
    // }
  }

  move(callback){

  }

  visit(dir, dirContext, func, done) { 
    fs.readdir(dir, (err, entries) => {
      if (err || entries.length === 0) return done()
      
      let count = entries.length
      entries.forEach(entry => {

        func(dir, dirContext, entry, (entryContext) => {
          if (entryContext) {
            // console.log('entering entering')
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

  import(callback){

  }

}