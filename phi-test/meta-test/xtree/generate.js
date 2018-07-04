const path = require('path')
const { expect } = require('chai')

const { 
  init, 
  copy, 
  getConflicts,
  generate 
} = require('src/fruitmix/xcopy/xtree')

describe(path.basename(__filename), () => {

  it('init', done => {

    let arg = {
      type: 'move',
      st: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'file',
            name: 'foo'
          }
        ]
      },
      dt: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'foo',
          }
        ]
      }
    } 


    let xss = generate(arg)
    xss.forEach(xs => {
      console.log('---------------------- >')
      xs.forEach(x => console.log(JSON.stringify(x, null, '  ')))
    })

    done()
  })
})

