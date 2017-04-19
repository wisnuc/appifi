import Debug from 'debug'
const APP_STORE = Debug('APPIFI:APP_STORE')

import request from 'superagent'
import { storeState, storeDispatch } from '../../lib/reducers'
import { validateRecipe } from '../../lib/utility'

const getJsonRecipesUrl = () => {

  let url = (storeState().developer && storeState().developer.appstoreMaster === true) ?
    'https://raw.githubusercontent.com/wisnuc/appifi-recipes/master/release.json' :
    'https://raw.githubusercontent.com/wisnuc/appifi-recipes/release/release.json'

  APP_STORE(`Using ${url}`)

  return url
}

const retrieveTextAsync = async (url) => {
  try {
    let response = await request
                                .get(url)
                                .set('Accept', 'text/plain')
    if(response.error) {
      APP_STORE('Retrieve Failed')
      return
    }
    else if(!response.ok) {
      APP_STORE('Bad response')
      return
    }
    else {
      return response.text
    }
  }
  catch(error) {
    APP_STORE('Unknown Error')
    return
  }
}

const retrieveRecipes = async () => {

  let recipes = null
  APP_STORE('Retrieve json recipes...')
  let jsonRecipes = await retrieveTextAsync(getJsonRecipesUrl())
  if (jsonRecipes instanceof Error) return jsonRecipes

  APP_STORE('Parse json recipes...')
  try {
    recipes = JSON.parse(jsonRecipes)
  }
  catch (e) {
    APP_STORE('Json recipes parse error')
    return e
  }

  recipes = recipes.filter(recipe => validateRecipe(recipe))  
  APP_STORE('Recipes retrieved')
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
    APP_STORE(`retrieveRepoMap: recipes null or undefined`)
    return new Error('recipes can\'t be null')
  }

  APP_STORE(`Retrieving repos for recipes...`)

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
    APP_STORE('Already loading')
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
        APP_STORE('Failed loading appstore', r)
        return
      }
      APP_STORE('Loading success')      
    }).catch(e => {
      APP_STORE('Loading failed', e)
    })
  }
}

export { refreshAppStore }

