const Router = require('express').Router

const Tickets = require('../lib/tickets')
const Asset = require('../../lib/assertion')
const E = require('../../lib/error')

let router = Router()

//TODO authentication
//create
router.post('/', (req, res) => {
  let user = req.user
  let type = req.body.type
  // console.log(user, type)
  if(typeof type !== 'number' || type < 0 || type > 2)
    return res.status(400).json(E.EINVAL())
  Tickets.createTicket(user, req.body.sa, type, (err, resp) => {
    if(err) return console.log(err) && res.status(500).json(err)
    return res.status(200).json(resp)
  })
})

//confirm
router.get('/:ticketId', (req, res) => {
  Tickets.getTicket(req.params.ticketId, (err, data) => {
    if(err) return console.log(err) && res.status(500).json(err)
    return res.status(200).json(data.userData)
  })
})

//get all tickets 
router.get('/', (req, res) => {

})

//  1, get ticket
//  2, create user
//  3, LA <--> WA

router.post('/wechat/:ticketId', async (req, res) => {
  let guid = req.body.guid
  let state = req.body.state
  let user = req.user
  if(!Asset.isUUID(guid) || typeof state !== 'boolean')
    return res.status(400).json(E.EINVAL())
  try{
    let newuser = await Tickets.confirmTicketAsync(req.params.ticketId, guid, user.uuid, state)
    return res.status(200).json(newuser)
  }catch(e){
    console.log(e)
    return res.status(500).json(e)
  }

})

module.exports = router