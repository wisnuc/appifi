import fs from 'fs'

import Promise from 'bluebird'
import validator from 'validator'

const configFilePath = '/etc/wisnuc.json'

// log
const info = (text) => console.log(`[docker config] ${text}`)

// global
var config = {}

const writeConfig = () => fs.writeFile(configFilePath, config, err => {})

const getConfig = (name) => config[name]

const setConfig = (name, value) => {

  if (!config.hasOwnProperty(name)) return
  if (config[name] === value) return

  config[name] = value
  writeConfig()
}

const initConfig = () => {
 
  let x, y, writeback = false

  // read config file
  try {
    x = fs.readFileSync(configFilePath) 
    x = JSON.parse(x)

    y = x.version
    if (y === 1) 
      config.version = 1
    else {
      config.version = 1
      writeback = true
    }

    y = x.lastUsedVolume
    if (y === null || ((typeof y === 'string') && validator.isUUID(y))) 
      config.lastUsedVolume = y
    else {
      config.lastUsedVolume = null
      writeback = true
    }

    y = x.barcelonaFanScale
    if (y && typeof y === 'number' && y >= 0 && y <= 100)
      config.barcelonaFanScale = y
    else {
      config.barcelonaFanScale = 50
      writeback = true
    }
  }
  catch (e) {
    config = {
      version: 1,
      lastUsedVolume: null,
      barcelonaFanScale: 50
    } 
    writeback = true
  }

  if (writeback) writeConfig()
}

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

export { readConfig, saveConfig, initConfig, setConfig, getConfig }

