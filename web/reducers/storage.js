import request from 'superagent'
import { mixin, dispatch } from '../utils/utils'
// import deepFreeze from 'deep-freeze'

import pollingMachine from './polling'

const endpoint = '/storage'

const defaultState = { 

  request: null,
  operation: null,
  error: null,
  result: null
}

let polling = pollingMachine(endpoint, 'STORAGE_UPDATE', 1000)

const sendOperation = (state, operation) => {

  if (state.request) {
    return state
  }

  let handle = request
    .post(baseUrl)
    .send(operation)
    .set('Accept', 'application/json')
    .end((err, res) => {
      dispatch({
        type: 'STORAGE_OPERATION_RESPONSE',
        err,
        res
      })
    })

  return {
    request: handle,
    operation,
    error: null,
    result: null,
  }
}

const reducer = (state = defaultState, action) => {


  switch (action.type) { 
  case 'LOGIN_SUCCESS':
//    polling.start()
    return state
/*
  case 'STORAGE_UPDATE':
    console.log('storage_update')
    return Object.assign({}, state, { storage: action.data })
*/
  case 'STORAGE_OPERATION_RESPONSE':

    if (action.err) {
      return {
        request: null,
        operaton: state.operation,
        error: action.err,
        result: null
      }
    }
    return {
      request: null,
      operation: state.operation,
      error: null,
      result: action.res.body
    }    

  case 'SYSTEM_OPERATION':
    return sendOperation(state, action.operation)

  default:
    return state
  }
}

export default reducer 

