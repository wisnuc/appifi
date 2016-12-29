import fs from 'fs';
import xattr from 'fs-xattr';


let target = '/home/laraine/Projects/appifi/testpic/20141213.jpg'
xattr.get(target, 'user.fruitmix', (err, attr) => {
  console.log(JSON.parse(attr))
  console.log(JSON.parse(attr).hasOwnProperty('uuid'))
  console.log(JSON.parse(attr).hasOwnProperty('hash'))
  console.log(JSON.parse(attr).hasOwnProperty('htime'))
  console.log(JSON.parse(attr).hasOwnProperty('hash') === JSON.parse(attr).hasOwnProperty('htime'))
})
