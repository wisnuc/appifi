import path from 'path'
import fs from 'fs'
import child from 'child_process'
import Debug from 'debug'

const debug = Debug('appifi:docker')

import mkdirp from 'mkdirp'
import request from 'superagent'

import appstore from './appstore' // TODO

import { containerStart, containerStop, containerCreate, containerDelete } from './dockerapi'

import sysconfig from '../../system/sysconfig'
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

const dockerFruitmixDir = () => {

  if (!storeState().docker || !storeState().docker.volume) return null
  return `${dockerVolumesDir}/${storeState().docker.volume}/wisnuc/fruitmix`
}

// TODO change to debug module
const info = (message) => console.log(`[docker] ${message}`)

const mkdirpAsync = Promise.promisify(mkdirp)
Promise.promisifyAll(fs)

const parseDockerRootDir = (rootDir) => {

  if (!rootDir.endsWith('/wisnuc/r')) return null
  
  let mp = rootDir.slice(0, -9)

  let { storage, sysboot } = storeState()
  let { blocks, volumes } = storage

  let volume = volumes.find(vol => vol.stats.mountpoint === mp)
  if (volume) {
    return {
      type: volume.stats.fileSystemType,
      uuid: volume.stats.fileSystemUUID,
      mountpoint: volume.stats.mountpoint 
    }
  }

  let block = blocks.find(blk => !blk.stats.isVolume && blk.stas.mountpoint === mp)
  if (block) {
    return {
      type: block.stats.fileSystemType,
      uuid: block.stats.fileSystemUUID,
      mountpoint: volume.stats.mountpoint
    }
  }
}

const probeDaemonRoot = (callback) => 
  request
    .get('http://localhost:1688/info')
    .set('Accept', 'application/json')
    .end((err, res) => {
      if (err) return callback(err)
      if (!res.ok) return callback(new Error('request res not ok'))
      callback(null, res.body.DockerRootDir)
    })

const probeDaemonRootAsync = Promise.promisify(probeDaemonRoot)



const probeDaemon2 = (callback) => 
  request
    .get('http://localhost:1688/info')
    .set('Accept', 'application/json')
    .end((err, res) => {

      if (err || !res.ok) 
        return callback(null, { running: false })

      let rootDir = res.body.DockerRootDir

      debug('probeDaemon, dockerRootDir: ', rootDir)

      let volume = rootDir.split('/')[4]
      console.log(`probeDaemon Success, volume: ${volume}`)
      callback(null, {
        running: true,
        volume
      })
    })

const probeDaemon = Promise.promisify(probeDaemon2)

function dispatchDaemonStart(volume, agent) {

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

  // setConfig('lastUsedVolume', volume)
  sysconfig.set('lastUsedVolume', volume)

  storeDispatch({
    type: 'DAEMON_START',
    data: { volume, events }
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
    `--exec-root=${execRootDir}`,
    `--graph=${graphDir}`,
    '--host=127.0.0.1:1688',  
    `--pidfile=${dockerPidFile}`
  ]

  let dockerDaemon = child.spawn('docker', args, opts)

  dockerDaemon.on('error', err => {
    console.log('dockerDaemon error >>>>')
    console.log(err)
    console.log('dockerDaemon error <<<<')
  })

  dockerDaemon.on('exit', (code, signal) => {
    dockerDaemon = null
    if (code !== undefined) console.log(`daemon exits with exitcode ${code}`)
    if (signal !== undefined) console.log(`daemon exits with signal ${signal}`)
  })

  await Promise.delay(3000)

  if (dockerDaemon === null) throw 'docker daemon stopped right after started'
  dockerDaemon.unref()

  let agent = await dockerEventsAgent() 
  dispatchDaemonStart(uuid, agent)
}

const daemonStop2 = (volume, callback) => {

  fs.readFile('/run/wisnuc/app/docker.pid', (err, data) => {

    if (err && err.code === 'ENOENT') 
      return callback(null) 
    else if (err) {
      return callback(err)
    }
    else {
      let pid = parseInt(data.toString())
      process.kill(pid)

      let timer = setInterval(() => {
        try {
          process.kill(pid, 0)
        }
        catch (e) {
          // supposed error code is 'ESRCH', see man 2 kill
          clearInterval(timer)
          callback()
        }
      }, 1000)
    } 
  })
}

const daemonStopCmd = 'start-stop-daemon --stop --pidfile "/run/wisnuc/app/docker.pid" --retry 3'
const daemonStop3 = (volume, callback) => 
  child.exec(daemonStopCmd, (err, stdout, stderr) => {
    if (err) 
      console.log('[docker] daemonStop:', err, stdout, stderr)    
    else
      console.log('[docker] daemonStop: success')
    callback(err)
  })

const daemonStop = Promise.promisify(daemonStop3)

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

async function initAsync() {

  await mkdirpAsync('/run/wisnuc/app')

  let sysboot = storeState().sysboot
  if (!sysboot || !sysboot.currentFileSystem) {
    console.log('[docker]: currentFileSystem not set, return')
    return
  }

  let rootDir
  try { rootDir = await probeDaemonRootAsync() } catch (e) {}

  let daemon = await probeDaemon()
  if (daemon.running) {
    info(`daemon already running with pid ${daemon.pid} and volume ${daemon.volume}`)   

    let agent = await dockerEventsAgent() 
    dispatchDaemonStart(daemon.volume, agent)
    return
  }

  let lastUsedVolume = sysconfig.get('lastUsedVolume')
  if (!lastUsedVolume) {
    info('last used volume not set, docker daemon not started')
    return
  }

  while (!storeState().storage) {
    info('wait 500ms for storage module init')
    await Promise.delay(500)
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
    initAsync()
      .then(r => { // r undefined
        info(`initialized`)
        debug('docker initialized')
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
  dockerAppdataDir, 
  dockerFruitmixDir
}


