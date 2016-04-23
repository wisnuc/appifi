import { combineReducers } from 'redux'
import themeColor from './themeColor'
import login from './login'
import navigation from './navigation'
import docker from './docker'
import storage from './storage'
 
const reducer = combineReducers({
  themeColor,
  login,
  navigation,
  docker,
  storage,
})

export default reducer

