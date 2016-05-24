// import { mixin } from '../utils/utils'

const defaultState = {

  state: 'READY', // READY, BUSY, REJECTED, TIMEOUT, ERROR, LOGGEDIN
  username: null,
  password: null
}

const loginState = (state = defaultState, action) => {

  switch (action.type) {

  case 'LOGOUT': // when user logs out
    return Object.assign({}, state, {
      state: 'READY',
      username: null,
      password: null
    })

  case 'LOGIN': // when user click the login button
    return Object.assign({}, state, {
      state: 'BUSY',
      username: action.username,
      password: action.password
    })

  case 'LOGIN_REJECTED': // server rejects
    return Object.assign({}, state, {
      state: 'REJECTED',
      username: null,
      password: null
    })

  case 'LOGIN_ERROR': // server replies with error
    return Object.assign({}, state, {
      state: 'ERROR'
    })

  case 'LOGIN_TIMEOUT': // server timeout
    return Object.assign({}, state, {
      state: 'TIMEOUT'
    })

  case 'LOGIN_SUCCESS':
    return  Object.assign({}, state, {
      state: 'LOGGEDIN'
    })

  default:
    return state 
  }
}

export default loginState


