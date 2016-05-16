const fs = require('fs')
const child = require('child_process')
const request = require('superagent')
const stream = require('stream')
const readline = require('readline')

import { toLines } from './utils'
import dockeragent from './dockeragent'

const Storage = require('./supervisor')

const dockerUrl = 'http://127.0.0.1:1688'
const dockerPidFile = '/run/wisnuc/app/docker.pid'
const dockerVolumesDir = '/run/wisnuc/volumes'
const configFilePath = '/etc/wisnuc.json'
const configDefault = { lastUsedVolume: null }

let timer = null
let eventListener = null
let config = configDefault

//
// memo for memoization
//
// status: 0 stopped; >0, started; -1: error
// pid: available for started only
// volume: available for started only
let memo = {
  status: 0
}

function info(message){
  console.log(`[Docker] ${message}`)
}

// TODO move elsewhere
async function delay(duration) {

  return  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, duration)
  })
}

async function readConfig() {

  return new Promise((resolve, reject) => {
  
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

async function saveConfig(config) {

  return new Promise((resolve, reject) => {

    fs.writeFile(configFilePath, JSON.stringify(config, null, '  '), (err) => {
      if (err) console.log(err)
      resolve()
    }) 
  })  
}

function scheduleUpdate() {

  if (timer) {
    clearTimeout(timer)
  }
  
  setTimeout(() => {
    updateDockerState() 
  }, 300)
}

function createEventListener() {

  return new Promise((resolve, reject) => {
    dockeragent
      .get('/events')
      .on('message', (msg) => {
        if (timer) {
          clearTimeout(timer)
        }
        setTimeout(() => {
          
        }, 300)
      })
      .on('disconnect', () => {
        info('event listener disconnected')
        eventListener = null
        // TODO refresh?
        memo = { status: 0 }
      })
      .connect((e, r) => e ? reject(e) : resolve(r))
  })
}

async function probeDaemon() {

  return await new Promise((resolve, reject) => {
    child.exec(`ps aux | grep docker | grep "docker daemon"`, (err, stdout, stderr) => {

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
    `daemon`, 
    `--exec-root=${mountpoint}/root`, 
    `--graph=${mountpoint}/graph`, 
    `--host=127.0.0.1:1688`,  
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
  eventListener = await createEventListener() 

  memo = { status: 0, pid: dockerDaemon.pid, volume: uuid }
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
    volume: memo.volume
  }, state) 
}

async function init() {

  // mkdir -p
  await new Promise((resolve, reject) => {
    child.exec(`mkdir -p /run/wisnuc/app`, (err, stdout, stderr) => {
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
        .then(r => info('docker config saved'))
        .catch(e => {
          info('WARNING: error saving docker config')
          info(e)
        })  
    } 

    eventListener = await createEventListener()
    
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
    info(`storage module fails to init, docker module init aborted`)
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
  .then(r => { 
    info('initialized')
    info(`memo status: ${memo.status}`)
  })
  .catch(e => {
    info('ERROR: init failed')
    console.log(e)
  })

async function daemonStartOperation(uuid) {

  let system = await probeSystem()
  let { daemon } = system

  if (daemon.running) {
    return system    
  }

  let volume = system.volumes.find(vol => vol.uuid === uuid)
  if (!volume || volume.missing) {
    return system
  }

  await daemonStart(volume.uuid)
  await updateDockerState()
}

async function daemonStopOperation() {

/*
  let system = await probeSystem()
  let { daemon } = system

  if (!daemon.running) return

  process.kill(daemon.pid)

  // at least 800ms on virtualbox, maybe much longer on nuc or nas
  await delay(800)
*/
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

async function containerStart(id) {

  return new Promise((resolve, reject) => 
    request.post(`${dockerUrl}/containers/${id}/start`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        err ? reject(err) : resolve(res)
      }))
}

async function containerStop(id) {

  return new Promise((resolve, reject) => 
    request.post(`${dockerUrl}/containers/${id}/stop`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        err ? reject(err) : resolve(res)
      }))
}

async function appInstall() {}

async function containerRemove(id) {

  return new Promise((resolve, reject) => 
    request.del(`${dockerUrl}/containers/${id}`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        err ? reject(err) : resolve(res)  
      })) 
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
        console.log('containerStart ' + args)
        break
      case 'containerStop':
        f = containerStop
        console.log('containerStop ' + args)
        break
      case 'containerRemove':
        f = containerRemove
        console.log('containerRemove ' + args)
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

module.exports = {

  operation: (req, callback) => {
    _operation(req)
      .then(r => callback(null, r))
      .catch(e => {
        console.log('Warning: Docker Operation Error')
        console.log(req)
        callback(e)
      })
  },

  status: () => { return { status: memo.status }},
  get: () => memo
}


