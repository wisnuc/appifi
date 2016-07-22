const request = require('superagent')
import { dispatch } from '../utils/utils'

const reducer = (state = { selectedApp: null }, action) => {

  switch (action.type) {
  case 'STORE_SELECTEDAPP':    
    return Object.assign({}, state, {
      selectedApp: action.selectedApp
    })
  
  default:
    return state
  }
}

export default reducer


