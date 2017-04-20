import request from 'superagent'
import Debug from 'debug'
const DOCKER_API = Debug('APPIFI:DOCKER_API')

import { HttpStatusError } from '../../lib/error'
import DefaultParam from '../../lib/defaultParam'

let getDockerURL = new DefaultParam().getDockerURL()
const dockerURL = `${getDockerURL.protocol}://${getDockerURL.ip}:${getDockerURL.port}`
DOCKER_API('Docker URL: ', dockerURL)

// return err
const containerStart = async (id) => {

  try {
    let result = await request.post(`${dockerURL}/containers/${id}/start`)
                              .set('Accept', 'application/json')

    /*
      see api doc, v1.23
      204 no error
      304 container already started
      404 no such container
      500 server error
    */

    if(result.statusCode === 204 || result.statusCode === 304) {
      DOCKER_API('Start Success, statusCode: ', result.statusCode)
      return 
    }
    else {
      DOCKER_API('Start Failed, statusCode: ', result.statusCode)
      return new HttpStatusError(result.statusCode)
    }
  }
  catch(error) {
    DOCKER_API('Start Unknown Error, error: ', error)
    return error
  }
}

// return err
const containerStop = async (id) => {

  try {
    let result = await request.post(`${dockerURL}/containers/${id}/stop`)
                              .set('Accept', 'application/json')

    /*
      see api doc, v1.23
      204 no error
      304 container already started
      404 no such container
      500 server error
    */

    if(result.statusCode === 204 || result.statusCode === 304) {
      DOCKER_API('Stop Success, statusCode: ', result.statusCode)
      return 
    }
    else {
      DOCKER_API('Stop Failed, statusCode: ', result.statusCode)
      return new HttpStatusError(result.statusCode)
    }
  }
  catch(error) {
    // DOCKER_API('Stop Unknown Error, error: ', error)
    DOCKER_API('Stop Unknown Error')
    return error
  }
}

// return err
const containerCreate = async (option) => {

  try {
    let result = await request.post(`${dockerURL}/containers/create`)
                        .set('Accept', 'application/json')
                        .send(option)

    if(result.statusCode === 201) {
      DOCKER_API('Create Success, statusCode: ', result.statusCode)
      return result.body
    }
    else {
      DOCKER_API('Create Maybe Failed, statusCode: ', result.statusCode)
      return result.body
    }
  }
  catch(error) {
    DOCKER_API('Create Unknown Error, error: ', error)
    return error
  }
}

// return err
const containerDelete = async (id) => {

  try {
    let result = await request.del(`${dockerURL}/containers/${id}?force=true`)

    /*
      api doc
      204 no error
      400 bad parameter
      404 no such container
      500 server error
    */

    if(result.statusCode === 204) {
      DOCKER_API('Delete Success, statusCode: ', result.statusCode)
      return
    }
    else {
      DOCKER_API('Delete Failed, statusCode: ', result.statusCode)
      return new HttpStatusError(result.statusCode)
    }
  }
  catch(error) {
    DOCKER_API('Delete Unknown Error, error: ', error)
    return error
  }
}

export { 
  containerStart, 
  containerStop,
  containerCreate,
  containerDelete,
}

