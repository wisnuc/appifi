const Promise = require('bluebird')
const debug = require('debug')('station')
const request = require('superagent')
const requestAsync = require('./request').requestHelperAsync

const User = require('../../models/user') 

const { FILE, CONFIG } = require('./const')

const TYPES = ['invite', 'bind', 'share']
Object.freeze(TYPES)

class Ticket {
  constructor() {
    this.sa = undefined
    this.initialized = false
  }

  init(sa, conn) {
    this.sa = sa
    this.conncet = conn 
    this.initialized = true
  }

  deinit() {
    this.sa = undefined
    this.connect = undefined
    this.initialized = false
  }

  async createTicketAsync(userId, type) {
    if(!this.initialized) throw new Error('Ticket module not initialized!')
    if(!this.conncet || !this.conncet.isConnected()) throw new Error('station connect error')
    if(!this.sa) throw new Error('station sa not found')
    let u = User.findUser(userId)
    if(!u) throw new Error('user not found')
    if(TYPES.indexOf(type) === -1) throw new Error('ticket type error')
      //TODO: remove check
    // if(type !== 'bind' && (!u.global || u.global.id === undefined)) throw new Error('user not bind wechat')
    // let creator = type === 'bind' ? u.uuid : u.global.id
    let creator = u.uuid
    let stationId = this.sa.id
    let token = this.conncet.token
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
    if(!this.initialized) throw new Error('Ticket module not initialized')
    if(!this.conncet || !this.conncet.isConnected()) throw new Error('station connect error')
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId
    let token = this.conncet.token
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
    if(!this.initialized) throw new Error('Ticket module not initialized')
    if(!this.conncet || !this.conncet.isConnected()) throw new Error('station connect error')
    let u = User.findUser(userId)
    //TODO: remove check
    // if(!u.global || !u.global.id) throw new Error('user has not bind wechat account')
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/'
    //TODO: use localId tmp
    // let creator = u.global.id
    let creator = u.uuid
    let token = this.conncet.token
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

  async discardTicketAsync(ticketId) {
    if(!this.initialized) throw new Error('Ticket module not initialized')
    if(!this.conncet || !this.conncet.isConnected()) throw new Error('station connect error')
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId
    let token = this.conncet.token
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

  async consumeTicket(userId, id, ticketId, state) {
    if(!this.conncet || !this.conncet.isConnected()) throw new Error('station connect error')
    if(!this.initialized) throw new Error('Ticket module not initialized')
    if(!state) return await this.discardTicketAsync(ticketId)
    let u = User.findUser(userId)
    let ticket = await this.getTicketAsync(ticketId)
    if(ticket.type === 'bind' && u.global) throw new Error('user has already bind')
    let index = ticket.users.findIndex(u => u.userId === id) 
    if (index === -1) throw new Error('wechat user not found')
    // discard this ticket 
    await this.discardTicketAsync(ticketId)

    debug(ticket)
    let user = ticket.users[index]
    let unionid = user.unionid
    if(!unionid) throw new Error('wechat unionid not found')
    switch(ticket.type) {
      case 'invite':{
        let username = user.nickName
        // TODO: use pvKey decode password
        let password = user.password
        return await User.createUserAsync({ 
                          username,
                          password,
                          global:{
                            id,
                            wx: [unionid]
                          }
                        })
      }
        break
      case 'bind':{
        return await User.updateUserAsync(useruuid, {
          global: {
            id,
            wx: [unionid]
          }
        })
      }
        break
      default:
        break
    }
  }
}

module.exports = new Ticket()