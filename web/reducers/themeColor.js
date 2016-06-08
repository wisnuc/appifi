import { decoration } from '../containers/Navigation'

const color = (state = decoration[0].themeColor, action) => {

  switch (action.type) {
  case 'THEME_COLOR':
    return state === action.color ? state : action.color 
        
  default:
    return state
  }
}

export default color

