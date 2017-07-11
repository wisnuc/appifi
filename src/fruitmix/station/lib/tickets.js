const request = require('superagent')

const { FILE, CONFIG } = require('./const')

let createTicket = (data, callback) => {
  request
    .post(CONFIG.CLOUD_PATH + 'v1/tickets')
    .set('Content-Type', 'application/json')
    .send({
       stationId: SA.id,
       data
    })
    .end((err, res) => {
      if(err || res.status !== 200) return callback(new Error('register error')) 
      return callback(null, res.body)
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