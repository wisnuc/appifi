import { dispatch } from '../utils/utils'
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
    return Object.assign({}, 
            state, 
            {
              state: action.data,
              request: null
            })

  default:
    return state
  }
}

export default server
