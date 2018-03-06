const path = require('path')
const app = require('express')()
const formidable = require('formidable')
const mkdirp = require('mkdirp')
const UUID = require('uuid')

const cwd = process.cwd()

app.post('/', (req, res) => {

  console.log(req.headers)

  if (!req.is('multipart/form-data')) return res.status(415).end()

  let form = new formidable.IncomingForm() 

  let finished = false

  let formfinished = false

  let fileFinished = false
  let body, error

  let filePath
  let size

  const finalize = () => {
    if (finished) return
    if (formFinished && fileFinished) {
      finished = true
      if (error) 
        res.status(500).end()
      else
        res.status(200).json(body)
    }
  }

  form.on('field', (name, value) => {
    console.log('field', name, value)
    if (finished) return

    if (name === 'size') {
      size = parseInt(value)
      // if ('' + size === value)
    }
  })

  form.on('fileBegin', (name, file) => {
    console.log('fileBegin', name, file)
    if (finished) return

    if (!Number.isInteger(size)) {
      finished = true
      res.status(409).end()
      return
    }
   
    filePath = path.join(cwd, 'tmptest', UUID.v4()) 
    file.path = filePath
  })

  form.on('file', (name, file) => {
    console.log('file', file)
    if (finished) return

    if (!Number.isInteger(size) || size !== file.size) {
      finished = true
      res.status(409).end()
      return
    }

    // set body & error
    setTimeout(() => {
      if (finished) return

      fileFinished = true
      body = { hello: 'hello' }
      finalize()
    }, 10)
  })

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
    formFinished = true
    finalize()
  })

  form.parse(req)
})

mkdirp('tmptest', err => {
  if (err) return process.exit(1)
  app.listen(12345, () => console.log('listening on port 12345'))
})

