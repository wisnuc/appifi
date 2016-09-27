var fs = require('fs')
var child = require('child_process')
var crypto = require('crypto')

// convert DSC_0044.JPG -auto-orient -thumbnail 250x150^ thumb.jpg

// a simple version to avoid canonical json, for easy debug
const stringify = (object) => 
  JSON.stringify(Object.keys(object)
    .sort()
    .reduce((obj, key) => {
      obj[key] = object[key]
      return obj
    }, {}))

const geometry = (width, height, modifier) => {

  let str
  
  if (!height)
    str = `${width.toString()}`
  else if (!width)
    str = `x${height.toString()}`
  else {
    str = `${width.toString()}x${height.toString()}`

    switch (modifier) {
    case 'caret':
      str += '^'
    default:
    }
  } 

  return str
}

module.exports = (input, output, digest, opts, callback) => {

  let finished = false
  let { width, height, modifier, autoOrient } = opts

  if (width !== undefined && (!Number.isInteger(width) || width === 0 || width > 4096))
    return EINVAL('invalid width') 

  if (height !== undefined && (!Number.isInteger(height) || height === 0 || height > 4096))
    return EINVAL('invalid height')

  if (!width && !height) return EINVAL('no geometry')
  if (!width || !height) modifier = undefined
  if (modifier && modifier !== 'caret') return EINVAL('unknown modifier')
  if (autoOrient !== undefined && typeof autoOrient !== 'boolean')
    return EINVAL('invalid autoOrient') 

  let optionHash = crypto
    .createHash('sha1')
    .update(stringify({ width, height, modifier, autoOrient }))
    .digest('hex')

  let args = []
  args.push(input)
  if (autoOrient) args.push('-auto-orient')
  args.push('-thumbnail')
  args.push(geometry(width, height, modifier))
  args.push(output) 

  let convert = child.spawn('convert', args)
  convert.on('close', code => {
    convert = null
    if (code !== 0) optionHash = null
    if (!finished) CALLBACK(null, { input, output, digest, optionHash })
  })

  function CALLBACK(err, res) {
    finished = true
    process.nextTick(() => callback(err, res))
  }

  function EINVAL(text) {
    CALLBACK(Object.assign(new Error(text), { code: 'EINVAL' }))
  }
}

// module.exports('./DSC_0044.JPG', './12345.jpg', 12345, { width: 120, height:120, modifiler:'caret' }, (err, res) => console.log(err || res))
