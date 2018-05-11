const EventEmitter = require('events')
const pathToRegexp = require('path-to-regexp')
const _ = require('lodash')
const request = require('request')
const path = require('path')

const routing = require('./routing')

const BASE_URL = 'https://www.siyouqun.com'
const COMMAND_URL = `${BASE_URL}/ResourceManager/nas/callback/command`
const RESOURCE_URL = `${BASE_URL}/ResourceManager/nas/callback/resource`

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
   * @param {object} ctx.fruitmix
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
    return this.ctx.fruitmix.getUserByPhicommUserId(phicommUserId)
  }
  /**
   * get token for cloud
   * @param {object} user
   */
  getToken (user) {
    return this.ctx.config.auth().tokenForRemote(user)
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
      params: {},
      manifest: {}
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
      const json = {
        common: {
          deviceSN: this.cofig.device.deviceSN,
          msgId: message.msgId
        },
        data: {
          err: {},
          data: {}
        }
      }
      this.reqCommand(json)
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

    // apis
    if (matchRoute.verb === 'POSTFORM') {
      const props = Object.assign({}, query, body, params)
      // { driveUUID, dirUUID, boundary, length, formdata }
      // let props = {
      //   manifest: true
      // }
      this.getResource().pipe(this.fruitmix.apis[resource][method](user, props))
    } else {
      const props = Object.assign({}, query, body, params)
      this.fruitmix.apis[resource][method](user, props, (err, data) => {
        if (err) return
        // stream
        if (path.isAbsolute(data)) {
          this.postResource(data)
        } else {
          // json
          const json = {
            common: {
              deviceSN: this.cofig.device.deviceSN,
              msgId: message.msgId
            },
            data: {
              err: {
                msg: err.message,
                status: err.status || 403
              },
              data: data
            }
          }
          this.reqCommand(json)
        }
      })
    }
  }
  /**
   * Except post file
   * @param {object} json
   * @memberof Pipe
   */
  reqCommand (json) {
    // {
    //   "common":{
    //     "deviceSN":"设备SN号",
    //     "msgId":"消息ID"
    //   },
    //   "data":""//设备返回给app的数据,字符串形式,base64或URLEncode,由APP和设备约定
    // }
    return request({
      uri: COMMAND_URL,
      method: 'POST',
      headers: { Authorization: `JWT ${this.config.cloudToken}` },
      body: true,
      json: json
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        var info = JSON.parse(body)
        console.log(info)
      }
    })
  }
  /**
   * post resource
   * @memberof Pipe
   */
  postResource (absolutePath) {
    var formData = {
      // Pass a simple key-value pair
      deviceSN: 'my_value',
      msgId: '',
      data: {},
      file: fs.createReadStream(absolutePath),
      // Pass multiple values /w an Array
      attachments: [
        fs.createReadStream(__dirname + '/attachment1.jpg'),
        fs.createReadStream(__dirname + '/attachment2.jpg')
      ],
      // Pass optional meta-data with an 'options' object with style: {value: DATA, options: OPTIONS}
      // Use case: for some types of streams, you'll need to provide "file"-related information manually.
      // See the `form-data` README for more information about options: https://github.com/form-data/form-data
      // custom_file: {
      //   value:  fs.createReadStream('/dev/urandom'),
      //   options: {
      //     filename: 'topsecret.jpg',
      //     contentType: 'image/jpeg'
      //   }
      // }
    }
    request.post({
      url: RESOURCE_URL,
      formData: formData
    }, function optionalCallback (err, httpResponse, body) {
      if (err) {
        return console.error('upload failed:', err)
      }
      console.log('Upload successful!  Server responded with:', body)
    })
  }

  getResource () {
    return request({
      uri: RESOURCE_URL,
      method: 'GET',
      headers: { Authorization: `JWT ${this.config.cloudToken}` },
      qs: {
        deviceSN: 'my_value',
        msgId: '',
        data: {}
      }
    })
  }

}

module.exports = Pipe
