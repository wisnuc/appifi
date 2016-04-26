import React from 'react'

const getStore = () => window.store.getState().docker

const AppStore = () => {

  let loading = getStore().reposRequest !== null

  if (loading) {
    return <h1>loading</h1>
  }
  
  if (!getStore().repos.length) {
    return <h1>network error, please reload</h1>
  }

  return (
    <div>
      { <span style={{fontSize:28, fontWeight:100}}>Recommended</span> }
      { getStore().repos.map((repo) => <h1>{repo.name}</h1>) }
    </div>
  )
}

export default AppStore


