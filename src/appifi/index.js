import assets from '../../assets'

import path from 'path'
import express from 'express'
import logger from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'

import server from './lib/server'
import appstore from './lib/appstore'
import docker from './lib/docker'

const app = express()

app.use(logger('dev', { 
  skip: (req, res) => res.nolog === true 
}))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())

docker.init()
appstore.reload()

app.set('json spaces', 2)

app.get('/', (req, res) => 
  res.set('Content-Type', 'text/html').send(assets.indexHtml))

app.get('/favicon.ico', (req, res) => 
  res.set('Content-Type', 'image/x-icon').send(assets.favicon))

app.get('/index.html', (req, res) => 
  res.set('Content-Type', 'text/html').send(assets.indexHtml))

app.get('/bundle.js', (req, res) => 
  res.set('Content-Type', 'application/javascript').send(assets.bundlejs))

app.use('/stylesheets', require('./routes/stylesheets'))
app.use('/appstore', require('./routes/appstore'))
app.use('/server', require('./routes/server'))

// without erorr handlers !!!
export default app
