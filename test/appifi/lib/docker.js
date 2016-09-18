import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised);

import { expect, should } from 'chai'
import sinon from 'sinon'
import { testing } from '../../src/lib/reducers'
import { daemonStartOperation } from '../../src/lib/docker'

async function hello(world) {

  if (world) return 'world'
  else throw new Error('shit')
}

describe('docker', () => {

  it('hello false', () => 
    expect(hello(false)).to.eventually.be.rejected)

  it('hello true', () => 
    expect(hello(true)).to.eventually.be.fulfilled)
})


