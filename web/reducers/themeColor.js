
const color = (state = 'deepOrange', action) => {

  switch (action.type) {
    case 'THEME_COLOR':
      return state === action.color ? state : action.color 
        
    default:
      return state
  }
}

export default color

