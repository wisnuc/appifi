const debug = require('debug')('autoname')

// FIXME for file names starting with dot (.)
const decompose = name => {
  let main, ext, stem, number
 
  let index = name.indexOf('.')
  if (index === -1) {
    main = name
    ext = ''
  } else {
    main = name.slice(0, index)
    ext = name.slice(index)
  }

  let m = main.match(/\ \([1-9]\d*\)$/)

  if (m) {
    stem = main.slice(0, m.index) 
    number = parseInt(m[0].slice(2, -1))
  } else {
    stem = main
  }

  return { stem, ext, number }
}

/**
autoname generates a new name based on given source name and existing (target) names


*/
const autoname = (name, names) => {

  if (!names.includes(name)) return name

  let { stem, ext, number } = decompose(name)

  let max = names
    .reduce((num, y) => {
      let o = decompose(y)
      if (o.stem === stem && o.ext === ext && o.number > num)
        return o.number
      else 
        return num
    }, number || 1)

  return `${stem} (${max + 1})${ext}`  
}

module.exports = autoname

