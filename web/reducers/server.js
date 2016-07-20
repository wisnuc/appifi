import { dispatch } from '../utils/utils'
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
    if (state) return state  
    let agent = request.post('/server')
      .send(action.data)
      .set('Accept', 'application/json')
      .end((err, res) => dispatch({ type: 'SERVEROP_RESPONSE', err, res }))   

    return Object.assign({}, action.data, { agent })
  
  case 'SERVEROP_RESPONSE':
    return null

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

