import request from 'superagent'
import { dispatch } from '../utils/utils'

const dockerUrl = '/docker'

const defaultState = {

  docker: null,
  request: null
}

const sendOperation = (state, operation) => {

  let debug = false

  debug && console.log('---- sendOperation')
  debug && console.log(operation)

  if (state.request) {
    return state
  }

  let handle = request
    .post(dockerUrl)
    .send(operation)
    .set('Accept', 'application/json')
    .end((err, res) => {
      debug && console.log('--- operation response')
      debug && console.log(res)
      dispatch({
        type: 'DOCKER_OPERATION_RESPONSE',
        err,
        res
      })
    })

  return Object.assign({}, state, { 
    request: { operation, handle }
  })
}

const processOperationResponse = (state, err, res) => {

  let {operation, args} = state.request.operation

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

const reducer = (state = defaultState, action) => {

  let debug = false 
  let warning = true

  switch (action.type) {
    
    case 'DOCKERD_STARTED':
      return sendOperation(state, { operation: 'get' })

    case 'DOCKER_OPERATION_RESPONSE':

      processOperationResponse(state, action.err, action.res)
      if (action.err)
        return Object.assign({}, state, {
            docker: action.err,
            request: null
          })

      return Object.assign({}, state, {
          docker: action.res.body,
          request: null
        })

    case 'DOCKER_OPERATION':
      if (!action.operation) {
        console.log('Bad DOCKER_OPERATION')
        console.log(action)
      }
      return sendOperation(state, action.operation)

    default:
      return state
  }
}

export default reducer 

/**
const stateNull = (state) => {

  return state.containers === null &&
    state.containersRequest === null &&
    state.images === null &&
    state.imagesRequest === null &&
    state.repos === null &&
    state.reposRequest === null
}

const reducer = (state = defaultState, action) => {

  let debug = false
  let warning = true

  let newState, creq, ireq

  switch (action.type) {

    // case 'LOGIN_SUCCESS':       
    case 'SYSTEM_OPERATION_RESPONSE':
      if (stateNull) {
        return mixin(state, { 
          containersRequest : sendContainersRequest(),
          imagesRequest : sendImagesRequest(),
          reposRequest : sendReposRequest()
        })
      }
      return state

    case 'DOCKER_CONTAINERS_REQUEST':
      if (state.containersRequest) return state
      return mixin(state, {containersRequest : containersRequest()})

    case 'DOCKER_IMAGES_REQUEST':
      if (state.imagesRequest) return state
      return mixin(state, {imagesRequest : sendImagesRequest()})

    case 'DOCKER_CONTAINERS_RESPONSE':

      debug && console.log('docker containers response:')
      debug && console.log(action.res)

      if (action.err) {
        warning && console.log('docker containers response error: ' + action.err)
        return mixin(state, {
          containersRequest: null
        })
      } 
      newState = mixin(state, { 
                        containers: action.res.body, 
                        containersRequest: null 
                      })
      debug && console.log(newState)
      return newState

    case 'DOCKER_IMAGES_RESPONSE':

      debug && console.log('docker images response:')
      debug && console.log(action.res)

      if (action.err) {
        warning && console.log('docker images response error: ' + action.err)
        dispatch({type: 'DOCKER_IMAGES_RESPONSE' })
        return state
      }  
      newState = mixin(state, {
                        images: action.res.body,
                        imagesRequest: null
                      })
      debug && console.log(newState)
      return newState 

   default:
      return state
  }
}

export default reducer
**/

