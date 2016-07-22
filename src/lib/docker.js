import fs from 'fs'
import child from 'child_process'
import Promise from 'bluebird'

import mkdirp from 'mkdirp'

import { toLines, delay } from '../lib/utils'
import { createStore, combineReducers } from '../lib/reduced'
import appstore from './appstore' // TODO

import { containerStart, containerStop, containerCreate, containerDelete } from './dockerapi'
import { getConfig, setConfig } from './appifiConfig'
import { dockerEventsAgent, DockerEvents } from './dockerEvents'
import { AppInstallTask } from './dockerTasks'

import { calcRecipeKeyString, appMainContainer } from './dockerApps'
import { storeState, storeDispatch } from '../lib/reducers'

const dockerUrl = 'http://127.0.0.1:1688'
const dockerPidFile = '/run/wisnuc/app/docker.pid'
const dockerVolumesDir = '/run/wisnuc/volumes'

const dockerAppdataDir = () => {

  if (!storeState().docker || !storeState().docker.volume) return null
  return `${dockerVolumesDir}/${storeState().docker.volume}/wisnuc/appdata`
}

function info(message) {
  console.log(`[docker] ${message}`)
}

async function mkdirpAsync(dirpath) {

  return new Promise(resolve => mkdirp(dirpath, err => err ? resolve(err) : resolve(null)))
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
            p[13].startsWith('--graph=/run/wisnuc/volumes/') &&
            p[14] === '--host=127.0.0.1:1688' &&
            p[15] === '--pidfile=/run/wisnuc/app/docker.pid') return true
        return false
      })

      if (!cmdline) {
        info(`probeDaemon docker is not running`)
        return resolve({running: false})
      }

      let p = cmdline.split(/\s+/)
      let pid = parseInt(p[1])
      let pp = p[12].split(/\//)
/**
[ '--exec-root=',
  'run',
  'wisnuc',
  'volumes',
  'faa48687-8b84-42ce-b625-ab49cf9e7830',
  'wisnuc',
  'docker',
  'root' ]
**/

      let volume = pp[4]

      info(`probeDaemon, docker is running with pid: ${pid}, volume:${volume}`)
      resolve({running: true, pid, volume})
    })
  }) 
}

function dispatchDaemonStart(pid, volume, agent) {

  let events = new DockerEvents(agent)
  events.on('update', state => {
    storeDispatch({
      type: 'DOCKER_UPDATE',
      data: state
    })
  })
  events.on('end', () => {
    storeDispatch({
      type: 'DAEMON_STOP'
    })
  })

  setConfig('lastUsedVolume', volume)
  storeDispatch({
    type: 'DAEMON_START',
    data: { pid, volume, events }
  })  
}

/*
 * return {pid, volume, listener} or null
 */
async function daemonStart(uuid) {

  let out = fs.openSync('/dev/null', 'w')
  let err = fs.openSync('/dev/null', 'w')

  let mountpoint = `${dockerVolumesDir}/${uuid}`
  let execRootDir = `${mountpoint}/wisnuc/r`
  let graphDir = `${mountpoint}/wisnuc/g`
  let appDataDir =`${dockerVolumesDir}/${uuid}/wisnuc/appdata` 

  await mkdirpAsync(execRootDir)
  await mkdirpAsync(graphDir)
  await mkdirpAsync(appDataDir)

  let opts = {
    cwd: mountpoint,
    detached: true, 
    stdio: ['ignore', out, err]
  }
 
  let args = [
    'daemon', 
//    `--exec-root=${mountpoint}/root`, 
//    `--graph=${mountpoint}/graph`, 
    `--exec-root=${execRootDir}`,
    `--graph=${graphDir}`,
    '--host=127.0.0.1:1688',  
    `--pidfile=${dockerPidFile}`
  ]

  let dockerDaemon = child.spawn('docker', args, opts)
  dockerDaemon.on('exit', (code, signal) => {
    dockerDaemon = null
    if (code !== undefined) console.log(`daemon exits with exitcode ${code}`)
    if (signal !== undefined) console.log(`daemon exits with signal ${signal}`)
  })

  await delay(3000)

  if (dockerDaemon === null) throw 'docker daemon stopped right after started'
  dockerDaemon.unref()

  let agent = await dockerEventsAgent() 
  dispatchDaemonStart(dockerDaemon.pid, uuid, agent)
}

/*
 * kill daemon anyway; TODO be nicer
 */
async function daemonStop() {

  let daemon = await probeDaemon()
  if (daemon.running) { 
    info(`sending term signal to ${daemon.pid}`)
    process.kill(daemon.pid)  
  }

  await delay(2000) 
}

function appStatus(recipeKeyString) {

  let state = storeState()
  
  if (state.docker === null || 
      state.docker.data === null ||
      state.docker.data.containers === null ||
      state.docker.computed === null ||
      (!state.docker.computed.installeds))
  { return 'UNAVAIL' }

  let installeds = state.docker.computed.installeds

  let inst = installeds.find(i => i.recipeKeyString === recipeKeyString)
  if (inst) return 'INSTALLED'

  let tasks = state.tasks
  let task = tasks.find(t => t.type === 'appInstall' && t.id === recipeKeyString && t.status === 'started')
  if (task) return 'INSTALLING'

  return 'NOTFOUND'
}

async function appInstall(recipeKeyString) {

  // check if installed or installing
  let status = appStatus(recipeKeyString)
  if (status !== 'NOTFOUND') {
    info(`${recipeKeyString} status: ${status}, install rejected`)
    return
  } 

  // retrieve recipe
  let appstore = storeState().appstore.result
  if (!appstore || !appstore.recipes) {
    info(`recipes unavail, failed to install ${appname} (${recipeKeyString})`)
    return
  }

  let recipe = appstore.recipes.find(r => calcRecipeKeyString(r) === recipeKeyString)
  if (!recipe) {
    info(`recipe not found: ${recipeKeyString}, install app failed`)
    return
  }

  // remove existing tasks if any
  let tasks = storeState().tasks
  let stopped = tasks.filter(t => t.type === 'appInstall' && t.id === recipeKeyString && t.status === 'stopped')
  stopped.forEach(t => {
    storeDispatch({
      type: 'TASK_REMOVE',
      task: {
        type: 'appInstall',
        id: recipeKeyString 
      }   
    })
  })

  // create task
  let task = new AppInstallTask(recipe)
  storeDispatch({
    type: 'TASK_ADD',
    task    
  })
}

async function init() {

  // mkdir -p
  await new Promise((resolve, reject) => {
    child.exec('mkdir -p /run/wisnuc/app', (err, stdout, stderr) => {
      err ? reject(stderr) : resolve(stdout)
    })
  })


  let daemon = await probeDaemon()
  if (daemon.running) {
    info(`daemon already running with pid ${daemon.pid} and volume ${daemon.volume}`)   

    let agent = await dockerEventsAgent() 
    dispatchDaemonStart(daemon.pid, daemon.volume, agent)
    return
  }

  let lastUsedVolume = getConfig('lastUsedVolume')
  if (!lastUsedVolume) {
    info('last used volume not set, docker daemon not started')
    return
  }

  while (!storeState().storage) {
    info('wait 500ms for storage module init')
    await delay(500)
  }

  let storage = storeState().storage
  let volume = storage.volumes.find(vol => vol.uuid === lastUsedVolume)
  if (!volume) {
    info(`last used volume (${lastUsedVolume}) not found, docker daemon not started`)
    return
  }

  if (volume.missing) {
    info(`last used volume (${lastUsedVolume}) has missing drive, docker daemon not started`)
    return
  }

  await daemonStart(volume.uuid)
}

async function daemonStartOp(uuid) {

  if (storeState().docker) 
    throw new Error('daemon already started') 

  let storage = storeState().storage
  let volume = storage.volumes.find(vol => vol.uuid === uuid)
  if (!volume)
    throw new Error('volume not found')
  if (volume.missing)
    throw new Error('volume missing')

  await daemonStart(volume.uuid)
}

async function containerDeleteCommand(id) {

  let docker = storeState().docker
  if (!docker || !docker.computed || !docker.computed.installeds) return null

  let installeds = docker.computed.installeds

  console.log('>>>>')
  installeds.forEach(inst => console.log(inst.containers))
  console.log('<<<<')

  let inst = installeds.find(i => {
    return i.containers.find(c => c.Id === id) ? true : false
  })  

  if (inst) {
    info(`container in apps cannot be deleted directly`)
    return null
  }

  containerDelete(id)
    .then(r => {
      console.log(r)
      info(`containerDelete ${id} success`)
    })
    .catch(e => {
      info(`containerDelete ${id} failed, error: ${e.errno} ${e.message}`)
    })
}

async function installedStart(uuid) {

  info(`installedStart uuid: ${uuid}`)

  let state = storeState()
  
  if (state.docker === null || 
      state.docker.data === null ||
      state.docker.data.containers === null ||
      state.docker.computed === null ||
      (!state.docker.computed.installeds))
    return { errno: -1 }

  let installeds = state.docker.computed.installeds
  let installed = installeds.find(inst => inst.uuid === uuid)
  if (!installed) return { errno: -1 }

  let container = appMainContainer(installed)
  if (container && container.Id) {
    await containerStart(container.Id)
  } 
}

async function installedStop(uuid) {

  info(`installedStop uuid: ${uuid}`)

  let state = storeState()
  
  if (state.docker === null || 
      state.docker.data === null ||
      state.docker.data.containers === null ||
      state.docker.computed === null ||
      (!state.docker.computed.installeds))
    return { errno: -1 }

  let installeds = state.docker.computed.installeds
  let installed = installeds.find(inst => inst.uuid === uuid)
  if (!installed) return { errno: -1 }

  let container = appMainContainer(installed)
  if (container && container.Id) {
    await containerStop(container.Id)
  }
}

async function appUninstall(uuid) {

  info(`appUninstall uuid: ${uuid}`)

  let state = storeState()
  
  if (state.docker === null || 
      state.docker.data === null ||
      state.docker.data.containers === null ||
      state.docker.computed === null ||
      (!state.docker.computed.installeds))
    return { errno: -1 }

  let installeds = state.docker.computed.installeds
  let installed = installeds.find(inst => inst.uuid === uuid)
  if (!installed) return { errno: -1 }

  let containers = installed.containers

  for (let i = 0; i < containers.length; i++) {
    await containerStop(containers[i].Id)
  } 

  for (let i = 0; i < containers.length; i++) {
    await containerDelete(containers[i].Id) 
  }
}

async function operationAsync(req) {

  info(`operation: ${req.operation}`)  

  let f, args
  if (req && req.operation) {
    
    args = (req.args && Array.isArray(req.args)) ? req.args : []
    switch (req.operation) {

    case 'daemonStart':
      f = daemonStartOp
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
    case 'containerDelete':
      f = containerDeleteCommand
      break
    case 'installedStart':
      f = installedStart
      break
    case 'installedStop':
      f = installedStop
      break
    case 'appInstall':
      f = appInstall
      break
    case 'appUninstall':
      f = appUninstall
      break
    default:
      info(`operation not implemented, ${req.operation}`)
    }
  }

  if (f) await f(...args)
  return null
}

export default {

  init: () => {
    init()
      .then(r => { // r undefined
        info(`initialized`)
      })
      .catch(e => {
        info('ERROR: init failed')
        console.log(e)
      })
  },

  operation: (req, callback) => {
    operationAsync(req)
      .then(r => {
        console.log(r)
        r instanceof Error ? callback(r) : callback(null, r)
      })
      .catch(e => {
        info(`${e.message}`)
        callback(e)
      })
  },
}

export { 

  daemonStart, 
  daemonStop,
  daemonStartOp,

  containerStart,
  containerStop,
  containerDelete,

  installedStart,
  installedStop,

  appInstall,
  appUninstall,

  probeDaemon, 
  dockerAppdataDir 
}


