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
      {/* cardTitle(repo) */}
      <CardMedia style={{padding:16, display:'flex', alignItems:'center' }} ><img src={`/images/${repo.imageLink}`}  /></CardMedia>
      { cardHeader(repo) }
      {/*
      <CardActions>
        <FlatButton label="Install" primary={true} onTouchTap={() => {
          dispatch({
            type: 'DOCKER_OPERATION',
            operation: {
              operation: 'appInstall',
              args: [repo.name, 'latest']
            } 
          })
        }}/>
        <FlatButton label="Detail" primary={true} />
      </CardActions>
      */}
    </Card>
  )  
}

let renderCard2 = (repo) => {
  
  return (
    <Paper>
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
      <Paper>
        <div style={{padding:16, display:'flex', alignItems:'center' }} onTouchTap={this.handleOpen}><img src={`/images/${repo.imageLink}`} /></div>
        <div>{repo.alias}</div>
      </Paper> 
      <Dialog
        style={{overflowY: scroll}}
        title="Dialog With Actions"
        actions={null}
        modal={false}
        open={this.state.open}
        onRequestClose={this.handleClose}
      >
        The actions in this window were passed in as an array of React objects.
      </Dialog> 
    </div>
    )
  }
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
      <div style={{fontSize:28, fontWeight:'100'}}>Recommended Apps</div>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}>
        { repos.map(repo => { return <AppCard repo={repo} />}) }
      </div>
    </div>
  )
}

export default render

