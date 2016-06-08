import request from 'superagent'
import { mixin, dispatch } from '../utils/utils'
// import deepFreeze from 'deep-freeze'

const endpoint = '/storage'

const defaultState = { 

  request: null,

  // view state
  creatingVolume: 0,
  expansions: [],
  newVolumeCandidates: []
}

const operation = (state = null, action) => {

  let tmp

  switch(action.type) {
  case 'STORAGE_OPERATION': {

    console.log('STORAGE_OPERATION')
    console.log(action.data)

    if (state && (state.timeout || state.request)) {
      return state
    }

    return {
      timeout: null,
      request: request
        .post(endpoint)
        .send(action.data)
        .end((err, res) => dispatch({
          type: 'STORAGE_OPERATION_RESPONSE', 
          err, res})),

      errno: 0,
      message: null,
      response: null,
      data: action.data
    }
  }

  case 'STORAGE_OPERATION_RESPONSE': {
    
    let errno = action.err ? (action.err.errno ? action.err.errno : -1) : 0
    let message = action.err ? action.err.message : null
    let response = action.err ? null : action.res

    tmp =  {
      timeout: null,
      request: null,
      errno, 
      message, 
      response,
      data: state.data
    }

    console.log('STORAGE_OPERATION_RESPONSE')
    console.log(tmp)

    if (state.data.operation === 'mkfs_btrfs') {
      setTimeout(() => dispatch({
        type: 'STORAGE_CREATE_VOLUME_CANCEL'  
      }), 1000)
    }
    return tmp
  }

  default:
    return state
  }
}

const card_expansion_toggle = (state, data) => {

  let index = state.expansions.findIndex(exp => exp.type === data.type && exp.id === data.id)
  if (index === -1) { // not found
    return Object.assign({}, state, {
      expansions: [...state.expansions, data]
    })
  }
  else {
    return Object.assign({}, state, {
      expansions: [...state.expansions.slice(0, index), ...state.expansions.slice(index + 1)]
    })
  }
}

const add_new_volume_candidate = (state, data) => {

  let candi = state.newVolumeCandidates.find(candi => candi === data)
  if (candi) {
    console.log(`ERROR: ${data} is already a candidate`)
    return state
  }

  return Object.assign({}, state, {
    newVolumeCandidates: [...state.newVolumeCandidates, data]
  })
}

const remove_new_volume_candidate = (state, data) => {

  let index = state.newVolumeCandidates.findIndex(candi => candi === data)
  if (index === -1) {
    console.log(`ERROR: ${data} is not a candidate`)
    return state
  }

  return Object.assign({}, state, {
    newVolumeCandidates: [...state.newVolumeCandidates.slice(0, index), ...state.newVolumeCandidates.slice(index + 1)]
  }) 
}

const reducer = (state = {
  creatingVolume: 0,
  expansions: [],
  newVolumeCandidates: [],
}, action) => {

  switch (action.type) { 
  case 'STORAGE_CREATE_VOLUME_START':  
    return Object.assign({}, state, { creatingVolume: 1 })

  case 'STORAGE_CREATE_VOLUME_STARTED':
    if (state.creatingVolume === 1)
      return Object.assign({}, state, { creatingVolume: 2 })
    return state

  case 'STORAGE_CREATE_VOLUME_CANCEL':
    
    if (state.operation && state.operation.request) {
      state.operation.request.abort() // TODO
    }

    return Object.assign({}, state, { 
      operation: null,
      creatingVolume: 0, 
      newVolumeCandidates: [],
      expansions: state.expansions.filter(exp => exp.type !== 'drive')
    })

  case 'STORAGE_CARD_EXPANSION_TOGGLE':
    return card_expansion_toggle(state, action.data)

  case 'STORAGE_ADD_NEW_VOLUME_CANDIDATE': 
    return add_new_volume_candidate(state, action.data)

  case 'STORAGE_REMOVE_NEW_VOLUME_CANDIDATE':
    return remove_new_volume_candidate(state, action.data)

  default:
    return state
  }
}

const mergedReducer = (state, action) => {

  let newState = reducer(state, action)
  let operationNewState = operation(state === undefined ? undefined : state.operation, action)

  if (operationNewState === (state=== undefined ? undefined : state.operation)) return newState
  return Object.assign({}, newState, { operation: operationNewState })
}

export default mergedReducer


