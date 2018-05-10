const EventEmitter = require('events')
const pathToRegexp = require('path-to-regexp')
const _ = require('lodash')

const routing = require('./routing')

const BASE_URL = 'https://www.siyouqun.com'
const COMMAND_URL = '/ResourceManager/nas/callback/command'
const RESOURCE_URL = '/ResourceManager/nas/callback/resource'

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
   * @param {object} fruitmix
   */
  constructor (fruitmix, auth) {
    super()
    this.fruitmix = fruitmix
    this.auth = auth
  }
  /**
   * check authorization
   * @param {string} phicommUserId
   * @return {object} user
   */
  checkUser (phicommUserId) {
    return this.fruitmix.getUserByPhicommUserId(phicommUserId)
  }
  /**
   * get token for cloud
   * @param {object} user
   */
  getToken (user) {
    return this.auth.cloudToken(user)
  }
  /**
   *
   * @param {object} message
   */
  handleMessage (message) {
    // {
    //   type:动作类型,取值[pip,req,ack，notice],	// 1. pip:透传APP消息; 2. req:服务器发送给设备的请求; 3. ack:表示应答设备的请求; 4. notice:服务器通知
    //   msgId:消息ID,				// 接收方与应答方应保证msgId的一致性
    //   packageParams:{				// 当type==pip说传递，包括发送服务器地址，接收服务器地址，用户标识
    //     sendingServer:A.B.C.D,		// 发送服务器名称或者IP,比如:114.234.28.2
    //     watingServer:E.F.G.H, 		// 消息接受服务器名称或IP地址,比如:211.152.34.2
    //     uid:用户ID号
    //   },
    //   reqCmd:reqCmd,	// 当type==req时, 需要传递该字段
    //   noticeType:noticeType, // 当type==noticeType时,需要传递该字段
    //   data: { // 数据的详细参数,当type==pip时, 透传APP的请求数据，具体数据格式由设备和APP协商
    //     verb: GET, // 'LIST', 'POST', 'POSTFORM', 'GET', 'PATCH', 'PUT', 'DELETE'
    //     urlPath: /drives/:driveUUID, // router path
    //     body: {},
    //     params: {}
    //   }
    // }

    /**
     * reponse to cloud
     */
    const data = {
      verb: 'GET',
      path: '/drives/123/dirs/456',
      body: {},
      params: {}
    } || message.data

    const { urlPath, verb, body, params } = data

    const user = this.checkUser(message.packageparams.uid)
    if (!user) throw new Error('check user failed')

    const paths = urlPath.split('/') // ['', 'drives', '123', 'dirs', '456']
    const resource = WHITE_LIST[paths[1]]
    if (!resource) throw new Error('this source not support')
    // 单独处理 token
    if (resource === 'token') {
      // TODO: 加入标记， 区分与本地 token
    }

    // match route path and generate query
    let matchRoute
    let method
    let query = {}
    for (let route of routes) {
      const { pathToRegexp, pathParttens } = route
      // match route
      if (pathToRegexp.test(urlPath)) {
        if (verb === 'GET') {
          method = route.verb === 'GET' ? 'GET' : 'LIST'
        } else if (verb === 'POST') {
          method = route.verb === 'POST' ? 'POST' : 'POSTFORM'
        } else {
          method = verb
        }

        matchRoute = route
        const unnamedParamters = pathToRegexp.exec(urlPath)
        // generate query
        pathParttens.map((v, index) => {
          query[v] = unnamedParamters[index + 1]
        })
      }
    }

    const props = Object.assign({}, query, body, params)
    // apis
    if (matchRoute.verb === 'POSTFORM') {
      this.reqResource()
    } else {
      this.reqCommand()
    }
    this.fruitmix.apis[resource][method](user, props, (err, data) => {

    })
    // this.fruitmix.apis[resource][verb](req.user,
    //   Object.assign({}, req.query, req.body, req.params), f(res, next))
  }
  /**
   * Except post file
   * @memberof Pipe
   */
  reqCommand () {

  }
  /**
   * Only when post file
   * @memberof Pipe
   */
  reqResource () {}
  sucess () {}
  error () {}
}

// const data = {
//   verb: 'GET',
//   path: '/drives/123/dirs/456',
//   body: {},
//   params: {}
// }
// // match path
// for (let route of routes) {
//   const { pathToRegexp, pathParttens } = route
//   if (pathToRegexp.test(data.path)) {
//     // get query
//     // matchRoute = route
//     const unnamedParamters = pathToRegexp.exec(data.path) // data.path.match(route.regexp)
//     let query = {}
//     pathParttens.map((v, index) => {
//       query[v] = unnamedParamters[index + 1]
//     })
//     console.log(query)
//   }
// }

module.exports = Pipe
