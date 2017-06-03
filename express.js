const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const request = require('request')
const UUID = require('uuid')

const express = require('express')
const app = express()

const tmptest = path.join(process.cwd(), 'tmptest')
mkdirp.sync(tmptest)

app.put('/*', function (req, res) {

  let url = `http://localhost:4005/file?path=${path.join(tmptest, UUID.v4())}`
  let sidekick = request.put(url, (err, response, body) => {

    if (err) return res.status(500).end()
    if (response.statusCode !== 200) return res.status(500).end()
    
    console.log(body)

    res.status(200).end()
  })

  req.pipe(sidekick)
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
