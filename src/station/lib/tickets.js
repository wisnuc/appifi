const Promise = require('bluebird')
const debug = require('debug')('station')
const request = require('superagent')
const requestAsync = require('./request').requestHelperAsync

const User = require('../../models/user') 

const { FILE, CONFIG } = require('./const')

const TICKET_TYPES = ['invite', 'bind', 'share']
Object.freeze(TICKET_TYPES)

class Tickets {
  constructor(saId, connect) {
    this.saId = undefined
    this.connect = connect
  }

  async createTicketAsync(userId, type) {
    let u = User.findUser(userId)
    if(!u) throw new Error('user not found')
    if(TICKET_TYPES.indexOf(type) === -1) throw new Error('ticket type error')
      //TODO: remove check
    // if(type !== 'bind' && (!u.global || u.global.id === undefined)) throw new Error('user not bind wechat')
    // let creator = type === 'bind' ? u.uuid : u.global.id
    let creator = u.uuid
    let stationId = this.saId
    let token = this.connect.token
    let data = '123456'
    let params = { stationId, data, creator, type }
    let url = CONFIG.CLOUD_PATH + 'v1/tickets'
    let opts = { 'Content-Type': 'application/json', 'Authorization': token}
    try{
      let res = await requestAsync('POST', url, { params }, opts)
      if(res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    }catch(e){
      debug(e)
      throw new Error('create ticket error')
    }
  }

  async getTicketAsync(ticketId) {
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId
    let token = this.connect.token
    let opts = { 'Content-Type': 'application/json', 'Authorization': token}
    try {
      let res = await requestAsync('GET', url, {}, opts)
      if(res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (e) {
      debug(e)
      throw new Error('get ticket error')
    }
  }

  async getTicketsAsync(userId) {
    let u = User.findUser(userId)
    //TODO: remove check
    // if(!u.global || !u.global.id) throw new Error('user has not bind wechat account')
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/'
    //TODO: use localId tmp
    // let creator = u.global.id
    let creator = u.uuid
    let token = this.connect.token
    let query = { creator }
    let opts = { 'Content-Type': 'application/json', 'Authorization': token}
    try {
      let res = await requestAsync('GET', url, { query }, opts)
      if(res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (e) {
      debug(e)
      throw new Error('get ticket error')
    }
  }

  async _discardTicketAsync(ticketId) {
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId
    let token = this.connect.token
    let opts = { 'Content-Type': 'application/json', 'Authorization': token}
    let params = { status: 1 } // TODO change ticket status
    try {
      let res = await requestAsync('PATCH', url, { params }, opts)
      if(res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (error) {
      debug(error)
      throw new Error('discard ticket error')
    }
  }

  async _changeUserTypeAsync(guid, ticketId, state) {
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId + '/users/' + guid
    let token = this.connect.token
    let opts = { 'Content-Type': 'application/json', 'Authorization': token}
    let params = { type: (state ? 'resolve' : 'reject') } // TODO change ticket status
    try {
      let res = await requestAsync('PATCH', url, { params }, opts)
      if(res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (error) {
      debug(error)
      throw new Error('change ticket->user type error')
    }
  }

  async consumeTicket(userId, id, ticketId, state) {
    // if(!state) return await this.discardTicketAsync(ticketId)
    let u = User.findUser(userId)
    let ticket = await this.getTicketAsync(ticketId)
    if(!ticket) throw new Error('no such ticket')
    if(ticket.type === 'bind' && u.global) throw new Error('user has already bind')
    let index = ticket.users.findIndex(u => u.userId === id) 
    if (index === -1) throw new Error('wechat user not found')
    debug(ticket)
    let user = ticket.users[index]
    let unionid = user.unionId
    if(!unionid) throw new Error('wechat unionid not found')
    switch(ticket.type) {
      case 'invite':{
        //TODO: confirm userList 
        await this._changeUserTypeAsync(id, ticketId, state)
        //discard this ticket 
        await this._discardTicketAsync(ticketId)
        if(state){
          let username = user.nickName
        // TODO: use pvKey decode password
          let password = user.password ? user.password : '123456'
          return await User.createUserAsync({ 
                            username,
                            password,
                            global:{
                              id,
                              wx: [unionid]
                            }
                          })
        }
      }
        break
      case 'bind':{
        await this._changeUserTypeAsync(id, ticketId, state)
        //discard this ticket 
        await this._discardTicketAsync(ticketId)
        if(state){
          return await User.updateUserAsync(useruuid, {
            global: {
              id,
              wx: [unionid]
            }
          })
        }
      }
        break
      default:
        break
    }
  }
}

module.exports.Tickets = Tickets
module.exports.TICKET_TYPES = TICKET_TYPES
