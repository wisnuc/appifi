import path from 'path'
import fs from 'fs'

import Node from '../../../src/fruitmix/file/node' 

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
chai.use(chaiAsPromised)
const expect = chai.expect
const should = chai.should()


describe(path.basename(__filename) + ' node', () => {

  let ctx 
  beforeEach(() => {

    ctx = {

      attached: [],
      detaching: [],

      nodeAttached(x) {
        this.attached.push(x)
      },

      nodeDetaching(x) {
        this.detaching.push(x)
      }
    }
  })

  it('should create a new node', () => {
    let node = new Node(ctx)
    expect(node.ctx).to.equal(ctx)
    expect(node.worker).to.be.null
    expect(node.parent).to.be.null
  })

  it('should attach child to parent', () => {

    let p = new Node(ctx)
    let c = new Node(ctx)

    c.attach(p)    
    
    expect(c.parent).to.equal(p)
    expect(p.getChildren()).to.include(c)
    expect(ctx.attached[0]).to.equal(c)
  }) 

  it('should detach child from parent', () => {

    let p = new Node(ctx)
    let c = new Node(ctx)

    c.attach(p)    
    c.detach(p) 

    expect(c.parent).to.equal(null)
    expect(p.getChildren()).not.to.include(c)
    expect(ctx.attached[0]).to.equal(c)
    expect(ctx.detaching[0]).to.equal(c)
  }) 
})
