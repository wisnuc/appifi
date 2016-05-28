const fs = require('fs')
const child = require('child_process')
const request = require('superagent')

import { createStore } from 'redux'
import { toLines } from './utils'

import dockeragent from './dockeragent'
import pullImage from './pullImage'
import containerCreateDefaultOpts from './containerDefault'

import { 
  containerStart, 
  containerStop, 
  containerCreate,
  containerDelete 
} from './dockerapi'

const Storage = require('./storage')
const AppStore = require('./appstore')

const dockerUrl = 'http://127.0.0.1:1688'
const dockerPidFile = '/run/wisnuc/app/docker.pid'
const dockerVolumesDir = '/run/wisnuc/volumes'
const configFilePath = '/etc/wisnuc.json'

let timeout = null
let eventListener = null
let config = { lastUsedVolume: null }

//
// memo for memoization
//
// status: 0 stopped; >0, started; -1: error
// pid: available for started only
// volume: available for started only
let memo = {
  status: 0,
  tasks: []
}

function info(message){
  console.log(`[docker] ${message}`)
}

// TODO move elsewhere
async function delay(duration) {

  return  new Promise((resolve) => { // reject not used
    setTimeout(() => {
      resolve()
    }, duration)
  })
}

async function readConfig() {

  return new Promise((resolve) => { // never reject
  
    fs.readFile(configFilePath, (err, data) => {

      let def = { lastUsedVolume: null }
      if (err) {
        info('WARNING: error reading docker config file, using default')
        resolve(def)
      }
      else {
        try {
          let r = JSON.parse(data.toString())
          resolve(r)
        }
        catch (e) {
          info('WARNING: error parsing docker config file, using default')
          info(data.toString())
          resolve(def)
        }
      }
    })
  })
}

async function saveConfig() {

  return new Promise((resolve) => { // never reject

    fs.writeFile(configFilePath, JSON.stringify(config, null, '  '), (err) => {
      if (err) console.log(err)
      resolve()
    }) 
  })  
}

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

  // let daemon = {pid: dockerDaemon.pid, volume:uuid}
  memo = { status: 0, pid: dockerDaemon.pid, volume: uuid, tasks: [] }
  info(`docker daemon started as ${dockerDaemon.pid}`)
}

async function daemonStop() {

  if (eventListener === null) {
    info('UNEXPECTED: event listener null')
    return
  }

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
    pid: memo.pid,
    volume: memo.volume,
    tasks: []
  }, state) 

  info(`memo updated, status: ${memo.status}`)
}

/* this is simply promisifying the pullImage */
async function imageCreate(name, tag) {

  return new Promise((resolve, reject) => 
    pullImage(name, tag, (e, agent) => 
      e ? reject(e) : resolve(agent)))
}

async function appInstallTask(image, tag) {

  let type = 'appInstall'
  let id = `${image}:${tag}`

  let task = { 
    type, 
    id, 
    state: 'running',           // universal state, running, failed, success
    error: null,                // error if failed
    stage: 'containerCreate',   // description of operation stage
    data: null,                 // for frontend display     
    /** only above properties will be sent to front end via json **/

    agent: null
  }

  memo.tasks.push(task)
  memo.status++

  let option = containerCreateDefaultOpts()
  option.Image = image

  let container = await containerCreate(option)
  if (container === null) {

    info('image not found, start pulling image')

    task.stage = 'imageCreate'
    let agent = await imageCreate(image, tag)
    task.agent = agent 
    await new Promise((resolve) => { // TODO never reject?

      agent.on('update', state => {
        task.data = state
        memo.status++
      })

      agent.on('close', () => {
        resolve()
      })       
    })

    task.agent = null
    if (task.data.digest && task.data.status) {
      info(`pull image ${id} success`)
    }
    else {
      info(`pull image ${id} failed`)
      task.state = 'failed'
      task.error = 'connectionClosed'
      return 
    }

    task.stage = 'containerCreate'
    task.data = null

    let opt = containerCreateDefaultOpts()
    opt.Image = image
    container = await containerCreate(opt)
    if (container === null) {
      task.state = 'failed'
      task.error = 'imageNotFound' 
      return
    }
  }

  /** Id, Warnings **/
  info(`new container id ${container.Id}`)
  
  task.stage = 'containerStart'
  await containerStart(container.Id)  

  // TODO
  task.state = 'success'  
}

async function appInstall(image, tag) {

  let type = 'appInstall'
  let id = `${image}:${tag}`

  let index = memo.tasks.findIndex(t => t.type === type && t.id === id)
  if (index !== -1) {
    let task = memo.tasks[index]

    console.log(memo.tasks)   
 
    if (task.state === 'running') return
    if (task.state === 'success') return
    
    memo.tasks.splice(index, 1)
  }

  appInstallTask(image, tag)
    .then(r => {})
    .catch(e => {
      let task = memo.tasks.find(t => t.type === type && t.id === id)
      if (!task) return
      task.state = 'failed'
      task.agent = null
      task.error = e.message 
      info('task failed')
      console.log(e)
    })
}

async function init() {

  // mkdir -p
  await new Promise((resolve, reject) => {
    child.exec('mkdir -p /run/wisnuc/app', (err, stdout, stderr) => {
      err ? reject(stderr) : resolve(stdout)
    })
  })

  config = await readConfig() 

  let daemon = await probeDaemon()
  if (daemon.running) {
    info(`daemon already running with pid ${daemon.pid} and volume ${daemon.volume}`)   

    if (config.lastUsedVolume !== daemon.volume) {
      config.lastUsedVolume = daemon.volume
      saveConfig()
        .then(() => info('docker config saved')) // no result? TODO
        .catch(e => {
          info('WARNING: error saving docker config')
          info(e)
        })  
    } 

    // TODO
    eventListener = await dockerEventsAgent() 
    memo.pid = daemon.pid
    memo.volume = daemon.volume
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

init()
  .then(r => { // r not used? TODO
    info('initialized')
    info(`memo status: ${memo.status}`)
  })
  .catch(e => {
    info('ERROR: init failed')
    console.log(e)
  })

async function daemonStopOperation() {
  await daemonStop()
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
      f = daemonStopOperation
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
    return {
      type: t.type,
      id: t.id,
      state: t.state,
      error: t.error,
      stage: t.stage,
      data: t.data 
    }
  })
}

module.exports = {

  operation: (req, callback) => {
    _operation(req)
      .then(r => callback(null, r))
      .catch(e => {
        info(`${e.message}`)
        callback(e)
      })
  },

  status: () => Object.assign({}, { status: memo.status }),

  get: () => Object.assign({}, memo, { tasks: mapTasks(memo.tasks) }) 
}


