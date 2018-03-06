import path from 'path'
import { createNode } from 'src/fruitmix/lib/node'

import { expect } from 'chai'

const uuid1 = '8b223227-f239-4c3f-b079-6b8e21b44037'
const mtime1 = 1481865934452

describe(path.basename(__filename), function() {
  describe('createNode', function() {
    it('should create a file node with uuid, type, name, mtime, size', function() {
      let props = {
        uuid: uuid1,
        type: 'file',
        name: 'hello',
        mtime: mtime1,
        size: 12
      }

      let node = createNode(props)
      
      expect(node.parent).to.be.null
      expect(node.getChildren()).to.deep.equal([])
      expect(node.uuid).to.equal(props.uuid)
      expect(node.type).to.equal(props.type)
      expect(node.name).to.equal(props.name)
      expect(node.mtime).to.equal(props.mtime)
      expect(node.size).to.equal(props.size)
    })
  })
})
