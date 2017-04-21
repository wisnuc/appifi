import Debug from 'debug'
const APP_STORE = Debug('APPIFI:APP_STORE')

import request from 'superagent'
import { storeState, storeDispatch } from '../../lib/reducers'
import { validateRecipe } from '../../lib/utility'
import { retrieveRecipes, retrieveRepo, recipesRepoMap } from './retrieve'

class Appstore {

  async refreshAppstore() {

    let appstore = storeState().appstore
    if (appstore === 'LOADING') {
      APP_STORE('Already Loading')
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

    let repoMap = await recipesRepoMap(recipes)
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
}

let appstore = new Appstore()

const refreshAppstore = async () => appstore.refreshAppstore()
                                    // .then(r => {
                                    //   if(r instanceof Error) {
                                    //     APP_STORE('Failed Reloading Appstore', r)
                                    //     return
                                    //   }
                                    //   APP_STORE('Reloading Success')      
                                    // })
                                    // .catch(e => {
                                    //   APP_STORE('Reloading Failed', e)
                                    // })

export {
  refreshAppstore,  
}

