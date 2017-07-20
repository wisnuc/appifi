const Promise = require('bluebird')
const debug = require('debug')('station')

const User = require('../../models/user') 

const { FILE, CONFIG } = require('./const')

let createTicket = (user, sa, type, callback) => {
  //TODO encrypt data
  let u = User.findUser(user.uuid)
  // if(type === 2 && u.global)
  //   return callback(new Error('user has already bind'))
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
      if(err || res.status !== 200){
        debug(err)
        return callback(new Error('create ticket error'))
      } 
      return  callback(null, res.body.data)
    }) 
}

let getTicket = (ticketId, callback) => {
  request
    .get(CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId)
    .set('Content-Type', 'application/json')
    .end((err, res) => {
      if(err || res.status !== 200){
        debug(err)
        return callback(new Error('get ticket error')) 
      }
      return callback(null, res.body.data)
    })
}

let getTicketAsync = Promise.promisify(getTicket)


let getTickets = (creator, callback) => {
  request
    .get(CONFIG.CLOUD_PATH + 'v1/tickets/')
    .set('Content-Type', 'application/json')
    .send({
      creator
    })
    .end((err, res) => {
      if(err || res.status !== 200){
        debug(err)
        return callback(new Error('get tickets error')) 
      } 
      return callback(null, res.body.data)
    })
}

let requestConfirm = (state, guid, ticketId, callback) => {
  // state binding or unbinding
  request
    .post(CONFIG.CLOUD_PATH + 'v1/wx/' + (state ? 'binding' : 'unbinding'))
    .set('Content-Type', 'application/json')
    .send({
      ticketId
    })
    .end((err, res) => {
      if(err || res.status !== 200){
        debug(err)
        return callback(new Error('confirm error')) 
      }
      return callback(null, res.body.data)
    })
}


let requestConfirmAsync = Promise.promisify(requestConfirm)


let confirmTicketAsync = async (ticketId, id, useruuid, state) => {
  if(!state)
    return await requestConfirmAsync(state, id, ticketId)
  let u = User.findUser(useruuid)
  let ticket = await getTicketAsync(ticketId)

  if(ticket.type === 2 && u.global)
    throw new Error('user has already bind')  
  if(ticket.type === 1){//share register new local 
    
    let index = ticket.users.findIndex(u => u.id === id) 
    if (index === -1) throw new Error('user not found')
    await requestConfirmAsync(state, id, ticketId)
    return await User.createUserAsync({ 
                        username: '',
                        password: '',
                        global:{
                          id: id,
                          wx: [ticket.userData.unionid]
                        }
                      })            
  }else if(ticket.type === 2){//binding
    if (ticket.userData.id !== id) throw new Error('user not found')
    await requestConfirmAsync(state, id, ticketId)
    debug(ticket)
    return await User.updateUserAsync(useruuid, {
      global: {
        id: id,
        wx: [ticket.userData.unionid]
      }
    })
  }
}

module.exports = {
  createTicket,
  getTicket,
  getTicketAsync,
  requestConfirmAsync,
  confirmTicketAsync
}
