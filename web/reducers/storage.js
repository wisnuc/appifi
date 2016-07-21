import request from 'superagent'
import { mixin, dispatch } from '../utils/utils'
// import deepFreeze from 'deep-freeze'

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

  case 'STORAGE_CREATE_VOLUME_END': 
    return Object.assign({}, state, { 
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

export default reducer


