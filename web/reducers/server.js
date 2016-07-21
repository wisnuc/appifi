import { dispatch } from '../utils/utils'

import request from 'superagent'
import deepFreeze from 'deep-freeze'
import pollingMachine from './polling'

const serverUrl = '/server'

let polling = pollingMachine(serverUrl, 'SERVER_UPDATE', 1000)

const server = (state = { state: null }, action) => {
  
  switch(action.type) {
  case 'LOGIN_SUCCESS':
    polling.start()
    return state

  case 'SERVER_UPDATE':
    console.log('SERVER_UPDATE')
    return { state: action.data }

  default:
    return state
  }
}

const serverOp = (state = null, action) => {

  switch(action.type) {
  case 'SERVEROP_REQUEST':

    if (state) return state // TODO snack message 
    let agent = request.post('/server')
      .send(action.data)
      .set('Accept', 'application/json')
      .end((err, res) => dispatch({ type: 'SERVEROP_RESPONSE', err, res }))   
    polling.stop()
    return Object.assign({}, action.data, { agent })
  
  case 'SERVEROP_RESPONSE':
 
    if (state.mute) { }
    else if (action.err) {
      setTimeout(() => dispatch({
        type: 'SNACKBAR_OPEN', 
        data: `ERROR, op: ${state.operation}, err: ${action.err.message}`
      }), 0)
    }
    else if (!action.res.ok) {
      setTimeout(() => dispatch({
        type: 'SNACKBAR_OPEN',
        data: `ERROR, op: ${state.operation}, err: 'BAD http response'`
      }), 0)
    }
    else if (action.res.body.err) {
      setTimeout(() => dispatch({
        type: 'SNACKBAR_OPEN',
        data: `ERROR, op: ${state.operation}, err: ${action.res.body.err}`
      }), 0)
    }
    else {
      setTimeout(() => dispatch({
        type: 'SNACKBAR_OPEN',
        data: `${state.operation} SUCCESS`
      }), 0)
    } 

    if (state.operation === 'mkfs_btrfs') {
      setTimeout(() => {
        dispatch({type: 'STORAGE_CREATE_VOLUME_END'})
        setTimeout(() => polling.start(), 1000)
      }, 1000)
    }
    else 
      polling.start()

    return Object.assign({}, state, { agent: null })

  case 'SERVER_UPDATE':
    return (state && !state.agent) ? null : state

  default:
    return state
  }
}

const snackbar = (state = { open: false, message: '' }, action) => {

  switch(action.type) {
  case 'SNACKBAR_OPEN':
    return { open: true, message: action.data }
  case 'SNACKBAR_CLOSE':
    return { open: false, message: '' }
  default:
    return state
  }
}

export { server, serverOp, snackbar }

