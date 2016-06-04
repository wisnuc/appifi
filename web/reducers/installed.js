
const defaultState = {
  selectedContainerCard: null
}

const reducer = (state = defaultState, action) => {

  switch (action.type) {
  case 'CONTAINERCARD_SELECT':
    return Object.assign({}, state, {
      selectedContainerCard : action.containerId
    })

  case 'CONTAINERCARD_UNSELECT':
    return Object.assign({}, state, {
      selectedContainerCard: null
    })

  default:
    return state
  }
}

export default reducer

