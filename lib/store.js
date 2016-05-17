const request = require('superagent')

const hubUrl = 'https://hub.docker.com/v2'
const repoUrl = (repoName) => hubUrl + '/repositories/' + repoName

// TODO this should be retrieved elsewhere (say, github?)
let repoList = [
  {
    name: 'library/busybox',
    alias: 'busybox',
    image: 'busybox.png'
  },
  {
    name: 'aptalca/docker-rdp-calibre',
    alias: 'calibre',
    image: 'calibre.png'
  },
  {
    name: 'library/elasticsearch',
    alias: 'elasticsearch',
    image: 'elasticsearch.png'
  },
  {
    name: 'library/httpd',
    alias: 'apache',
    image: 'apache.png'
  },
 {
    name: 'library/solr',
    alias: 'solr',
    image: 'solr.png'
  },
  {
    name: 'library/owncloud',
    alias: 'owncloud',
    image: 'owncloud.png'
  },
  {
    name: 'library/redis',
    alias: 'redis',
    image: 'redis.png'
  },
  {
    name: 'dperson/transmission',
    alias: 'transmission',
    image: 'transmission.png'
  },
  {
    name: 'library/postgres',
    alias: 'postgres',
    image: 'postgresql.png'
  },
  {
    name: 'library/wordpress',
    alias: 'wordpress',
    image: 'wordpress.png'
  },
]


function requestTag(url) {

  return new Promise((resolve, reject) => {
    
    request.get(url)
      .set('Accpt', 'application/json')
      .end((err, res) => {
        if (err) resolve(err)
        else if (!res.ok) resolve(new Error('Bad Response'))
        else resolve(res.body)
      })
  })
}

/** TODO too much! **/
async function requestAllTags(name) {

  let url = repoUrl(name) + '/tags'
  let all = []

  while (true) {

    console.log(url)    
    let r = await requestTag(url)
    if (r instanceof Error) {
      console.log(r)
      return r
    }

    all = [...all, ...r.results]
    if (r.next === null)
      return all

    url = r.next
  }
}


/* this promise never reject */
async function requestRepo(repo) {

  let task =  new Promise((resolve, reject) => {

    request.get(repoUrl(repo.name))
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) resolve(err)
        else if (!res.ok) resovle(new Error('Bad Response'))
        else resolve(res.body)
      })
  }) 

  /**
  let r = await Promise.all([repo, requestAllTags(name)])
  if (r[0] instanceof Error || r[1] instanceof Error)
    return new Error('Bad Response')

  return Object.assign(r[0], { tags: r[1]})
  **/

  let r = await task
  if (r instanceof Error) 
    return r

  return Object.assign({}, r, { alias: repo.alias, imageLink: repo.image })
}


async function requestAllRepos() {

  console.log('requesting repo list')
  let responses = await Promise.all(repoList.map(repo => requestRepo(repo)))
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

