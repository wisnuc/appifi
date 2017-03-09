const request = require('superagent')
import { dispatch } from '../utils/utils'

const reducer = (state = { selectedApp: null, customApp: false }, action) => {

  switch (action.type) {
  case 'STORE_SELECTEDAPP':    
    return Object.assign({}, state, { selectedApp: action.selectedApp })

  case 'STORE_CUSTOMAPP':
    return Object.assign({}, state, { customApp: action.data })
  
  default:
    return state
  }
}

export default reducer


