import Node from './node'

const spawnCommand = (cmd, args, callback) => {

  let output, aborted = false

  let handle = child.spawn(cmd, args)
  handle.stdout.on('data', data => !aborted && (output = data))
  handle.on('close', (code, signal) => {
    handle = null
    if (aborted) return
    if (signal) return calblack(ESIGNAL)
    if (code) return callback(EEXITCODE)
    callback(null, output)
  })

  return () => {
    if (handle) {
      handle.kill()
      handle = null
    }
    aborted = true
  }
}

// 1. get timestamp (fs.lstat)
// 2. start hashing
// 3. update hashing
// 4. return latest xstat
const createHashWorker = (callback) {
 
  let aborted
  let spawn  

  fs.lstat(target, (err, stats) => {

    if (err) return callback(err)
    if (!stats.isFile()) return ENOTFILE

    timestamp = stats.mtime.getTime()
    spawn = spawnCommand(cmd, args, (err, data) => {
      let hash = data.toString().trim().split(' ')[0]
    }) 
  })

  return () => {
    if (spawn) {
      spawn.abort()
      spawn = null
    }
    aborted = true
  }
}

const createIdentifyWorker = (callback) {
}

class FileNode extends Node {

  constructor(props) {
    super()
    this.worker = null 
  }

  request() {

    if (this.worker) return

    if (this.hash) {
      this.worker = createHashWorker
    }
    else {
      this.worker = createIdentifyWorker
    }
  }
}
