
const reducer = (state = 0, action) => {

  switch(action.type) {
  case 'INCREMENT':
    console.log('INCREMENT')
    return state++

  default:
    return state
  }
}

export default reducer

