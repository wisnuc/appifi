import { store } from 'lib/reducers'

let state = null
let status = 0

store.subscribe(() => {
  status++ 
})

const appStoreFacade = (appstore) => {

  if (appstore === null ||
      appstore === 'ERROR' ||
      appstore === 'LOADING') {
    return appstore
  }

  let { recipes, repoMap } = appstore
  if (!repoMap) {
    return recipes
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

  return appended
}

const dockerFacade = (docker) => {
  
  if (!docker) return null
  
  let facade = {}
  facade.pid = docker.pid
  facade.volume = docker.volume
  
  if (docker.data) {
    facade = Object.assign({}, facade, docker.data, docker.computed)
  }

  return facade
}

const facade = () => {

  return {
    status,
    storage: store.getState().storage,
    docker: dockerFacade(store.getState().docker),
    appstore: appStoreFacade(store.getState().appstore),
    tasks: []
  } 
}

export default {

  status: () => {
    return { status }
  },

  get: () => {
    let f = facade()
    console.log(f)
    return f
  },
  
  post: () => {
  } 
}

console.log('server module initialized')
