import { combineReducers } from 'redux'

import lang from './lang'
import increment from './increment'
import themeColor from './themeColor'
import navigation from './navigation'
import appstore from './appstore'
import installed from './installed'
import { server, serverOp, snackbar } from './server'
 
const reducer = combineReducers({
  increment,
  lang,
  themeColor,
  navigation,
  appstore,
  installed,
  server,
  serverOp,
  snackbar
})

export default reducer

