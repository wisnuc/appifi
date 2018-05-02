const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')

/**
@module ExpressFactory
*/

/**
A path, router pair
@typedef PathRouterMapping
@type {array}
@property {string} 0 - path string
@property {function} 1 - express router
*/

/**
Options for customizing express application

@typedef {object} ExpressOptions
@property {object} settings - express settings, see express documentation
@property {object} settings.json - json.stringify options
@property {number} settings.json.spaces - defaults to 0
@property {object} log - log options
@property {string} log.format - morgan log format, such as `dev`, `combined` etc. Defaults to `dev`.
@property {string} log.skip - `all`, `muted`, `none`. Defaults to `muted` by which the response with `nolog` set to `true` is not logged.
@property {boolean} log.error - `all` or `none`. Defaults to `none`.
@property {array} mappings - [path, router] mapping
*/

/**
Creates an Express application according to given options

@param {ExpressOptions} opts - options
@return Customized Express application
*/
const createApp = opts => {
  let app = express()

  // set json spaces if available
  if (opts.settings && typeof opts.settings === 'object' &&
    opts.settings.json && typeof opts.settings.json === 'object' &&
    opts.settings.json.spaces && typeof opts.settings.json.spaces === 'number') {
    app.set('json spaces', opts.settings.json.spaces)
  }

  // install logger
  let log = { format: 'dev', skip: 'selected', error: false }
  if (opts.log && typeof opts.log === 'object') Object.assign(log, opts.log)

  if (log.skip === 'no') {
    app.use(logger(log.format))
  } else if (log.skip === 'selected') {
    app.use(logger(log.format, { skip: (req, res) => res.nolog }))
  } else {
    // no logger
  }

  // install body parser
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  // install auth middleware
  app.use(opts.auth)

  // install all routers
  opts.routers.forEach(r => {
    try {
      app.use(r[0], r[1])
    } catch (e) {
      // FIXME
      console.log(r)
      throw e
    }
  })

  // 404 handler
  app.use((req, res, next) => next(Object.assign(new Error('Not Found'), { status: 404 })))

  // 500 handler
  app.use((err, req, res, next) => {
    if (err) {
      if (log.error === 'all') {
        console.log(':: ', err)
      }
    }

    // TODO check nodejs doc for more error properties such as syscall.
    res.status(err.status || 500).json({
      code: err.code,
      xcode: err.xcode,
      message: err.message,
      result: err.result,
      where: err.where
    })
  })

  return app
}

module.exports = createApp
