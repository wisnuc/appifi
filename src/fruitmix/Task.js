const XCopy = require('./xcopy/xcopy')

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
    if (!pss.includes[dir[0]]) throw new Error('invalid same dir policy') 
    if (!ps.includes[dir[1]]) throw new Error('invalid diff dir policy')
    obj.dir = [dir[0], dir[1]].map(p => p || null)
  }

  if (policies.hasOwnProperty('file')) {
    let file = policies.file
    if (!Array.isArray(dir)) throw Error('invalid file policy')
    if (!ps.includes[dir[0]]) throw new Error('invalid same file policy') 
    if (!ps.includes[dir[1]]) throw new Error('invalid diff file policy')
    obj.file = [dir[0], dir[1]].map(p => p || null)
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
    this.tasks.filter()
  }

  // useless
  createCopyTask(user, props, callback) {
    let { src, dst } = props
    this.vfs.DIR(user, { driveUUID: dst.drive, dirUUID: dst.dir }, err => {
      if (err) return callback(err)
      this.vfs.READDIR(user, { driveUUID: src.drive, dirUUID: src.dir }, (err, xstats) => {
        try {
          let xs = props.entries.reduce((xs, ent) => {
            let x = xstats.find(x => x.name === ent)
            if (!x) throw new Error(`entry name ${ent} not found`)
            return [...xs, x]
          }, [])
          callback(null, new XCopy(vfs, nfs, user, props))
        } catch (err) {
          console.log(err)
          err.status = 400
          callback(err)
        }
      })
    })
  }

  createMoveTask(user, props, callback) {
    // same as copy, almost
  }

  createImportTask(user, props, callback) {
    this.vfs.DIR(user) 
  }

  createExportTask(user, props, callback) {
    // this.nfs
  }

  /**
  Create an xcopy task
  
  @param {object} user
  @param {object} props
  @param {string} props.mode - 'copy', 'move', 'import', 'export', etc.
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
    // 1. policies must be valid
    // 2. user must has permission for source
    // 3. user must has permission for dst
    // 4. all entries must be found
    let policies

    try {
      policies = normalizePolicies(props.policies)
    } catch (err) {
      err.status = 400
      return process.nextTick(() => callback(err))
    }
    
    if (typeof props.src !== 'object' || props.src === null) {
      let err = new Error('invalid src')
      err.status = 400
      return callback(err)
    }

    if (typeof props.dst !== 'object' || props.dst === null) {
      let err = new Error('invalid dst')
      err.status = 400
      return callback(err)
    }

    let newProps = Object.assign({}, props, { policies })

    let task = new XCopy(this.vfs, this.nfs, user, newProps)   
    task.creator = user.uuid
    this.tasks.push(task)
    callback(null, task.view())
  }  

  DELETE (user, props, callback) {
    let index = this.tasks.findIndex(t => t.user.uuid === user.uuid && t.uuid === taskUUID)
    if (index !== -1) {
      
    }
  }

  PATCH (user, props, callback) {
    let op = props.op

    if (op === 'step') {
      this.tasks.find(t => t.uuid === props.taskUUID).step(callback)
    } else if (op === 'watch') {
      this.tasks.find(t => t.uuid === props.taskUUID).watch(callback)
    } else {

    }
  }

  PATCHNODE (user, props, callback) {
    let task = this.tasks.find(t => t.creator === user.uuid && t.uuid === props.taskUUID) 
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
