import fs from 'fs'
import path from 'path'

import Promise from 'bluebird'

Promise.promisifyAll(fs)

const visit = (dir, dirContext, func, done) => { 
  fs.readdir(dir, (err, entries) => {
    if (err || entries.length === 0) return done()
    
    let count = entries.length
    entries.forEach(entry => {

      func(dir, dirContext, entry, (entryContext) => {
        if (entryContext) {
          // console.log('entering entering')
          visit(path.join(dir, entry), entryContext, func, () => {
            count--
            if (count === 0) done()
          })
        }
        else {
          count --
          if (count === 0) done()
        }
      })
    })
  })
}

async function visitAsync(dir, dirContext, funcAsync) {

  async function wrapper(dir, dirContext, entry, funcAsync) {
    let entryContext = await funcAsync(dir, dirContext, entry)
    if (entryContext) await visitAsync(path.join(dir, entry), entryContext, funcAsync)
  }

  let entries = await fs.readdirAsync(dir)
  if (entries instanceof Error) return
  if (entries.length === 0) return

  await Promise.all(entries.map(entry => wrapper(dir, dirContext, entry, funcAsync)))
}

/*
async function abcAsync(dir, dirContext, entry) {

  console.log('======')
  console.log(dir)
  console.log(dirContext)
  console.log(entry)

  let stats = await fs.statAsync(path.join(dir, entry))
  if (stats instanceof Error) return
  if (stats.isDirectory()) return `context for ${path.join(dir, entry)}`
}

visitAsync('/data', 'Top Context', abcAsync)
  .then(r => console.log('finished'))
  .catch(e => console.log(e)) 
*/

export { visit, visitAsync }

/** example 

function xyz(dir, dirContext, entry, callback) {

  console.log(entry)
  fs.stat(path.join(dir, entry), (err, stat) => {

    if (err) {
      callback()
    }
    else if (stat.isDirectory()) {
      callback(`${dir}`)
    }
    else {
      callback()
    }
  })
}

visit('/data', xyz, null, () => {

  console.log('finished')
})

**/










