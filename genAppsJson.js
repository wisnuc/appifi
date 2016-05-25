import fs from 'fs'
import apps from './hosted/apps'

try {

  let json = JSON.stringify(apps, null, '  ')
  fs.writeFile('./hosted/apps.json', json, function(err) {
    if(err) {
      return console.log(err)
    }

    console.log('The file was saved!')
  })
}
catch (e) {
  console.log(e)
}


