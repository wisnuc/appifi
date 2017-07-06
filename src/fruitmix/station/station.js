const fs = require('fs')
const path = require('path')

const ursa = require('ursa')
const Promise = require('bluebird')
const Router = require('express').Router

const { registerAsync } = require('./register')
const broadcast = require('../../common/broadcast')
const Connect = require('./connect')

Promise.promisifyAll(fs)

let sa, connect

const initAsync = async () => {
  let createKeysAsync = async () => {
    let pbkPath = path.join(process.cwd(), FILE.PUBKEY)
    let pvkPath = path.join(process.cwd(), FILE.PVKEY)

    //remove keys 
    try{
      await fs.unlinkAsync(pbkPath)
      await fs.unlinkAsync(pvkPath)
    }catch(e){

    }

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
      let pbStat = await fs.lstatAsync(path.join(process.cwd(), FILE.PUBKEY))
      let pvStat = await fs.lstatAsync(path.join(process.cwd(), FILE.PVKEY))
      if(pbStat.isFile() && pvStat.isFile())
        return
      return await createKeysAsync()
      
    }catch(e){
      if(e.code === 'ENOENT')
        return await this.createKeysAsync()
      throw e
    }

}

const startAsync = async () => {
  await initAsync() // init station for keys
  try{
     sa = await registerAsync()
     //connect to cloud
     connect = new Connect('http://10.10.9.59:5757', sa)
  }catch(e){
    console.log(e)
  }
}


broadcast.on('FruitmixStarted', (err, data) => {
  if(err) return
  startAsync
    .then(data => {

    })
    .catch(e => {
      //TODO 
      console.log(e)
    })
})

let router = Router()


module.exports = router
