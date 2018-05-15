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
  users: 'user',
  drives: 'drives',
  tags: 'tag',
  files: 'file',
  media: 'media',
  tasks: 'task',
  'phy-drives': 'nfs'
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
    // throw 503 unavailable if fruitmix === null
    return this.ctx.fruitmix().getUserByPhicommUserId(phicommUserId)

    // users = fruitmix 
    //  ? fruitmix.users 
    //  : [{ phicommUserId: xxxx }]
  }
  /**
   * get token for cloud
   * @param {object} user
   */
  getToken (user) {
    return this.ctx.config.auth().tokenForRemote(user)
  }
  /**
   * check config
   * @memberof Pipe
   */
  checkConfig () {
    const config = this.ctx.config
    if (!config.device || !config.cloudToken) throw new Error('Pipe have no cloudConf')
  }
  /**
   * check message properties
   * @param {object} message
   */
  checkMessage (message) {
    // {
    //   type:动作类型,取值[pip,req,ack，notice],	// 1. pip:透传APP消息; 2. req:服务器发送给设备的请求; 3. ack:表示应答设备的请求; 4. notice:服务器通知
    //   msgId:消息ID,				// 接收方与应答方应保证msgId的一致性
    //   packageParams:{				// 当type==pip说传递，包括发送服务器地址，接收服务器地址，用户标识
    //     sendingServer:A.B.C.D,		// 发送服务器名称或者IP,比如:114.234.28.2
    //     waitingServer:E.F.G.H, 		// 消息接受服务器名称或IP地址,比如:211.152.34.2
    //     uid:用户ID号
    //   },
    //   data: { // 数据的详细参数,当type==pip时, 透传APP的请求数据，具体数据格式由设备和APP协商
    //     verb: GET, // 'LIST', 'POST', 'POSTFORM', 'GET', 'PATCH', 'PUT', 'DELETE'
    //     urlPath: /drives/:driveUUID, // router path
    //     body: {},
    //     params: {}
    //   }
    // }
    if (!message) {
      throw new Error('pipe have no message')
    }
    const { msgId, packageParams, data } = message
    if (!msgId) {
      throw new Error('message have no msgId')
    }
    if (!packageParams || !packageParams.waitingServer || !packageParams.uid) {
      throw new Error('message have no packageParams')
    }
    if (!data || !data.verb || !data.urlPath) {
      throw new Error('message have no data')
    }
    this.message = message
  }
  /**
   * handle message from pipe
   * @param {object} message
   * @param {function} callback - optional
   */
  handleMessage (message) {
    try {
      // firstly, check config
      this.checkConfig()
      this.checkMessage(message)
      // reponse to cloud
      const { urlPath, verb, body, params } = message.data
      const user = this.checkUser(message.packageParams.uid)
      if (!user) throw new Error('check user failed')

      const paths = urlPath.split('/') // ['', 'drives', '123', 'dirs', '456']
      const resource = WHITE_LIST[paths[1]]
      if (!resource) throw new Error('this source not support')
      // 由于 token 没有 route， so 单独处理 token
      if (resource === 'token') {
        return this.reqCommand(null, this.getToken(user))
      }
      // match route path and generate query
      let matchRoute
      let method
      let query = {}
      for (let route of routes) {
        const { pathToRegexp, pathParttens } = route
        // match route
        if (pathToRegexp.test(urlPath)) {
          matchRoute = route
          if (verb === 'GET') {
            method = route.verb === 'GET' ? 'GET' : 'LIST'
          } else if (verb === 'POST') {
            method = route.verb === 'POST' ? 'POST' : 'POSTFORM'
          } else {
            method = verb
          }
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
      return err
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
    if (matchRoute.verb === 'POSTFORM') {
      const props = Object.assign({}, query, body, params)
      // { driveUUID, dirUUID, boundary, length, formdata }
      // let props = {
      //   manifest: true
      // }
      return this.getResource().pipe(this.ctx.fruitmix().apis[matchRoute.api][method](user, props))
    } else {
      const props = Object.assign({}, query, body, params)
      return this.ctx.fruitmix().apis[matchRoute.api][method](user, props, (err, data) => {
        if (err) return this.reqCommand(err, data)
        // stream
        if (typeof data === 'string' && path.isAbsolute(data)) {
          this.postResource(data)
        } else {
          // json
          debug(data)
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
      if (error instanceof Error) {
        resErr = {
          msg: error.message,
          status: error.status || 403
        }
      } else if (typeof err === 'string') {
        resErr = {
          msg: error,
          status: 403
        }
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
          debug(`command resposne body: ${body}`)
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
      deviceSN: this.device.deviceSN,
      msgId: this.message.msgId,
      data: {},
      file: fs.createReadStream(absolutePath)
    }
    request.post({
      url: this.message.packageParams.waitingServer + RESOURCE_URL,
      headers: { Authorization: this.ctx.config.cloudToken },
      formData: formData
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        debug(`command resposne body: ${body}`)
      }
    })
  }
  /**
   * get resource
   * @param {object} res
   * @returns {stream}
   * @memberof Pipe
   */
  getResource (res) {
    return request({
      uri: this.message.packageParams.waitingServer + RESOURCE_URL,
      method: 'GET',
      headers: { Authorization: this.ctx.config.cloudToken },
      qs: {
        deviceSN: this.ctx.config.device.deviceSN,
        msgId: this.message.msgId,
        uid: this.message.packageParams.uid,
        data: res
      }
    })
  }
}

module.exports = Pipe
