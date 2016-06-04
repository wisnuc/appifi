import React from 'react'

import { Paper, Avatar } from 'material-ui'
import { List, ListItem } from 'material-ui/List'
import { Card, CardActions, CardHeader, CardMedia, CardTitle, CardText } from 'material-ui/Card'
import { Tabs, Tab } from 'material-ui/Tabs'
import { FloatingActionButton, IconButton, FlatButton, RaisedButton, Toggle, CircularProgress } from 'material-ui'

import IconAVPlayArrow from 'material-ui/svg-icons/av/play-arrow'
import IconAVStop from 'material-ui/svg-icons/av/stop'

// import reactClickOutside from 'react-click-outside'

import { LabeledText, Spacer } from './CustomViews'
import { dispatch, dockerStore, dockerState } from '../utils/storeState'

const buttonDisabled = {

  created: {
      start: false,
      stop: true,
      restart: true
    },
  running: {
      start: true,
      stop: false,
      restart: false
    },
  restarting: {
      start: true,
      stop: true,
      restart: true,
    },
  paused: {
      notUsed: 0
    },
  exited: {
      start: false,
      stop: true,
      restart: true
    }
}

const startingMe = (container) => {
  
  let { request } = dockerStore()
  return (request && 
          request.operation && 
          request.operation.operation === 'containerStart' && 
          request.operation.args[0] && 
          request.operation.args[0] === container.Id)
}

const stoppingMe = (container) => {

  let { request } = dockerStore()
  return (request && 
          request.operation &&
          request.operation.operation === 'containerStop' && 
          request.operation.args[0] && 
          request.operation.args[0] === container.Id)
}

const containerRunning = (container) => {
 
}

const containerButtonStyle = {
    width: 92,
    height: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center' 
  }

const BusyFlatButton = ({ busy, label, disabled, onTouchTap }) => {

  if (busy)
    return <div style={containerButtonStyle}><CircularProgress size={0.5} /></div>
  
  return <div style={containerButtonStyle}><FlatButton label={label} disabled={disabled} onTouchTap={onTouchTap} /></div> 
}

const OpenButton = ({container}) => {

  const openable = (container) =>
    ( container.State === 'running' &&
      container.Ports.length &&
      container.Ports[0].Type === 'tcp' &&
      container.Ports[0].PublicPort) 


  if (!openable(container)) return <div style={containerButtonStyle} /> 

  let url = `http://${window.location.hostname}:${container.Ports[0].PublicPort}`
  let onOpen = () => window.open(url) 

  return (
    <div style={containerButtonStyle}>
      <FlatButton label="open" primary={true} onTouchTap={ onOpen } />
    </div>
  )
}

const renderHeaderLeft = (avatar, title, text, onClick) => {

  let style = { height: '100%', flexGrow:1, display: 'flex', alignItems: 'center', padding:8 }

  return (
    <div style={style} onClick={onClick} >
      <Avatar style={{marginLeft:8, marginRight:24}} src={avatar} />
      <div style={{fontSize:14, fontWeight:600, width:200}}>{title}</div>
      <div style={{fontSize:14, fontWeight:300, color:'gray'}}>{text}</div>
    </div>
  )
}

const renderHeaderRight = (container) => {

  let startButtonTap = () => 
    dispatch({
      type: 'DOCKER_OPERATION',
      operation: {
        operation: 'containerStart',
        args: [container.Id]
      }
    })

  let stopButtonTap = () => 
    dispatch({
      type: 'DOCKER_OPERATION',
      operation: {
        operation: 'containerStop',
        args: [container.Id]
      }
    })

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding:8 }}> 
      <BusyFlatButton busy={startingMe(container)} label="start" disabled={buttonDisabled[container.State].start} 
        onTouchTap={startButtonTap} />
      <BusyFlatButton busy={stoppingMe(container)} FlatButton label="stop" disabled={buttonDisabled[container.State].stop} 
        onTouchTap ={stopButtonTap} />
      <OpenButton container={container} /> 
    </div>
  )
}

// change definition to container id
let selected = null

const renderContainerCardHeader = (container) => {

  let avatar = 'http://lorempixel.com/100/100/nature/'
  let onClick = () => {
    selected = selected === container.Id ? null : container.Id
    dispatch({type: 'INCREMENT'})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      { renderHeaderLeft(avatar, container.Image, container.Status, onClick) }
      { renderHeaderRight(container) }
    </div>
  ) 
}

const renderContainerCardContent = (container) => {

  let ccdRowStyle = { width: '100%', display: 'flex', flexDirection: 'row', }
  let ccdLeftColStyle = { flex: 1, fontSize: 24, fontWeight: 100 }
  let ccdRightColStyle = { flex: 3 }

  return (
    <div style={{padding:16}}>
      <div style={ccdRowStyle}>
        <div style={ccdLeftColStyle}>General</div>
        <div style={ccdRightColStyle}>
          <LabeledText label='container name' text={container.Names[0].slice(1)} right={4}/>
          <LabeledText label='container id' text={container.Id} right={4}/>
          <LabeledText label='image' text={container.Image} right={4}/>
          <LabeledText label='image id' text={container.ImageID.slice(7)} right={4}/>
          <LabeledText label='state' text={container.State} right={4}/>
          <LabeledText label='status' text={container.Status} right={4}/>
        </div>
      </div>
    </div>
  )
}

const renderContainerCardFooter = (container) => {

  let onTouchTap = () => {
    dispatch({
      type: 'DOCKER_OPERATION',
      operation: {
        operation: 'containerDelete',
        args: [container.Id]
      }
    })  
  }

  return (
    <div style={{padding:8}}>
      <FlatButton label="uninstall" onTouchTap = {onTouchTap} />
    </div>
  )  
}

const renderContainerCard = (container) => {

  let unselect = { width: '98%', marginTop: 0, marginBottom: 0 }
  let select = { width: '100%', marginTop: 24, marginBottom: 24 }

  let s = container.Id === selected   

  return (
    <Paper style={ s ? select : unselect } key={container.Id} rounded={false} zDepth={ s ? 2 : 1 } >
      { renderContainerCardHeader(container) }
      { s && renderContainerCardContent(container) } 
      { s && renderContainerCardFooter(container) }
    </Paper>
  )
}

class ContainerCard extends React.Component {


  render () {

    let docker = dockerState()
    let { request } = dockerStore()

    if (docker === null) {      
      return <div><CircularProgress size={1} /></div>
    }

    if (docker instanceof Error) {
      return <div>Error loading Installed Apps</div>
    }

    let containers = docker.containers

    if (!containers.length) {
      return <div/>
    }
    
    let banner
    if (containers.length === 0) {
      banner = `no app installed`
    }
    else if (containers.length === 1) {
      banner = `1 app installed`
    }
    else (
      banner = `${containers.length} apps installed`
    )

    // TODO marginLeft not accurate
    return (
      <div>
        <div style={{ fontSize:14, marginLeft:30 }} >
          { banner }
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop:16 }}>
          { containers.map(renderContainerCard) }
        </div>
      </div>
    )
  }
}

class InstalledApps extends React.Component {

  render() {
    return (
        <ContainerCard />
    )
  }
}

export default () => {
  return <InstalledApps key='installed-apps-list' />
}


