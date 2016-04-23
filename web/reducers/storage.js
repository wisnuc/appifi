import request from 'superagent'
import { mixin, dispatch } from '../utils/utils'
// import deepFreeze from 'deep-freeze'

const baseUrl = 'http://localhost:3000/storage'

const defaultState = {
  
  storage: null,
  storageRequest: null,

}

const sendStorageRequest = () => 
  request
    .get(baseUrl)
    .set('Accept', 'application/json')
    .end((err, res) => {
      dispatch({
        type: 'STORAGE_RESPONSE',
        err: err,
        res: res
      })
    })

const reducer = (state = {}, action) => {

  let debug = false
  let warning = true

  switch (action.type) {
    
    case 'LOGIN_SUCCESS':
      return mixin(state, {
        storageRequest: sendStorageRequest()
      })

    case 'STORAGE_RESPONSE':
      if (action.err) {
        warning && console.log('storage request err: ' + action.res)
        return mixin(state, {
          storageRequest: sendStorageRequest()
        })
      }

      debug && console.log(action.res.body)

      let newState = mixin(state, {
        storage: action.res.body,
        storageRequest: null
      })

//      deepFreeze(newState.storage)
      return newState

    default:
      return state
  }
}

export default reducer 
