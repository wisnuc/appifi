import path from 'path'

import createHashMagic from 'src/fruitmix/lib/hashMagic'

describe(path.basename(__filename), function() {

  it('this is an over-simplified test, need sinon to cover all possibilities <<<< TODO', function(done) {
    let worker = createHashMagic()
    worker.on('end', ret => {
      console.log(ret)
      console.log(worker)
      done()
    })
    worker.start(path.join(process.cwd(), 'graph.png'), '123456')
  })
})

