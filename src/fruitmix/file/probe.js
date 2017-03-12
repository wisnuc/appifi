const EABORT = Object.assign(new Error('aborted'), { code: 'EABORT' })
const EUUID = Object.assign(new Error('file or directory uuid mismatch'), { code: 'EUUID' })
const ENOTDIR = Object.assign(new Error('not a directory'), { code: 'ENOTDIR' })
const ETIMESTAMP = Object.assign(new Error('timestamp changed during operation'), { code: 'ETIMESTAMP' })

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
const probe = (dpath, uuid, callback) => {

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
          if (!--count) callback(null, props)
        }))
    })

  let timer = setTimeout(() => {
    readXstat(dpath, (err, xstat) => { 
      if (aborted) return
      if (err) callback(err)
      if (!xstat.isDirectory()) return callback(ENOTDIR)
      if (xstat.uuid !== uuid) return calblack(EUUID)
      if (xstat.mtime === mtime) return callback(null) // success, no change

      // read props
      readProps((err, props) => {
        if (aborted) return
        if (err) callback(err) 

        // read second time
        readXstat(dpath, (err, xstat2) => {
          if (aborted) return
          if (err) return callback(err)
          if (!xstat2.isDirectory()) return callback(ENOTDIR)
          if (xstat2.uuid !== uuid) return callback(EUUID)
          if (xstat2.mtime !== xstat.mtime) return callback(ETIMESTAMP)
          callback(null, { mtime: xstat.mtime, props, again })
        })
      })
    })
  }, 200)

  return {

    abort() {
      aborted = true
      callback(EABORT)
    },

    request() {
      if (timer) return
      again = true
    }
  }
}

export default probe
