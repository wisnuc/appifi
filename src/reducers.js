import Debug from 'debug'

import { createStore, combineReducers } from 'redux'
import { containersToApps } from './appifi/lib/dockerApps'

const debug = Debug('system:reducers')

const device = (state = null, action) => {

  switch (action.type) {
  case 'UPDATE_DEVICE':
    return action.data
  case 'UPDATE_DEVICE_MEMINFO':
    return Object.assign({}, state, { memInfo: action.data })
  default:
    return state
  }
}

const serverConfig = (state = {}, action) => {

  switch(action.type) {
  case 'SERVER_CONFIG':
    state[action.key] = action.value
    return state 
  default:
    return state
  }
}

const storage = (state = null, action) => {

  switch(action.type) {
  case 'STORAGE_UPDATE':
    return action.data

  default:
    return state
  }
}

const sysboot = (state = null, action) => {

  switch(action.type) {
  case 'UPDATE_SYSBOOT':
    return action.data

  default:
    return state
  }
}

const fruitmixUsers = (state = null, action) => {
  
  switch(action.type) {
  case 'UPDATE_FRUITMIX_USERS':
    debug('update fruitmix users', action.data)
    return action.data

  default:
    return state
  }
}

const fruitmixDrives = (state = null, action) => {

  switch(action.type) {
  case 'UPDATE_FRUITMIX_DRIVES':
    debug('update fruitmix drives', action.data)
    return action.data
  
  default:
    return state
  }
}

const dockerObservers = []

export const observeDocker = f => 
  dockerObservers.push(f)

const docker = (state = null, action) => {

  let newState

  switch(action.type) {
  case 'DAEMON_START':
    newState = {
      // pid: action.data.pid,
      volume: action.data.volume,
      events: action.data.events,
      data: null,
      computed: null
    }
    break

  case 'DOCKER_UPDATE':
    newState = Object.assign({}, 
      state, 
      {
        data: action.data
      }, 
      {
        computed: {
          installeds: containersToApps(action.data.containers)
        }
      })
    break

  case 'DAEMON_STOP': 
    newState = null
    break

  default: 
    newState = state
    break
  }

  dockerObservers.forEach(observe => 
    process.nextTick(() => 
      observe(newState, state)))
  return newState
}

const tasks = (state = [], action) => {

  switch(action.type) {
  case 'TASK_ADD': {
    action.task.on('update', () => {
      store.dispatch({
        type: 'TASK_UPDATE'
      })  
    })
    action.task.on('end', () => {
      store.dispatch({
        type: 'TASK_UPDATE'
      })
    })
    return [...state, action.task]
  }

  case 'TASK_REMOVE':
    let index = state.findIndex(t => t.type === action.task.type && t.id === action.task.id)
    if (index === -1) {
      console.log(`ERROR: TASK_REMOVE, task not found, type: ${action.task.type}, id: ${action.task.id}`)
      return state 
    }
    return [...state.slice(0, index), ...state.slice(index + 1)]

  default:
    return state
  }
} 

const appstore = (state = null, action) => {

  switch(action.type) {
  case 'APPSTORE_UPDATE':
    return action.data 

  default:
    return state
  }
}

const increment = (state = 0, action) => {

  switch(action.type) {
  case 'TASK_UPDATE':
    return state++

  default:
    return state
  }
}

let store = createStore(combineReducers({
  increment,
  device,
  serverConfig,
  storage,
  sysboot,
  docker,
  appstore,
  tasks,
  fruitmixUsers,
  fruitmixDrives
}))

// store.subscribe(() => console.log(store.getState()))

console.log(`reducers module initialized`)

export const storeState = () => store.getState()
export const storeDispatch = (action) => store.dispatch(action)
export const storeSubscribe = (f) => store.subscribe(f)

export const testing = { store }














