const request = require('superagent')
const uuid = require('uuid')

const { FILE, CONFIG } = require('./const')

let createTicket = (callback) => {
  //TODO userid not uuid.v4()
  request
    .post(CONFIG.CLOUD_PATH + 'v1/tickets')
    .set('Content-Type', 'application/json')
    .send({
       localUserId: uuid.v4(),
       stationId: SA.id
    })
    .end((err, res) => {
      if(err || res.status !== 200) return callback(new Error('register error')) 
      return callback(null, res.body)
    }) 
}

module.exports.createTicket = createTicket

let getTicket = (ticket, callback) => {
   //TODO userid not uuid.v4()
  request
    .get(CONFIG.CLOUD_PATH + 'v1/tickets/' + ticket)
    .set('Content-Type', 'application/json')
    .end((err, res) => {
      if(err || res.status !== 200) return callback(new Error('register error')) 
      return callback(null, res.body)
    })
}

module.exports.getTicket = getTicket