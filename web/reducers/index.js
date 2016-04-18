import { combineReducers } from 'redux'
import themeColor from './themeColor'
import login from './login'
import nav from './nav'
 
const reducer = combineReducers({
  themeColor,
  login,
  nav,
})

export default reducer

