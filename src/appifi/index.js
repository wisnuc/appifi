import express from 'express'
import logger from 'morgan'
import bodyParser from 'body-parser'

import assets from '../../assets'
import server from './server'

const app = express()

app.use(logger('dev', { skip: (req, res) => res.nolog === true }))

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

app.get('/stylesheets/style.css', (req, res) => 
  res.set('Content-Type', 'text/css')
    .send(assets.styleCSS))

app.get('/stylesheets/roboto.css', (req, res) => 
  res.set('Content-Type', 'text/css')
    .send(assets.robotoCSS))

app.get('/stylesheets/Roboto-Thin-webfont.woff', (req, res) => 
  res.set('Content-Type', 'application/font-woff')
    .send(assets.robotoThin))

app.get('/stylesheets/Roboto-Light-webfont.woff', (req, res) => 
  res.set('Content-Type', 'application/font-woff')
    .send(assets.robotoLight))

app.get('/stylesheets/Roboto-Regular-webfont.woff', (req, res) => 
  res.set('Content-Type', 'application/font-woff')
    .send(assets.robotoRegular))

app.get('/stylesheets/Roboto-Medium-webfont.woff', (req, res) => 
  res.set('Content-Type', 'application/font-woff')
    .send(assets.robotoMedium))

app.get('/stylesheets/Roboto-Bold-webfont.woff', (req, res) => 
  res.set('Content-Type', 'application/font-woff')
    .send(assets.robotoBold))

app.get('/stylesheets/Roboto-Black-webfont.woff', (req, res) => 
  res.set('Content-Type', 'application/font-woff')
    .send(assets.robotoBlack))

const nolog = (res) => {
  res.nolog = true
  return res
}

app.get('/server', (req, res) => nolog(res).status(200).json(server.get()))
app.get('/server/status', (req, res) => nolog(res).status(200).json(server.status()))

app.post('/server', (req, res) => 
  server.operation(req.body, (err, result) => 
    err ? res.status(200).json({
        err: err.message,
        ecode: err.code
      }) :
      res.status(200).json({
        err: null,
        result
      })))

module.exports = app
