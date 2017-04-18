import Debug from 'debug'
const APPSTORE = Debug('APPIFI:APP_STORE')

import request from 'superagent'
import { storeState, storeDispatch } from '../../lib/reducers'
import { validateRecipe } from '../../lib/utility'

const useLocalRecipes = false // used for test, obsolete

const getJsonRecipesUrl = () => {

  let url = (storeState().developer && storeState().developer.appstoreMaster === true) ?
    'https://raw.githubusercontent.com/wisnuc/appifi-recipes/master/release.json' :
    'https://raw.githubusercontent.com/wisnuc/appifi-recipes/release/release.json'

  APPSTORE(`Using ${url}`)

  return url
}

const retrieveTextAsync = Promise.promisify((url, callback) => 
  request.get(url)
    .set('Accept', 'text/plain')
    .end((err, res) => {
      if (err) callback(err)
      else if (!res.ok) callback(new Error('bad response'))
      else callback(null, res.text) 
    })
)

const retrieveRecipes = async () => {

  let recipes = null
  if (useLocalRecipes) {
    recipes = localRecipes
  }
  else {
    APPSTORE('Retrieve json recipes...')
    let jsonRecipes = await retrieveTextAsync(getJsonRecipesUrl())
    if (jsonRecipes instanceof Error) return jsonRecipes

    APPSTORE('Parse json recipes...')
    try {
      recipes = JSON.parse(jsonRecipes)
    }
    catch (e) {
      APPSTORE('Json recipes parse error')
      return e
    }
  }

  recipes = recipes.filter(recipe => validateRecipe(recipe))  
  APPSTORE('Recipes retrieved')
  return recipes 
}

async function retrieveLocalRecipes() {

}

/* this promise never reject */
const retrieveRepo = (namespace, name) => {

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
const retrieveRepoMap = async (recipes) => {

  if (!recipes) {
    APPSTORE(`retrieveRepoMap: recipes null or undefined`)
    return new Error('recipes can\'t be null')
  }

  APPSTORE(`Retrieving repos for recipes...`)

  let compos = []
  recipes.forEach(recipe => 
    (recipe.components && recipe.components.length) ?
      compos = [...compos, ...recipe.components] : null )

  let repos = await Promise.all(compos.map(compo =>
        retrieveRepo(compo.namespace, compo.name)))

  let map = new Map()
  for (let i = 0; i < recipes.length; i ++) {
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

const refreshAppStore = async () => {

  let appstore = storeState().appstore
  if (appstore === 'LOADING') {
    APPSTORE('Already loading')
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
    refreshAppStore().then(r => {
      if (r instanceof Error) {
        APPSTORE('Failed loading appstore', r)
        return
      }
      APPSTORE('Loading success')      
    }).catch(e => {
      APPSTORE('Loading failed', e)
    })
  }
}

export { refreshAppStore }

