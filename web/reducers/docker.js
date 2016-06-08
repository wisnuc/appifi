import request from 'superagent'
import { dispatch } from '../utils/utils'

const dockerUrl = '/docker'

const defaultState = {
  request: null
}

const sendOperation = (state, operation) => {

  if (!operation) {
    return state
  }

  if (state.request) {
    return state
  }

  let handle = request
    .post(dockerUrl)
    .send(operation)
    .set('Accept', 'application/json')
    .end((err, res) => {
  
      setTimeout(() =>
      dispatch({
        type: 'DOCKER_OPERATION_RESPONSE',
        err,
        res
      }), 1600)
    })

  let s = Object.assign({}, state, { 
    request: { operation, handle }
  })

  return s
}

const reducer = (state = defaultState, action) => {

  switch (action.type) {
  case 'DOCKER_OPERATION':
    return sendOperation(state, action.operation)

  case 'DOCKER_OPERATION_RESPONSE':
    state.request = null
    return state

  default:
    return state
  }
}

export default reducer 


