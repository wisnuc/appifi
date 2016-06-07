
const defaultState = {
  select: null
}

const reducer = (state = defaultState, action) => {

  switch (action.type) {
  case 'NAV_SELECT':
    if (action.select !== 'INSTALLED_APPS' && state.select !== null) {
      return Object.assign({}, state, { select: null })
    }
    else {
      return state
    }

  case 'INSTALLED_SELECT':
    return Object.assign({}, state, { select: action.select })

  case 'INSTALLED_DESELECT':
    return Object.assign({}, state, { select: null })

  default:
    return state
  }
}

export default reducer

