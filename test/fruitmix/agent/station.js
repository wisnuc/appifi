const path = require('path')
const request = require('supertest')
const superagent = require('superagent')
const Promise = require('bluebird')
const rimrafAsync = Promise.promisify(require('rimraf'))
const mkdirpAsync = Promise.promisify(require('mkdirp'))
const UUID = require('uuid')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const sinon = require('sinon')
const expect = chai.expect
const should = chai.should()

const app = require('src/app')
const { saveObjectAsync } = require('src/fruitmix/lib/utils')
const broadcast = require('src/common/broadcast')
const Tickets = require('src/fruitmix/station/lib/tickets')
const Station = require('src/fruitmix/station/lib/station')

const User = require('src/fruitmix/models/user')

const {
  IDS,
  stubUserUUID,
  createUserAsync,
  retrieveTokenAsync,
  createPublicDriveAsync,
  setUserGlobalAsync,
  retrieveCloudTokenAsync
} = require('./lib')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')
const tmpDir = path.join(tmptest, 'tmp')
const repoDir = path.join(tmptest, 'repo')

let Ticket = {
  ticketId:'123456',
  type: 2,
  userData: {
    guid: '1212121',
    unionId: '654321'
  }
}

// sinon.stub(Tickets, 'createTicket', (user, sa, type, callback) => callback(null, { id: '12312313132' }))

// console.log(require('src/fruitmix/station/lib/tickets') === Tickets)

// Tickets.createTicket(1, 2, 3, (err, data)=> {
//   console.log('.......///.......', data)
// })

const resetAsync = async() => {

  broadcast.emit('FruitmixStop')

  await broadcast.until('UserDeinitDone', 'BoxDeinitDone')

  await rimrafAsync(tmptest) 
  await mkdirpAsync(tmpDir) 
  await mkdirpAsync(repoDir)
 
  broadcast.emit('FruitmixStart', 'tmptest') 

  await broadcast.until('UserInitDone', 'BoxInitDone')
}

describe(path.basename(__filename), () => {
  describe('No user', () => {

    beforeEach(async () => {
      await resetAsync()
      await createUserAsync('alice')
      token = await retrieveTokenAsync('alice')
    })

    it('should fail create Ticket if no token', done => {
      request(app)
        .post('/station/tickets')
        .expect(401)
        .end(done)
    })
  })

  // describe('Alice, with Token , create Ticket', () => {
  //   let token , id = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'
  //   beforeEach(async () => {
  //     sinon.stub(Tickets, 'createTicket', (user, sa, type, callback) => callback(null, { id }))
  //     sinon.stub(Station, 'stationFinishStart', (req, res, next) => next())
  //     await resetAsync()
  //     await createUserAsync('alice')
  //     token = await retrieveTokenAsync('alice')
  //   })

  //   afterEach( () => Tickets.createTicket.restore())

  //   it('POST /tickets should return { id }', done => {
  //     request(app)
  //       .post('/station/tickets')
  //       .set('Authorization', 'JWT ' + token)
  //       .send({ type: 2 })
  //       .expect(200)
  //       .end((err, res) => {
  //         if(err) return done(err)
  //         expect(res.body).to.deep.equal({ id })
  //         done()
  //       })
  //   })
  // })

  // describe('Alice binding global user', () => {
  //   let token , id = 'a96241c5-bfe2-458f-90a0-46ccd1c2fa9a'
  //   beforeEach(async () => {
  //     await resetAsync()
  //     await createUserAsync('alice')
  //     token = await retrieveTokenAsync('alice')
  //     console.log(token)
  //   })

  //   // afterEach( () => Tickets.requestConfirmAsync.restore())

  //   it('POST /tickets should return { id }', done => {
  //     request(app)
  //       .post('/station/tickets/wechat/' + Ticket.ticketId)
  //       .set('Authorization', 'JWT ' + token)
  //       .send({
  //         state: true,
  //         guid: Ticket.userData.guid
  //       })
  //       .expect(200)
  //       .end((err, res) => {
  //         if(err) return done()
  //         console.log(121212121)
  //         console.log(res.body)
  //         // expect(User.findUser(IDS.alice.uuid).global.id).to.equal(Ticket.userData.guid)
  //       })
  //   })
  // })
})