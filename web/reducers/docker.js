import request from 'superagent'
import { dispatch } from '../utils/utils'

import pollingMachine from './polling'

const dockerUrl = '/docker'

let polling = pollingMachine(dockerUrl, 'DOCKER_UPDATE', 1000)

const defaultState = {

  docker: null,
  request: null
}

const sendOperation = (state, operation) => {

  let debug = true

  debug && console.log('[DOCKER] sendOperation')

  if (state.request) {
    console.log('docker sendOperation busy')
    return state
  }

  let handle = request
    .post(dockerUrl)
    .send(operation)
    .set('Accept', 'application/json')
    .end((err, res) => {
      dispatch({
        type: 'DOCKER_OPERATION_RESPONSE',
        err,
        res
      })
    })

  let s = Object.assign({}, state, { 
    request: { operation, handle }
  })
  console.log(s)
  return s
}

const reducer = (state = defaultState, action) => {


  switch (action.type) {
  case 'LOGIN_SUCCESS':
    // polling.start()
    return state

  case 'DOCKER_UPDATE':
    console.log('docker_update')
      // TODO this is dirty, maybe we need a queue
    return Object.assign({}, state, { docker: action.data, request: null })

  case 'DOCKER_OPERATION':
    if (!action.operation) {
      console.log('Bad DOCKER_OPERATION')
      console.log(action)
      return state
    }
    console.log('docker send operation')
    console.log(action.operation)
    console.log('docker send operation')
    return sendOperation(state, action.operation)

  case 'DOCKER_OPERATION_RESPONSE':
    // neglect request response
    state.request = null
    return state

  default:
    return state
  }
}

export default reducer 


