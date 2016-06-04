/*

Docker State

1. top state: daemon started, daemon stopped

1.1 daemon started

this.status > 0
this.daemon !== null
this.eventListener !== null // returned from dockerEventsAgent, a dockeragent instance
this.tasks = []

1.2 daemon stopped

this.status === 0
this.daemon = {
    pid: integer, // docker daemon pid
    volume: uuid, // volume running docker daemon 
  }
this.eventListener === null
this.tasks = [] // length 0..n

2. state transition

daemonStart or init (detected running), but NOT spontaneous (TODO)
daemonStop or spontaneous (daemon die) 

daemonStart is an operation, except the initial detection there is no event to trigger state transition.

daemonStop is an operation, and eventListener disconnect is the event.

event is the action (according to definition in TLA) but operation is not.

3. task

task is defined with a common interface, like a base class

3.1 basic info

parent, type, id, status, error, message, display() 

example:

  type = 'appInstall'
  id = 'signature' // if not appname
  status = 'started' or 'stopped'
  
  errno = errno
  message = message

  getState() => combine above info with _getState()  

4. event flow

4.1 source: eventlistener 

a) trigger update
b) trigger stop / reset

4.2 source: tasks

a) trigger status count increment

5. delayed update

*/

import request from 'superagent'
import { containersToApps } from 'lib/dockerApps'

const dockerUrl = 'http://127.0.0.1:1688'

function info(text) {
  console.log(`[docker state] ${text}`)
}


class DockerState {

  constructor() {
   
    this.status = 0
    this.daemon = null
    this.tasks = []
    this.state = null
    this.apps = null
    this.stateListeners = []
  }

  attach(daemon) {

    if (this.status > 0) return
    if (daemon.events === null) return

    daemon.events.on('update', state => {
      this.state = state
      this.apps = containersToApps(state.containers)
      this.status++ 
      this.stateListeners.forEach(l => l(state))
    })

    daemon.events.on('close', () => {
      this.reset()  
      this.stateListeners.forEach(l => l(null))
    })

    this.daemon = daemon
    info(`daemon attached`)
  }

  reset() {

    this.tasks.forEach(t => t.abort())

    if (this.daemon && this.daemon.events)
      this.daemon.events.abort()

    this.status = 0,
    this.daemon = null
    this.tasks = []
    this.state = null
    this.apps = null
  }

  addTask(task) {

    if (this.status === 0) return
    task.on('update', () => { 
      console.log(task.getState())
      this.status++  
    })
    task.on('end', () => { this.status++ })
    this.tasks.push(task)
    this.status++
  }

  removeTask(task) {

    if (this.status === 0) return

    let idx = this.tasks.indexOf(task)
    if (idx < 0) return

    this.tasks.splice(idx, 1)
    task.on('update', () => {})
    task.on('end', () => {})
    this.status++
  }

  getState() {

    if (this.status === 0) 
      return {
        status: 0,
        daemon: null,
        tasks: [],
        state: null,
        apps: null
      }

    return Object.assign({}, 
      this.state,
      {
        status: this.status,
        daemon: {pid: this.daemon.pid, volume: this.daemon.volume},
        tasks: this.tasks.map(t => t.facade()),
        apps: this.apps.map(app => 
          Object.assign({}, app, {
            containersId: app.containers.map(c => c.Id)
          }))
      }) 
  }

  getStatus() {
    return {status: this.status}
  }

  addStateListener(l) {
    this.stateListeners.push(l)
  }

  // NOTFOUND, INSTALLED, INSTALLING, UNAVAIL, TODO maybe BROKEN in future?
  appStatus(recipeKeyString) {

    if (this.status <= 0) return 'UNAVAIL'
    if (this.state === null || (!this.state.containers)) return 'UNAVAIL'

    let app = this.apps.find(app => app.recipeKeyString === recipeKeyString)

    if (app)
      return 'INSTALLED'

    if (this.tasks.find(t => t.type === 'appInstall' && t.id === key))
      return 'INSTALLING'

    return 'NOTFOUND'
  }
}


export default DockerState


