import { combineReducers } from 'redux'
import themeColor from './themeColor'
import login from './login'
import navigation from './navigation'
import docker from './docker'
 
const reducer = combineReducers({
  themeColor,
  login,
  navigation,
  docker,
})

export default reducer

