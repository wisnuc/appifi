const Router = require('express').Router

const tickets = require('../lib/tickets')

let router = Router()

//TODO authentication
//create
router.post('/', (req, res) => {
  tickets.createTicket((err, resp) => {
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

//create LA <-> WA
router.post('/wechat/:ticketId', (req, res) => {

})
module.exports = router