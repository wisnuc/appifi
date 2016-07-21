import { dispatch } from '../utils/utils'

const reducer = (state = null, action) => {

  switch(action.type) {
  case 'LOGIN_SUCCESS':
    setTimeout(() => dispatch({
      type: 'SERVEROP_REQUEST',
      data: {
        operation: 'networkUpdate',
        mute: true
      }
    }), 0)
    return state

  default:
    return state
  }
}

export default reducer
