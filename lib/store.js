const request = require('superagent')

const hubUrl = 'https://hub.docker.com/v2'
const repoUrl = (repoName) => hubUrl + '/repositories/' + repoName

// TODO this should be retrieved elsewhere (say, github?)
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

/* this promise never reject */
function requestRepo(name) {

  return new Promise((resolve, reject) => {

    request.get(repoUrl(name))
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) resolve(err)
        else if (!res.ok) resovle(new Error('Bad Response'))
        else resolve(res.body)
      })
  })
}

async function requestAllRepos() {

  console.log('requesting repo list')
  let responses = await Promise.all(repoList.map(repo => requestRepo(repo.name)))
  console.log('requesting repo list end')
  return responses.filter(res => (!(res instanceof Error)))
}

module.exports = (callback) => {

  requestAllRepos()
    .then(r => {
      callback(null, r)
    })
    .catch(e => {
      console.log(e)
      callback(null, [])
    })
}

