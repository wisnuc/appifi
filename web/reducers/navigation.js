let navDefault = [
  { name: 'APPSTORE',        selected: true },
  { name: 'INSTALLED_APPS',  selected: false },
] 
  
const navigation = (state = navDefault, action) => {

  switch (action.type) {
  case 'NAV_SELECT': {
    console.log(`NAV_SELECT: ${action.select}`)
    return state.map(ent => ({
      name: ent.name,
      selected: ent.name === action.select
    }))
  }

  default:
    return state
  }
}

export default navigation

