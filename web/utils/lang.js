
let current = 'en_US'
let callbacks = []

function langText(text) {

  if (text === null || typeof text !== 'object') 
    return 'TextErrNotATextObject'
  
  if (text.en_US === undefined)
    return 'TextErrFallbackUndefined'

  if (text.current)
    return text.current.toString()

  return text.en_US.toString()
}

function register(cb) {

  if (typeof cb === 'function')
    callbacks.push(cb)
}

function setLang(code) {
  
  if (code === current)
    return

  if (code === 'en_US' || code === 'zh_CN') {
    let prev = current
    current = code
    callbacks.forEach(cb => cb(current, prev))
  }
}

export { langText, setLang, register }


