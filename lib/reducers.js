import { createStore, combineReducers } from 'redux'

const storage = (state = null, action) => {

  switch(action.type) {
  case 'STORAGE_UPDATE':
    return action.data

  default:
    return state
  }
}

const docker = (state = null, action) => {

  switch(action.type) {
  case 'DAEMON_START':
    return {
      pid: action.data.pid,
      volume: action.data.volume,
      events: action.data.events,
      data: null,
      computed: null
    }

  case 'DOCKER_UPDATE':
    return Object.assign({}, state, {data: action.data})

  case 'DAEMON_STOP': 
    return null

  default: 
    return state
  }
}

const tasks = (state = [], action) => {

  switch(action.type) {
  case 'TASK_ADD':
    return [...state, action.task]

  case 'TASK_UPDATE': {
    let index = state.findIndex(t => t.type === action.task.type && t.id === action.task.id)
    if (index === -1) {
      console.log(`ERROR: TASK_UPDATE, task not found, type: ${action.task.type}, id: ${action.task.id}`)
      return state
    }
    return [...state.slice(0, index), action.data, ...state.slice(index + 1)]
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

const reducer = combineReducers({
  storage,
  docker,
  appstore,
  tasks
})

let status = 0
let store = createStore(reducer)

console.log(`reducers module initialized`)

export { store }













