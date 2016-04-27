import React from 'react'
import Progress from './Progress'


const getStore = () => window.store.getState().docker



let render = () => {

  let loading = getStore().reposRequest !== null
  if (loading) {
    return <Progress key='appstore_loading' text='loading' />
  }

  let repos = getStore().repos;
  if (repos.length === 0) {
    return <h1>It seems that your computer can not connect to docker hub (hub.docker.com)</h1>
  }

  return (
    <div key='appstore'>
      <span style={{fontSize:28, fontWeight:'100'}}>Recommended</span>
      { getStore().repos.map((repo) => <h1>{repo.name}</h1>) }
    </div>
  )
}

export default render

