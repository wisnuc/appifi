import request from 'superagent'
import Debug from 'debug'
const DOCKER_API = Debug('APPIFI:DOCKER_API')

import { HttpStatusError } from '../../lib/error'
import DefaultParam from '../../lib/defaultParam'

class DockerAPI {
  constructor() {
    let getDockerURL = new DefaultParam().getDockerURL()
    this.dockerURL = `${getDockerURL.protocol}://${getDockerURL.ip}:${getDockerURL.port}`
    DOCKER_API('Docker URL: ', this.dockerURL)
  }

  // return err
  async containerStart(id) {

    try {
      let result = await request.post(`${this.dockerURL}/containers/${id}/start`)
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
  async containerStop(id) {

    try {
      let result = await request.post(`${this.dockerURL}/containers/${id}/stop`)
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
  async containerCreate(option) {

    try {
      let result = await request.post(`${this.dockerURL}/containers/create`)
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
  async containerDelete(id) {

    try {
      let result = await request.del(`${this.dockerURL}/containers/${id}?force=true`)

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
}

const dockerAPI = new DockerAPI()
const containerStart = async (id) => dockerAPI.containerStart(id)
const containerStop = async (id) => dockerAPI.containerStop(id)
const containerCreate = async (option) => dockerAPI.containerCreate(option)
const containerDelete = async (id) => dockerAPI.containerDelete(id)  

export { 
  containerStart, 
  containerStop,
  containerCreate,
  containerDelete,
}