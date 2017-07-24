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

  init(sa) {
    this.sa = sa
    this.initialized = true
  }

  deinit() {
    this.sa = undefined
    this.initialized = false
  }

  async createTicketAsync(userId, type) {
    if(!this.initialized) throw new Error('Ticket module not initialized!')
    if(!this.sa) throw new Error('station sa not found')
    let u = User.findUser(userId)
    if(!u) throw new Error('user not found')
    if(TYPES.indexOf(type) === -1) throw new Error('ticket type error')
      //TODO:
    // if(type !== 'bind' && (!u.global || u.global.id === undefined)) throw new Error('user not bind wechat')
    // let creator = type === 'bind' ? u.uuid : u.global.id
    let creator = u.uuid
    let stationId = this.sa.id
    let data = '123456'
    let params = { stationId, data, creator, type }
    let url = CONFIG.CLOUD_PATH + 'v1/tickets'
    let opts = { 'Content-Type': 'application/json'}
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
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId
    let opts = { 'Content-Type': 'application/json'}
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
    let u = User.findUser(userId)
    //TODO:
    // if(!u.global || !u.global.id) throw new Error('user has not bind wechat account')
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/'
    //TODO:
    // let creator = u.global.id
    let creator = u.uuid
    let query = { creator }
    let opts = { 'Content-Type': 'application/json'}
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
    let url = CONFIG.CLOUD_PATH + 'v1/tickets/' + ticketId
    let opts = { 'Content-Type': 'application/json'}
    let params = { status: 1 } // TODO change ticket status
    try {
      let res = await requestAsync('PATCH', url, { params }, opts)
      if(res.status === 200)
        return res.body.data
      debug(res.body)
      throw new Error(res.body.message)
    } catch (error) {
      debug(e)
      throw new Error('discard ticket error')
    }
  }

  async bindUser(userId, id, ticketId, state) {
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
    let unionid = ticket[index].unionid
    if(!unionid) throw new Error('wechat unionid not found')
    switch(ticket.type) {
      case 'invite':{
        return await User.createUserAsync({ 
                          username: '',
                          password: '',
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
