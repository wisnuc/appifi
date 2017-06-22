const Debug = require('debug')
const RETRIEVE = Debug('APPIFI:APP_STORE:RETRIEVE')

const request = require('superagent')
const { storeState, storeDispatch } = require('../../lib/reducers')
const { validateRecipe } = require('../../lib/utility')

const defaultPrefixRepoPath = 'https://hub.docker.com/v2/repositories'

class Retrieve {
  constructor() {
    this.recipes = null
    this.reposList = null
    this.recipesRepoList = new Map()
    this.appifiRecipesURL = (storeState().developer && storeState().developer.appstoreMaster === true) ?
      'https://raw.githubusercontent.com/wisnuc/appifi-recipes/master/release.json' :
      'https://raw.githubusercontent.com/wisnuc/appifi-recipes/release/release.json'
    RETRIEVE(`Using ${this.appifiRecipesURL}`)

  }

  async retrieveRecipes() {

    RETRIEVE('Retrieve JSON Recipes...')

    let jsonRecipes = null

    try {
      let response = await request.get(this.appifiRecipesURL).set('Accept', 'text/plain')
      if(response.error) {
        RETRIEVE('Retrieve Failed')
        return
      }
      else if(!response.ok) {
        RETRIEVE('Bad Response')
        return
      }
      else {
        jsonRecipes = response.text
      }
    }
    catch(error) {
      RETRIEVE('Unknown Error')
      return
    }

    RETRIEVE('Parse JSON Recipes...')
    try {
      this.recipes = JSON.parse(jsonRecipes)
    }
    catch (error) {
      RETRIEVE('JSON Recipes Parse Error')
      return error
    }

    this.recipes = this.recipes.filter(recipe => validateRecipe(recipe))  
    RETRIEVE('Recipes Retrieved Success')

    return this.recipes
  }

  async retrieveLocalRecipes() {

  }

  // this promise never reject
  async retrieveRepo(namespace, name) {

    RETRIEVE('Retrieve Repository Infor...')

    let jsonRecipes = null

    try {
      let response = await request.get(`${defaultPrefixRepoPath}/${namespace}/${name}`).set('Accept', 'application/json')
      if(response.error) {
        RETRIEVE('Retrieve Failed')
        return
      }
      else if(!response.ok) {
        RETRIEVE('Bad Response')
        return
      }
      else {
        jsonRecipes = response.text
      }
    }
    catch(error) {
      RETRIEVE('Unknown Error')
      return
    }

    RETRIEVE('Parse JSON Infor...')
    try {
      this.reposList = JSON.parse(jsonRecipes)
    }
    catch (error) {
      RETRIEVE('JSON Infor Parse Error')
      return error
    }

    RETRIEVE('Repository Infor Retrieved Success')

    return this.reposList
  }

  // retrieve all repos for all recipes, return component -> repo map
  async recipesRepoMap(recipes) {

    if (!recipes) {
      RETRIEVE(`Recipes Null or Undefined`)
      return new Error('Recipes Can\'t Be Null')
    }

    RETRIEVE(`Retrieving ReposList For Recipes...`)

    let compos = []
    recipes.forEach(recipe => 
      (recipe.components && recipe.components.length) ?
        compos = [...compos, ...recipe.components] : null )

    let repos = await Promise.all(compos.map(compo =>
          this.retrieveRepo(compo.namespace, compo.name)))

    for (let i = 0; i < recipes.length; i ++) {
      this.recipesRepoList.set(compos[i], repos[i])
    }
    
    RETRIEVE('Repositorys & Recipes Mapping Success')
    return this.recipesRepoList
  }
}

let retrieve = new Retrieve()

const retrieveRecipes = async () => await retrieve.retrieveRecipes()
const retrieveRepo = async (namespace, name) => await retrieve.retrieveRepo(namespace, name)
const recipesRepoMap = async (recipes) => await retrieve.recipesRepoMap(recipes)

module.exports = {
  retrieveRecipes,
  retrieveRepo,
  recipesRepoMap,
}
