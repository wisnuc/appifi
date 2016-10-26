import express from 'express'
import logger from 'morgan'
import bodyParser from 'body-parser'

import assets from '../../assets'

import server from './routes/server'
import appstore from './routes/appstore'
import stylesheets from './routes/stylesheets'

const app = express()

app.use(logger('dev', { 
  skip: (req, res) => res.nolog === true 
}))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.set('json spaces', 2)

app.get('/', (req, res) => 
  res.set('Content-Type', 'text/html').send(assets.indexHtml))

app.get('/favicon.ico', (req, res) => 
  res.set('Content-Type', 'image/x-icon').send(assets.favicon))

app.get('/index.html', (req, res) => 
  res.set('Content-Type', 'text/html').send(assets.indexHtml))

app.get('/bundle.js', (req, res) => 
  res.set('Content-Type', 'application/javascript').send(assets.bundlejs))

app.use('/stylesheets', stylesheets)
app.use('/appstore', appstore)
app.use('/server', server)

export default app
