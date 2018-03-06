// input { path, files, dirUUID }
class DirCopy extends EventEmitter {

  constructor (src, tmp, dst, files) {
    super()

    this.src = src
    this.tmp = tmp
    this.dst = dst

    this.dir


    this.pending = []
    this.working = []
    this.finished = []
    this.failed = []

    this.synk = new Synk({
      push: function(x) {
        console.log(x)
      }
    })
  }

  // x { root, 
  push (x) {
    this.pending.push(x)
  }

  pull () {

  }

  isBlocked () {
  }

  isStopped () {
  }

  root () {
  }


  createPipe(input) {

    let src = path.join(this.src, input.path) 
    let tmp = path.join(this.tmp, input.path) 
    let dst = path.join(this.dst, input.path)

    return new Transform({
      name: 'copy',
      concurrency: 4,
      transform: (x, callback) =>
        (x.abort = fileCopy(path.join(src, x.name), path.join(tmp, x.name),
          (err, fingerprint) => {
            delete x.abort
            if (err) {
              callback(err)
            } else {
              callback(null, (x.fingerprint = fingerprint, x))
            }
          }))
    }).pipe(new Transform({
      name: 'stamp',
      transform: (x, callback) =>
        forceXstat(path.join(tmp, x.name), { hash: x.fingerprint },
          (err, xstat) => err
            ? callback(err)
            : callback(null, (x.uuid = xstat.uuid, x)))
    })).pipe(new Transform({
      name: 'move',
      transform: (x, callback) =>
        fs.link(path.join(tmp, x.name), path.join(dst, x.name), err => err
          ? callback(err)
          : callback(null, x))
    })).pipe(new Transform({
      name: 'remove',
      transform: (x, callback) => rimraf(path.join(tmp, x.name), () => callback(null))
    })).root()

  }

  schedule () {
    if (this.isBlocked) return

    this.pending = this.ins.reduce((acc, t) => [...acc, ...t.pull()], this.pending)

    while (this.working.length < this.concurrency && this.pending.length) {
      let x = this.pending.shift()
      this.working.push(x)

      pipe.on('data', data => {
      })

      pipe.on('step', () => {
        if (pipe.isStopped()) {
          this.working.splice(this.working.indexOf(x), 1) 
          if (pipe.isFinished()) {
            // drop
          } else {
            // since we drained the pipe, it won't be blocked by output, 
            // so there won't be 
            this.failed.push(x) 
          }

          this.schedule()
        }

        this.emit('step')
      })

      x.pipe = pipe
    }
  }
}
