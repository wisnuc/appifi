import { combineReducers } from 'redux'

import themeColor from './themeColor'
import login from './login'
import navigation from './navigation'
import docker from './docker'
import storage from './storage'
import appstore from './appstore'
import server from './server'
 
const reducer = combineReducers({
  themeColor,
  login,
  navigation,
  docker,
  storage,
  appstore,
  server
})

export default reducer

