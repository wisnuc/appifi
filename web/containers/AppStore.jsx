import React from 'react'

import { Card, CardTitle, CardHeader, CardMedia, CardAction, CardText } from 'material-ui/Card'

import Progress from './Progress'

const dockerStore = () => window.store.getState().docker
const systemStore = () => window.store.getState().storage

let renderCard = (repo) => {
  
  return (
    <Card style={{width:240, marginTop:18, marginRight:18}}>
      <CardHeader title={repo.name} />
      <CardText>Install</CardText>
    </Card>
  )  
}

let render = () => {

  let { repos, reposRequest } = dockerStore() 
  let { storage } = systemStore()

  if (!storage) {
    return <Progress key='appstore_loading' text='Retrieving Information from AppStation' busy={true} />
  }

  if (!storage.daemon.running) {
    if (storage.volumes.length === 0) {
      return <Progress key='appstore_loading' text='For starting AppEngine, you need to create a disk volume.' busy={false} />      
    }
    return <Progress key='appstore_loading' text='AppEngine not started' busy={false} />
  }

  let loading = reposRequest !== null

  if (repos === null && reposRequest === null) // TODO
    return <Progress key='appstore_loading' text='unexpected state, something wrong' />

  if (loading) {
    return <Progress key='appstore_loading' text='Loading Apps from AppStore' busy={true} />
  }

  if (repos.length === 0) {
    return <h1>It seems that your computer can not connect to docker hub (hub.docker.com)</h1>
  }

  return (
    <div key='appstore' >
      <div style={{fontSize:28, fontWeight:'100'}}>Recommended</div>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}>
        { dockerStore().repos.map(renderCard) }
      </div>
    </div>
  )
}

export default render

