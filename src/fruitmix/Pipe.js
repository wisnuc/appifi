const EventEmitter = require('events')
const pathToRegexp = require('path-to-regexp')

class Pipe extends EventEmitter {
  /**
   * Create a Pipe
   * @param {object} opts
   * @param {string} opts.file - path of drives.json
   * @param {string} opts.tmpDir - path of tmpDir (should be suffixed by 'drives')
   * @param {object} user
   */
  constructor (opts, user) {
    super()
    this.conf = opts.configuration // is this required ??? TODO
    this.fruitmixDir = opts.fruitmixDir
    this.user = user
  }

  handleMessage (message) {
    // {
    //   "type":"动作类型,取值[pip,req,ack，notice]",	//1. pip:透传APP消息; 2. req:服务器发送给设备的请求; 3. ack:表示应答设备的请求; 4. notice:服务器通知
    //   "msgId":"消息ID",				//接收方与应答方应保证msgId的一致性
    //   "packageParams":{				//当type==pip说传递，包括发送服务器地址，接收服务器地址，用户标识
    //     "sendingServer":"A.B.C.D",		//发送服务器名称或者IP,比如:114.234.28.2
    //     "watingServer":"E.F.G.H", 		//消息接受服务器名称或IP地址,比如:211.152.34.2
    //     "uid":"用户ID号"
    //   },
    //   "reqCmd":"reqCmd",				//当type==req时, 需要传递该字段
    //   "noticeType":"noticeType"			//当type==noticeType时,需要传递该字段
    //   "data":{					//数据的详细参数,当type==pip时, 透传APP的请求数据，具体数据格式由设备和APP协商
    //     "param1":"value1",
    //     "param2":"value2"
    //   }
    // }
    const { path } = message.data.req
    var keys = []
    var re = pathToRegexp('/foo/:bar', keys)
    switch (path) {
      case '':
        this.postJson()
        break

      default:
        break
    }
  }

  update() {}
  delete() {}
  postJson() {}
  getJson() {}
  storeFile() {}
  fetchFile() {}
}

module.exports = Pipe
