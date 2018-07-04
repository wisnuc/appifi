const path = require('path')
const { expect } = require('chai')

const { copy } = require('src/fruitmix/xtree/expand')

describe(path.basename(__filename), () => {
  it('expand empty\n\thello\n\tworld', () => {
    let root = {
      st: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'hello',
            children: [
              {
                type: 'file',
                name: 'slash'
              }
            ]
          },
          {
            type: 'file',
            name: 'world'
          }
        ]
      },
      dt: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'hello',
            children: [{
              type: 'file',
              name: 'dot'
            }]
          }
        ]
      },
    }

    copy(root)
    console.log(JSON.stringify(root, null, '  '))
  })
})
     
