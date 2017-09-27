const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const { FILES } = require('./lib')

const request = require('superagent')

let address = process.argv.find((x, index, array) => index > 0 && array[index - 1] === '--address')
if (!address) {
  console.log('please provide server address with --address 10.10.10.10')
  process.exit(1)
}

describe(path.basename(__filename), () => {

  let alice = {}

  it('retrieve alice uuid', function (done) {
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

                let drive = res.body.find(d => d.tag === 'home' && d.owner === alice.uuid && d.type === 'private')
                if (!drive) {
                  console.log('alice home drive not found')
                  process.exit(1)
                }

                alice.home = drive
                console.log('alice home drive', alice.home)

                let r = request.post(`http://${address}:3000/drives/${alice.home.uuid}/dirs/${alice.home.uuid}/entries`)
                  .set('Authorization', 'JWT ' + alice.token)

                for (let i = 0; i < 500; i++) {
                  r.attach(`alonzo${i}.jpg`, 'testdata/alonzo_church.jpg', JSON.stringify({
                    size: FILES.alonzo.size,
                    sha256: FILES.alonzo.hash
                  }))
                }

                r.end((err, res) => {
                    console.log(res.body) 
                    if (err) return done(err)
                })
              })
          })
      })
  })


})

