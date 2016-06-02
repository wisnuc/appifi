import fs from 'fs'
import child from 'child_process'
import events from 'events'
import request from 'superagent'
import deepmerge from 'deepmerge'

import { toLines, delay } from 'lib/utils'
import { createStore, combineReducers } from 'lib/reduced'
import appstore from './appstore'
import {refreshAppStore} from './appstore'
import Storage from './storage'

import dockeragent from './dockeragent'
import pullImage from './pullImage'
import containerCreateDefaultOpts from './containerDefault'

import { containerStart, containerStop, containerCreate, containerDelete } from './dockerapi'
import { readConfig, saveConfig } from './dockerConfig'
import { dockerEventsAgent, DockerEvents } from './dockerEvents'
import { AppInstallTask } from './dockerTasks'
import DockerState from './dockerState' 
import { appLabel } from 'common/appMethods'

const dockerUrl = 'http://127.0.0.1:1688'
const dockerPidFile = '/run/wisnuc/app/docker.pid'
const dockerVolumesDir = '/run/wisnuc/volumes'

function info(message){
  console.log(`[docker] ${message}`)
}

let dockerState = new DockerState()

dockerState.addStateListener((state) => {
  info(`state updated`)
/*
  console.log(state.containers) 
  console.log('hello world')
  if (state !== null) {
    console.log('uuidgroups')
    let uuidGroups = appified(state.containers)
    console.log('uuidgroups')
  }
*/
})

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

  let agent = await dockerEventsAgent() 
  dockerState.attachDaemon({
    pid: dockerDaemon.pid,
    volume: uuid,
    events: new DockerEvents(agent)
  })
}

/*
 * kill daemon anyway; TODO be nicer
 */
async function daemonStop() {

  if (dockerState.status === 0) return

  let daemon = await probeDaemon()
  if (daemon.running) { 
    info(`sending term signal to ${daemon.pid}`)
    process.kill(daemon.pid)  
  }      
}

async function appInstall(recipeKeyString) {

  console.log(recipeKeyString)
  let status = dockerState.appStatus(recipeKeyString)
  console.log(status)
  if (status !== 'NOTFOUND') {
    info(`${appname} ${status}, install rejected`)
    return
  } 

  let app = appstore.getApp(recipeKeyString)
  if (!app) {
    info(`appInstall recipe not found: ${recipeKeyString}`)
    return null
  }

  let task = new AppInstallTask(app)
  dockerState.addTask(task)
}


async function init() {

  refreshAppStore()
    .then((r) => {
      // TODO
      console.log('appstore refreshed')
      dockerState.updateAppStore(r.recipes, r.repoMap)
    })
    .catch(e=>{console.log('appstore refresh failed'); console.log(e)})

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
    let agent = await dockerEventsAgent() 
    dockerState.attachDaemon({
      pid: daemon.pid,
      volume: daemon.volume,
      events: new DockerEvents(agent)
    })

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

  // FIXME
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
}

async function daemonStartOperation(uuid) {

  if (dockerState.status > 0) return

  let storage = Storage.get()
  let volume = storage.volumes.find(vol => vol.uuid === uuid)
  if (!volume || volume.missing) {
    return
  }

  await daemonStart(volume.uuid)
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

export default {

  init: () => {
    init()
      .then(r => { // r not used? TODO
        info(`initial status: ${dockerState.status}`)
      })
      .catch(e => {
        info('ERROR: init failed')
        console.log(e)
      })
  },

  operation: (req, callback) => {
    _operation(req)
      .then(r => {
        console.log(r)
        r instanceof Error ? callback(r) : callback(null, r)
      })
      .catch(e => {
        info(`${e.message}`)
        callback(e)
      })
  },

  status: () => dockerState.getStatus(),
  get: () => dockerState.getState()
}

// TODO
let testing = {

//   ImageCreateTask,
//   AppInstallTask,
}

export { testing }

