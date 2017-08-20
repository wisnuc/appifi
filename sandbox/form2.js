const path = require('path')
const app = require('express')()
const formidable = require('formidable')
const mkdirp = require('mkdirp')
const UUID = require('uuid')

const cwd = process.cwd()

app.post('/', (req, res) => {

  if (!req.is('multipart/form-data')) return res.status(415).end()

  let form = new formidable.IncomingForm() 

  let ended = false
  let aborted = false
  let finished = false

  // all field 
  form.on('field', (name, value) => {
    console.log('field', name, value)
    if (finished) return

    mkdirp(dirPath, err => {
      if (finished) return
      if (err) {
        finished = true
        return res.status(500).end() 
      }

      if (count === 0) {
        finished = true
        return res.status(200).end()
      }
    })
  })

  form.onPart(part => {
     
  })

  // when form error, req is paused according to formidable doc
  // `A request that experiences an error is automatically paused`
  // which means end won't be fired unless resumed?
  form.on('error', err => {
    console.log('error', err)
    if (finished) return 
    finished = true
    res.status(500).json({ code: err.code, message: err.message })
  })

  form.on('aborted', () => {
    console.log('aborted')
    if (finished) return
    finished = true
  })

  form.on('end', () => {
    console.log('end')
    if (finished) return

    ended = true
    if (count === 0) {
      finished = true
      if (error)
        res.status(err.status || 500).end()
      else
        res.status(200).end()
    }
  })

  form.parse(req)
})

mkdirp('tmptest', err => {
  if (err) return process.exit(1)
  app.listen(12345, () => console.log('listening on port 12345'))
})

