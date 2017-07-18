const fs = require('fs')
const path = require('path')

const ursa = require('ursa')
const Promise = require('bluebird')
const Router = require('express').Router
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const request = require('superagent')

// const { registerAsync } = require('./register')
const { FILE, CONFIG } = require('./const')
const broadcast = require('../../../common/broadcast')
const Connect = require('./connect')

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

class Station {
  constructor(){
    broadcast.on('FruitmixStart', froot => {
      this.froot = froot
      this.startAsync()
        .then(() => {})
        .catch(e => {
          //TODO 
          console.log(e)
        })
    })
  }

  async initAsync() {
    this.pbkPath = path.join(this.froot, 'station', FILE.PUBKEY)
    this.pvkPath = path.join(this.froot, 'station', FILE.PVKEY)
    try{
        //TODO
        let pbStat = await fs.lstatAsync(this.pbkPath)
        let pvStat = await fs.lstatAsync(this.pvkPath)
        if(pbStat.isFile() && pvStat.isFile()){
          this.publicKey = (await fs.readFileAsync(this.pbkPath)).toString('utf8')
          this.privateKey = (await fs.readFileAsync(this.pvkPath)).toString('utf8')
          return  
        }
        return await this.createKeysAsync()
        
      }catch(e){
        if(e.code === 'ENOENT')
          return await this.createKeysAsync()
        throw e
      }

  }

  async createKeysAsync() {
      //remove keys 
    try{
      await rimrafAsync(path.join(this.froot, 'station'))
      await fs.unlinkAsync(this.pbkPath)
      await fs.unlinkAsync(this.pvkPath)
    }catch(e){

    }

    await mkdirpAsync(path.join(this.froot, 'station'))

    let modulusBit = 2048 

    let key  = ursa.generatePrivateKey(modulusBit, 65537)

    let privatePem = ursa.createPrivateKey(key.toPrivatePem()) //生成私钥
    this.privateKey = privatePem.toPrivatePem('utf8')
    await fs.writeFileAsync(this.pvkPath, this.privateKey, 'utf8')


    let publicPem = ursa.createPublicKey(key.toPublicPem())   //生成公钥
    this.publicKey = publicPem.toPublicPem('utf8')
    await fs.writeFileAsync(this.pbkPath, this.publicKey, 'utf8')
    return 
  }
  
  async startAsync() {
    await this.initAsync() // init station for keys
    try{
      this.sa = await this.registerAsync()
      broadcast.emit('StationStart', this)
      //connect to cloud
      this.connect = Connect
    }catch(e){
      // console.log(e)
    }
  }

  register(callback) {
    let saPath = path.join(this.froot, 'station', FILE.SA)
    fs.lstat(saPath, (err, lstat) => {
      if(err || !lstat.isFile()) return this.requestRegisterStation(callback)
      fs.readFile(saPath, (err, data) => {
        if(err) return callback(err)
        console.log( JSON.parse(data))
        return callback(null, JSON.parse(data))
      })
    })
  }

  async registerAsync()　{
    return Promise.promisify(this.register).bind(this)()
  }

  requestRegisterStation(callback) {
    // console.log(publicKey)
    request
      .post(CONFIG.CLOUD_PATH + 'v1/stations')
      .set('Content-Type', 'application/json')
      .send({
        publicKey: this.publicKey
      })
      .end((err, res) => {
        let SA_PATH = path.join(this.froot, 'station', FILE.SA)
        if(err || res.status !== 200) return callback(new Error('register error')) 
        let ws = fs.createWriteStream(SA_PATH)
        ws.write(JSON.stringify(res.body.data, null, ' '))
        ws.close()
        return callback(null, res.body.data)
      }) 
  }

  stationFinishStart(req, res, next) {
    console.log('station started')
    if(this.sa !== undefined && this.connect !== undefined && this.connect.isConnect){
      req.body.sa = this.sa
      req.body.connect = this.connect
      return next()
    }
    return res.status(500).json(new Error('station initialize error'))
  }
}

module.exports = new Station()
