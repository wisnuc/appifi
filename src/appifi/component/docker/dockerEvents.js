import events from 'events'
import request from 'superagent'
import Debug from 'debug'
const DOCKER_EVENTS = Debug('APPIFI:DOCKER_EVENTS')

import dockerAgent from './dockerAgent'
import DefaultParam from '../../lib/defaultParam'

/*
* agent or null
*/
const dockerEventsAgent = async () => {

  try {
    return dockerAgent.get('/events', (error) => {
      DOCKER_EVENTS(error)
    })
  }
  catch(error) {
    DOCKER_EVENTS('Unknown Error')
    return error
  }    
}

/*
 * important class, wrap timeout and probeDockerState
 */ 
class DockerEvents extends events {
  
  constructor(agent, interval) {
    super()

    let getDockerURL = new DefaultParam().getDockerURL()
    this.dockerURL = `${getDockerURL.protocol}://${getDockerURL.ip}:${getDockerURL.port}`
    DOCKER_EVENTS('Docker URL: ', this.dockerURL)

    if (!interval) {
      interval = 300
    }

    this.timeout = null
    this.agent = agent 

    agent.on('json', () => {

      if (this.timeout) {
        clearTimeout(this.timeout)
      }

      this.timeout = setTimeout(() => {
        if (agent.aborted || agent.closed) {
          return
        }

        this.probe()
      }, interval)
    })

    agent.on('close', () => {
      if (this.timeout) {
        clearTimeout(this.timeout)
      }

      this.emit('end')
    })

    // initial update
    this.probe()
  }

  async _dockerAPIGet(url) {
    try {
      let result = await request.get(this.dockerURL + url)
                                .set('Accept', 'application/json')

      DOCKER_EVENTS('Docker API Get Success: ', result.statusCode)
      return result.body
    }
    catch(error) {
      DOCKER_EVENTS('Docker API Get Error: ', error)
      return
    }
  }

  /*
  * should return state TODO
  */ 
  async probeDockerState() {

    const containersUrl = '/containers/json?all=1'
    const imagesUrl = '/images/json'
    const infoUrl = '/info'
    const versionUrl = '/version'
    const volumesUrl = '/volumes'
    const networksUrl = '/networks'

    let r = await Promise.all([
      this._dockerAPIGet(containersUrl),
      this._dockerAPIGet(imagesUrl),
      this._dockerAPIGet(infoUrl),
      this._dockerAPIGet(versionUrl),
      this._dockerAPIGet(volumesUrl),
      this._dockerAPIGet(networksUrl)
    ])

    // TODO 
    // let cd = await Promise.all(r[0].map(c => dockerApiGet(`/containers/${c.
    let id = await Promise.all(r[1].map(img => this._dockerAPIGet(`/images/${img.Id.slice(7)}/json`)))

    let state = {
      containers : r[0],
      images: r[1],
      imageDetails: id,
      info: r[2],
      version: r[3],
      volumes: r[4],
      networks: r[5]
    }

    return state
  }

  probe() {
    this.probeDockerState()
      .then(state => {
        if (this.agent.aborted || this.agent.closed) {
          return
        }

        this.emit('update', state)
      })
  }

  abort() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    if (this.agent) {
      this.agent.abort()
    }
  }
}

export { dockerEventsAgent, DockerEvents }
