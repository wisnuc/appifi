import path from 'path'
import fs from 'fs'
import E from '../lib/error'

import { readXstat } from './xstat'



// we do not use state machine pattern and event emitter for performance sake
// the probe is essentially the same as originally designed stm, it just cut the transition from
// probing to waiting or idle. 
// exiting probing is considered an end. If 'again` is required, the caller should create another
// probe in callback.

// prober may return
// error
// {
//    mtime: timestamp for given directory
//    props: props for entries
//    again: should do it again
// }
const probe = (dpath, uuid, mtime, delay, callback) => {

  let timer, again = false, aborted = false

  // embedded function, to avoid callback branch
  const readProps = (callback) => 
    fs.readdir(dpath, (err, entries) => {
      if (aborted) return
      if (err) return callback(err)
      if (entries.length === 0) return callback(null, [])     

      let props = []
      let count = entries.length 

      entries.forEach(ent => 
        readXstat(path.join(dpath, ent), (err, xstat) => {
          if (aborted) return
          if (!err) props.push(xstat) // FIXME
          if (!--count) callback(null, props.sort((a,b) => a.name.localeCompare(b.name)))
        }))
    })

  timer = setTimeout(() => {
    readXstat(dpath, (err, xstat) => { 
      if (aborted) return
      if (err) return callback(err)
      if (!xstat.type === 'directory') return callback(new E.ENOTDIR())
      if (xstat.uuid !== uuid) return callback(new E.EINSTANCE())
      if (xstat.mtime === mtime) {
        console.log(`probe: same timestamp, arg: ${mtime}, readback: ${xstat.mtime}`)
        return callback(null, { data: null, again })
      }

      // read props
      readProps((err, xstats) => {
        if (aborted) return
        if (err) callback(err) 

        // read second time
        readXstat(dpath, (err, xstat2) => {
          if (aborted) return
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
      aborted = true
      callback(new E.EABORT())
    },
    request() {
      if (timer) return
      again = true
   }
  }
}

export default probe

class probeWorker extends EventEmitter {

  constructor() {
    super()

    this.type = 'probe'

    this.dpath = dpath
    this.uuid = uuid
    this.mtime = mtime
    this.delay = delay

    // state
    this.finished = false
    this.timer = null

    // relay
    this.again = false
  }

  readXstats(callback) {
    fs.readdir(this.dpath, (err, entries) => {
      if (this.finished) return 
      if (err) return callback(err)
      if (entries.length === 0) return callback(null, [])

      let xstats = []
      let count = entries.length
      entries.forEach(ent => 
        readXstat(path.join(this.dpath, ent), (err, xstat) => {
          if (this.finished) return
          if (!err) xstats.push(xstat)
          if (!--count) {
            xstats.sort((a,b) => a.name.localeCompare(b.name))
            callback(null, xstats)
          }
        }))
    })
  }

  probe() {       
    this.timer = setTimeout(() => {
       
    }, this.deay)  
  }

  request() {
    if (this.timer) return
    again = true
  }

  abort() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.finished = true
  }
}










