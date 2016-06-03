import { createStore, combineReducers } from 'redux'

const storage = (state = null, action) => {

  switch(action.type) {
  case 'STORAGE_UPDATE':
    return action.data

  default:
    return state
  }
}

const daemon = (state = null, action) => {

  switch(action.type) {
  case 'DAEMON_START':
    return {
      pid: action.pid,
      volume: action.volume,
      events: action.events,
      data: null
    }

  case 'DAEMON_UPDATE':
    return Object.assign({}, state, {data: action.data})

  case 'DAEMON_STOP':
    state.events.abort()
    return null

  default: 
    return state
  }
}

const tasks = (state = [], action) => {

  switch(action.type) {
  case 'TASK_ADD':
    return [...state, action.task]

  case 'TASK_UPDATE':
    return []

  case 'TASK_REMOVE':
    return []

  default:
    return state
  }
} 

const appstore = (state = null, action) => {

  switch(action.type) {
  case 'APPSTORE_UPDATE':
    return {
      recipes: action.recipes,
      repoMap: action.repoMap
    }
  
  default:
    return state
  }
}

const reducer = combineReducers({
  storage,
  daemon,
  appstore,
  tasks
})

let status = 0
let store = createStore(reducer)

store.subscribe(() => status++)

export { store }













