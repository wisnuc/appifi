import fs from 'fs'

const configFilePath = '/etc/wisnuc.json'

const info = (text) => console.log(`[docker config] ${text}`)

async function readConfig() {

  return new Promise((resolve) => { // never reject
  
    fs.readFile(configFilePath, (err, data) => {

      let def = { lastUsedVolume: null }
      if (err) {
        info('WARNING: error reading docker config file, using default')
        resolve(def)
      }
      else {
        try {
          let r = JSON.parse(data.toString())
          resolve(r)
        }
        catch (e) {
          info('WARNING: error parsing docker config file, using default')
          info(data.toString())
          resolve(def)
        }
      }
    })
  })
}

async function saveConfig(config) {

  return new Promise((resolve) => { // never reject

    fs.writeFile(configFilePath, JSON.stringify(config, null, '  '), (err) => {
      if (err) console.log(err)
      resolve()
    }) 
  })  
}

export { readConfig, saveConfig }

