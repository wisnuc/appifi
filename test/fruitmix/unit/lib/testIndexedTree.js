import path from 'path'
import fs from 'fs'

import UUID from 'node-uuid'
import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import xattr from 'fs-xattr'
import { expect } from 'chai'

import { 
  nodeProperties, 
  IndexedTree, 
} from 'src/fruitmix/lib/indexedTree'

const testData1 = () => {

  let arr = 'abcdefghijklmnopqrstuvwxyz'
    .split('')
    .map(c => {
      let node = Object.create(nodeProperties)
      node.parent = null
      node.name = c
      return node
    })
  
  let object = {
    a:          null,
    b:        'a',
    c:        'a',
    d:      'c',
    e:        'a',
    f:      'e',
    g:      'e',
    h:        'a',
    i:      'h',
    j:      'h',
    k:    'j',
    l:      'h',
    m:    'l',
    n:    'l'
  } 

  for (let prop in object) {  
    if (object.hasOwnProperty(prop)) {
      if (object[prop] === null) continue
      let node = arr.find(n => n.name === prop)
      let parent = arr.find(n => n.name === object[prop])

      if (!node || !parent) throw new Error('node or parent non-exist')
      node.attach(parent)
    }
  } 
  return arr
}

describe(path.basename(__filename) + ': (tree) node functions', function() {

  describe('tree node functions', function() {
    describe('path', function() { 
      it('nodeK path should be a h j k', function(done) { 
        let arr = testData1()
        let nodeK = arr.find(node => node.name === 'k')
  	    expect(nodeK.nodepath().map(n => n.name)).to.deep.equal(['a', 'h', 'j', 'k'])
        done()
      })

      it ('nodeG path should be a e g', function(done) {
        let arr = testData1()
        let nodeG = arr.find(node => node.name === 'g')
        expect(nodeG.nodepath().map(n => n.name)).to.deep.equal(['a', 'e', 'g'])
        done()
      })

      
    })
    
    describe('children', function() {
      
      it ('nodeA children should be b c e h', function(done) {
        let arr = testData1()
        let nodeA = arr.find(node => node.name === 'a')
 	      expect(nodeA.children.map(n => n.name)).to.deep.equal(['b', 'c', 'e', 'h'])
        done()
      })

    })

  })

  describe('modify tree', function() {
    it('set a new child', function() {
      let arr = testData1();
      let nodeA = arr.find(node => node.name === 'a')
      let nodeZ = arr.find(node => node.name === 'z')
      nodeA.setChild(nodeZ);  
      expect(nodeA.children.map(n => n.name)).to.deep.equal(['b', 'c', 'e', 'h', 'z'])
    })
    
    it('unset a new child', function() {
      let arr = testData1();
      let nodeA = arr.find(node => node.name === 'a')
      let nodeB = arr.find(node => node.name === 'b')
      nodeA.unsetChild(nodeB);  
      expect(nodeA.children.map(n => n.name)).to.deep.equal(['c', 'e', 'h'])
    })

    it('attach parent', function() {
      let arr=testData1();
      let nodeA = arr.find(node => node.name === 'a')
      let nodeZ = arr.find(node => node.name === 'z')
      nodeZ.attach(nodeA);  
      expect(nodeA.children.map(n => n.name)).to.deep.equal(['b', 'c', 'e', 'h', 'z'])
    })
    
    it('detach parent', function() {
      let arr=testData1();
      let nodeA = arr.find(node => node.name === 'a')
      let nodeB = arr.find(node => node.name === 'b')
      nodeB.detach();  
      expect(nodeA.children.map(n => n.name)).to.deep.equal(['c', 'e', 'h'])
    })

  })

  describe('get part of tree', function() {
    it('get children by getChildren()', function(){
      let arr = testData1();
      let nodeA = arr.find(node => node.name === 'a')
      expect(nodeA.children.map(n => n.name)).to.deep.equal(['b', 'c', 'e', 'h'])
    })
  })
  
  describe('traversal tree', function() {
    it('upEach', function() { 
        let arr = testData1()
        let nodeG = arr.find(node => node.name === 'g')
        let arr2 = []
        nodeG.upEach(node => arr2.push(node))
        expect(arr2.map(n=>n.name)).to.deep.equal(['g', 'e', 'a'])
    })
    
    it('upFind', function() {
      let arr = testData1()
      let nodeG = arr.find(node => node.name === 'g')

      expect(nodeG.upFind(node => node.name==='e').name==='e');
      expect(nodeG.upFind(node => node.name==='z')===undefined);
 
    }) 
    
    it('preVisit', function() {
      let arr = testData1()
      let nodeA = arr.find(node => node.name === 'a')
      let arr2 = []
      nodeA.preVisit(node => arr2.push(node.name));
      expect(arr2).to.deep.equal([ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n' ]) 
    })
    
   it('postVisit', function() {
      let arr = testData1()
      let nodeA = arr.find(node => node.name === 'a')
      let arr2 = []
      nodeA.postVisit(node => arr2.push(node.name)); 
      expect(arr2).to.deep.equal([ 'b', 'd', 'c', 'f', 'g', 'e', 'i', 'k', 'j', 'm', 'n', 'l', 'h', 'a' ]) 
    })

    it('preVisitEol', function() {
      let arr = testData1()
      let nodeA = arr.find(node => node.name === 'a')
      let arr2 = []
      nodeA.preVisitEol(node => ( arr2.push(node.name), node.name!=='e')); 
      expect(arr2).to.deep.equal([ 'a', 'b', 'c', 'd', 'e', 'h', 'i', 'j', 'k', 'l', 'm', 'n' ]) 
    })
    
    it('preVisitFind', function() {
      let arr = testData1()
      let nodeA = arr.find(node => node.name === 'a')
      expect(nodeA.preVisitFind(node => node.name==='e').name==='e'); 
      expect(nodeA.preVisitFind(node => node.name==='z')===undefined); 
    })

  })
})

describe(path.basename(__filename) + ': indexedTree functions', function() {

  describe('new IndexedTree()', function() {
   
    let proto = { x: 1, y: 2, z: ['hello', 1] } 
    let t

    beforeEach(function() {
      t = new IndexedTree(proto) 
    })
    
    it('should preserve proto object props', function() {
      expect(t.proto.x).to.equal(proto.x)
      expect(t.proto.y).to.equal(proto.y)
      expect(t.proto.z).to.deep.equal(proto.z)
    })
/**
    it('should set itself to proto.tree', function() {
      expect(t.proto.tree).to.equal(t) 
    })
**/
    it('should have an empty uuid Map', function() {
      expect(t.uuidMap instanceof Map).to.be.true
      expect(t.uuidMap.size).to.equal(0)
    })

    it('should have an empty hash Map', function() {
      expect(t.hashMap instanceof Map).to.be.true
      expect(t.hashMap.size).to.equal(0)
    })
/**  
    it('should have an empty hashless set', function() {
      expect(t.hashless instanceof Set).to.be.true
      expect(t.hashless.size).to.equal(0)
    })
**/

    it('should have an empty shared set', function() {
      expect(t.shared instanceof Set).to.be.true
      expect(t.shared.size).to.equal(0)
    })
/**
    it('should hav an empty extended Set', function() {
      expect(t.extended instanceof Set).to.be.true
      expect(t.extended.size).to.equal(0)
    })
**/
    it('should have empty roots array', function() {
      expect(t.roots).to.deep.equal([])
    })
  })

  describe('create root (need check ......................... )', function() {

    let uuid1 = '1e15e8ce-7ae4-43f4-8d9f-285c1f28dfac'
    let uuid2 = '5da92303-33a1-4f79-8d8f-a7b6becde6c3'
    let uuid3 = 'b9aa7c34-8b86-4306-9042-396cf8fa1a9c'
    let uuid4 = 'f97f9e1f-848b-4ed4-bd47-1ddfa82b2777'

    let digest1 = 'e14bfc54f20117011c716706ba9c4879a07f6a882d34766eda70ec5bbfe54e0e'
    let root = { uuid: uuid1, hash: digest1, type:'folder' }
    let proto = { x: 1, y: 2, z: ['hello', 1] }
    let t
  
    beforeEach(function() {
      t = new IndexedTree(proto)
    })

    it('should throw if root no uuid', function() {

      let root = { type: 'folder' }
      let fn = () => { t.createNode(null, root) }
      expect(fn).to.throw(Error)
    })

    it('should throw if root object no type', function() {
  
      let root = { uuid: uuid1 }
      let fn = () => { t.createNode(null, root) }
      expect(fn).to.throw(Error)
    })

    it('should throw if root is not a folder', function() {

      let root = { uuid: uuid1, type: 'file' }
      let fn = () => { t.createNode(null, root) }
      expect(fn).to.throw(Error)
    })

    it('root should preserve root object props', function() {

      let root = { 
        uuid: uuid1, 
        type: 'folder', 
        owner: [uuid2],  
        writelist: [uuid3],
        readlist: [uuid4],
        name: 'hello',
        mtime: 123456,
        hash: 234567
      }

      let node = t.createNode(null, root)

      expect(node.uuid).to.equal(root.uuid)
      expect(node.type).to.equal(root.type)
      expect(node.owner).to.deep.equal(root.owner)
      expect(node.writelist).to.deep.equal(root.writelist)
      expect(node.readlist).to.deep.equal(root.readlist)
      expect(node.name).to.equal(root.name)
      expect(node.hasOwnProperty('mtime')).to.be.false
      expect(node.hasOwnProperty('hash')).to.be.false
    }) 
/**
    it('root should have correct parent/children set', function() {
      
      t.createNode(null, root)
      expect(t.root.parent).to.be.null
      expect(t.root.getChildren()).to.deep.equal([])
    })

    it('proto should be the prototype of root', function() {
      
      t.createNode(null, root)

      expect(t.proto.isPrototypeOf(t.root)).to.be.true
    })

    it('root should be in uuid map', function() {
      
      t.createNode(null, root)

      expect(t.uuidMap.get(uuid1)).to.equal(t.root)
      expect(t.uuidMap.size).to.equal(1)
    })

    it('root should NOT be in hash map, since it is a folder', function() {
    
      t.createNode(null, root)
      
      expect(t.hashMap.size).to.equal(0)
    })
**/

  })  
})

describe(path.basename(__filename) + ': indexedTree, createNode() for root node', function() {

  let rfp, t

  beforeEach(function() {
  
    rfp = {
      uuid: 'd70e2da0-d1bd-4fe6-ade1-66d0909357f7',
      type: 'folder', 
      name: 'root folder',
      owner: ['f1a9e47e-6896-4d75-9d27-6bf17293937e'] ,
      writelist: ['99bcb341-07f5-4ec2-9c6f-56af2fbee056'],
      readlist: ['fb71cc7e-42fb-4ef9-ad89-c1d912263a53']
    } 

    t = new IndexedTree({})
  })

  it('created root node should preserve uuid, name, owner, writelist, readlist, without mtime, size, and hash', function() {

    let node = t.createNode(null, rfp)
    expect(node.uuid).to.equal(rfp.uuid)
    expect(node.name).to.equal(rfp.name)
    expect(node.owner).to.deep.equal(rfp.owner)
    expect(node.writelist).to.deep.equal(rfp.writelist)
    expect(node.readlist).to.deep.equal(rfp.readlist)
    expect(node.size).to.be.undefined
    expect(node.mtime).to.be.undefined
    expect(node.hash).to.be.undefined
  })

  it('created root node should be put into roots array', function() {

    let node = t.createNode(null, rfp)
    expect(t.roots).to.include(node)
  })

  it('created root node should be folder', function() {
    let node = t.createNode(null, rfp)
    expect(node.isDirectory()).to.be.true
  })

  it('should throw if props has no uuid when creating root node', function() {
    delete rfp.uuid
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props has no type when creating root node', function() {
    delete rfp.type
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props has no name when creating root node', function() {
    delete rfp.name
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props name is not string when creating root node', function() {
    rfp.name = 2
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props name is empty when creating root node', function() {
    rfp.name = ''
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props has no owner when creating root node', function() {
    delete rfp.owner
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props owner is not array when creating root node', function() {
    rfp.owner = 'hello'
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props owner array is empty when creating root node', function() {
    rfp.owner = []
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props writelist is undefined when creating root node', function() {
    delete rfp.writelist
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props writelist is not an array when creating root node', function() {
    rfp.writelist = 'hello'
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should NOT throw if props writelist is an empty array when creating root node', function() {
    rfp.writelist = []
    expect(() => t.createNode(null, rfp)).to.not.throw(Error)
  })

  it('should throw if props readlist is undefined when creating root node', function() {
    delete rfp.readlist
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should throw if props readlist is not an array when creating root node', function() {
    rfp.readlist = 'hello'
    expect(() => t.createNode(null, rfp)).to.throw(Error)
  })

  it('should NOT throw if props readlist is an empty array when creating root node', function() {
    rfp.readlist = []
    expect(() => t.createNode(null, rfp)).to.not.throw(Error)
  })
})

/**

445e3e29-ab7e-46d1-bfcd-3f5a6885ef3f
d16eff77-c35b-44f1-a450-12c842bce02b
3112785a-3ac8-4ce0-a2ae-30a36a77d47f
eb8f9162-e81b-42d8-9cbc-c5cb6d8f14e5
6cee5dcd-ffd8-44a0-b78c-679b9ffff6b2
e25238b4-2d60-4174-8f98-da6706cbbcbf
0ca159ec-5d0b-4e0a-ba2d-037fb49ececc
d0851a61-70b8-442a-af08-ecbcbab9be4f
9b9886d7-bc0a-4e3f-ac28-a9297bb707d7
6411ad54-fb1f-4afb-9b43-00e3156ed732
d53d7750-157e-48ac-830f-74286ff17f3c
e44ee8ed-92d0-4017-8b76-01b88a8949cf
70e384fc-51f4-4b2e-bb88-f3eedb31d93b
4830ca46-9e36-4298-bb27-cbd547740d2f
a7e38554-b0bd-4465-881c-14925808ac97
2f8740dc-e642-4c1b-85dc-3c4708268b12
ed746533-8b11-4915-b921-22d57d8ece68
4bc6f706-767d-4cda-b340-d89b2e9c7148
125a28e0-eefc-471c-8048-2a45535bfaad
6fda27b9-6979-4515-9ea8-31f3d4463100
6c5d6eb8-54dc-43f5-b1a8-fa9e965da783
7e416ab1-cd58-443c-b095-237a12fa4240
42c54b0e-6eb8-4718-91db-57ce8a5d2bd4
246f44db-6a1a-4eef-b9d7-ca14907702b9
a2469edd-10b7-495a-9b9a-6a7f4902cec7
83d24729-6892-4bd3-b276-19f23b9d2577
4a79321d-add2-4622-b163-aba23c43855e
49985ecf-b6d8-43d7-9309-46b7c43d42dd
ed757316-5a22-41bd-9a86-284dfe5e4dad
ef0305f8-d2d4-446f-aa5f-97002f8fef5e
68be9aeb-c273-4f37-85e9-a89adb36764d
59381e87-027f-4da4-9af2-2f1d19d45f50
8836c9a9-0946-4819-ba78-163ca708ed63
bac2eadf-333f-4f00-9895-477dddbc00a0
1e9787fb-b309-4426-b864-9b964b9228a1
6adbb946-3200-48a3-80b3-1a9e82f0549c

**/

describe(path.basename(__filename) + ': indexedTree, createNode() for non-root folder', function() {

  let nrfp, t

  beforeEach(function() {
  
    let rfp = {
      uuid: 'd70e2da0-d1bd-4fe6-ade1-66d0909357f7',
      type: 'folder', 
      name: 'root folder',
      owner: ['f1a9e47e-6896-4d75-9d27-6bf17293937e'] ,
      writelist: ['99bcb341-07f5-4ec2-9c6f-56af2fbee056'],
      readlist: ['fb71cc7e-42fb-4ef9-ad89-c1d912263a53']
    } 

    nrfp = {
      uuid: 'a179f3cd-17e6-4318-a802-293043a0e0e1',
      type: 'folder', 
      name: 'nonroot folder',
      owner: ['5b0526ca-87f0-4055-acd5-71c75a17b7d4'] ,
      writelist: ['3e7e21e2-a27e-45f3-938d-ce176b5cf3e5'],
      readlist: ['a2919c3d-1482-49c9-9215-70112d6e7c08']
    } 

    t = new IndexedTree({})
    t.createNode(null, rfp)
  })

  it('created nonroot folder node should attach to root[0]', function() {

    let n = t.createNode(t.roots[0], nrfp)
    expect(n.parent).to.equal(t.roots[0])
    expect(t.roots[0].getChildren()).to.include(n)
 })

  it('created nonroot folder node should preserve uuid, name, owner, writelist, readlist, without mtime, size, and hash', function() {

    let n = t.createNode(t.roots[0], nrfp)

    expect(n.uuid).to.equal(nrfp.uuid)
    expect(n.name).to.equal(nrfp.name)
    expect(n.owner).to.deep.equal(nrfp.owner)
    expect(n.writelist).to.deep.equal(nrfp.writelist)
    expect(n.readlist).to.deep.equal(nrfp.readlist)
    expect(n.size).to.be.undefined
    expect(n.mtime).to.be.undefined
    expect(n.hash).to.be.undefined
  })

  it('created nonroot node should be folder', function() {
    let n = t.createNode(t.roots[0], nrfp)
    expect(n.isDirectory()).to.be.true
  })

  it('should throw if props has no uuid when creating nonroot node', function() {
    delete nrfp.uuid
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })

  it('should throw if props has no type when creating nonroot node', function() {
    delete nrfp.type
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })

  it('should throw if props has no name when creating nonroot node', function() {
    delete nrfp.name
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })

  it('should throw if props name is not a string when creating nonroot node', function() {
    nrfp.name = 2
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })

  it('should throw if props name is an empty string when creating nonroot node', function() {
    nrfp.name = ''
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })

  it('should throw if props has no owner when creating nonroot node', function() {
    delete nrfp.owner
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })

  it('should throw if owner is not an array when createing nonroot folder node', function() {
    nrfp.owner = 'hello'
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })

  it('should NOT throw if owner is an empty array when creating nonroot folder node', function() {
    nrfp.owner = []
    expect(() => t.createNode(t.roots[0], nrfp)).to.not.throw(Error)
  })

  it('should throw if writelist is not an array when creating nonroot folder node', function() {
    nrfp.writelist = 'hello'
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })

  it('should NOT throw if both writelist and readlist are undefined when creating nonroot folder node', function() {
    delete nrfp.writelist
    delete nrfp.readlist
    expect(() => t.createNode(t.roots[0], nrfp)).to.not.throw(Error)
  })

  it('should throw if writelist defined but readlist not when creating nonroot folder node', function() {
    delete nrfp.readlist
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  }) 

  it('should throw if readlist defined but writelist not when creating nonroot folder node', function() {
    delete nrfp.writelist
    expect(() => t.createNode(t.roots[0], nrfp)).to.throw(Error)
  })
})

describe(path.basename(__filename) + ': indexedTree, createNode() for (non-root) file', function() {

  const jpegMagic001 = 'JPEG image data, JFIF standard 1.01, aspect ratio, density 1x1, segment length 16, Exif Standard: [TIFF image data, little-endian, direntries=18, description=, manufacturer=Sony, model=F3116, orientation=upper-right, xresolution=326, yresolution=334, resolutionunit=2, software=MediaTek Camera Application, datetime=2016:07:19 15:44:47], baseline, precision 8, 4096x2304, frames 3'
  const jpegMagic002 = 'JPEG image data, JFIF standard 1.01, resolution (DPI), density 72x72, segment length 16, baseline, precision 8, 160x94, frames 3'
  const hash001 = '7a44a28d1da4e2b99eda6060aab85168fe9d09fa7f91831f9ef7c137cdca5751'

  let nrfp, t

  beforeEach(function() {
  
    let rfp = {
      uuid: 'd70e2da0-d1bd-4fe6-ade1-66d0909357f7',
      type: 'folder', 
      name: 'root folder',
      owner: ['f1a9e47e-6896-4d75-9d27-6bf17293937e'] ,
      writelist: ['99bcb341-07f5-4ec2-9c6f-56af2fbee056'],
      readlist: ['fb71cc7e-42fb-4ef9-ad89-c1d912263a53']
    } 

    nrfp = {
      uuid: 'a179f3cd-17e6-4318-a802-293043a0e0e1',
      type: 'file', 
      name: 'nonroot file',
      owner: ['5b0526ca-87f0-4055-acd5-71c75a17b7d4'] ,
      writelist: ['3e7e21e2-a27e-45f3-938d-ce176b5cf3e5'],
      readlist: ['a2919c3d-1482-49c9-9215-70112d6e7c08'],
      size: 123456,
      mtime: 123456
    } 

    t = new IndexedTree({})
    t.createNode(null, rfp)
  })

  it('created file node should attach to roots[0]', function() {

    let n = t.createNode(t.roots[0], nrfp)
    expect(n.parent).to.equal(t.roots[0])
    expect(t.roots[0].getChildren()).to.include(n)
  })

  it('created file node from props w/o hash/magic should preserve uuid, name, owner, writelist, readlist, size, mtime, w/o magic or hash', function() {

    let n = t.createNode(t.roots[0], nrfp)

    expect(n.uuid).to.equal(nrfp.uuid)
    expect(n.name).to.equal(nrfp.name)
    expect(n.owner).to.deep.equal(nrfp.owner)
    expect(n.writelist).to.deep.equal(nrfp.writelist)
    expect(n.readlist).to.deep.equal(nrfp.readlist)
    expect(n.size).to.equal(nrfp.size)
    expect(n.mtime).to.equal(nrfp.mtime)
    expect(n.magic).to.be.undefined
    expect(n.hash).to.be.undefined
  })

  it('created file node from props w/o hash/magic should be a file', function() {
    let n = t.createNode(t.roots[0], nrfp)
    expect(n.isFile()).to.be.true
  }) 

  it('created file node from props w/o hash/magic should be put into hashless Set', function() {
    let n = t.createNode(t.roots[0], nrfp)
    expect(t.hashless.has(n)).to.be.true
  })

  it('creating file node from props w/o hash/magic should emit hashlessAdded event', function() {
    let emitted
    t.on('hashlessAdded', node => {
      emitted = node
    })
    expect(t.createNode(t.roots[0], nrfp)).to.equal(emitted)
  })

  it('created file node from props w/ uninterested magic should preserve uuid, name, owner, writelist, readlist, size, mtime, w/o magic or hash', function() {

    let hash = '7a44a28d1da4e2b99eda6060aab85168fe9d09fa7f91831f9ef7c137cdca5751'
    let magic = 'ASCII text'

    nrfp.hash = hash
    nrfp.magic = magic

    let n = t.createNode(t.roots[0], nrfp)
    expect(n.uuid).to.equal(nrfp.uuid)
    expect(n.name).to.equal(nrfp.name)
    expect(n.owner).to.deep.equal(nrfp.owner)
    expect(n.writelist).to.deep.equal(nrfp.writelist)
    expect(n.readlist).to.deep.equal(nrfp.readlist)
    expect(n.size).to.equal(nrfp.size)
    expect(n.mtime).to.equal(nrfp.mtime)
    expect(n.magic).to.be.undefined
    expect(n.hash).to.be.undefined
  }) 

  it('created file node from props w/ uninterested magic should NOT be put into either hashMap or hashless Set', function() {

    let hash = '7a44a28d1da4e2b99eda6060aab85168fe9d09fa7f91831f9ef7c137cdca5751'
    let magic = 'ASCII text'

    nrfp.hash = hash
    nrfp.magic = magic

    let n = t.createNode(t.roots[0], nrfp)

    expect(t.hashless.has(n)).to.be.false  
    expect(t.hashMap.has(hash)).to.be.false
  })

  it('created file node from props w/ interested magic should preserve uuid, name, owner, writelist, readlist, size, mtime, hash, w/o magic', function() {

    nrfp.hash = '7a44a28d1da4e2b99eda6060aab85168fe9d09fa7f91831f9ef7c137cdca5751'
    nrfp.magic = jpegMagic001

    let n = t.createNode(t.roots[0], nrfp)
  
    expect(n.uuid).to.equal(nrfp.uuid)
    expect(n.name).to.equal(nrfp.name)
    expect(n.owner).to.deep.equal(nrfp.owner)
    expect(n.writelist).to.deep.equal(nrfp.writelist)
    expect(n.readlist).to.deep.equal(nrfp.readlist)
    expect(n.size).to.equal(nrfp.size)
    expect(n.mtime).to.equal(nrfp.mtime)
    expect(n.hash).to.equal(nrfp.hash)
    expect(n.magic).to.be.undefined
  }) 

  it('created file node from props w/ interested magic should be put into hashMap but not hashless Set', function() {

    nrfp.hash = '7a44a28d1da4e2b99eda6060aab85168fe9d09fa7f91831f9ef7c137cdca5751'
    nrfp.magic = jpegMagic001

    let n = t.createNode(t.roots[0], nrfp)
    expect(t.hashless.has(n)).to.be.false
    expect(t.hashMap.has(nrfp.hash)).to.be.true
    expect(t.hashMap.get(nrfp.hash).nodes).to.include(n)
  })

  it('created file node from props w/ interested magic w/ extended meta should be put into extended Set', function() {

    nrfp.hash = '7a44a28d1da4e2b99eda6060aab85168fe9d09fa7f91831f9ef7c137cdca5751'
    nrfp.magic = jpegMagic001
    
    let n = t.createNode(t.roots[0], nrfp)
    let digestObj = t.hashMap.get(nrfp.hash)
    expect(t.extended.has(digestObj)).to.be.true 
  })

  it('creating file node from props w/ interested magic w/ extended meta should emit extendedAdded', function() {
  
    let emitted
    nrfp.hash = hash001
    nrfp.magic = jpegMagic001
    t.on('extendedAdded', node => emitted = node)
    t.createNode(t.roots[0], nrfp)
    let d = t.hashMap.get(hash001)
    expect(emitted).to.equal(d)
  })

  it('creating file node from props w/ interested magic w/o extended meta should NOT be put into extended Set', function() {
        
    nrfp.hash = hash001
    nrfp.magic = jpegMagic002
    t.createNode(t.roots[0], nrfp)
    let digestObj = t.hashMap.get(nrfp.hash)
    expect(digestObj.meta.extended).to.be.false 
    expect(t.extended.has(digestObj)).to.be.false
  })
 
  it('creating file node from props w/ interested magic w/o extended meta should NOT emit extendedAdded', function() {

    let emitted
    nrfp.hash = hash001
    nrfp.magic = jpegMagic002
    t.on('extendedAdded', node => emitted = node)
    t.createNode(t.roots[0], nrfp)
    expect(emitted).to.be.undefined
  }) 
})



