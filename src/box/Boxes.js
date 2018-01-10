const path = require('path')
const EventEmitter = require('events')
const assert = require('assert')
const Debug = require('debug')

// short circuit debug (suspect memory leaks)
const debug = debug('boxes')

const mkdirp = require('mkdirp')
const { forceXstat } = require('../lib/xstat')
const Directory = require('./directory')
const File = require('./file')

const autoTesting = process.env.hasOwnProperty('NODE_PATH') ? true : false

class B extends EventEmitter {
  constructor (froot) {
    super()
    this.dir = path.join(froot, 'boxes')
    mkdirp.sync(this.dir)
    
    // all boxes memory cache
    this.boxes = new Map()

    // init state boxes
    this.initBoxes = new Set()

    // pending boxes
    this.pendingBoxes = new Set()

    // reading boxes
    this.readingBoxes = new Set()
  }

  indexBox (box) {
    debug(`index box ${box.doc.name}`)
    this.boxes.set(box.doc.uuid, box)
  }

  unindexBox (box) {
    debug(`unindex box ${box.doc.name}`)
    this.boxes.delete(box.doc.uuid)
  }

  boxEnterIdle (box) {
    debug(`box ${box.doc.name} enter idle`)
  }

  boxExitIdle (box) {
    debug(`box ${box.doc.name} exit idle`)
  }

  boxEnterInit (box) {
    debug(`box ${box.doc.name} enter init`)
    this.initBoxes.add(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxExitInit (box) {
    debug(`box ${box.doc.name} exit init`)
    this.initBoxes.delete(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxEnterPending (box) {
    debug(`box ${box.doc.name} enter pending`)
    this.pendingBoxes.add(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxExitPending (box) {
    debug(`box ${box.doc.name} exit pending`)
    this.pendingBoxes.delete(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxEnterReading (box) {
    debug(`box ${box.doc.name} enter reading`)
    this.readingBoxes.add(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  boxExitReading (box) {
    debug(`box ${box.doc.name} exit reading`)
    this.readingBoxes.delete(box.doc.uuid)
    this.reqSchedBoxRead()
  }

  reqSchedBoxRead () {
    if (this.boxReadScheduled) return
    this.boxReadScheduled = true
    process.nextTick(() => this.scheduleBoxRead())
  }

  boxReadSettled () {
    return this.initBoxes.size === 0 &&
      this.pendingBoxes.size === 0 &&
      this.readingBoxes.size === 0
  }

  scheduleBoxRead () {
    this.boxReadScheduled = false
    if (this.boxReadSettled()) {

      if (!autoTesting) {
        // console.log('total directories: ', this.uuidMap.size)
      }

      this.emit('BoxReadDone')
      return
    }

    while (this.initBoxes.size > 0 && this.readingBoxes.size < 6) {
      let uuid = this.initBoxes[Symbol.iterator]().next().value
      let box = this.uuidMap.get(uuid)
      assert(!!box)
      box.read()
    }
  }
}

class Boxes extends B {
  constructor() {
    
  }

  init () {
    
  }
}