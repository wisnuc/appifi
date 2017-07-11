const Router = require('express').Router

const tickets = require('../lib/tickets')

let router = Router()

//TODO authentication
//create
router.post('/', (req, res) => {
  let user = req.user
  tickets.createTicket(user, (err, resp) => {
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


// 1, get ticket
// 2, create user
// 3, LA <--> WA

router.post('/wechat/:ticketId', (req, res) => {
  
})
module.exports = router