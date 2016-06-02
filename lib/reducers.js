import { createStore } from 'redux'

const daemon = (state = null, action) {

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
  }
}

const tasks = (state = [], action) {

  switch(action.type) {
  case 'TASK_ADD':
    return [...state, action.task]

  case 'TASK_UPDATE':
    return []

  case 'TASK_REMOVE':
    return []
  }
} 

const appstore = (state = null, action) {

  switch(action.type) {
  case 'APPSTORE_UPDATE'
    return {
      recipes: action.recipes,
      repoMap: action.repoMap
    }
  }
}

const reducer = combineReducers({
  daemon,
  appstore,
  tasks
})

let status = 0
let store = createStore(reducer)

store.subscribe(() => status++)















