'use strict'

var express = require('express')
var router = express.Router()
var request = require('superagent')
var async = require('async')

let baseUrl = 'https://hub.docker.com/v2'
let repoUrl = (repoName) => baseUrl + '/repositories/' + repoName

let repoList = [
  {
    name: 'library/owncloud'
  },
  {
    name: 'library/jenkins'
  },
  {
    name: 'library/redis'
  }
]

router.get('/', function(req, res, next) {

  let resultList = []
  let taskQueue = async.queue((repo, callback) => {
    request.get(repoUrl(repo.name))
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) {
          callback(err)
        }
        else if (!res.ok) {
          callback(new Error('unknown error'))
        } 
        else {
          callback(null, res.body)
        }
      })
  })

  taskQueue.drain = () => {
//    console.log(resultList)
    res.status(200).json(resultList)
  }

  repoList.map((repo) => taskQueue.push(repo, (err, result) => !err &&  resultList.push(result)))
})

module.exports = router

