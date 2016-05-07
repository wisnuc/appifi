import request from 'superagent'
import { mixin, dispatch } from '../utils/utils'

const baseUrl = ''
const dockerApiUrl = baseUrl + '/dockerapi'
const dockerHubUrl = baseUrl + '/dockerhub'
const appEngineUrl = baseUrl + '/appengine'

const defaultState = {

  containers: null,  
  containersRequest: null,

  images: null,
  imagesRequest: null,

  repos: null,
  reposRequest: null,
}

const sendContainersRequest = () => request
                                  .get(dockerApiUrl + '/containers/json?all=1')
                                  .set('Accept', 'application/json')
                                  .end((err, res) => dispatch({
                                    type: 'DOCKER_CONTAINERS_RESPONSE', err, res
                                  }))

const sendImagesRequest = () => request
                              .get(dockerApiUrl + '/images/json')
                              .set('Accept', 'application/json')
                              .end((err, res) => dispatch({
                                type: 'DOCKER_IMAGES_RESPONSE', err, res
                              }))

const sendReposRequest = () => request
                                .get(dockerHubUrl)
                                .set('Accept', 'application/json')
                                .end((err, res) => dispatch({
                                  type: 'DOCKER_REPOS_RESPONSE', err, res
                                }))

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

    case 'DOCKER_REPOS_RESPONSE':
      
      if (action.err) {
        warning && console.log('docker repos response error: ' + action.err)
      }
      newState = mixin(state, {
                        repos: action.res.body,
                        reposRequest: null
                      })
      debug && console.log(newState)
      return newState 

    default:
      return state
  }
}

export default reducer

