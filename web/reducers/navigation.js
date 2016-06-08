import { combineReducers } from 'redux'

const menu = (state = true, action) => {
  
  switch(action.type) {
    
  case 'NAV_MENU_TOGGLE':
    return !state

  default:
    return state
  }
}


let navDefault = [
  { name: 'APP', parent: null,              selected: true }, 
  { name: 'APPSTORE', parent: 'APP',        selected: true },
  { name: 'INSTALLED_APPS', parent: 'APP',  selected: false },
  { name: 'STORAGE', parent: null,          selected: false },
/*
  { name: 'VOLUMES', parent: 'STORAGE',     selected: true },
  { name: 'DRIVES', parent: 'STORAGE',      selected: false },
  { name: 'MOUNTS', parent: 'STORAGE',      selected: false },
  { name: 'PORTS', parent: 'STORAGE',       selected: false },
*/
  { name: 'ETHERNET', parent: null,         selected: false },
  { name: 'COOLING', parent: null,          selected: false },
  { name: 'DATETIME', parent: null,         selected: false },
  { name: 'SYSUPDATE', parent: null,        selected: false },
  { name: 'PASSWORD', parent: null,         selected: false },
  { name: 'POWEROFF', parent: null,         selected: false }  
] 
  
const nav = (state = navDefault, action) => {

  switch (action.type) {
  case 'NAV_SELECT': {

    console.log(action)
      // find select
    let select = state.find((item) => {
      return item.name === action.select
    })

    if (select === undefined) return state

      // is menu 
    if (!select.parent) { 

      if (select.selected) return state

      return state.map((item) => {
          // tab is irrelevent
        if (item.parent) return item
          // only one menu can be selected
          // set selected item
        if (item === select)
          return Object.assign({}, item, {selected: true})
          // unset previously selected item
        if (item.selected) 
          return Object.assign({}, item, {selected: false})
          // other menus are irrelevent
        return item
      })
    }
    else { // is tab

      let parent = state.find((item) => {
        return item.name === select.parent
      })

        // this is defined as illegal now, may be changed in future
      if (!parent.selected) return state
        // if already selected
      if (select.selected) return state

      let result = state.map((item) => {
          
          // menu is irrelevent
        if (!item.parent) {
          return item
        }
          // non-siblings irrelevent
        if (item.parent !== parent.name) {
          return item
        }

          // set selected tab
        if (item === select) {
          return Object.assign({}, item, {selected: true})
        }
          // unset previously selected tab (sibling)
        if (item.selected) {
          return Object.assign({}, item, {selected: false})
        }

        return item   
      })

      return result
    }
  }

  default:
    return state
  }
}

const reducer = combineReducers({
  menu,
  nav
})

export default reducer

