const Router = require('express').Router
const debug = require('debug')('station')

const Tickets = require('../lib/tickets')
const Asset = require('../../lib/assertion')
const E = require('../../lib/error')

let router = Router()

//TODO authentication
//create
// type(string) enum [invite, bind, share]

const TYPES = ['invite', 'bind', 'share']
Object.freeze(TYPES)

router.post('/', (req, res) => {
  let user = req.user
  let type = req.body.type
  // console.log(user, type)

  if(typeof type !== 'string' || TYPES.indexOf(type) === -1)
    return res.status(400).json(new E.EINVAL())
  Tickets.createTicketAsync(user.uuid, type)
    .then(data => {
      return res.status(200).json(data)
    })
    .catch(err => {
      debug(err)
      return res.status(500).json(err.message)
    })
})

//confirm
router.get('/:ticketId', (req, res) => {
  Tickets.getTicketAsync(req.params.ticketId)
    .then(data => {
      debug(data)
      if(data.users)
        return res.status(200).json(data.users)
      return res.status(200).json([])
    })
    .catch(e => {
      debug(e)
      return res.status(500).json(e.message)
    })
})

//get all tickets 
router.get('/', (req, res) => {
  Tickets.getTicketsAsync(req.user.uuid)
    .then(data => {
      return res.status(200).json(data)
    })
    .catch(e => {
      debug(e)
      return res.status(500).json(e.message)
    })
})

//  1, get ticket
//  2, create user
//  3, LA <--> WA

router.post('/wechat/:ticketId', (req, res) => {
  let guid = req.body.guid
  let state = req.body.state
  let user = req.user
  if(!Asset.isUUID(guid) || typeof state !== 'boolean')
    return res.status(400).json(new E.EINVAL())
  Tickets.consumeTicket(user.uuid, guid, req.params.ticketId, state)
    .then(data => {
      return res.status(200).json(data)
    })
    .catch(e => {
      debug(e)
      return res.status(500).json(e.message)
    })
})

module.exports = router