import request from 'superagent'
import { mixin, dispatch } from '../utils/utils'

const baseUrl = 'http://localhost:3000/dockerapi'

const defaultState = {

  containers: null,  
  containersRequest: null,

  images: null,
  imagesRequest: null
}

const sendContainersRequest = () => request
                                  .get(baseUrl + '/containers/json?all=1')
                                  .set('Accept', 'application/json')
                                  .end((err, res) => dispatch({
                                    type: 'DOCKER_CONTAINERS_RESPONSE', err, res
                                  }))

const sendImagesRequest = () => request
                              .get(baseUrl + '/images/json')
                              .set('Accept', 'application/json')
                              .end((err, res) => dispatch({
                                type: 'DOCKER_IMAGES_RESPONSE', err, res
                              }))


const reducer = (state = defaultState, action) => {

  let debug = false
  let warning = true

  let newState, creq, ireq

  switch (action.type) {

    case 'LOGIN_SUCCESS':       
      return mixin(state, { 
        containersRequest : sendContainersRequest(),
        imagesRequest : sendImagesRequest()
      })

    case 'DOCKER_CONTAINERS_REQUEST':
      if (state.containersRequest) return state
      return mixin(state, {containersRequest : contianersRequest()})

    case 'DOCKER_IMAGES_REQUEST':
      if (state.imagesRequest) return state
      return mixin(state, {imagesRequest : sendImagesRequest()})

    case 'DOCKER_CONTAINERS_RESPONSE':

      debug && console.log('docker containers response:')
      debug && console.log(action.res)

      if (action.err) {
        warning && console.log('docker containers response error: ' + action.err)
        return mixin(state, {containerReqest})
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

      if (action.err){
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

