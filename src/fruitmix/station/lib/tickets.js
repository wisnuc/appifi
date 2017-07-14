const request = require('superagent')
const User = require('../../models/user') 

const { FILE, CONFIG } = require('./const')

let createTicket = (user, sa, type, callback) => {
  //TODO encrypt data
  // console.log(user)
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
      return callback(null, res.body.data)
    })
}

let getTicketAsync = Promise.promisify(getTicket)

module.exports.getTicket = getTicket

let getTickets = (creator, callback) => {
  request
    .get(CONFIG.CLOUD_PATH + 'v1/tickets/')
    .set('Content-Type', 'application/json')
    .send({
      creator
    })
    .end((err, res) => {
      if(err || res.status !== 200) return callback(new Error('register error')) 
      return callback(null, res.body.data)
    })
}

let requestConfirm = (state, guid, callback) => {

}

let requestConfirmAsync = Promise.promisify(requestConfirm)


let confirmTicketAsync = async (ticketId, guid, useruuid, state) => {
  let ticket = await getTicketAsync(ticketId)
  let index = ticket.users.findIndex(u => u.guid === guid) 
  if (index === -1) return  callback(new Error('user not found'))
  if(ticket.type === 1){//share register new local user
    return await User.createUserAsync({ 
                        username: '',
                        password: '',
                        global:{
                          id: guid,
                          wx: []
                        }
                      })            
  }else if(ticket.type === 2){//binding
    return await User.updateUserAsync(useruuid, {
      global: {
        id: guid,
        wx: []
      }
    })
  }
}

module.exports.confirmTicketAsync = confirmTicketAsync