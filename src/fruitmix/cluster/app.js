import path from 'path' 
import fs from 'fs'

import express from 'express'
import logger from 'morgan'
import bodyParser from 'body-parser'

import auth from './middleware/auth'
import login from './routes/login'
import ipctest from './routes/ipctest'

/**
import init from './routes/init'
import token from './routes/token'
import users from './routes/users'
import drives from './routes/drives'

import files from './routes/files'
// import share from './routes/share'
import libraries from './routes/libraries'
import media from './routes/media'
import mediashare from './routes/mediashare'
import authtest from '../routes/authtest'
**/

const App = () => {

  let app = express()

/**
  let env = app.get('env')
  if (env !== 'production' && env !== 'development' && env !== 'test') {
    console.log('[fruitmix] Unrecognized NODE_ENV string: ' + env +', exit')
    process.exit(1)
  } else {
    console.log('[fruitmix] NODE_ENV is set to ' + env)
  }
**/

  app.use(logger('dev', { skip: (req, res) => res.nolog === true }))

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(auth.init())

  app.get('/', (req, res) => {
    setTimeout(() => {
      console.log(`pid: ${process.pid}`)
      res.send('hello world')
    }, 1000)
  })

  // add res.error(), res.success()
  app.use(require('./middleware/response').default)

  // app.use(express.static(path.join(__dirname, 'public')))
  app.use('/', require('./routes'))

  // app.use('/login', login)
  // app.use('/ipctest', ipctest)
/**
  app.use('/init', init)
  app.use('/token', token)
  app.use('/users', users)
  app.use('/drives', drives)
  app.use('/files', files)
  app.use('/libraries', libraries)
  // app.use('/share', share)
  app.use('/media', media)
  app.use('/mediashare', mediashare)
  app.use('/authtest', authtest)
**/
  return app
}

export default App


