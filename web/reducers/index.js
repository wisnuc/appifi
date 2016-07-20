import { combineReducers } from 'redux'

import increment from './increment'
import themeColor from './themeColor'
import login from './login'
import navigation from './navigation'
import docker from './docker'
import storage from './storage'
import appstore from './appstore'
import installed from './installed'
import { server, serverOp, snackbar } from './server'
 
const reducer = combineReducers({
  increment,
  themeColor,
  login,
  navigation,
  docker,
  storage,
  appstore,
  installed,
  server,
  serverOp,
  snackbar
})

export default reducer

