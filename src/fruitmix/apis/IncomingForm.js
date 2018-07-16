const EventEmitter = require('events')
const crypto = require('crypto')
const stream = require('stream')

const Dicer = require('dicer')
const sanitize = require('sanitize-filename')

const HashStream = require('../../lib/hash-stream')
const { isUUID, isSHA256, isNonNullObject } = require('../../lib/assertion')

const debug = require('debug')('IncomingForm')

const isValidPolicy = policy => {
  if (policy === undefined) return true
  if (!Array.isArray(policy)) return false
  if (policy.length !== 2) return false
  let values = [undefined, null, 'skip', 'replace', 'rename'] 
  if (!values.includes(policy[0])) return false
  if (!values.includes(policy[1])) return false
  return true
} 

/**
Incoming form parses an incomming formdata and execute vfs operations accordingly.

                destroy     job finished
Heading         fail          
Parsing         fail        
Piping          fail
Pending                     stay, fail, execute
Executing

@module IncomingForm
*/

/**
Base state class
*/
class State {

  constructor (ctx, ...args) {
    this.ctx = ctx
    this.ctx.state = this
    this.enter(...args)
    process.nextTick(() => this.ctx.emit('StateEntered', this.constructor.name))
  }

  emitState() {
    this.ctx.emit('StateEntered', this.constructor.name)
  }

  setState (NextState, ...args) {
    this.exit()
    new NextState(this.ctx, ...args)
  }

  enter () {}
  exit () {}

  onJobFailed (job) {}
  onJobSucceeded (job) {}

  _destroy () {
    let err = new Error('destroyed')
    err.code = 'EDESTROYED'
    this.setState(Failed, err)
  }

  destroy () {}
}

/**
The job is failed, no reaction
*/
class Failed extends State {

  enter (err) {
    this.error = err
    debug('failed', err.message)
  }

}

/**
The job is finished, no reaction
*/
class Succeeded extends State {

  enter (data) {
    this.data = data
  }

}

/**
Waiting for part header, react to destroyed

1. job failed or succeeded events are irrelevent.
2. synchronous transition to failed when destroyed.
*/
class Heading extends State {

  enter (part) {
    part.on('error', err => {
      this.setState(Failed, err)
    })

    part.on('header', header => {
      try {
        this.parseHeader(header)
      } catch (e) {
        e.status = 400
        return this.setState(Failed, e)
      }

      /**
      name directive parsed, stamp ctx.prev here
      */
      this.ctx.predecessor = this.ctx.ctx.jobs
        .slice(0, this.ctx.ctx.jobs.indexOf(this.ctx))
        .reverse()
        .find(j => j.args.toName === this.ctx.args.fromName)

      // go to next state
      if (this.ctx.args.type === 'file') {
        this.setState(Piping, this.part)
      } else {
        this.setState(Parsing, this.part)
      }
    })

    this.part = part
  }

  /**
  Parse name and filename directive according to protocol

  This function installs args gradually, conforming to api specs.
  */
  parseHeader (header) {
    let name, filename, fromName, toName

    // fix %22
    // let x = header['content-disposition'][0].split('; ')
    let x = Buffer.from(header['content-disposition'][0], 'binary')
      .toString('utf8')
      .replace(/%22/g, '"')
      .split('; ')

    // check header is valid
    if (x.length < 2 || x.length > 3 || x[0] !== 'form-data') 
      throw new Error('invalid header')

    // install basic args as early as possible
    if (x.length === 2) {
      this.ctx.args.type = 'field'
    } else {
      this.ctx.args.type = 'file'
    }

    if (x[1].length <= 'name=""'.length || !x[1].startsWith('name="') || !x[1].endsWith('"')) 
      throw new Error('invalid name field')

    // retrieve name
    name = x[1].slice(6, -1)
    this.ctx.args.name = name

    // retrieve filename if any
    if (x.length > 2) {
      if (x[2].length <= 'filename=""'.length || !x[2].startsWith('filename="') || !x[2].endsWith('"')) 
      throw new Error('invalid filename field')

      try {
        filename = JSON.parse(x[2].slice(10, -1))
      } catch (e) {
        throw new Error('invalid filename field')
      }

      if (!isNonNullObject(filename) || Array.isArray(filename)) throw new Error('invalid filename field')
      let { op, hash, size, sha256, policy } = filename 
      if (op === 'newfile') {
        Object.assign(this.ctx.args, { op, size, sha256, policy })
      } else if (op = 'append') {
        Object.assign(this.ctx.args, { op, hash, size, sha256 })
      } else {
        Object.assign(this.ctx.args, { op, hash, size, sha256, policy })
      }
    }
   
    // validate name and generate part.fromName and .toName
    let split = name.split('|')
    if (split.length === 0 || split.length > 2) throw new Error('invalid name')
    if (!split.every(name => name === sanitize(name))) throw new Error('invalid name')
    fromName = split.shift()
    toName = split.shift() || fromName
    this.ctx.args.fromName = fromName
    this.ctx.args.toName = toName

    if (x.length > 2) {
      let { op, hash, size, sha256, policy } = filename
      if (op === 'newfile') { // op, size, sha256, [policy]
        if (fromName !== toName) throw new Error('newfile requires single name')
        if (!Number.isInteger(size)) throw new Error('invalid size')
        if (size < 0 || size > 1024 * 1024 * 1024) throw new Error('size out of range')
        if (sha256 !== undefined && !isSHA256(sha256)) throw new Error('invalid sha256')
        if (policy === undefined) {
          this.ctx.args.policy = [null, null]
        } else {
          if (!isValidPolicy(policy)) throw new Error('invalid policy')
        } 
      } else if (op === 'append') { // { op, hash, size, sha256 }
        if (fromName !== toName) throw new Error('append requires single name')
        if (!isSHA256(hash)) throw new Error('invalid hash')
        if (!Number.isInteger(size)) throw new Error('invalid size')
        if (size <= 0 || size > 1024 * 1024 * 1024) throw new Error('size out of range')
        if (sha256 !== undefined && !isSHA256(sha256)) throw new Error('invalid sha256')
      } else {
        throw new Error('invalid op')
      }
    } 
  }

  exit () {
    this.part.removeAllListeners()
    this.part.on('error', () => {})
  }

  destroy () {
    this._destroy()
  }

}

/**
Streaming part body to buffer, in field job.

1. job failed or succeeded events are irrelevant.
2. sychronous transition to failed when destroyed.
*/
class Parsing extends State {

  enter (part) {
    this.buffers = []
    part.on('data', data => this.buffers.push(data))
    part.on('end', () => {

      let body
      try {
        body = JSON.parse(Buffer.concat(this.buffers))
        if (!isNonNullObject(body) || Array.isArray(body)) throw new Error()
      } catch (_) {
        let e = new Error('invalid part body')
        e.status = 400
        return this.setState(Failed, e)
      }

      let { op, policy, tags, uuid } = body

      try {
        if (op === 'mkdir' || op === 'rename' || op === 'dup') {
          Object.assign(this.ctx.args, { op, policy })
          if (!isValidPolicy(policy)) throw new Error(`invalid policy`)

          // this check cannot be done when parsing header since op is unknown
          if (op === 'rename' || op === 'dup') {
            if (this.ctx.args.fromName === this.ctx.args.toName) throw new Error('two distinct names required')
          }
        } else if (op === 'remove') {
          Object.assign(this.ctx.args, { op, uuid })
          if (uuid && !isUUID(uuid)) throw new Error('invalid uuid')
        } else if (op === 'addTags' || op === 'removeTags' || op === 'setTags') {
          Object.assign(this.ctx.args, { op, tags })
          if (!Array.isArray(tags) || !tags.every(id => Number.isInteger(id))) throw new Error('invalid tags')
        } else {
          Object.assign(this.ctx.args, { op, policy, uuid, tags })
          throw new Error('invalid op')
        }
      } catch (e) {
        e.status = 400
        return this.setState(Failed, e)
      }

      let pred = this.ctx.predecessor
      if (pred) {
        if (pred.isFailed()) {
          this.setState(Failed, new Error('predecessor failed'))
        } else if (pred.isSucceeded()) {
          this.setState(Executing)
        } else {
          this.setState(Pending)
        }
      } else {
        this.setState(Executing)
      }
    })

    this.part = part
  }

  exit () {
    this.part.removeAllListeners()
    this.part.on('error', () => {})
  }

  destroy () {
    this._destroy()
  }
}

class Piping extends State {
  
  enter (part) {

    let data = this.ctx.ctx.apis.tmpfile()
    this.ctx.args.data = data 
    let { size, sha256 } = this.ctx.args 

    this.hs = HashStream.createStream(part, data, size, sha256, false)
    this.hs.on('finish', err => {

      if (err) {
        if (err.code === 'EOVERSIZE' || err.code === 'EUNDERSIZE' || err.code === 'ESHA256MISMATCH') {
          err.status = 400
        } else {
          console.log('hash stream error code', err.code, this.hs)
        }
        this.setState(Failed, err)
      } else {
        // hash stream should guarantee this prop
        this.ctx.args.sha256 = this.hs.digest
        let pred = this.ctx.predecessor
        if (pred) {
          if (pred.isFailed()) {
            this.setState(Failed, new Error('predecessor failed'))
          } else if (pred.isSucceeded()) {
            this.setState(Executing)
          } else {
            this.setState(Pending)
          }
        } else {
          this.setState(Executing)
        }
      }
    })

    this.part = part 
  } 

  destroy () {
    this.hs.removeAllListeners()
    this.hs.destroy()
    this._destroy()
  }
}

/**
Pending field or file job

Go to failed or executing when job finished. Ignore destroy
*/
class Pending extends State {

  enter () {
    debug('enter pending')
  }

  onJobFailed (job) {
    if (job === this.ctx.predecessor) this.setState(Failed, new Error('predecessor failed'))
  }

  onJobSucceeded (job) {
    if (job === this.ctx.predecessor) this.setState(Executing)
  }

}

/**
Commit the final operation to VFS

Ignore all events
*/
class Executing extends State {

  enter () {
    let args = this.ctx.args

    if (args.type === 'file') {
      switch (args.op) {
        case 'newfile':
          this.ctx.ctx.apis.newfile({
            name: args.toName,
            data: args.data,
            size: args.size,
            sha256: args.sha256,
            policy: args.policy
          }, (err, xstat, resolved) => {
            if (err) {
              this.setState(Failed, err)
            } else {
              args.resolved = resolved // record resolved
              this.setState(Succeeded, xstat)
            }
          })
          break

        case 'append':
          this.ctx.ctx.apis.append({
            name: args.toName,
            hash: args.hash,
            data: args.data,
            size: args.size,
            sha256: args.sha256 
          }, (err, xstat) => {
            if (err) {
              this.setState(Failed, err)
            } else {
              this.setState(Succeeded, xstat)
            }
          })
          break

        default:
          break 
      }
    } else {
      switch (args.op) {
        case 'mkdir':
          this.ctx.ctx.apis.mkdir({ 
            name: args.toName,
            policy: args.policy
          }, (err, xstat, resolved) => {
            if (err) {
              this.setState(Failed, err)
            } else {
              args.resolved = resolved
              this.setState(Succeeded, xstat)
            }
          })
          break

        case 'remove':
          this.ctx.ctx.apis.remove({
            name: args.toName,
            uuid: args.uuid
          }, err => err 
            ? this.setState(Failed, err) 
            : this.setState(Succeeded, null))
          break

        case 'rename':
          this.ctx.ctx.apis.rename({
            fromName: args.fromName,
            toName: args.toName,
            policy: args.policy
          }, (err, xstat, resolved) => {
            if (err) {
              this.setState(Failed, err)
            } else {
              args.resolved = resolved
              this.setState(Succeeded, xstat)
            }
          })
          break

        case 'addTags': 
          this.ctx.ctx.apis.addTags({ 
            name: args.name,
            tags: [...args.tags] 
          }, (err, xstat) => 
            err ? this.setState(Failed, err) : this.setState(Succeeded, xstat))
          break
        
        case 'removeTags':
          this.ctx.ctx.apis.removeTags({
            name: args.name,
            tags: [...args.tags]
          }, (err, xstat) => 
            err ? this.setState(Failed, err) : this.setState(Succeeded, xstat))
          break
        
        case 'setTags':
          this.ctx.ctx.apis.setTags({
            name: args.name,
            tags: [...args.tags]
          }, (err, xstat) => 
            err ? this.setState(Failed, err) : this.setState(Succeeded, xstat))
          break

        default:
          console.log('invalid job op', args.op)
          let err = new Error('op not implemented yet')
          err.status = 403
          this.setState(Failed, err)
          break
      }
    }
  }
}

/**
Job starts from a part and finally reached failed or succeeded.

A job is a state machine. It has the following states:

1. heading
2. parsing
3. parsed
4. piping
5. piped
6. executing
7. failed
8. succeeded

*/
class Job extends EventEmitter {

  constructor (ctx, part) {
    super()
    // init this early
    this.args = {}
    this.ctx = ctx
    new Heading(this, part)
  }

  isSucceeded () {
    return this.state.constructor === Succeeded
  }

  isFailed () {
    return this.state.constructor === Failed
  }

  isFinished () {
    return this.isFailed() || this.isSucceeded()
  }

  onJobFailed (job) {
    this.state.onJobFailed(job)
  }

  onJobSucceeded (job) {
    this.state.onJobSucceeded(job)
  }

  destroy () {
    this.state.destroy()
  }

}

/**
Party handles part

Party is a (s -> 0 | s => e -> 0) reactor. Noting that s -> 0 may reach finish and failed state.
*/
class Party extends EventEmitter {

  constructor(apis) {
    super()

    this.error = null
    this.ended = false
    this.finished = false
    this.apis = apis
    this.jobs = [] 
    this.jobCount = 0
  }

  result () {
    return this.jobs.filter(j => j.isFinished())
      .map(j => {
        if (j.isFailed()) {
          let { status, code, xcode, message, syscall, path } = j.state.error
          return Object.assign({}, j.args, { error: { status, code, xcode, message, syscall, path } })
        } else {
          return Object.assign({}, j.args, { data: j.state.data })
        }
      })
  }

  write (part) {
    if (this.finished || this.error) return    

    let job = new Job(this, part) 
    job.on('StateEntered', state => {
      if (!job.isFinished()) return
      this.jobCount--
      //if (this.ended && this.jobs.every(j => j.isFinished())) {
      if (!this.jobCount && this.ended) {
        // mute , due to asynchrony of state event
        this.jobs.forEach(j => j.removeAllListeners()) 
        if (!this.error && job.isFailed()) this.error = job.state.error
        this.finished = true
        return this.emit('finish')
      }

      if (this.error) { // E state
        this.jobs.forEach(j => job.isFailed() ? j.onJobFailed(job) : j.onJobSucceeded(job))
      } else {          // S state
        if (job.isFailed()) { // first error
          this.jobs.forEach(j => j.onJobFailed())
          this.jobs.forEach(j => j.destroy())
          this.error = job.state.error
          this.emit('error', this.error)
        } else {
          this.jobs.forEach(j => j.onJobSucceeded(job))
        }
      }

    })

    this.jobs.push(job)
    this.jobCount++
  } 

  end () {
    if (this.finished || this.ended) return
    this.ended = true
    if (this.ended && !this.jobCount) {
      // mute
      this.jobs.forEach(j => j.removeAllListeners())
      this.finished = true 
      this.emit('finish')
    } 
  }

  destroy () {
    if (this.finished || this.error) return
    this.error = new Error('destroyed')
    this.error.code = 'EDESTROYED'
    this.jobs.forEach(j => j.destroy())
  }
}

/**
IncomingForm

formdata -> dicer -> party
*/
class IncomingForm extends EventEmitter {

  constructor (opts, apis) {
    super()

    let { boundary, formdata } = opts
    this.error = null

    this.errorHandler = err => {
      this.error = err

      this.formdata.unpipe()
      this.formdata.removeListener('error', this.errorHandler)
      this.formdata.on('error', () => {})

      this.dicer.removeAllListeners()
      this.dicer.on('error', () => {})

      this.party.removeListener('error', this.errorHandler)
      this.party.on('error', () => {})

      // this must be called 
      // case: when parsing header errored, part is not ended but all jobs finished.
      this.party.end()
    }

    this.party = new Party(apis)
    this.party.on('error', this.errorHandler)
    this.party.on('finish', () => {
      // Noting that party may finish in error
      this.error = this.error || this.party.error
      if (this.error) {
        this.error.result = this.party.result()
        debug('party finished with error', JSON.stringify(this.error, null, '  '))
      } else {
        this.result = this.party.result()
        debug('party finished with result', JSON.stringify(this.result, null, '  '))
      }

      this.emit('finish')
    })

    this.dicer = new Dicer({ boundary })
    this.dicer.on('part', part => this.party.write(part))
    this.dicer.on('error', this.errorHandler)
    this.dicer.on('finish', () => this.party.end())

    this.formdata = formdata
    this.formdata.on('error', this.errorHandler)
    this.formdata.pipe(this.dicer)
  }

}

module.exports = IncomingForm
