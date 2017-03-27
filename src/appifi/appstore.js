import Debug from 'debug'
import request from 'superagent'
import { storeState, storeDispatch } from './reducers'
import { validateRecipe, calcRecipeKeyString } from './dockerApps'

const debug = Debug('appifi:appstore')
const K = x => y => x
const useLocalRecipes = false // used for test, obsolete

function info(text) {
  console.log(`[appstore] ${text}`)
}

const getJsonRecipesUrl = () => {

  let url = (storeState().developer && storeState().developer.appstoreMaster === true) ?
    'https://raw.githubusercontent.com/wisnuc/appifi-recipes/master/release.json' :
    'https://raw.githubusercontent.com/wisnuc/appifi-recipes/release/release.json'

  debug(`using ${url}`)
  return url
}

const retrieveTextAsync = Promise.promisify((url, callback) => 
  request.get(url)
    .set('Accept', 'text/plain')
    .end((err, res) => {
      if (err) callback(err)
      else if (!res.ok) callback(new Error('bad response'))
      else callback(null, res.text) 
    }))

async function retrieveRecipes() {

  let recipes = null
  if (useLocalRecipes) {
    recipes = localRecipes
  }
  else {
    debug('retrieve json recipes')
    let jsonRecipes = await retrieveTextAsync(getJsonRecipesUrl())
    if (jsonRecipes instanceof Error) return jsonRecipes

    debug('parse json recipes')
    try {
      recipes = JSON.parse(jsonRecipes)
    }
    catch (e) {
      debug('json recipes parse error')
      return e
    }
  }

  recipes = recipes.filter(recipe => validateRecipe(recipe))  
  debug('recipes retrieved')
  return recipes 
}

async function retrieveLocalRecipes() {

 
}

/* this promise never reject */
function retrieveRepo(namespace, name) {

  return new Promise((resolve) => { // never reject
    let url = `https://hub.docker.com/v2/repositories/${namespace}/${name}`
    request.get(url)
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) resolve(null)
        else if (!res.ok) resolve(null)
        else resolve(res.body)
      })
  }) 
}

// retrieve all repos for all recipes, return component -> repo map
async function retrieveRepoMap(recipes) {

  if (!recipes) {
    warn(`retrieveRepoMap: recipes null or undefined`)
    return new Error('recipes can\'t be null')
  }

  info(`retrieving repos for recipes`)
  let compos = []
  recipes.forEach(recipe => 
    (recipe.components && recipe.components.length) ?
      compos = [...compos, ...recipe.components] : null )

  let repos = await Promise.all(compos.map(compo =>
        retrieveRepo(compo.namespace, compo.name)))

  let map = new Map()
  for (let i = 0; i < recipes.length; i++) {
    map.set(compos[i], repos[i])
  }
  
  return map
}

// new appstore definition
// null (init state)
// {
//    status: 'LOADING', 'LOADED', 'ERROR'
//    errcode: ERROR only
//    errMessage: ERROR only
//    result: LOADED only
// } 
//

export async function refreshAppStore() {

  let appstore = storeState().appstore
  if (appstore === 'LOADING') {
    info('appstore is already loading')
    return
  }

  storeDispatch({
    type: 'APPSTORE_UPDATE',
    data: {
      status: 'LOADING',
    } 
  })

  let recipes = await retrieveRecipes()
  if (recipes instanceof Error) {
    console.log(recipes)
    storeDispatch({
      type: 'APPSTORE_UPDATE',
      data: {
        status: 'ERROR',
        code: recipes.code,
        message: recipes.message,
      }
    })
    return
  }

  let repoMap = await retrieveRepoMap(recipes)
  if (repoMap instanceof Error) { // TODO this seems unnecessary
    console.log(repoMap)
    storeDispatch({
      type: 'APPSTORE_UPDATE',
      data: {
        status: 'ERROR',
        code: recipes.code,
        message: recipes.message,
      }
    })
    return
  }

  storeDispatch({
    type: 'APPSTORE_UPDATE',
    data: {
      status: 'LOADED',
      result: { recipes, repoMap }
    }
  })
}

export default {

  reload: () => {
    info('loading')
    refreshAppStore().then(r => {
      if (r instanceof Error) {
        info('failed loading appstore')
        console.log(r)
        return
      }
      info('loading success')
    }).catch(e => {
      console.log(e) 
      info('loading failed')
    })
  },
}


