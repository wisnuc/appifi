
const defaultState = {
  select: null
}

const reducer = (state = defaultState, action) => {

  switch (action.type) {
  case 'INSTALLED_SELECT':
    return Object.assign({}, state, { select: action.select })

  case 'INSTALLED_DESELECT':
    return Object.assign({}, state, { select: null })

  default:
    return state
  }
}

export default reducer

