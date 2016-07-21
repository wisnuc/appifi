import { dispatch } from '../utils/utils'

const reducer = (state = null, action) => {

  switch(action.type) {
  case 'NAV_SELECT':
    if (action.select === 'TIMEDATE') {
      setTimeout(() => dispatch({
        type: 'SERVEROP_REQUEST',
        data: {
          operation: 'timeDateUpdate',
          mute: true
        }
      }), 0)
    }
    return state

  default:
    return state
  }
}

export default reducer
