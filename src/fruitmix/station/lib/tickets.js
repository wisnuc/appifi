const request = require('superagent')

const { FILE, CONFIG } = require('./const')

let createTicket = (user, sa, type, callback) => {
  //TODO encrypt data
  console.log(user)
  request
    .post(CONFIG.CLOUD_PATH + 'v1/tickets')
    .set('Content-Type', 'application/json')
    .send({
       stationId: sa.id,
       data: '123456',
       creator: user.uuid,
       type
    })
    .end((err, res) => {
      console.log(err, res.body)
      if(err || res.status !== 200) return callback(new Error('register error'))
      return callback(null, res.body.data)
    }) 
}

module.exports.createTicket = createTicket

let getTicket = (ticketId, callback) => {
  request
    .get(CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId)
    .set('Content-Type', 'application/json')
    .end((err, res) => {
      if(err || res.status !== 200) return callback(new Error('register error')) 
      return callback(null, res.body)
    })
}

module.exports.getTicket = getTicket