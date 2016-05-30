import fs from 'fs'
import child from 'child_process'
import events from 'events'
import request from 'superagent'
import deepmerge from 'deepmerge'

import { toLines, delay } from 'lib/utils'
import { createStore, combineReducers } from 'lib/reduced'
import appstore from './appstore'
import Storage from './storage'

import dockeragent from './dockeragent'
import pullImage from './pullImage'
import containerCreateDefaultOpts from './containerDefault'

import { containerStart, containerStop, containerCreate, containerDelete } from './dockerapi'
import { readConfig, saveConfig } from './dockerConfig'

import DockerState from './dockerState' 

const dockerUrl = 'http://127.0.0.1:1688'
const dockerPidFile = '/run/wisnuc/app/docker.pid'
const dockerVolumesDir = '/run/wisnuc/volumes'

let memo = {
  status: 0,
  tasks: []
}

let timeout = null
let eventListener = null

function resetMemo() {

  if (timeout) clearTimeout(timeout)
  eventListener = null
  memo = { status: 0, tasks: [] }  
}

function scheduleMemoUpdate() {

  info('schedule memo update')
  if (timeout) {
    clearTimeout(timeout)
  }
  
  timeout = setTimeout(() => {
    updateDockerState() 
  }, 300)
}

function info(message){
  console.log(`[docker] ${message}`)
}


/*
 * async function, return { running: false } or { running: true, pid, volume }, may return error
 * in future
 */
async function probeDaemon() {

  return await new Promise((resolve) => { // TODO never reject?
    child.exec('ps aux | grep docker | grep "docker daemon"', (err, stdout) => { // stderr not used

      /** the assumption is only one instance of daemon now **/
      let cmdline = toLines(stdout).find(line => {
      /*  [ 'root', '12670', '0.0', '1.9', '555028', '39444', '?', 'Ssl', 'May03', '0:25', 'docker', 'daemon', // 12 total
            '--exec-root="/run/wisnuc/volumes/da2ba49b-1d16-4f6e-8005-bfaedd110814/root"', 
            '--graph="/run/wisnuc/volumes/da2ba49b-1d16-4f6e-8005-bfaedd110814/graph"',
            '--host="127.0.0.1:1688"',
            '--pidfile="/run/wisnuc/app/docker.pid"' ] */
        // console.log(line)
        let p = line.split(/\s+/)
        // console.log(p)
        if (p.length === 16 &&
            p[10] === 'docker' && 
            p[11] === 'daemon' &&
            p[12].startsWith('--exec-root=/run/wisnuc/volumes/') && 
            p[12].endsWith('/root') &&
            p[13].startsWith('--graph=/run/wisnuc/volumes/') &&
            p[13].endsWith('/graph') &&
            p[14] === '--host=127.0.0.1:1688' &&
            p[15] === '--pidfile=/run/wisnuc/app/docker.pid') return true
        return false
      })

      if (!cmdline) return resolve({running: false})
      let p = cmdline.split(/\s+/)
      let pid = parseInt(p[1])
      let pp = p[12].split(/\//)
      let volume = pp[pp.length - 2]
      resolve({running: true, pid, volume})
    })
  }) 
}

/*
 * return agent or null
 */
async function dockerEventsAgent() {

  let agent = await new Promise((resolve) => // TODO never reject?
    dockeragent.get('/events', (e, r) => 
      e ? resolve(null) : resolve(r)))

  if (!agent) return null

  agent.on('json', obj => {
    info(`docker event, type: ${obj.Type}, action: ${obj.Action}, status: ${obj.status}`)
    scheduleMemoUpdate()
  })

  agent.on('close', () => {
    info('event listener disconnected')
    resetMemo()
  })

  return agent
}

/*
 * return {pid, volume, listener} or null
 */
async function daemonStart(uuid) {

  let out = fs.openSync('/dev/null', 'w')
  let err = fs.openSync('/dev/null', 'w')
  let mountpoint = `${dockerVolumesDir}/${uuid}`
  let opts = {
    cwd: mountpoint,
    detached: true, 
    stdio: ['ignore', out, err]
  }
 
  let args = [
    'daemon', 
    `--exec-root=${mountpoint}/root`, 
    `--graph=${mountpoint}/graph`, 
    '--host=127.0.0.1:1688',  
    `--pidfile=${dockerPidFile}`
  ]

  let dockerDaemon = child.spawn('docker', args, opts)
  dockerDaemon.on('exit', (code, signal) => {
    dockerDaemon = null
    if (code !== undefined) console.log(`daemon exits with exitcode ${code}`)
    if (signal !== undefined) console.log(`daemon exits with signal ${signal}`)
  })

  await delay(1000)

  if (dockerDaemon === null) throw 'docker daemon stopped right after started'
  dockerDaemon.unref()
  eventListener = await dockerEventsAgent() 

  let daemon = {pid: dockerDaemon.pid, volume:uuid}
  memo = { status: 0, daemon, tasks: [] }
  info(`docker daemon started as ${dockerDaemon.pid}`)
}

/*
 * kill daemon anyway; TODO be nicer
 */
async function daemonStop() {

  if (memo.status === 0) return

  let daemon = await probeDaemon()
  if (daemon.running) { 
    info(`sending term signal to ${daemon.pid}`)
    process.kill(daemon.pid)  
  }      
}

function dockerApiGet(url) {
  return new Promise((resolve, reject) => 
    request.get(dockerUrl + url)
      .set('Accept', 'application/json')
      .end((err, res) => err ? reject(err) : resolve(res.body)))
}

/*
 * should return state TODO
 */ 
async function updateDockerState() {

  const containersUrl = '/containers/json?all=1'
  const imagesUrl = '/images/json'
  const infoUrl = '/info'
  const versionUrl = '/version'
  const volumesUrl = '/volumes'
  const networksUrl = '/networks'

  let r = await Promise.all([
    dockerApiGet(containersUrl),
    dockerApiGet(imagesUrl),
    dockerApiGet(infoUrl),
    dockerApiGet(versionUrl),
    dockerApiGet(volumesUrl),
    dockerApiGet(networksUrl)
  ])

  // TODO 
  // let cd = await Promise.all(r[0].map(c => dockerApiGet(`/containers/${c.
  let id = await Promise.all(r[1].map(img => dockerApiGet(`/images/${img.Id.slice(7)}/json`)))

  let state = {
    containers : r[0],
    images: r[1],
    imageDetails: id,
    info: r[2],
    version: r[3],
    volumes: r[4],
    networks: r[5]
  }

  memo = Object.assign({ 
    status: memo.status + 1,
    daemon: memo.daemon,
    tasks: []
  }, state) 

  info(`memo updated, status: ${memo.status}`)
}

class task extends events {

  constructor(type, id, parent) {
    super()
    this.parent = parent
    this.type = type
    this.id = id
    this.status = 'started'
    this.errno = 0
    this.message = null
   
    /** must implement _getState() **/
  }

  getState() {
    return {
      type: this.type,
      id: this.id,
      status: this.status,
      errno: this.errno,
      message: this.message,
      state: this._getState(),
    }
  }
}

class imageCreateTask extends task {

  constructor(name, tag, parent) {

    super('imageCreate', `${name}:${tag}`, parent)
    this.data = null

    pullImage(name, tag, (e, agent) => {

      if (e) {
        this.status = 'stopped'
        this.errno = e.errno
        this.message = e.message
        console.log('imageCreate emit end, e')
        emit('end')
      }
      else {
        this.agent = agent
        agent.on('update', state => {
          this.data = state
          this.emit('update')
        })

        agent.on('close', () => {
          if (this.aborting === true) {
            this.errno = 'ECONNABORTED'
          }
          else {
            this.errno = 0
          }
          this.status = 'stopped'
          this.agent = null
          this.emit('end')
        })
      }
    })  
  }

  _getState() {
    return this.data
  }

  abort() {
    if (this.agent && this.status === 'started') {
      this.aborting = true
      this.agent.abort()
    }
  } 
}

class appInstTask extends task {

  constructor(app) {
    super('appInstall', `${app.appname}`, null)

    this.app = app
    this.jobs = app.components.map(compo => {
      
      let image = new imageCreateTask(`${compo.namespace}/${compo.name}`, compo.tag, this)
      image.on('update', () => this.emit('update'))
      image.on('end', () => {
        
        if (!this.jobs.every(job => job.image._getState().digest && job.image._getState().status))
          return

        this.createAndStartContainers()
          .then(e => {
            if (e) {
              this.errno = e.errno
              this.message = e.message
            }
            else {
              this.errno = 0
              this.message = null
            }
            this.status = 'stopped'
            this.emit('end')
          })
          .catch(e => {
            if (e.code === undefined) console.log(e)
            this.errno = e.errno
            this.message = e.message
            this.status = 'stopped'
            this.emit('end') 
          })
      })

      return {
        compo: compo, 
        image: image,
        container: null
      }
    })
  }

  async createAndStartContainers() {

    // in reverse order
    for (var i = this.jobs.length - 1; i >= 0; i--) {
      let job = this.jobs[i]
      let opt = deepmerge(containerCreateDefaultOpts(), job.compo.config)
      opt.Image = `${job.compo.namespace}/${job.compo.name}`
      
      let re = await containerCreate(opt)
      if (re instanceof Error) {
        job.container = {
          errno: re.errno,
          message: re.message,
          result: null
        } 
        return re
      }
      
      job.container = {
        errno: 0,
        message: null,
        result: re
      }
    }

    return containerStart(this.jobs[0].container.result.Id) 
  }

  _getState() {
    return this.jobs.map(job => {
      return {
        image: job.image.getState(),
        container: job.container
      }
    })
  }
}

async function appInstall(appname) {

  let apps = appstore.get().apps
  let app = apps.find(app => app.appname === appname)
  if (!app) return

  let task = new appInstTask(app)
  task.on('update', () => {
    memo.status++
  })
  memo.tasks.push(task)
}

async function init() {

  // mkdir -p
  await new Promise((resolve, reject) => {
    child.exec('mkdir -p /run/wisnuc/app', (err, stdout, stderr) => {
      err ? reject(stderr) : resolve(stdout)
    })
  })

  let config = await readConfig() 

  let daemon = await probeDaemon()
  if (daemon.running) {
    info(`daemon already running with pid ${daemon.pid} and volume ${daemon.volume}`)   

    if (config.lastUsedVolume !== daemon.volume) {
      config.lastUsedVolume = daemon.volume
      saveConfig(config)
        .then(() => info('docker config saved')) // no result? TODO
        .catch(e => {
          info('WARNING: error saving docker config')
          info(e)
        })  
    } 

    // TODO
    eventListener = await dockerEventsAgent() 
    memo.daemon = {
      pid: daemon.pid,
      volume: daemon.volume 
    }
    await updateDockerState()
    return 
  }

  if (!config.lastUsedVolume) {
    info('last used volume not set, docker daemon not started')
    return
  }

  while (Storage.get().status === 0) {
    info('wait 200ms for storage module init')
    await delay(200)
  }

  let storage = Storage.get()
  if (storage.status === -1) {
    info('storage module fails to init, docker module init aborted')
    memo.status = -1
    return
  }

  let volume = storage.volumes.find(vol => vol.uuid === config.lastUsedVolume)
  if (!volume) {
    info(`last used volume (${config.lastUsedVolume}) not found, docker daemon not started`)
    return
  }

  if (volume.missing) {
    info(`last used volume (${config.lastUsedVolume}) has missing drive, docker daemon not started`)
    return
  }

  await daemonStart(volume.uuid)
  await updateDockerState()
}

async function daemonStartOperation(uuid) {

  if (memo.status > 0) return

  let storage = Storage.get()
  let volume = storage.volumes.find(vol => vol.uuid === uuid)
  if (!volume || volume.missing) {
    return
  }

  await daemonStart(volume.uuid)
  await updateDockerState()
}

async function _operation(req) {

  info(`operation: ${req.operation}`)  

  let f, args
  if (req && req.operation) {
    
    args = (req.args && Array.isArray(req.args)) ? req.args : []
    switch (req.operation) {

    case 'daemonStart':
      f = daemonStartOperation
      break 
    case 'daemonStop':
      f = daemonStop
      break
    case 'containerStart':
      f = containerStart
      break
    case 'containerStop':
      f = containerStop
      break
    case 'appInstall':
      f = appInstall
      break
    }
  }

  if (f) await f(...args)
  return null
}

async function _init() {

  let daemon = await probeDaemon()
  if (daemon.running) {
    process.kill(daemon.pid) 
  }
}

function mapTasks(tasks) {

  return tasks.map(t => {
    return t.getState()
  })
}

export default {

  init: () => {
    init()
      .then(r => { // r not used? TODO
        info('initialized')
        info(`memo status: ${memo.status}`)
      })
      .catch(e => {
        info('ERROR: init failed')
        console.log(e)
      })
  },

  operation: (req, callback) => {
    _operation(req)
      .then(r => {
        r instanceof Error ? callback(r) : callback(null, r)
      })
      .catch(e => {
        info(`${e.message}`)
        callback(e)
      })
  },

  status: () => Object.assign({}, { status: memo.status }),

  get: () => Object.assign({}, memo, { tasks: mapTasks(memo.tasks) }) 
}

let testing = {

  imageCreateTask,
  appInstTask,
}

export { testing }

