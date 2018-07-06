const path = require('path')
const { expect } = require('chai')

const { 
  init, 
  copy, 
  findByPath,
  getConflicts,
  resolve,
  generate 
} = require('src/fruitmix/xcopy/xtree')

describe(path.basename(__filename), () => {

  it('generate', done => {
    let arg = {
      st: {
        type: 'directory',
        name: '',
        children: [
          {
            type: 'directory',
            name: 'foo',
            children: [
              {
                type: 'file',
                name: 'alonzo',
              }
            ]
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
            children: [
              {
                type: 'file',
                name: 'alonzo',
              }
            ]
          }
        ]
      }
    }

    let language = generate(arg)
    console.log(language.length)
    console.log(language)
    done()
  })

  it.skip('resolve', done => {
    let si = 
      {
        "st": {
          "type": "directory",
          "name": "",
          "children": [
            {
              "type": "directory",
              "name": "foo",
              "children": [
                {
                  "type": "file",
                  "name": "alonzo",
                  "path": "/foo/alonzo",
                  "status": "conflict",
                  "policy": ['rename', null]
                }
              ],
              "path": "/foo",
              "status": "kept",
              "policy": [
                "keep",
                null
              ]
            }
          ],
          "path": "/",
          "status": "kept"
        },
        "dt": {
          "type": "directory",
          "name": "",
          "children": [
            {
              "type": "directory",
              "name": "foo",
              "children": [
                {
                  "type": "file",
                  "name": "alonzo",
                  "path": "/foo/alonzo"
                }
              ],
              "path": "/foo"
            }
          ],
          "path": "/"
        },
        "policies": {
          "dir": [
            null,
            null
          ],
          "file": [
            null,
            null
          ]
        } 
    }

    let rs = resolve(si, '/foo')
    console.log(JSON.stringify(rs, null, '  '))
  })

})

