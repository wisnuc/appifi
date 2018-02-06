const Promise = require('bluebird')
const debug = require('debug')('station')
const request = require('superagent')
const requestAsync = require('./request').requestHelperAsync

const getFruit = require('../../fruitmix')

const { FILE, CONFIG } = require('./const')

const TICKET_TYPES = ['invite', 'bind', 'share']
Object.freeze(TICKET_TYPES)

class Tickets {
  constructor(ctx) {
    this.saId = ctx.station.id
    this.ctx = ctx
  }

  async createTicketAsync(userId, type) {
    let fruit = getFruit()
    let u = fruit.findUserByUUID(userId)
    if (!u) throw new Error('user not found')
    if (TICKET_TYPES.indexOf(type) === -1) throw new Error('ticket type error')
    
    if(type !== 'bind' && (!u.global || u.global.id === undefined)) throw new Error('user not bind wechat')
    let creator = type === 'bind' ? u.uuid : u.global.id

    // FIXME: creator maybe guid if not bind
    // let creator = u.uuid
    let stationId = this.saId
    let token = this.ctx.token
    let data = 'placeholder'
    let params = { stationId, data, creator, type }
    let url = CONFIG.CLOUD_PATH + 's/v1/tickets'
    let opts = { 'Content-Type': 'application/json', 'Authorization': token }
    try {
      let res = await requestAsync('POST', url, { params }, opts)
      if (res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (e) {
      debug(e)
      throw new Error('create ticket error')
    }
  }

  async getTicketAsync(ticketId) {
    let url = CONFIG.CLOUD_PATH + 's/v1/tickets/' + ticketId
    let token = this.ctx.token
    let opts = { 'Content-Type': 'application/json', 'Authorization': token }
    try {
      let res = await requestAsync('GET', url, {}, opts)
      if (res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (e) {
      debug(e)
      throw new Error('get ticket error')
    }
  }

  async getTicketsAsync(userId) {
    let fruit = getFruit()
    let u = fruit.findUserByUUID(userId)
    if(!u.global || !u.global.id) throw new Error('user has not bind wechat account')
    let url = CONFIG.CLOUD_PATH + 's/v1/tickets/'

    let creator = u.global.id
    let token = this.ctx.token
    let query = { creator }
    
    let opts = { 'Content-Type': 'application/json', 'Authorization': token }
    try {
      let res = await requestAsync('GET', url, { query }, opts)
      if (res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (e) {
      debug(e)
      throw new Error('get ticket error')
    }
  }

  async updateTicketAsync(ticketId) {
    let url = CONFIG.CLOUD_PATH + 's/v1/tickets/' + ticketId
    let token = this.ctx.token
    let opts = { 'Content-Type': 'application/json', 'Authorization': token }
    let params = { status: 1 } // TODO: change ticket status
    try {
      let res = await requestAsync('PATCH', url, { params }, opts)
      if (res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (error) {
      debug(error)
      throw new Error('discard ticket error')
    }
  }

  async updateUserTypeAsync(guid, ticketId, state) {
    let url = CONFIG.CLOUD_PATH + 's/v1/tickets/' + ticketId + '/users/' + guid
    let token = this.ctx.token
    let opts = { 'Content-Type': 'application/json', 'Authorization': token }
    let params = { type: (state ? 'resolved' : 'rejected') } // TODO change ticket status
    try {
      let res = await requestAsync('PATCH', url, { params }, opts)
      if (res.status === 200)
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
    let fruit = getFruit()
    let u = fruit.findUserByUUID(userId)
    let ticket = await this.getTicketAsync(ticketId)
    if (!ticket) throw new Error('no such ticket')
    if (ticket.type === 'bind' && u.global) throw new Error('user has already bind')
    let index = ticket.users.findIndex(u => u.id === id)
    if (index === -1) throw new Error('wechat user not found')
    debug(ticket)

    // refuse
    if(!state) return await this.updateUserTypeAsync(id, ticketId, false)

    if(fruit.getUsers().find(u => !!u.global && u.global.id === id)) throw new Error('this wechat has already bind another user')
    let user = ticket.users[index]
    let unionid = user.unionId
    if (!unionid) throw Object.assign(new Error('wechat unionid not found'), { status: 401 })

    // All about confirm
    await this.updateUserTypeAsync(id, ticketId, true) 

    switch (ticket.type) {
      case 'invite': { 
        let username = user.nickName
        // TODO: use pvKey decode password
        let password = user.password ? user.password : '123456'
        return await fruit.createUserAsync(u, {
          username,
          password,
          global: {
            id,
            wx: [unionid]
          }
        })
      }
        break
      case 'bind': {
        //discard this ticket 
        return await fruit.updateUserGlobalAsync(u, userId, {
          global: {
            id,
            wx: [unionid]
          }
        })
      }
        break
      case 'share': {
        if(!ticket.data) throw new Error('ticket data error')
        let boxUUID
        try{
          boxUUID = JSON.parse(ticket.data).boxId
        }catch(e) {
          debug(e)
          throw e
        }
        let props = {
          users: {
            op: 'add',
            value:[id]
          }
        }
        return await fruit.updateBoxAsync(u, boxUUID, props)
      }
        break
      default:
        break
    }
  }
}

module.exports.Tickets = Tickets
module.exports.TICKET_TYPES = TICKET_TYPES
