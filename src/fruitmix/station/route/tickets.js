const Router = require('express').Router

const tickets = require('../lib/tickets')

let router = Router()

//TODO authentication
//create
router.post('/', (req, res) => {
  let user = req.user
  let type = req.body.type
  tickets.createTicket(user, req.body.sa, type, (err, resp) => {
    if(err) return res.status(500).json(err)
    return res.status(200).json(resp)
  })
})

//confirm
router.get('/:ticketId', (req, res) => {
  tickets.getTicket(req.params.ticketId, (err, data) => {
    if(err) return res.status(500).json(err)
    return res.status(200).json(data)
  })
})

router.get('/', (req, res) => {
  
})

//  1, get ticket
//  2, create user
//  3, LA <--> WA

router.post('/wechat/:ticketId', (req, res) => {
  let guid = req.body.userid
  let state = req.body.state



})
module.exports = router