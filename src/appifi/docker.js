import path from 'path'
import { fs, child, rimrafAsync, mkdirpAsync } from '../common/async'
import Debug from 'debug'
import request from 'superagent'

import { storeState, storeDispatch } from '../reducers'
import { containerStart, containerStop, containerCreate, containerDelete } from './dockerApi'
import appstore from './appstore' // TODO
import { dockerEventsAgent, DockerEvents } from './dockerEvents'
import dockerStateObserver from './dockerStateObserver'
import { AppInstallTask } from './dockerTasks'
import { calcRecipeKeyString, appMainContainer, containersToApps } from './dockerApps'

const debug = Debug('appifi:docker')

const dockerUrl = 'http://127.0.0.1:1688'
const dockerPidFile = '/run/wisnuc/app/docker.pid'

let rootDir
let appDataDir
let execRootDir
let graphDir

/**
  docker daemon requires two base directories to work
  1. /run/wisnuc/app to store docker.pid file
  2. [rootdir]/ (tailing with wisnuc for volumes)
        // forexample: /run/wisnuc/volumes/xxxx/wisnuc
      r for exec root
      g for graph
      appdata for docker volume
**/
const prepareDirs = async (dir) => {

  await mkdirpAsync('/run/wisnuc/app')

  rootDir = dir
  appDataDir = path.join(rootDir, 'appdata')
  execRootDir = path.join(rootDir, 'r')
  graphDir = path.join(rootDir, 'g')

  await mkdirpAsync(appDataDir) 
  await mkdirpAsync(path.join(rootDir, 'r'))
  await mkdirpAsync(path.join(rootDir, 'g'))
}


const info = (message) => console.log(`[docker] ${message}`)

const probeDaemonGraphDir = (callback) => 
  request
    .get('http://localhost:1688/info')
    .set('Accept', 'application/json')
    .end((err, res) => {
      if (err) return callback(err)
      if (!res.ok) return callback(new Error('request res not ok'))
      callback(null, res.body.DockerRootDir)
    })

const probeDaemonGraphDirAsync = Promise.promisify(probeDaemonGraphDir)

const startDockerEvents = async () => {

  let agent = await dockerEventsAgent()
  let events = new DockerEvents(agent)

  events.on('update', state => {

    let oldState = storeState().docker
    storeDispatch({
      type: 'DOCKER_UPDATE',
      data: {
        data: state,
        computed: {
          installeds: containersToApps(state.containers)
        }
      }
    })

    let newState = storeState().docker
    dockerStateObserver(newState, oldState) 
  })

  events.on('end', () => {
    storeDispatch({
      type: 'DAEMON_STOP'
    })
  })

  storeDispatch({
    type: 'DAEMON_START',
    data: { root: graphDir, events }
  }) 
}

const daemonStart = async () => {

  let out = fs.openSync('/dev/null', 'w')
  let err = fs.openSync('/dev/null', 'w')

  let opts = {
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

const initAsync = async (dir) => {

  debug('docker init dir', dir)

  await prepareDirs(dir)

  debug('graph dir', graphDir)

  let probedGraphDir
  try { 
    probedGraphDir = await probeDaemonGraphDirAsync() 
  } catch (e) {}

  debug('probed graph dir', probedGraphDir)

  if (probedGraphDir === graphDir) {
    console.log(`[docker] daemon already started @ ${rootDir}`)
  }
  else {

    if (probedGraphDir) {
      console.log(`[docker] another daemon already started (graphDir) @ {probedGraphDir}, try stopping it`)
      await daemonStop()
      await Promise.delay(1000)
    }

    console.log(`[docker] starting daemon @ ${rootDir}`)
    await daemonStart()
  }

  await startDockerEvents()
  console.log('[docker] docker events listener started')
  appstore.reload()
  console.log('[docker] appstore reloading')
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
  let task = new AppInstallTask(recipe, appDataDir)
  storeDispatch({
    type: 'TASK_ADD',
    task    
  })
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

export default {

  init: (dir) => {
    initAsync(dir)
      .then(r => { // r undefined
        console.log(`[docker] initialized`)
      })
      .catch(e => {
        info('ERROR: init failed')
        console.log(e)
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
}


