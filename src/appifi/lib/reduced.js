const createStore = (reducer) => {

  let state
  let listeners = []

  const getState = () => state

  const dispatch = (action) => {
    state = reducer(state, action)
    listeners.forEach(listener => listener())
  }

  const subscribe = (listener) => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter(l => l !== listener)
    }
  }

  dispatch({})

  return { getState, dispatch, subscribe }
}

const combineReducers = (reducers) => {
  return (state = {}, action) => {
    return Object.keys(reducers).reduce(
      (nextState, key) => {
        nextState[key] = reducers[key](state[key], action)
        return nextState
      }, 
      {}
    )
  }
}

export { createStore, combineReducers }

/** test
const reducer1 = (state = 0, action) => {

  switch (action.type) {
  case 'INC':
    return state + 1
  case 'DEC':
    return state - 1
  default:
    return state  
  }
}

const reducer2 = (state = 100, action) => {

  switch (action.type) {
  case 'INC':
    return state + 1
  case 'DEC':
    return state - 1
  default:
    return state  
  }
}

const reducer3 = combineReducers({reducer1, reducer2})

let store = createStore(reducer3)
console.log(store.getState())
store.dispatch({type: 'INC'})
console.log(store.getState())
store.dispatch({type: 'DEC'})
console.log(store.getState())
**/






