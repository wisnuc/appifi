const Router = require('express').Router
const debug = require('debug')('station')

const TICKET_TYPES = require('../lib/tickets').TICKET_TYPES
const Asset = require('../../lib/assertion')
const E = require('../../lib/error')

let router = Router()

router.post('/', (req, res, next) => {
  let user = req.user
  let type = req.body.type
  // console.log(user, type)

  if(typeof type !== 'string' || TICKET_TYPES.indexOf(type) === -1)
    return res.status(400).json(new E.EINVAL())
  req.Tickets.createTicketAsync(user.uuid, type)
    .then(data => {
      return res.status(200).json(data)
    })
    .catch(next)
})

//confirm
router.get('/:ticketId', (req, res, next) => {
  req.Tickets.getTicketAsync(req.params.ticketId)
    .then(data => {
      debug(data)
      if(data.users)
        return res.status(200).json(data.users)
      return res.status(200).json([])
    })
    .catch(next)
})

//get all tickets 
router.get('/', (req, res, next) => {
  req.Tickets.getTicketsAsync(req.user.uuid)
    .then(data => {
      return res.status(200).json(data)
    })
    .catch(next)
})

//  1, get ticket
//  2, create user
//  3, LA <--> WA

router.post('/wechat/:ticketId', (req, res, next) => {
  let guid = req.body.guid
  let state = req.body.state
  let user = req.user
  if(!Asset.isUUID(guid) || typeof state !== 'boolean')
    return res.status(400).json(new E.EINVAL())
  req.Tickets.consumeTicket(user.uuid, guid, req.params.ticketId, state)
    .then(data => {
      return res.status(200).json(data)
    })
    .catch(next)
})

module.exports = router