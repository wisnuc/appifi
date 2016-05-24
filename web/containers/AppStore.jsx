import React from 'react'

import { Card, CardTitle, CardHeader, CardMedia, CardActions, CardText } from 'material-ui/Card'
import { FlatButton, RaisedButton, Paper, Dialog } from 'material-ui'

import Progress from './Progress'
import { store, dispatch } from '../utils/utils'


const cardTitle = (repo) => {

  if (repo.namespace === 'library')
    return <CardTitle titleStyle={{fontSize:24, fontWeight:100}} title={repo.alias} subtitle='official' />
  else
    return <CardTitle titleStyle={{fontSize:24, fontWeight:100}} title={repo.alias} subtitle={repo.namespace} />
}

const cardHeader = (repo) => {

  if (repo.namespace === 'library')
    return <CardHeader title={repo.alias} subtitle='official' />
  else 
    return <CardHeader title={repo.alias} subtitle={repo.namespace} />
}

let renderCard = (repo) => {
  
  return (
    <Card style={{width:160, marginTop:16, marginRight:16}}>
      <CardMedia style={{padding:16, display:'flex', alignItems:'center' }} ><img src={`/images/${repo.imageLink}`}  /></CardMedia>
      { cardHeader(repo) }
    </Card>
  )  
}

let renderCard2 = (repo) => {
  
  return (
    <Paper style={{width:160, marginTop:16, marginRight:16}}>
      <div style={{padding:16, display:'flex', alignItems:'center' }} onTouchTap><img src={`/images/${repo.imageLink}`} /></div>
      <div>{repo.alias}</div>
    </Paper>
  )
}

class AppCard extends React.Component {

  static propTypes = {
    repo: React.PropTypes.object.isRequired
  } 

  state = {
    open: false
  }

  handleOpen = () => {
    this.setState({open: true});
  }

  handleClose = () => {
    this.setState({open: false});
  }

  render() {
    
    let repo = this.props.repo

    return (
    <div>
      <Paper style={{width:160, marginTop:16, marginRight:8}}>
        <div style={{padding:16, display:'flex', alignItems:'center' }} onTouchTap={this.handleOpen}>
          <img style={{width:128, height:128}} src={`/images/${repo.imageLink}`} />
        </div>
        <div style={{paddingLeft:16, paddingRight:16, paddingBottom:16}}>
          <div style={{fontSize:16, fontWeight:100, lineHeight:'18px'}}>{repo.alias}</div>
        </div>
      </Paper> 
      <Dialog
        style={{overflowY: scroll}}
        actions={null}
        modal={false}
        open={this.state.open}
        onRequestClose={this.handleClose}
      >
        <div style={{display: 'flex', flexDirection: 'row'}}>
          <div><img src={`/images/${repo.imageLink}`} /></div>
          <div style={{marginLeft: 16}} >
            <div style={{fontSize: 28, fontWeight: 100}}>{ repo.alias }</div>
            <div style={{fontSize: 14, fontWeight: 500}}>{ repo.user }</div>
          </div>
        </div>
        <div>
          { repo.description }
        </div>
      </Dialog> 
    </div>
    )
  }
}

let render = () => {

  let state = store().getState()
  let { appstore, request } = state.store
  let { storage } = state.storage
  let { docker } = state.docker


  if (!storage || storage instanceof Error) {
    return <Progress key='appstore_loading' text='Connecting to AppStation' busy={true} />
  }

  if (docker.status <= 0) {
    if (storage.volumes.length === 0) {
      return <Progress key='appstore_loading' text='AppEngine not started. For starting AppEngine, you need to create a disk volume first.' busy={false} />      
    }
    return <Progress key='appstore_loading' text='AppEngine not started' busy={false} />
  }

  if (appstore === null) {
    if (request === null) 
      dispatch({ type: 'STORE_RELOAD'  })
    return <Progress key='appstore_loading' text='Loading Apps from AppStore' busy={true} />
  }

  if (appstore.status === 'error') {
    return <div>Error loading appstore, please refresh</div>
  }

  if (appstore.status === 'init') {
    return <div>Server status error, probably you need to restart server</div>
  } 

  if (appstore.status === 'refreshing') {
    return <Progress key='appstore_loading' text='Loading Apps from AppStore' busy={true} />
  }

  // Assert status is success
  if (appstore.apps.length === 0) {
    return <Progress key='appstore_loading' text='It seems that your computer can not connect to docker hub (hub.docker.com)' busy={false} />
  }

  return (
    <div key='appstore' >
      <div style={{fontSize:28, fontWeight:'100'}}>Recommended Apps</div>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}>
        { appstore.apps.map(repo => { return <AppCard repo={repo} />}) }
      </div>
    </div>
  )
}

export default render

