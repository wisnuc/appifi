import EventEmitter from 'events'

import deepmerge from 'deepmerge'
import UUID from 'node-uuid'

import { storeState } from '../reducers'
import pullImage from './pullImage'
import { containerCreate, containerStart } from './dockerApi'
import containerCreateDefaultOpts from './containerDefault'

import { calcRecipeKeyString, installAppifiLabel } from './dockerApps'
function info(text) {
  console.log(`[docker task] ${text}`)
}

class Task extends EventEmitter {

  constructor(type, id, parent) {
    super()
    this.parent = parent
    this.type = type
    this.id = id
    this.status = 'started'
    this.errno = 0
    this.message = null
   
    /** must implement getState() **/
  }

  getState() {
    return {}
  }

  // brilliant name
  facade() {
    return Object.assign({
      type: this.type,
      id: this.id,
      status: this.status,
      errno: this.errno,
      message: this.message,
    }, this.getState())
    
  }
}

class ImageCreateTask extends Task {

  constructor(name, tag, parent) {

    super('imageCreate', `${name}:${tag}`, parent)
    info(`imageCreate ${name}:${tag}`)
    this.data = null

    pullImage(name, tag, (e, agent) => {

      if (e) {
        this.status = 'stopped'
        this.errno = e.errno
        this.message = e.message
        
        info(`pullImage ${name}:${tag} failed (errno: ${e.errno}): ${e.message}`)
        this.emit('end')
      }
      else {
        this.agent = agent
        agent.on('update', state => {
          this.data = state
          this.emit('update')
        })

        agent.on('close', () => {
          if (this.aborting === true) {
            this.errno = 'ECONNABORTED'
          }
          else {
            this.errno = 0
          }
          this.status = 'stopped'
          this.agent = null
          this.emit('end')
        })
      }
    })  
  }

  getState() {
    return this.data
  }

  abort() {
    if (this.agent && this.status === 'started') {
      this.aborting = true
      this.agent.abort()
    }
  } 
}

class AppInstallTask extends Task {

  constructor(recipe, appdataDir) {

    info(`appInstall ${recipe.appname}`)
    super('appInstall', `${recipe.appname}`, null)

    this.recipe = recipe
    this.appdataDir = appdataDir
    this.id = calcRecipeKeyString(recipe)
    this.uuid = UUID.v4()
    this.jobs = recipe.components.map(compo => {
      
      let image = new ImageCreateTask(`${compo.namespace}/${compo.name}`, compo.tag, this)
      image.on('update', () => this.emit('update', this))
      image.on('end', () => {
        
        if (!this.jobs.every(job => {
        /*
          console.log('>>>>')
          console.log(job)
          console.log(job.image)
          console.log(job.image.getState())
          console.log('<<<<')
        */
          if (job.image.getState() === null) return false
          return job.image.getState().digest && job.image.getState().status ? true : false
        } )) {
          this.errno = -1
          this.message = 'pullImage failed'
          this.status = 'stopped'
          info(`appInstall ${this.recipe.appname} failed, pullImage failed`)
           
          return
        }

        this.createAndStartContainers()
          .then(e => {
            if (e) {
              this.errno = e.errno
              this.message = e.message
              console.error(e)
              info(`appInstall ${this.recipe.appname} failed`)
            }
            else {
              this.errno = 0
              this.message = null
              info(`appInstall ${this.recipe.appname} success`)
            }
            this.status = 'stopped'
            this.emit('end', this)
          })
          .catch(e => {
            this.errno = e.errno
            this.message = e.message
            this.status = 'stopped'
            info(`appInstall ${this.recipe.appname} failed (${e.errno}), ${e.message}`)
            this.emit('end', this) 
          })
      })

      return {
        compo: compo, 
        image: image,
        container: null
      }
    })
  }

  processBinds(recipeKeyString, opt) {

    if (!opt || !opt.HostConfig || !opt.HostConfig.Binds) return opt

    let subpath = recipeKeyString.replace(/:/g, '/') 
    opt.HostConfig.Binds = opt.HostConfig.Binds.map(bind => (this.appdataDir + '/' + subpath + bind))
    return opt
  }

  processPortBindings(recipeKeyString, opt) {
    return opt
  }

  // 
  async createAndStartContainers() {

    // in reverse order
    for (var i = this.jobs.length - 1; i >= 0; i--) {
      let job = this.jobs[i]
      let opt = deepmerge(containerCreateDefaultOpts(), job.compo.config)
      opt.Image = `${job.compo.namespace}/${job.compo.name}`
      opt = this.processBinds(this.id, opt)
      opt = this.processPortBindings(this.id, opt)     

      // opt.Labels['appifi-signature'] = this.id
      installAppifiLabel(opt.Labels, this.uuid, this.recipe)

      let re = await containerCreate(opt)
      if (re instanceof Error) {
        job.container = {
          errno: re.errno,
          message: re.message,
          result: null
        } 
        return re
      }
      
      job.container = {
        errno: 0,
        message: null,
        result: re
      }
    }

    let id = this.jobs[0].container.result.Id
    info(`starting container ${id}`)
    return containerStart(this.jobs[0].container.result.Id) 
  }

  getState() {

    let jobs = this.jobs.map(job => {
      return {
        image: job.image.facade(),
        container: job.container
      }
    })

    return {
      uuid: this.uuid,
      recipe: this.recipe,
      jobs
    } 
  }
}

export { AppInstallTask }

