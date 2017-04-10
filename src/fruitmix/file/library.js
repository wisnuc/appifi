import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

import mkdirp from 'mkdirp'
const validator = require('validator')

import { DIR } from './const'
import { localUsers } from '../cluster/model'

const isUUID = (uuid) => (typeof uuid === 'string') ? validator.isUUID(uuid) : false


const librariesMigration =  (filedata) => {
  localUsers((e, users) => {
    let userLibraries = users.filter( user => user.library === 'string' && user.library )
                              .map( user => user.library)

    userLibraries.forEach((library => {

    }))                            
  })
}

const libraryMigration = (libraryNode) => {
  if(!libraryNode) return 
  if(!(libraryNode.children instanceof Array)) return
  let libraryPath = libraryNode.absPath()
  libraryNode.children.forEach(deviceUUID => {
    if(!isUUID(uuid)) return 
    let devicePath = path.join(libraryPath, deviceUUID)
    fs.readdir(devicePath, (err, files) => {
      if(err) return 
      
      let count = files.length
      
      let done = () => {
        count--
        if(count == 0){
          //del devicePath

        }
      }

      files.forEach(file => {
         // src is in tmp folder
        let dirpath = path.join(libraryPath, file.slice(0, 2))
        let filepath = path.join(dirpath, file.slice(2))   

        mkdirp(dirpath, err => { // create head dir
          if(err) return done()
          fs.rename(tmppath, filepath, err => {
            // TODO  if error 
            return done()                    
          }) 
        })
      })
    })
  })
}