import { storeState, storeDispatch, storeSubscribe } from './reducers'
import { calcRecipeKeyString } from './dockerApps'
import { daemonStart, daemonStop, daemonStartOperation, containerStart, containerStop, containerDelete,
installedStart, installedStop, appInstall, appUninstall } from './docker'

let status = 0

storeSubscribe(() => {
  status++
  console.log(`[server] status updated: ${status}`)
})

const appstoreFacade = (appstore) => {

  if (appstore === null) return null

  if (appstore.status === 'LOADING') 
    return { status: 'LOADING' }

  if (appstore.status === 'ERROR')
    return { status: 'ERROR', code: appstore.code, message: appstore.message }

  let { recipes, repoMap } = appstore.result
  if (!repoMap) {
    return {
      status: 'LOADED',
      result: recipes
    }
  }

  // be careful. if recipes are cloned first, then cloned 
  // recipes' components won't be the key in the map any more !!!

  let appended = []

  recipes.forEach(recipe => {

    let components = []
    recipe.components.forEach(compo => {
      let repo = repoMap.get(compo)
      if (repo === undefined) repo = null
      components.push(Object.assign({}, compo, {repo}))
    })
    appended.push(Object.assign({}, recipe, {components}))
  }) 

  appended.forEach(recipe => recipe.key = calcRecipeKeyString(recipe)) 
  return {
    status: 'LOADED',
    result: appended
  }
}

const installedFacades = (installeds) => {

  if (!installeds) return null

  let facade = installeds.map(inst => Object.assign({}, inst, {
    container: undefined,
    containerIds: inst.containers.map(c => c.Id) 
  }))

  // remove containers property, dirty, is there a better way ??? TODO
  facade.forEach(f => f.containers = undefined)
  return facade
}

const dockerFacade = (docker) => {
  
  if (!docker) return null
  
  let facade = {}
  facade.pid = docker.pid
  facade.volume = docker.volume
  
  if (docker.data) {
    facade = Object.assign({}, facade, docker.data, { 
      installeds: installedFacades(docker.computed.installeds)
    })
  }

  return facade
}

const tasksFacade = (tasks) => {

  if (!tasks || !tasks.length) return [] 
  return tasks.map(t => t.facade())
}

const facade = () => {

  return {
    status,
    config: storeState().serverConfig,
    storage: storeState().storage,
    docker: dockerFacade(storeState().docker),
    appstore: appstoreFacade(storeState().appstore),
    tasks: tasksFacade(storeState().tasks)
  } 
}

const operationAsync = async (req) => {

  info(`operation: ${req.operation}`)

  let f, args

  if (req && req.operation) {
    
    args = (req.args && Array.isArray(req.args)) ? req.args : []

    switch (req.operation) {
    case 'daemonStart':
      f = daemonStartOperation
      break 
    case 'daemonStop':
      f = daemonStop
      break
    case 'containerStart':
      f = containerStart
      break
    case 'containerStop':
      f = containerStop
      break
    case 'containerDelete':
      f = containerDeleteCommand
      break
    case 'installedStart':
      f = installedStart
      break
    case 'installedStop':
      f = installedStop
      break
    case 'appInstall':
      f = appInstall
      break
    case 'appUninstall':
      f = appUninstall
      break
    default:
      info(`operation not implemented, ${req.operation}`)
    }
  }

  return f ? await f(...args) : null // TODO
}

export default {

  status: () => {
    return { status }
  },

  get: () => {
    let f = facade()
    return f
  },

  operation: (req) => {
    operationAsync(req)
      .then(r => callback(null)) 
      .catch(e => callback(e))
  }
}

console.log('server module initialized')




