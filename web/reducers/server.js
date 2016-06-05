import { dispatch } from '../utils/utils'
import deepFreeze from 'deep-freeze'
import pollingMachine from './polling'

const serverUrl = '/server'

let polling = pollingMachine(serverUrl, 'SERVER_UPDATE', 1000)

const server = (state = {
    state: null,
    request: null,
  }, action) => {
  
  switch(action.type) {
  case 'LOGIN_SUCCESS':
    polling.start()
    return state

  case 'SERVER_UPDATE':
    console.log('SERVER_UPDATE')
    let newState = Object.assign({}, 
            state, 
            {
              state: action.data,
              request: null
            })
    // deepFreeze(newState.state)
    // console.log('--- action data')
    // console.log(action.data)
    // console.log('<<< action data')
    return newState

  default:
    return state
  }
}

export default server
