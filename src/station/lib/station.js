const fs = require('fs')
const path = require('path')

const ursa = require('ursa')
const Promise = require('bluebird')
const Router = require('express').Router
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const request = require('superagent')
const debug = require('debug')('station')

// const { registerAsync } = require('./register')
const { FILE, CONFIG } = require('./const')
const broadcast = require('../../common/broadcast')
const Pipe = require('./pipe')
const { Connect, CONNECT_STATE } = require('./connect')
const Tickets = require('./tickets').Tickets

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

class Station {
  constructor(){
    this.froot = undefined
    this.pbkPath = undefined
    this.pvkPath = undefined
    this.publicKey = undefined
    this.privateKey = undefined
    this.sa = undefined
    this.connect = undefined
    this.pipe = undefined
    this.initialized = false
    this.init()
  }                                                  
  
  init() {
    broadcast.on('FruitmixStart', async (froot) => {
      this.froot = froot
      await this.startAsync(froot) // init station for keys
      try{
        debug('station start building')
        // await this.registerAsync(froot)
        this.sa = await this.registerAsync(froot)
        //connect to cloud
        this.connect = new Connect(this) 
        this.connect.on('ConnectStateChange', state => {
          debug('state change :', state)
          this.initialized = (state === CONNECT_STATE.CONNED) ? true : false
        })
        this.tickets = new Tickets(this.sa.id, this.connect)
        this.pipe = new Pipe(path.join(froot, 'tmp'), this.connect)
        this.initialized = true

        await this.connect.initAsync() // connect to cloud and get token
        broadcast.emit('StationStart', this)
      }catch(e){
        debug('Station start error!',e)
      }
    })
    // deinit
    broadcast.on('FruitmixStop', this.deinit.bind(this))
  }

  deinit() {
    this.publicKey = undefined
    this.privateKey = undefined
    this.sa = undefined
    this.froot = undefined
    this.pbkPath = undefined
    this.pvkPath = undefined
    if(this.initialized)
      this.connect.deinit()
    this.connect = undefined
    this.tickets = undefined
    this.pipe = undefined
    this.initialized = false
    debug('station deinit')
    broadcast.emit('StationStop', this)
  }

  async startAsync(froot) {
    let pbkPath = path.join(froot, 'station', FILE.PUBKEY)
    let pvkPath = path.join(froot, 'station', FILE.PVKEY)
    try{
        //TODO:
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

      //TODO:  
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
      .post(CONFIG.CLOUD_PATH + 'v1/stations')
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
        let ws = fs.createWriteStream(SA_PATH)
        ws.write(JSON.stringify(res.body.data, null, ' '))
        ws.close()
        return callback(null, res.body.data)
      }) 
  }

  stationFinishStart(req, res, next) {
    if(this.initialized !== undefined && this.connect.isConnected()){
      req.body.sa = this.sa
      req.body.Connect = this.connect
      req.Tickets = this.tickets
      return next()
    }
    debug('Station initialized error')
    return res.status(500).json('station initialize error')
  }

  info(){
    let info = Object.assign({}, this.sa)
    info.connectState = this.connect.getState()
    info.pbk = this.publicKey
    return info
  }
}

module.exports = new Station()
