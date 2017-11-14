const path = require('path')
const autoname = require('src/lib/autoname')

describe(path.basename(__filename), () => {

  it('do nothing', done => {
    console.log(autoname('hello', ['hello', 'hello (0)', 'hello (1)', 'hello(100)', 'hello (100)']))
    done()
  }) 

  it('decompose hello.tar', done => {

    let name = 'hello.tar'
    let no = decompose(name)

    console.log(no)

    done()
  }) 

  it('decompose hello.tar.gz', done => {

    let name = 'hello.tar.gz'
    let no = decompose(name)

    console.log(no)

    done()
  }) 

  it('decompose hello (1).tar.gz', done => {

    let name = 'hello (1).tar.gz'
    let no = decompose(name)

    console.log(no)

    done()
  }) 

  it('decompose hello (100).tar.gz', done => {

    let name = 'hello (100).tar.gz'
    let no = decompose(name)

    console.log(no)

    done()
  }) 

  it('decompose hello (100) (100).tar.gz', done => {

    let name = 'hello (100) (100).tar.gz'
    let no = decompose(name)

    console.log(no)

    done()
  }) 
})
