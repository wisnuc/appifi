const request = require('superagent')
const Promise = require('bluebird')

const User = require('../../models/user') 

const { FILE, CONFIG } = require('./const')

let createTicket = (user, sa, type, callback) => {
  //TODO encrypt data
  let u = User.findUser(user.uuid)
  if(type === 2 && u.global)
    return callback(new Error('user has already bind'))
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
      if(err || res.status !== 200) return callback(new Error('create ticket error'))
      return callback(null, res.body.data)
    }) 
}

module.exports.createTicket = createTicket

let getTicket = (ticketId, callback) => {
  request
    .get(CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId)
    .set('Content-Type', 'application/json')
    .end((err, res) => {
      if(err || res.status !== 200) return callback(new Error('get ticket error')) 
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
      if(err || res.status !== 200) return callback(new Error('get tickets error')) 
      return callback(null, res.body.data)
    })
}

let requestConfirm = (state, guid, ticketId, callback) => {
  // state binding or unbinding
  request
    .post(CONFIG.CLOUD_PATH + 'v1/wx/' + state ? 'binding' : 'unbinding')
    .set('Content-Type', 'application/json')
    .send({
      ticketId
    })
    .end((err, res) => {
      if(err || res.status !== 200) return console.log(err) && callback(new Error('confirm error')) 
      return callback(null, res.body.data)
    })
}


let requestConfirmAsync = Promise.promisify(requestConfirm)


let confirmTicketAsync = async (ticketId, guid, useruuid, state) => {
  if(!state)
    return await requestConfirmAsync(state, guid, ticketId)
  let u = User.findUser(useruuid)
  let ticket = await getTicketAsync(ticketId)
  if(ticket.type === 2 && u.global)
    throw new Error('user has already bind')  
  if(ticket.type === 1){//share register new local 
    let index = ticket.users.findIndex(u => u.guid === guid) 
    if (index === -1) throw new Error('user not found')
    await requestConfirmAsync(state, guid, ticketId)
    return await User.createUserAsync({ 
                        username: '',
                        password: '',
                        global:{
                          id: guid,
                          wx: []
                        }
                      })            
  }else if(ticket.type === 2){//binding
    console.log(2222222)
    if (ticket.userData.guid !== guid) throw new Error('user not found')
    console.log('confirm start')
    await requestConfirmAsync(state, guid, ticketId)
    console.log('confirm success')
    return await User.updateUserAsync(useruuid, {
      global: {
        id: guid,
        wx: [ticket.userData.unionId]
      }
    })
  }
}

module.exports.confirmTicketAsync = confirmTicketAsync