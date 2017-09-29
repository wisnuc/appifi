const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const request = require('superagent')
const FormData = require('form-data')
const UUID = require('uuid')

const { FILES } = require('./lib')

let address = process.argv.find((x, index, array) => index > 0 && array[index - 1] === '--address')

if (!address) {
  console.log('please provide server address, eg: --address 10.10.10.10')
  process.exit(1)
}

describe(path.basename(__filename), () => {

  let alice = {}

  before(function (done) {
    this.timeout(0)
    request
      .get(`http://${address}:3000/users`) 
      .end((err, res) => {
        if (err) return done(err) 
        let user = res.body.find(u => u.username === 'alice')
        if (!alice) {
          console.log('alice not found')
          process.exit(1)
        }

        alice.uuid = user.uuid
        console.log('alice uuid', alice.uuid)

        request
          .get(`http://${address}:3000/token`)
          .auth(alice.uuid, 'alice')
          .end((err, res) => {
            if (err) return done(err)
            
            alice.token = res.body.token
            console.log('alice token', alice.token)

            request
              .get(`http://${address}:3000/drives`)
              .set('Authorization', 'JWT ' + alice.token)
              .end((err, res) => {
                if (err) return done(err)

                let drive = res.body.find(d => d.tag === 'home' 
                  && d.owner === alice.uuid 
                  && d.type === 'private')

                if (!drive) {
                  console.log('alice home drive not found')
                  process.exit(1)
                }

                alice.home = drive
                console.log('alice home drive', alice.home)

                done()
              })
          })
      })
  })

  it('upload alonzo', function (done) {

    this.timeout(0)

    const size1g = 1024 * 1024 * 1024

    let form = new FormData()
    // form.append('hello', JSON.stringify({ op: 'mkdir' }))
    // form.append('hello|world', JSON.stringify({ op: 'rename' }))

/**
    let rs = fs.createReadStream(FILES.oneGiga.path, { start: 0, end: size1g / 2 - 1 })
    form.append('halfGiga', rs, {
      filename: JSON.stringify({ size: FILES.halfGiga.size, sha256: FILES.halfGiga.hash }),
      knownLength: FILES.halfGiga.size
    })
**/

/**
    let rs = fs.createReadStream(FILES.oneGiga.path, { start: 0, end: size1g / 2 - 1 })
    form.append('halfGiga1', rs, {
      filename: JSON.stringify({ size: FILES.halfGiga.size, sha256: FILES.halfGiga.hash }),
      knownLength: FILES.halfGiga.size
    })
**/

    const formUploadOneHalf = (name, callback) => {
      let form = new FormData()

      let rs1 = fs.createReadStream(FILES.oneGiga.path)
      form.append(name, rs1, {
        filename: JSON.stringify({ size: FILES.oneGiga.size, sha256: FILES.oneGiga.hash }),
        knownLength: FILES.oneGiga.size
      })

      let rs2 = fs.createReadStream(FILES.halfGiga.path)
      form.append(name, rs2, {
        filename: JSON.stringify({ size: FILES.halfGiga.size, sha256: FILES.halfGiga.hash, 
          append: FILES.oneGiga.hash }),
        knownLength: FILES.halfGiga.size
      })
     
      form.submit({
        method: 'post',
        host: address,
        port: 3000,
        path: `/drives/${alice.home.uuid}/dirs/${alice.home.uuid}/entries`, 
        headers: { Authorization: 'JWT ' + alice.token }
      }, function (err, res) {

        const buffers = []
        res.setEncoding('utf8')
        res.on('data', data => buffers.push(data))
        res.on('end', () => {

          let body = {}
          if (buffers.length) {
            body = JSON.parse(buffers.join(''))
            console.log(body)
          }

          if (res.statusCode !== 200) 
            callback(new Error('failed'))
          else 
            callback(null, body)
        })
      })
    }

    const loop = () => {
      let name = UUID.v4().slice(0, 8)
      formUploadOneHalf(name, (err, body) => {
        if (err) return done(err)
      
        console.log(body)
        let uuid = body[0].data.uuid

        request.post(`http://${address}:3000/drives/${alice.home.uuid}/dirs/${alice.home.uuid}/entries`)
          .set('Authorization', 'JWT ' + alice.token)
          .field(name, JSON.stringify({ op: 'remove', uuid: body[0].data.uuid }))
          .end((err, res) => {

            console.log(res.body)

            if (err) return done(err)

            console.log(`${name} uploaded and removed`)

            setImmediate(loop)
          })
      })
    }

    loop()

/**
    let name = UUID.v4().slice(0, 8)
    let rs1 = fs.createReadStream(FILES.oneGiga.path)
    form.append(name, rs1, {
      filename: JSON.stringify({ size: FILES.oneGiga.size, sha256: FILES.oneGiga.hash }),
      knownLength: FILES.oneGiga.size
    })

    let rs2 = fs.createReadStream(FILES.halfGiga.path)
    form.append(name, rs2, {
      filename: JSON.stringify({ size: FILES.halfGiga.size, sha256: FILES.halfGiga.hash, 
        append: FILES.oneGiga.hash }),
      knownLength: FILES.halfGiga.size
    })

    form.submit({
      method: 'post',
      host: address,
      port: 3000,
      path: `/drives/${alice.home.uuid}/dirs/${alice.home.uuid}/entries`, 
      headers: { Authorization: 'JWT ' + alice.token }
    }, function (err, res) {
      const buffers = []
      res.setEncoding('utf8')
      res.on('data', data => buffers.push(data))
      res.on('end', () => {
        if (buffers.length) {
          const body = JSON.parse(buffers.join(''))
          console.log(body)
        }
        done()
      })
    })
**/


  })
})


