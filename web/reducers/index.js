import { combineReducers } from 'redux'
import themeColor from './themeColor'
import login from './login'
import navigation from './navigation'
 
const reducer = combineReducers({
  themeColor,
  login,
  navigation,
})

export default reducer

