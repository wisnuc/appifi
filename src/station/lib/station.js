const fs = require('fs')
const path = require('path')
const os = require('os')

const ursa = require('ursa')
const Promise = require('bluebird')
const Router = require('express').Router
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const request = require('superagent')
const debug = require('debug')('station')
const deepFreeze = require('deep-freeze')
const E = require('../../lib/error')

const requestAsync = require('./request').requestHelperAsync
const { saveObjectAsync } = require('../../lib/utils')
const { FILE, CONFIG } = require('./const')
const broadcast = require('../../common/broadcast')
const Pipe = require('./pipe')
const { MQTT, CONNECT_STATE } = require('./mqtt')
const Tickets = require('./tickets').Tickets
const getFruit = require('../../fruitmix')
const BoxUpdater = require('./boxUpdater')

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const f = af => (req, res, next) => af(req, res).then(x => x, next)

class Station {

  constructor () {
    this.froot = undefined
    this.pbkPath = undefined
    this.pvkPath = undefined
    this.publicKey = undefined
    this.privateKey = undefined
    this.station = undefined
    this.initialized = false
    this.lock = false

    this.token = undefined
    this.mqtt = undefined
    this.pipe = undefined
    this.boxUpdater = undefined

    this.deinited = false
    this.setUp()
  }

  setUp () {
    broadcast.on('StationStart', (froot) => {
      this.froot = froot
      try {
        this.init(froot)
      } catch(e){
        debug(e)
      }
    })

    broadcast.on('UserListChanged', async () => {
      if (!this.initialized) return
      debug('Station Handler UserListChanged Notify')
      this.updateCloudUsersAsync()
        .then(() => { debug('station update userlist success') })
        .catch(e => debug(e))
    })
    broadcast.on('StationStop', this.deinit.bind(this))
  }

  init(froot) {
    this.initAsync(froot)
      .then(() => {})
      .catch(e => {
        debug('station start error, about to restart', e)
        setTimeout(() => {
          if(this.deinited) return
          if(this.mqtt) {
            this.mqtt.destory()
            this.mqtt = undefined
          }
          this.init(froot)
        }, 5000)
      })
  }

  async initAsync(froot) {
    await this.startAsync(froot) // init station for keys
    this.station = await this.registerAsync(froot)
    // get station token
    this.token = await this.getToken()
    const pipe = new Pipe(this)
      // start mqtt
    this.mqtt = new MQTT(this)
    // register 
    this.mqtt.register('pipe', pipe.handle.bind(pipe))
    this.mqtt.on('MQTTConnected', () => {
      this.updateCloudUsersAsync()  //update users and lanIP
        .then(() => { })
        .catch(e => debug('update service users error', e))
    })
    this.mqtt.connect()
    
    this.tickets = new Tickets(this)
    this.initialized = true
    this.boxUpdater = new BoxUpdater(this)
    
    await this.updateCloudUsersAsync()
  }

  /**
   * get token from cloud, when appifi start
   * @param {string} stationId
   */
  async getToken () {
    try {
      debug('Start Get Station Token')
      let url = CONFIG.CLOUD_PATH + 's/v1/stations/' + this.station.id + '/token'
      let res = await requestAsync('get', url, {}, {})
      if (res.status === 200) {
        let data = res.body.data
        let secretKey = ursa.createPrivateKey(this.privateKey)
        let seed = secretKey.decrypt(data.encryptData, 'base64', 'utf8')
        if (seed !== data.seed) throw new Error('public key authorization faild')
        return data.token
      } else {
        throw new Error(res.body.message)
      }
    } catch (error) {
      debug(error)
      throw new Error('get token error')
    }
  }

  deinit() {
    this.deinited = true
    this.initialized = false
    this.publicKey = undefined
    this.privateKey = undefined
    this.station = undefined
    this.froot = undefined
    this.pbkPath = undefined
    this.pvkPath = undefined
    this.tickets = undefined
    this.lock = false
    if(this.mqtt) this.mqtt.destory()
    this.mqtt = undefined
    debug('station deinit')
    broadcast.emit('StationStopDone', this)
  }

  async startAsync(froot) {
    let pbkPath = path.join(froot, 'station', FILE.PUBKEY)
    let pvkPath = path.join(froot, 'station', FILE.PVKEY)
    try {
      let pbStat = await fs.lstatAsync(pbkPath)
      let pvStat = await fs.lstatAsync(pvkPath)
      if (pbStat.isFile() && pvStat.isFile()) {
        this.publicKey = (await fs.readFileAsync(pbkPath)).toString('utf8')
        this.privateKey = (await fs.readFileAsync(pvkPath)).toString('utf8')
        this.pbkPath = pbkPath
        this.pvkPath = pvkPath
        return
      }
      return await this.createKeysAsync(froot)
    } catch (e) {
      if (e.code === 'ENOENT')
        return await this.createKeysAsync(froot)
      throw e
    }
  }

  async createKeysAsync(froot) {
    //remove keys 
    try {
      await rimrafAsync(path.join(froot, 'station'))
      await mkdirpAsync(path.join(froot, 'station'))

      let modulusBit = 2048

      let pbkPath = path.join(froot, 'station', FILE.PUBKEY)
      let pvkPath = path.join(froot, 'station', FILE.PVKEY)

      let key = ursa.generatePrivateKey(modulusBit, 65537)

      let privatePem = ursa.createPrivateKey(key.toPrivatePem()) //生成私钥
      let privateKey = privatePem.toPrivatePem('utf8')
      await fs.writeFileAsync(pvkPath, privateKey, 'utf8')


      let publicPem = ursa.createPublicKey(key.toPublicPem())   //生成公钥
      let publicKey = publicPem.toPublicPem('utf8')
      await fs.writeFileAsync(pbkPath, publicKey, 'utf8')
      this.publicKey = publicKey
      this.privateKey = privateKey
      this.pbkPath = pbkPath
      this.pvkPath = pvkPath
      return
    } catch (e) {
      debug(e)
      throw e
    }
  }

  register(froot, callback) {
    let saPath = path.join(froot, 'station', FILE.SA)
    fs.lstat(saPath, (err, lstat) => {
      if (err || !lstat.isFile()) return this.requestRegisterStation(froot, callback)
      fs.readFile(saPath, (err, data) => {
        if (err) {
          debug(err)
          return callback(err)
        }
        debug(JSON.parse(data))
        return callback(null, JSON.parse(data))
      })
    })
  }

  async registerAsync(froot) 　{
    return Promise.promisify(this.register).bind(this)(froot)
  }

  requestRegisterStation(froot, callback) {
    // console.log(publicKey)
    request
      .post(CONFIG.CLOUD_PATH + 's/v1/stations')
      .set('Content-Type', 'application/json')
      .send({
        publicKey: this.publicKey
      })
      .end((err, res) => {
        let SA_PATH = path.join(froot, 'station', FILE.SA)
        if (err || res.status !== 200) {
          debug(err)
          return callback(new Error('register error'))
        }
        res.body.data.name = 'HomeStation'
        let ws = fs.createWriteStream(SA_PATH)
        ws.write(JSON.stringify(res.body.data, null, ' '))
        ws.close()
        return callback(null, res.body.data)
      })
  }

  async updateCloudUsersAsync() {
    let fruit = getFruit()
    if (!fruit) throw new Error('fruitmix not start')
    let userIds = fruit.userList.users.filter(u => !!u.global && !u.disabled).map(u => u.global.id)
    let LANIP = this.getLANIP()
    await this.updateCloudStationAsync({ userIds, LANIP, name: this.station.name })
    debug('update cloud users and LanIP success')
  }

  getLANIP() {
    let ipAddresses = os.networkInterfaces()
    let addrs = []
    Object.keys(ipAddresses).forEach(key => {
      addrs = [...addrs, ...ipAddresses[key]]
    })
    return addrs.find(add => {
      if (!add.internal && add.family === 'IPv4') return true
      return false
    }).address
  }

  async updateCloudInfoAsync() {
    let LANIP = this.getLANIP()
    let props = {
      name: this.station.name,
      LANIP
    }
    await this.updateCloudStationAsync(props)
  }

  async updateCloudStationAsync(props) {
    if (this.initialized && this.mqtt.isConnected()) {
      let url = CONFIG.CLOUD_PATH + 's/v1/stations/' + this.station.id
      let token = this.token
      let opts = { 'Authorization': token }
      let params = props // TODO change ticket status
      try {
        debug('发起update station info ', props, url)
        let res = await requestAsync('PATCH', url, { params }, opts)
        if (res.status === 200)
          return res.body.data
        debug(res.body)
        throw new Error(res.body.message)
      } catch (error) {
        debug(error)
        throw new Error('station update error')
      }
    }
    return
  }

  //FIXME: change ticket
  stationFinishStart(req, res, next) {
    if (this.initialized && this.mqtt.isConnected()) {
      req.station = this.station
      req.Tickets = this.tickets
      return next()
    }
    debug('Station initialized error')
    return res.status(500).json('station initialize error')
  }

  info() {
    let info = Object.assign({}, this.station)
    info.connectState = this.initialized ? this.mqtt.getState() : CONNECT_STATE.DISCED
    info.pbk = this.publicKey
    return info
  }

  async updateInfoAsync(props) {
    if (!this.station) throw Object.assign(new Error('station not registe'), { status: 500 })
    let name = props.name
    let current = this.station
    let nextStation = {
      id: current.id,
      name: name
    }
    await this.saveToDiskAsync(current, nextStation)
    try {
      await this.updateCloudInfoAsync()
    } catch (e) {
      debug('update cloud info error: ', e)
      // do nothing if update cloud error
    }
    return this.info()
  }

  async saveToDiskAsync(currentStation, nextStation) {
    // referential equality check
    if (currentStation !== this.station) throw E.ECOMMITFAIL()

    if (this.lock === true) throw E.ECOMMITFAIL()

    this.lock = true
    try {

      await saveObjectAsync(path.join(this.froot, 'station', FILE.SA), path.join(this.froot, 'tmp'), nextStation)

      this.station = nextStation

      deepFreeze(this.station)
    } finally {
      this.lock = false
    }
  }
}

module.exports = new Station()
