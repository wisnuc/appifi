import React from 'react'

import { Card, CardTitle, CardHeader, CardMedia, CardAction, CardText } from 'material-ui/Card'

import Progress from './Progress'
import { store, dispatch } from '../utils/utils'


let renderCard = (repo) => {
  
  return (
    <Card style={{width:240, marginTop:18, marginRight:18}}>
      <CardHeader title={repo.name} />
      <CardText>Install</CardText>
    </Card>
  )  
}

let render = () => {

  let state = store().getState()
  let { repos, request } = state.store
  let { storage } = state.storage
  let { docker } = state.docker

  if (!storage || storage instanceof Error) {
    return <Progress key='appstore_loading' text='Connecting to AppStation' busy={true} />
  }

//  if (!storage.daemon.running) {
  if (docker.status <= 0) {
    if (storage.volumes.length === 0) {
      return <Progress key='appstore_loading' text='AppEngine not started. For starting AppEngine, you need to create a disk volume first.' busy={false} />      
    }
    return <Progress key='appstore_loading' text='AppEngine not started' busy={false} />
  }

  if (repos === null) {
    if (request === null) 
      dispatch({ type: 'STORE_RELOAD'  })
    return <Progress key='appstore_loading' text='Loading Apps from AppStore' busy={true} />
  }

  if (repos instanceof Error) { // TODO
    return <Progress key='appstore_loading' text='Error loading Apps from AppStore' busy={false} />
  }

  if (repos.length === 0) {
    return <Progress key='appstore_loading' text='It seems that your computer can not connect to docker hub (hub.docker.com)' busy={false} />
  }

  return (
    <div key='appstore' >
      <div style={{fontSize:28, fontWeight:'100'}}>Recommended</div>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}>
        { repos.map(renderCard) }
      </div>
    </div>
  )
}

export default render

