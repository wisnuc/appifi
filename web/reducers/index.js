import { combineReducers } from 'redux'

import increment from './increment'
import themeColor from './themeColor'
import login from './login'
import navigation from './navigation'
// import docker from './docker'
import storage from './storage'
import appstore from './appstore'
import installed from './installed'
import { server, serverOp, snackbar } from './server'
import network from './network'
import timeDate from './timeDate'
 
const reducer = combineReducers({
  increment,
  themeColor,
  login,
  navigation,
  storage,
  appstore,
  installed,
  server,
  serverOp,
  network,
  timeDate,
  snackbar
})

export default reducer

