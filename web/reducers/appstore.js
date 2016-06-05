const request = require('superagent')
import { dispatch } from '../utils/utils'

const storeUrl = '/appstore'

const defaultState = {

  /** err & result of request **/
  error: null,
  appstore: null,

  /** request is either fired or scheduled **/
  timeout: null,
  request: null,

  /** for detail page display, modal **/
  selectedApp: null
}


const reload = () => 
  request
    .get(storeUrl)
    .set('Accept', 'application/json')
    .end((err, res) => dispatch({
      type: 'STORE_RELOAD_RESPONSE', err, res
    }))

const refresh = () =>
  request
    .post(storeUrl)
    .set('Accept', 'application/json')
    .end((err, res) => dispatchh({
      type: 'STORE_REFRESH_RESPONSE', err, res
    }))

const reducer = (state = defaultState, action) => {

  switch (action.type) {
  case 'STORE_RELOAD':

    console.log('STORE_RELOAD dispatched')

    if (state.request || state.timeout) return state
    return Object.assign({}, state, { request: reload() })

  case 'STORE_RELOAD_RESPONSE':
      
    if (action.err) {
      return Object.assign({}, state, {
        repos: action.err, //TODO
        request: null
      })
    }

    return Object.assign({}, state, {
      appstore: action.res.body,
      request: null
    })

  case 'STORE_SELECTEDAPP':    
    return Object.assign({}, state, {
      selectedApp: action.selectedApp
    })
  
  case 'DOCKERD_STARTED': // TODO
    setTimeout(() => dispatch({ type: 'STORE_RELOAD' }), 0)
    break

  default:
    return state
  }
}

export default reducer


