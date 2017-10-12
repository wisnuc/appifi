const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const child = require('child_process')
const debug = require('debug')('dirimport')

const { forceXstat } = require('../lib/xstat')

const fileCopy = require('./filecopy')

class Mkdir {

  constructor () {
    this.working = []
    this.failed = []
  }

  push(x) {
    this.working.push(x)
    mkdirp(x.relPath, err => {
      // dequeue
      this.working.splice(this.working.indexOf(x)) 
      if (err) {
        x.error = err
        this.failed.push(x)
      } else {
        this.next(x)
      }
    })
  }
}

class Move {

  constructor () {
    this.working = []
    this.failed = []
  }

  push (x) {
    this.working.push(x)
    
  }
}

class DirImport {

  constructor(src, tmp, getDirPath) {
    super()

    this.src = src
    this.tmp = tmp
    this.getDirPath = getDirPath

    this.concurrency = 2


    this.mkdirPending = []
    this.mkdirError = []
    // this.
  }

  copy () {
    while (this.copyPending.length && this.copyWorking.length < 2) {
      let x = this.copyPending.shift()
      x.worker = fileCopy(path.join(this.src, x.name), path.join(this.dst, x.name), 
        (err, fingerprint) => {
          delete x.worker
          // dequeue
          let index = this.copyWorking.indexOf(x) 
          this.copyWorking = [
            ...this.copyWorking.slice(0, index),
            ...this.copyWorking.slice(index + 1)
          ]
          if (err) {
            x.error = err.message
            this.copyError = [...this.copyError, x]
          } else {
            x.fingerprint = fingerprint 
            this.stampPending = [...this.stampPending, x]
          }
        })
    }
  }

  stamp () {
    
  }

  link () {
  }
}
