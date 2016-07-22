import fs from 'fs'

import Promise from 'bluebird'
import validator from 'validator'

const configFilePath = '/etc/wisnuc.json'

// log
const info = (text) => console.log(`[appifi config] ${text}`)

// global
var config = {}

const writeConfig = () => fs.writeFile(configFilePath, JSON.stringify(config, null, ' '), err => {})

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
    x = fs.readFileSync(configFilePath, { encoding: 'utf8' }) 
    x = JSON.parse(x.toString())

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

    info(`config initialized`)
  }
  catch (e) {
    console.log(e)
    info(`config file not found or io error, use default`)
    config = {
      version: 1,
      lastUsedVolume: null,
      barcelonaFanScale: 50
    } 
    writeback = true
  }

  if (writeback) writeConfig()
  console.log(config)
}

export { initConfig, setConfig, getConfig }

