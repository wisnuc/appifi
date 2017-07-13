const fs = require('fs')
const path = require('path')

const ursa = require('ursa')
const Promise = require('bluebird')
const Router = require('express').Router
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const { registerAsync } = require('./lib/register')
const { FILE, CONFIG } = require('./lib/const')
const broadcast = require('../../common/broadcast')
const Connect = require('./lib/connect')
const auth = require('../middleware/auth')
const tickets = require('./route/tickets')

Promise.promisifyAll(fs)
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

let sa, connect, fruitmixPath, pubKey, pvKey

const initAsync = async (froot) => {
  let pbkPath = path.join(froot, 'station', FILE.PUBKEY)
  let pvkPath = path.join(froot, 'station', FILE.PVKEY)
  let createKeysAsync = async () => {
    //remove keys 
    try{
      await rimrafAsync(path.join(froot, 'station'))
      await fs.unlinkAsync(pbkPath)
      await fs.unlinkAsync(pvkPath)
    }catch(e){

    }

    await mkdirpAsync(path.join(froot, 'station'))

    let modulusBit = 2048 

    let key  = ursa.generatePrivateKey(modulusBit, 65537)

    let privatePem = ursa.createPrivateKey(key.toPrivatePem()) //生成私钥
    let privateKey = privatePem.toPrivatePem('utf8')
    await fs.writeFileAsync(pvkPath, privateKey, 'utf8')


    let publicPem = ursa.createPublicKey(key.toPublicPem())   //生成公钥
    let publicKey = publicPem.toPublicPem('utf8')
    await fs.writeFileAsync(pbkPath, publicKey, 'utf8')
    return 
  }

  try{
      //TODO
      let pbStat = await fs.lstatAsync(pbkPath)
      let pvStat = await fs.lstatAsync(pvkPath)
      if(pbStat.isFile() && pvStat.isFile()){
        return  
      }
      return await createKeysAsync()
      
    }catch(e){
      if(e.code === 'ENOENT')
        return await createKeysAsync()
      throw e
    }

}
 
const startAsync = async (froot) => {
  await initAsync(froot) // init station for keys
  try{
     sa = await registerAsync(froot)
     console.log(sa)
     //connect to cloud
     connect = new Connect(CONFIG.CLOUD_PATH, sa, froot)
  }catch(e){
    console.log(e)
  }
}


broadcast.on('FruitmixStart', froot => {
  fruitmixPath = froot
  console.log(123)
  startAsync(froot)
    .then(froot => {

    })
    .catch(e => {
      //TODO 
      console.log(e)
    })
})

// broadcast.emit('FruitmixStart', process.cwd())

let router = Router()

let stationFinishStart = (req, res, next) => {
  console.log('station start')
  if(sa !== undefined && connect !== undefined && connect.isConnect){
    req.body.sa = sa
    req.body.connect = connect
    return next()
  }
  return res.status(500).json()
}

router.use('/tickets', auth.jwt(), tickets)

router.get('/info', auth.jwt(), (req, res) => {
  return res.status(200).json({
    "uuid": sa.id,
    "name": "station name",
    "pubkey": pubKey
  })
})

module.exports = router
