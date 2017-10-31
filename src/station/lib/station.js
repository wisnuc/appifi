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
const { Connect, CONNECT_STATE } = require('./connect')
const Tickets = require('./tickets').Tickets
const getFruit = require('../../fruitmix')

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const f = af => (req, res, next) => af(req, res).then(x => x, next)

class Station {
  constructor(){
    this.froot = undefined
    this.pbkPath = undefined
    this.pvkPath = undefined
    this.publicKey = undefined
    this.privateKey = undefined
    this.station = undefined
    this.connect = undefined
    this.pipe = undefined
    this.initialized = false
    this.lock = false
    this.init()
  }                                                  
  
  init() {
    broadcast.on('StationStart', f(async (froot) => {
      this.froot = froot
      await this.startAsync(froot) // init station for keys
      try{
        debug('station start building')
        // await this.registerAsync(froot)
        this.station = await this.registerAsync(froot)
        //connect to cloud
        this.connect = new Connect(this) 
        this.connect.on('ConnectStateChange', state => {
          debug('state change :', state)
          this.initialized = (state === CONNECT_STATE.CONNED) ? true : false
          if (this.initialized) {
            this.updateCloudUsersAsync()
              .then(() => {debug('station update success')})
              .catch(e => debug(e))
          }
        })
        this.tickets = new Tickets(this.station.id, this.connect)
        this.pipe = new Pipe(path.join(froot, 'tmp'), this.connect)
        this.initialized = true

        await this.connect.initAsync() // connect to cloud and get token
        broadcast.emit('StationStartDone', this)
      }catch(e){
        debug('Station start error!',e)
      }
    }))

    // UserList Changed Notify

    broadcast.on('UserListChanged', async () => {
      if (this.initialized) {
        debug('Station Handler UserListChanged Notify')
        this.updateCloudUsersAsync()
          .then(() => {debug('station update userlist success')})
          .catch(e => debug(e))
      }
    })

    // deinit
    broadcast.on('StationStop', this.deinit.bind(this))
  }

  deinit() {
    this.publicKey = undefined
    this.privateKey = undefined
    this.station = undefined
    this.froot = undefined
    this.pbkPath = undefined
    this.pvkPath = undefined
    if(this.initialized)
      this.connect.deinit()
    this.connect = undefined
    this.tickets = undefined
    this.pipe = undefined
    this.initialized = false
    this.lock = false
    debug('station deinit')
    broadcast.emit('StationStopDone', this)
  }

  async startAsync(froot) {
    let pbkPath = path.join(froot, 'station', FILE.PUBKEY)
    let pvkPath = path.join(froot, 'station', FILE.PVKEY)
    try{
      let pbStat = await fs.lstatAsync(pbkPath)
      let pvStat = await fs.lstatAsync(pvkPath)
      if(pbStat.isFile() && pvStat.isFile()){
        this.publicKey = (await fs.readFileAsync(pbkPath)).toString('utf8')
        this.privateKey = (await fs.readFileAsync(pvkPath)).toString('utf8')
        this.pbkPath = pbkPath
        this.pvkPath = pvkPath
        return  
      }
      return await this.createKeysAsync(froot)
      
    }catch(e){
      if(e.code === 'ENOENT')
        return await this.createKeysAsync(froot)
      throw e
    }
  }

  async createKeysAsync(froot) {
      //remove keys 
    try{
      await rimrafAsync(path.join(froot, 'station'))
      await mkdirpAsync(path.join(froot, 'station'))

      let modulusBit = 2048 

      let pbkPath = path.join(froot, 'station', FILE.PUBKEY)
      let pvkPath = path.join(froot, 'station', FILE.PVKEY)

      let key  = ursa.generatePrivateKey(modulusBit, 65537)

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
    }catch(e){
      debug(e)
      throw e
    }
  }

  register(froot, callback) {
    let saPath = path.join(froot, 'station', FILE.SA)
    fs.lstat(saPath, (err, lstat) => {
      if(err || !lstat.isFile()) return this.requestRegisterStation(froot, callback)
      fs.readFile(saPath, (err, data) => {
        if(err){ 
           debug(err)
          return callback(err)
        }
        debug( JSON.parse(data))
        return callback(null, JSON.parse(data))
      })
    })
  }

  async registerAsync(froot)　{
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
        if(err || res.status !== 200){
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
    if(!fruit) throw new Error('fruitmix not start')
    let userIds = fruit.userList.users.filter(u=> !!u.global).map(u => u.global.id)
    let LANIP = this.getLANIP()
    await this.updateCloudStationAsync({ userIds, LANIP, name: this.station.name })
  }

  getLANIP() {
    let ipAddresses = os.networkInterfaces()
    let addrs = []
    Object.keys(ipAddresses).forEach(key => {
      addrs = [...addrs, ...ipAddresses[key]]
    })
    return addrs.find(add => {
              if(!add.internal && add.family === 'IPv4') return true
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
    if(this.initialized && this.connect.isConnected()){
      let url = CONFIG.CLOUD_PATH + 's/v1/stations/' + this.station.id
      let token = this.connect.token
      let opts = { 'Authorization': this.connect.token }
      let params = props // TODO change ticket status
      try {
        debug('发起update station info ')
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

  stationFinishStart(req, res, next) {
    if(this.initialized && this.connect.isConnected()){
      req.body.station = this.station
      req.body.Connect = this.connect
      req.Tickets = this.tickets
      return next()
    }
    debug('Station initialized error')
    return res.status(500).json('station initialize error')
  }

  info (){
    if(this.initialized) {
      let info = Object.assign({}, this.station)
      info.connectState = this.connect.getState()
      info.pbk = this.publicKey
      return info
    }
    return false
  }

  async updateInfoAsync (props) {
    if(!this.station) throw Object.assign(new Error('station not registe'), { status: 500 })
    let name = props.name
    let current = this.station
    let nextStation = {
      id: current.id,
      name: name
    }
    await this.saveToDiskAsync(current, nextStation)
    try{
      await this.updateCloudInfoAsync()
    }catch(e){
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
