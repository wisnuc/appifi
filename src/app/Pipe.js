const EventEmitter = require('events')
const pathToRegexp = require('path-to-regexp')
const _ = require('lodash')
const request = require('request')
const path = require('path')
const fs = require('fs')
const debug = require('debug')('pipe')

const routing = require('./routing')

const COMMAND_URL = `/ResourceManager/nas/callback/command`
const RESOURCE_URL = `/ResourceManager/nas/callback/resource`
const RE_BOUNDARY = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i

const routes = []
// routing map
// [{
//   path: '/drives/:driveUUID/dirs/:dirUUID',
//   keys: [],
//   verb: 'GET',
//   api: 'drives',
//   pathToRegexp: '////',
//   pathParttens： [ driveUUID, dirUUID ]
// }]
for (const k in routing) {
  for (const r of routing[k].routes) {
    const path = r[0] === '/' ? routing[k].prefix : routing[k].prefix + r[0]
    let keys = []
    const re = pathToRegexp(path, keys)
    routes.push({
      path: path,
      verb: r[1],
      api: r[2],
      pathToRegexp: re,
      pathParttens: _.map(keys, 'name')
    })
  }
}

const WHITE_LIST = {
  token: 'token',
  boot: 'boot',
  users: 'user',
  drives: 'drives',
  tags: 'tag',
  files: 'file',
  media: 'media',
  tasks: 'task',
  'phy-drives': 'nfs',
  'device': 'device'
}

/**
 * format error
 * @param {object} error
 * @param {number} status - http code
 * @return {object} formatError
 */
const formatError = (error, status) => {
  status = status || 403
  let formatError
  if (error instanceof Error) {
    formatError = error
    formatError.status = error.status ? error.status : status
  } else if (typeof err === 'string') {
    formatError = new Error(error)
    formatError.status = status
  }
  return formatError
}

class Pipe extends EventEmitter {
  /**
   * Create a Pipe
   * @param {object} ctx
   * @param {object} ctx.fruitmix()
   * @param {object} ctx.config
   */
  constructor (ctx) {
    super()
    this.ctx = ctx
  }
  /**
   * check authorization
   * @param {string} phicommUserId
   * @return {object} user
   */
  checkUser (phicommUserId) {
    let user
    if (!this.ctx.fruitmix()) {
      user = this.ctx.boot.view().boundUser
        ? (this.ctx.boot.view().boundUser.phicommUserId === phicommUserId
          ? this.ctx.boot.view().boundUser : null) : null
    } else {
      user = this.ctx.fruitmix().getUserByPhicommUserId(phicommUserId)
    }
    if (!user) throw formatError(new Error(`uid: ${phicommUserId}, check user failed`), 401)
    // throw 503 unavailable if fruitmix === null
    return Object.assign({}, user, { remote: true })
  }
  /**
   * get token for cloud
   * @param {object} user
   * @return {object} token
   */
  getToken (user) {
    return this.ctx.config.auth().tokenForRemote(user)
  }

  getBootInfo (user) {
    return this.ctx.boot.view()
  }
  /**
   * check config
   * @memberof Pipe
   */
  checkConfig () {
    const config = this.ctx.config
    if (!config || !config.device || !config.cloudToken) {
      throw formatError(new Error('pipe have no cloudConf'), 400)
    }
  }
  /**
   * check message properties
   * @param {object} message
   */
  checkMessage (message) {
    // {
    //   type: 'pip',
    //   msgId: 'xxxx',
    //   packageParams: {
    //     sendingServer: '127.0.0.1',
    //     waitingServer: '127.0.0.1',
    //     uid: 123456789
    //   },
    //   data: {
    //     verb: 'GET',
    //     urlPath: '/token',
    //     body: {},
    //     params: {}
    //   }
    // }
    if (!message) throw formatError(new Error('pipe have no message'), 400)

    const { msgId, packageParams, data } = message
    if (!msgId) {
      throw formatError(new Error(`message have no msgId`), 400)
    }
    if (!packageParams) {
      throw formatError(new Error(`this msgId: ${msgId}, message have no packageParams`), 400)
    }
    if (!packageParams.waitingServer) {
      throw formatError(new Error(`this msgId: ${msgId}, packageParams have no waitingServer`), 400)
    }
    if (!packageParams.uid) {
      throw formatError(new Error(`this msgId: ${msgId}, packageParams have no uid`), 400)
    }
    if (!data) {
      throw formatError(new Error(`this msgId: ${msgId}, message have no data`), 400)
    }
    if (!data.verb) {
      throw formatError(new Error(`this msgId: ${msgId}, data have no verb`), 400)
    }
    if (!data.urlPath) {
      throw formatError(new Error(`this msgId: ${msgId}, data have no urlPath`), 400)
    }
    this.message = message
  }
  /**
   * handle message from pipe
   * @param {object} message
   */
  handleMessage (message) {
    try {
      // firstly, check config
      this.checkConfig()
      this.checkMessage(message)
      const user = this.checkUser(message.packageParams.uid)
      // reponse to cloud
      const { urlPath, verb, body, params } = message.data
      const paths = urlPath.split('/') // ['', 'drives', '123', 'dirs', '456']
      const resource = WHITE_LIST[paths[1]]
      if (!resource) {
        throw formatError(new Error(`this resource: ${resource}, not support`), 400)
      }
      // 由于 token 没有 route， 单独处理 token
      if (resource === 'token') {
        return this.reqCommand(null, this.getToken(user))
      }
      // 单独处理 boot
      if (resource === 'boot') {
        return this.reqCommand(null, this.getBootInfo())
      }
      // match route path
      const matchRoutes = []
      for (const route of routes) {
        // match route
        if (route.pathToRegexp.test(urlPath)) matchRoutes.push(route)
      }
      // match route api
      let method = verb.toUpperCase()
      const methods = _.map(matchRoutes, 'verb')
      if (method === 'GET') {
        method = methods.includes(method) ? method : 'LIST'
      } else if (method === 'POST') {
        method = methods.includes(method) ? method : 'POSTFORM'
      }
      // generate query
      const query = {}
      let matchRoute
      for (const ms of matchRoutes) {
        if (ms.verb === method) {
          matchRoute = ms
          const { pathToRegexp, pathParttens } = ms
          const unnamedParamters = pathToRegexp.exec(urlPath)
          // generate query
          pathParttens.map((v, index) => {
            query[v] = unnamedParamters[index + 1]
          })
        }
      }
      const opts = { user, matchRoute, method, query, body, params }
      this.apis(opts)
    } catch (err) {
      debug(`pipe message error: `, err)
      this.reqCommand(err)
    }
  }
  /**
   * local apis
   * @param {object} opts
   * @param {function} callback
   * @returns
   * @memberof Pipe
   */
  apis (opts) {
    const { user, matchRoute, method, query, body, params } = opts
    const props = Object.assign({}, query, body, params)
    // postform
    if (matchRoute.verb === 'POSTFORM') {
      // get resource from cloud
      this.getResource().on('response', response => {
        try {
          props.length = response.headers['content-length']
          const m = RE_BOUNDARY.exec(response.headers['content-type'])
          props.boundary = m[1] || m[2]
          props.formdata = response
          console.log('response body: ', body)
          console.log('response headers: ', response.headers)
        } catch (err) {
          return this.reqCommand(err)
        }
        // { driveUUID, dirUUID, boundary, length, formdata }
        this.ctx.fruitmix().apis[matchRoute.api][method](user, props, (err, data) => {
          console.log('err', err)
          this.reqCommand(err, data)
        })
      })
    } else {
      return this.ctx.fruitmix().apis[matchRoute.api][method](user, props, (err, data) => {
        if (err) return this.reqCommand(err)
        // stream
        if (typeof data === 'string' && path.isAbsolute(data)) {
          this.postResource(data)
        } else {
          // json
          this.reqCommand(null, data)
        }
      })
    }
  }
  /**
   * response command
   * @param {object} error
   * @param {object} res
   * @memberof Pipe
   */
  reqCommand (error, res) {
    let resErr
    if (error) {
      error = formatError(error)
      resErr = {
        msg: error.message,
        status: error.status
      }
    }
    let count = 0
    const req = () => {
      if (++count > 2) return
      return request({
        uri: 'http://sohon2test.phicomm.com' + COMMAND_URL, // this.message.packageParams.waitingServer + COMMAND_URL,
        method: 'POST',
        headers: { Authorization: this.ctx.config.cloudToken },
        body: true,
        json: {
          common: {
            deviceSN: this.ctx.config.device.deviceSN,
            msgId: this.message.msgId
          },
          data: {
            err: resErr,
            res: res
          }
        }
      }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          debug(`reqCommand body: ${body}`)
        }
      })
    }
    return req()
  }
  /**
   * post resource
   * @param {string} absolutePath
   * @memberof Pipe
   */
  postResource (absolutePath) {
    var formData = {
      // Pass a simple key-value pair
      file: fs.createReadStream(absolutePath)
    }
    request.post({
      url: 'http://sohon2test.phicomm.com' + RESOURCE_URL,
      headers: { Authorization: this.ctx.config.cloudToken },
      qs: {
        deviceSN: this.ctx.config.device.deviceSN,
        msgId: this.message.msgId
      },
      formData: formData
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        debug(`postResource body: ${body}`)
      }
    })
  }
  /**
   * get resource
   * @memberof Pipe
   */
  getResource () {
    return request({
      uri: 'http://sohon2test.phicomm.com' + RESOURCE_URL,
      method: 'GET',
      headers: { Authorization: this.ctx.config.cloudToken },
      qs: {
        deviceSN: this.ctx.config.device.deviceSN,
        msgId: this.message.msgId,
        uid: this.message.packageParams.uid
      }
    })
  }
}

module.exports = Pipe
