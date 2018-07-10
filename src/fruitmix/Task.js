const XCopy = require('./xcopy/xcopy')
const XSink = require('./xcopy/xsink')

/**
@param {object} policies - policies provided by client
@returns normalized policies in [same, diff] format
*/
const normalizePolicies = policies => {
  const ps = [undefined, null, 'skip', 'replace', 'rename']
  const pss = [...ps, 'keep']

  const obj = { dir: [], file: [] }  

  if (policies === undefined || policies === null) return obj
  if (typeof policies !== 'object') throw new Error('policies not an object')

  if (policies.hasOwnProperty('dir')) {
    let dir = policies.dir
    if (!Array.isArray(dir)) throw Error('invalid dir policy')

    if (!pss.includes(dir[0])) throw new Error('invalid same dir policy') 
    if (!ps.includes(dir[1])) throw new Error('invalid diff dir policy')
    obj.dir = [dir[0], dir[1]].map(p => p || null)
  }

  if (policies.hasOwnProperty('file')) {
    let file = policies.file
    if (!Array.isArray(file)) throw Error('invalid file policy')
    if (!ps.includes(file[0])) throw new Error('invalid same file policy') 
    if (!ps.includes(file[1])) throw new Error('invalid diff file policy')
    obj.file = [file[0], file[1]].map(p => p || null)
  }

  return obj
} 

class Task {

  constructor (vfs, nfs) {
    if (!vfs) throw new Error('vfs is not provided')
    if (!nfs) throw new Error('nfs is not provided')

    this.vfs = vfs
    this.nfs = nfs
    this.tasks = []
    this.nodeApi = { 
      PATCH: this.PATCHNODE.bind(this)
    }
  }

  LIST (user, props, callback) {
    callback(null, this.tasks.map(item => item.view()))
  }

  GET (user, props, callback) {
    let result = this.tasks.find(item => item.uuid == props.taskUUID)
    if (!result) {
      let err = new Error('task not found')
      err.status = 404
      callback(err) 
    } else {
      callback(null, result.view())
    }
  }

  /**
  Create an xcopy task
  
  @param {object} user
  @param {object} props
  @param {boolean} props.batch - if provided, must be true
  @param {string} props.mode - 'copy', 'move', 'icopy', 'imove', 'ecopy', 'emove', 'ncopy', 'nmove',
  @param {object} props.src - object representing src dir
  @param {string} props.src.drive - vfs drive uuid or nfs drive id
  @param {string} props.src.dir - vfs dir uuid or nfs path
  @param {object} props.dst - object representing dst dir
  @param {string} props.dst.drive - vfs drive uuid or nfs drive id
  @param {string} props.dst.dir - vfs dir uuid or nfs path
  @param {string[]} entries - an array of names
  @param {object} policies - global policies
  @param {object} policies.dir - global dir policy, defaults to [null, null]
  @param {object} policies.file - global file policy, defaults to [null, null]
  */
  POST (user, props, callback) {
    let { batch, entries } = props
    if (batch === true) {
      if (!Array.isArray(entries) 
        || entries.length === 0 
        || !entries.every(ent => ent && typeof ent === 'object')) {
        let err = new Error('invalid srcs')
        err.status = 400 
        return callback(err)
      }
    } else {
      if (typeof props.src !== 'object' || props.src === null) {
        let err = new Error('invalid src')
        err.status = 400
        return callback(err)
      }
    }

    if (typeof props.dst !== 'object' || props.dst === null) {
      let err = new Error('invalid dst')
      err.status = 400
      return callback(err)
    }

    let task, policies
    if (batch) {
      task = new XSink(this.vfs, this.nfs, user, Object.assign({}, props))
    } else {
      try {
        policies = normalizePolicies(props.policies)
      } catch (err) {
        err.status = 400
        return process.nextTick(() => callback(err))
      }
      task = new XCopy(this.vfs, this.nfs, user, Object.assign({}, props, { policies }))
    }

    if (task.autoClean) {
      task.on('finish', () => {
        let index = this.tasks.indexOf(task)
        if (index !== -1) this.tasks.splice(index, 1)
      })
    }

    this.tasks.push(task)
    callback(null, task.view())
  }  

  DELETE (user, props, callback) {
    let index = this.tasks.findIndex(t => t.user.uuid === user.uuid && t.uuid === props.taskUUID)
    if (index !== -1) {
      let result = this.tasks.splice(index, 1)
      result[0].destroy()
      callback(null, this.tasks.map(item => item.view()))
    } else {
      callback(Object.assign(new Error('not fount task'), {status: 404}))
    }
  }

  PATCH (user, props, callback) {
    let op = props.op

    if (op === 'step') {
      this.tasks.find(t => t.uuid === props.taskUUID).step(callback)
    } else if (op === 'watch') {
      this.tasks.find(t => t.uuid === props.taskUUID).watch(callback)
    } else {
      let err = new Error('unsupported op')
      err.status = 403 
      process.nextTick(() => callback(err))
    }
  }

  PATCHNODE (user, props, callback) {
    let task = this.tasks.find(t => t.user.uuid === user.uuid && t.uuid === props.taskUUID) 
    if (!task) {
      let err = new Error('task not found')
      err.status = 404
      return process.nextTick(() => callback(err))
    }

    let { policy, applyToAll } = props
    task.updateNode(props.nodeUUID, { policy, applyToAll }, callback)
  }

} 

module.exports = Task
