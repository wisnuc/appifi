const dockerUrl = 'http://127.0.0.1:1688'

async function containerStart(id) {

  return new Promise((resolve, reject) => 
    request.post(`${dockerUrl}/containers/${id}/start`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        err ? reject(err) : resolve(res.statusCode)
      }))
}

async function containerStop(id) {

  return new Promise((resolve, reject) => 
    request.post(`${dockerUrl}/containers/${id}/stop`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        err ? reject(err) : resolve(res.statusCode)
      }))
}

async function containerCreate(option) {

  return new Promise((resolve, reject) => {
    request
      .post(`${dockerUrl}/containers/create`)
      .set('Accept', 'application/json')
      .send(option)
      .end((err, res) => {
        if (err) {
          if (err.status === 404) 
            return resolve(null)
          else
            return reject(err.status) 
        }
        else {
          resolve(res.body)
        }
      })
  })
}

async function containerDelete(id) {

  return new Promise((resolve, reject) => {
    request
      .del(`${dockerUrl}/containers/${id}`)
      .end((err, res) => {
        err ? reject(err.status) : resolve(null)
      })
  })
}

export { 
  containerStart, 
  containerStop,
  containerCreate,
  containerDelete,
}

