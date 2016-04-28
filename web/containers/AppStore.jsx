import React from 'react'

import { Card, CardTitle, CardHeader, CardMedia, CardAction, CardText } from 'material-ui/Card'

import Progress from './Progress'

const getStore = () => window.store.getState().docker

let renderCard = (repo) => {
  
  return (
    <Card style={{width:240, marginTop:18, marginRight:18}}>
      <CardHeader title={repo.name} />
      <CardText>Hello World</CardText>
    </Card>
  )  
}

let render = () => {

  let loading = getStore().reposRequest !== null
  if (loading) {
    return <Progress key='appstore_loading' text='Loading Apps from AppStore' />
  }

  let repos = getStore().repos;
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
        { getStore().repos.map(renderCard) }
      </div>
    </div>
  )
}

export default render

