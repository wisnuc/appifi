import request from 'superagent'
import { mixin, dispatch } from '../utils/utils'
// import deepFreeze from 'deep-freeze'

const baseUrl = '/system'

const defaultState = { 

  storage: null,
  storageRequest: null,
}

let status = -2

// either timeout or req is set, but not both
let timeout = null
let req = null

const get = () => {

  timeout = null
  req = request
    .get(baseUrl)
    .set('Accept', 'application/json')
    .end((err, res) => {

      req = null
      if (err) {
        // schedule another get
        timeout = setTimeout(() => get(), 300)
        return
      }
      
      status = res.body.head
      // schedule another head
      timeout = setTimeout(() => head(), 300)
      dispatch({
        type: 'STORAGE_UPDATE', 
        storage: res.body
      })
    })
}

const head = () => {

  timeout = null
  req = request
    .get(baseUrl + '/head')
    .set('Accept', 'application/json')
    .end((err, res) => {

      req = null
      if (err) {
        // schedule another head
        timeout = setTimeout(() => head(), 300)
        return
      }
    
      if (status === res.body.head) {
        // schedule another head
        timeout = setTimeout(() => head(), 300)
        return
      }

      timeout = setTimeout(() => get(), 0)
    })  
}

const startPolling = () => {

  status = -2
  timeout = null
  req = null
  get()
}

const stopPolling = () => {

  if (timeout) clearTimeout(timeout)
  if (req) req.abort()

  status = -2
  timeout = null
  req = null
}

const sendOperation = (state, operation) => {

  let debug = false

  debug && console.log('---- sendOperation')
  debug && console.log(operation)

  if (state.storageRequest) {
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
    storageRequest: { operation, handle }
  })
}

const processOperationResponse = (state, err, res) => {

  let {operation, args} = state.storageRequest.operation

  /*
  console.log('operation response') 
  console.log(operation)
  console.log(args)
  console.log(err)
  console.log(res.body)
  */
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

const reducer = (state = {}, action) => {

  let debug = false 
  let warning = true

  switch (action.type) {
    
    case 'LOGIN_SUCCESS':

      startPolling()
      return state
      // return sendOperation(state, { operation: 'get' })

    case 'SYSTEM_OPERATION_RESPONSE':

      processOperationResponse(state, action.err, action.res)

      if (action.err)
        return mixin(state, {
          storage: action.err,
          storageRequest: null
        })

      return mixin(state, {
        storage: action.res.body,
        storageRequest: null
      })

    case 'SYSTEM_OPERATION':
      return sendOperation(state, action.operation)

    default:
      return state
  }
}

export default reducer 

