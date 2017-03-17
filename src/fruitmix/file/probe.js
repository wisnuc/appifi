import path from 'path'
import fs from 'fs'
import EventEmitter from 'events'
import E from '../lib/error'

import { readXstat, readXstatAsync } from './xstat'

// the reason to prefer emitter version over closure one is:
// 1. easire to test
// 2. explicit state
// 3. can emit again (state) when error
class ProbeWorker extends EventEmitter {

  constructor(dpath, uuid, mtime, delay) {
    super()
    this.dpath = dpath
    this.uuid = uuid
    this.mtime = mtime
    this.delay = delay

    this.finished = false
    this.again = false
    this.timer = undefined
  }

  // clean up
  finalize() {
    this.timer = clearTimeout(this.timer)
    this.finished = true 
    this.again = false
  }

  // emit error + again
  error(e) {
    this.emit('error', e, this.again)
    this.finalize()
  }

  // emit data + again
  finish(data) {
    this.emit('finish', data, this.again)
    this.finalize()
  }

  // read all entries' xstats
  readXstats(callback) {
    let count, xstats = []
    fs.readdir(this.dpath, (err, entries) => 
      this.finished ? undefined
        : err ? callback(err)
          : (count = entries.length) === 0 ? callback(null, [])     
            : entries.forEach(ent => 
                readXstat(path.join(this.dpath, ent), (err, xstat) => {
                  if (this.finished) return
                  if (!err) xstats.push(xstat)
                  if (!--count) callback(null, xstats.sort((a,b) => a.name.localeCompare(b.name)))
                })))
  }

  // start worker
  start() {

    if (this.finished) throw 'probe worker already finished'

    this.timer = setTimeout(() => 
      readXstat(this.dpath, (err, xstat) => 
        this.finished ? undefined
        : err ? this.error(err)
        : xstat.type !== 'directory' ? this.error(new E.ENOTDIR())
        : xstat.uuid !== this.uuid ? this.error(new E.EINSTANCE())
        : xstat.mtime === this.mtime ? this.finish(null)
        : this.readXstats((err, xstats) => 
            this.finished ? undefined
            : err ? this.error(err) 
            : readXstat(this.dpath, (err, xstat2) => 
                this.finished ? undefined
                : err ? this.error(err)
                : xstat2.type !== 'directory' ? this.error(new E.ENOTDIR())
                : xstat2.uuid !== this.uuid ? this.error(new E.EINSTANCE())
                : xstat2.mtime !== xstat.mtime ? this.error(new E.ETIMESTAMP())
                : this.finish({ mtime: xstat.mtime, xstats })))), this.delay)
  }

  // abort worker
  abort() {
    if (this.finished) throw 'probe worker already finished'
    this.finalize()
  }

  // request another probe
  // this state is an inherent state if you expand worker to a state machine
  // put this state here is much easier for user
  request() {
    if (this.finished) throw 'probe worker already finished'
    if (!this.timer) this.again = true
  }
}

export default (dpath, uuid, mtime, delay) =>
  new ProbeWorker(dpath, uuid, mtime, delay)

// the following are historical version, written in closure
// closure may use less memory since it does not inherit from EventEmitter
// but it is hard to test and must HACK the err object to return 'again'

// we do not use state machine pattern and event emitter for performance sake
// the probe is essentially the same as originally designed stm, it just cut the transition from
// probing to waiting or idle. 
// exiting probing is considered an end. If 'again` is required, the caller should create another
// probe in callback.

// prober may return
// error
// {
//    data: mtime: timestamp for given directory
//    xstats: props for entries
//    again: should do it again
// }

/**
const probe = (dpath, uuid, mtime, delay, callback) => {

  let timer, again = false, finished = false

  // embedded function, to avoid callback branch
  const readXstats = (callback) => 
    fs.readdir(dpath, (err, entries) => {
      if (finished) return
      if (err) return callback(err)
      if (entries.length === 0) return callback(null, [])     

      let props = []
      let count = entries.length 

      entries.forEach(ent => 
        readXstat(path.join(dpath, ent), (err, xstat) => {
          if (finished) return
          if (!err) props.push(xstat)
          if (!--count) callback(null, props.sort((a,b) => a.name.localeCompare(b.name)))
        }))
    })

  timer = setTimeout(() => {
    readXstat(dpath, (err, xstat) => { 
      if (finished) return
      if (err) return callback(err)
      if (!xstat.type === 'directory') return callback(new E.ENOTDIR())
      if (xstat.uuid !== uuid) return callback(new E.EINSTANCE())
      if (xstat.mtime === mtime) return callback(null, { data: null, again })

      readXstats((err, xstats) => {
        if (finished) return
        if (err) callback(err) 

        // read second time
        readXstat(dpath, (err, xstat2) => {
          if (finished) return
          if (err) return callback(err)
          if (!xstat2.type === 'directory') return callback(new E.ENOTDIR())
          if (xstat2.uuid !== uuid) return callback(new E.EINSTANCE())
          if (xstat2.mtime !== xstat.mtime) return callback(new E.ETIMESTAMP())

          let data = { mtime: xstat.mtime, xstats }
          callback(null, { data, again })
        })
      })
    })
  }, delay)

  return {

    type: 'probe',
    abort() {
      if (finished) throw 'probe worker already finished'
      timer = clearTimeout(timer)
      finished = true
      callback(new E.EABORT())
    },

    request() {
      if (finished) throw 'probe worker already finished'
      if (timer) return
      again = true
    }
  }
}
**/

