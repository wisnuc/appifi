const lang = (state = 'zh_CN', action) => {
  switch (action.type) {
  case 'TOGGLE_LANG':
    return state === 'zh_CN' ? 'en_US' : 'zh_CN'
  default:
    return state
  }
}

export default lang
