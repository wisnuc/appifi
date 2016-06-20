import events from 'events'
import request from 'superagent'
import dockeragent from './dockeragent'

const dockerUrl = 'http://127.0.0.1:1688'

function dockerApiGet(url) {
  return new Promise((resolve, reject) => 
    request.get(dockerUrl + url)
      .set('Accept', 'application/json')
      .end((err, res) => err ? reject(null) : resolve(res.body)))
}

/*
 * should return state TODO
 */ 
async function probeDockerState() {

  const containersUrl = '/containers/json?all=1'
  const imagesUrl = '/images/json'
  const infoUrl = '/info'
  const versionUrl = '/version'
  const volumesUrl = '/volumes'
  const networksUrl = '/networks'

  let r = await Promise.all([
    dockerApiGet(containersUrl),
    dockerApiGet(imagesUrl),
    dockerApiGet(infoUrl),
    dockerApiGet(versionUrl),
    dockerApiGet(volumesUrl),
    dockerApiGet(networksUrl)
  ])

  // TODO 
  // let cd = await Promise.all(r[0].map(c => dockerApiGet(`/containers/${c.
  let id = await Promise.all(r[1].map(img => dockerApiGet(`/images/${img.Id.slice(7)}/json`)))

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

/*
 * agent or null
 */
async function dockerEventsAgent() {

  return await new Promise((resolve) => // TODO never reject?
    dockeragent.get('/events', (e, r) => 
      e ? resolve(null) : resolve(r)))
}

/*
 * important class, wrap timeout and probeDockerState
 */ 
class DockerEvents extends events {
  
  constructor(agent, interval) {
    super()

    if (!interval) interval = 300

    this.timeout = null
    this.agent = agent 

    agent.on('json', () => {
      if (this.timeout) clearTimeout(this.timeout)
      this.timeout = setTimeout(() => {
        if (agent.aborted || agent.closed) return
        this.probe()
      }, interval)
    })

    agent.on('close', () => {
      if (this.timeout) clearTimeout(this.timeout)
      this.emit('end')
    })

    // initial update
    this.probe()
  }

  probe() {
    probeDockerState()
      .then(state => {
        if (this.agent.aborted || this.agent.closed) return
        this.emit('update', state)
      })
  }

  abort() {
    if (this.timeout) clearTimeout(this.timeout)
    if (this.agent) this.agent.abort()
  }
}

export { dockerEventsAgent, DockerEvents }
