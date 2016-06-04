import request from 'superagent'
import { HttpStatusError } from 'lib/error'

const dockerUrl = 'http://127.0.0.1:1688'


// return err
async function containerStart(id) {

  return new Promise((resolve, reject) => 
    request.post(`${dockerUrl}/containers/${id}/start`)
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) return resolve (err)
        
        /*  see api doc, v1.23
            204 no error
            304 container already started
            404 no such container
            500 server error */
        if (res.statusCode === 204 || res.statusCode === 304) 
          return resolve(null)

        resolve(new HttpStatusError(res.statusCode))
      }))
}

// return err
async function containerStop(id) {

  return new Promise((resolve, reject) => 
    request.post(`${dockerUrl}/containers/${id}/stop`)
      .set('Accept', 'application/json')
      .end((err, res) => {

        if (err) return resolve (err)
        
        /*  see api doc, v1.23
            204 no error
            304 container already started
            404 no such container
            500 server error */

        if (res.statusCode === 204 || res.statusCode === 304) 
          return resolve(null)

        resolve(new HttpStatusError(res.statusCode))
      }))
}

// return err
async function containerCreate(option) {

  return new Promise((resolve, reject) => {
    request
      .post(`${dockerUrl}/containers/create`)
      .set('Accept', 'application/json')
      .send(option)
      .end((err, res) => {
        if (err) {
          resolve(err)
        }
        else {
          resolve(res.body)
        }
      })
  })
}

// return err
async function containerDelete(id) {

  return new Promise((resolve, reject) => {
    request
      .del(`${dockerUrl}/containers/${id}?force=true`)
      .end((err, res) => {

        if (err) return resolve(err);    

      /* api doc
        204 no error
        400 bad parameter
        404 no such container
        500 server error */

        if (res.statusCode === 204) return resolve(null)
        resolve(new HttpStatusError(res.statusCode))
      })
  })
}

export { 
  containerStart, 
  containerStop,
  containerCreate,
  containerDelete,
}

