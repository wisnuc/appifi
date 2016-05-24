import request from 'superagent'
import { mixin, dispatch } from '../utils/utils'
// import deepFreeze from 'deep-freeze'

import pollingMachine from './polling'

const baseUrl = '/system'

const defaultState = { 

  storage: null,
  request: null
}

let polling = pollingMachine('/system', 'STORAGE_UPDATE', 1000)

const sendOperation = (state, operation) => {

  let debug = false

  debug && console.log('---- sendOperation')
  debug && console.log(operation)

  if (state.request) {
    return state
  }

  let handle = request
    .post(baseUrl)
    .send(operation)
    .set('Accept', 'application/json')
    .end((err, res) => {
      debug && console.log('--- operation response')
      debug && console.log(res)
      dispatch({
        type: 'SYSTEM_OPERATION_RESPONSE',
        err,
        res
      })
    })

  return Object.assign({}, state, { 
    request: { operation, handle }
  })
}

/*
const processOperationResponse = (state, err, res) => {

  let {operation, args} = state.request.operation

  switch (operation) {
  case 'get':
    break
  case 'daemonStart':
    break
  case 'daemonStop':
    break
  default:
    break
  }
  return
}
*/

const reducer = (state = defaultState, action) => {

  // let debug = false 
  // let warning = true

  switch (action.type) { 
  case 'LOGIN_SUCCESS':
    polling.start()
    return state

  case 'STORAGE_UPDATE':
    console.log('storage_update')
    return Object.assign({}, state, { storage: action.data })

  case 'SYSTEM_OPERATION_RESPONSE':

    // processOperationResponse(state, action.err, action.res)

    if (action.err)
      return mixin(state, {
        storage: action.err,
        request: null
      })

    return mixin(state, {
      storage: action.res.body,
      request: null
    })

  case 'SYSTEM_OPERATION':
    return sendOperation(state, action.operation)

  default:
    return state
  }
}

export default reducer 

