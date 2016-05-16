import React from 'react'

import { Paper, Avatar } from 'material-ui'
import { List, ListItem } from 'material-ui/List'
import { Card, CardActions, CardHeader, CardMedia, CardTitle, CardText } from 'material-ui/Card'
import { Tabs, Tab } from 'material-ui/Tabs'
import { FloatingActionButton, IconButton, FlatButton, RaisedButton, Toggle, CircularProgress } from 'material-ui'

import IconAVPlayArrow from 'material-ui/svg-icons/av/play-arrow'
import IconAVStop from 'material-ui/svg-icons/av/stop'
import CommunicationEmail from 'material-ui/svg-icons/communication/email'
import reactClickOutside from 'react-click-outside'

import { LabeledText, Spacer } from './CustomViews'
import { store, dispatch } from '../utils/utils'

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
  
  let { request } = store().getState().docker
  console.log(request)
  return (request && 
          request.operation && 
          request.operation.operation === 'containerStart' && 
          request.operation.args[0] && 
          request.operation.args[0] === container.Id)
}

const stoppingMe = (container) => {

  let { request } = store().getState().docker
  return (request && 
          request.operation &&
          request.operation.operation === 'containerStop' && 
          request.operation.args[0] && 
          request.operation.args[0] === container.Id)
}

const BusyFlatButton = ({ busy, label, disabled, onTouchTap }) => {

  let style = {
    width: 92,
    height: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center' 
  }

  if (busy)
    return <div style={style}><CircularProgress size={0.5} /></div>
  
  return <div><FlatButton style={style} label={label} disabled={disabled} onTouchTap={onTouchTap} /></div> 
}

class ListRowLeft extends React.Component {

  static propTypes = {
    selected: React.PropTypes.bool.isRequired,
    avatar: React.PropTypes.string.isRequired,
    title: React.PropTypes.string.isRequired,
    text: React.PropTypes.string.isRequired,
    onClick: React.PropTypes.func.isRequired,
    onClickOutside: React.PropTypes.func.isRequired,
  }
 
  handleClickOutside() {

    if (!this.props.selected) return
    console.log('click outside')
    this.props.onClickOutside()
  }
 
  render() {
    return (
      <div 
        style={{
          height: '100%',// TODO 
          flexGrow:1,
          display: 'flex', 
          alignItems: 'center', 
          padding:8,
        }} 
        onClick={()=>this.props.onClick()}
      >
        <Avatar style={{marginLeft:8, marginRight:24}} src={this.props.avatar} />
        <div style={{fontSize:14, fontWeight:600, width:200}}>{this.props.title}</div>
        <div style={{fontSize:14, fontWeight:300, color:'gray'}}>{this.props.text}</div>
      </div>
    )
  }
}

let EnhancedListRowLeft = reactClickOutside(ListRowLeft)

let selected = -1

class ContainerCard extends React.Component {

  static rowStyleUnselected = {
          width: 'calc(100% - 24px)',
          height: 'auto',
          marginTop: 0,
          marginBottom: 0,
        }

  static rowStyleSelected = {
          width: '100%',
          height: '240px',
          marginTop: 24,
          marginBottom: 24,
        }

  static rowStyle = {
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
        }

  static leftColStyle = {
          flex: 1,
          fontSize: 24,
          fontWeight: 100
        }

  static rightColStyle = {
          flex: 3,
        }

  buildRowItem = (container, index) => {
   
    return (
      <Paper
        style={ index === selected ? ContainerCard.rowStyleSelected : ContainerCard.rowStyleUnselected }
        key={ index }
        rounded={false}
        zDepth={ index === selected ? 2:1}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center'
        }}>
          <EnhancedListRowLeft
            selected={selected === index ? true : false}
            avatar='http://lorempixel.com/100/100/nature/'
            title={container.Image}
            text={container.Status}
            onClick={() => {
              selected = selected === index ? -1 : index
              window.store.dispatch({type: 'trigger'})
            }}
            onClickOutside={() => {
              console.log('onClickOutside ...')
              if (selected === index) {
                console.log(selected)
                console.log(index)
                selected = -1
                window.store.dispatch({type: 'trigger'})
              }
            }}
          /> 
          <div style={{ display: 'flex', alignItems: 'center', padding:8 }}> 
            <BusyFlatButton busy={startingMe(container)} label="start" disabled={buttonDisabled[container.State].start} 
              onTouchTap={ () => {
                dispatch({
                  type: 'DOCKER_OPERATION',
                  operation: {
                    operation: 'containerStart',
                    args: [container.Id]
                  }
                })
              }}
            />
            <BusyFlatButton busy={stoppingMe(container)} FlatButton label="stop" disabled={buttonDisabled[container.State].stop} 
              onTouchTap ={ () => {
                dispatch({
                  type: 'DOCKER_OPERATION',
                  operation: {
                    operation: 'containerStop',
                    args: [container.Id]
                  }
                })
              }}
            />
            {/* <FlatButton label="restart" disabled={buttonDisabled[container.State].restart} /> */}
            
          </div>
        </div>
        { index === selected && 
          <div style={{padding:16}}>
            <div style={ContainerCard.rowStyle}>
              <div style={ContainerCard.leftColStyle}>General</div>
              <div style={ContainerCard.rightColStyle}>
                <LabeledText label='container name' text={container.Names[0].slice(1)} right={4}/>
                <LabeledText label='container id' text={container.Id} right={4}/>
                <LabeledText label='image' text={container.Image} right={4}/>
                <LabeledText label='image id' text={container.ImageID.slice(7)} right={4}/>
                <LabeledText label='state' text={container.State} right={4}/>
                <LabeledText label='status' text={container.Status} right={4}/>
              </div>
            </div>
            <div>
              <FlatButton label="uninstall" 
                onTouchTap = { () => {
                  dispatch({
                    type: 'DOCKER_OPERATION',
                    operation: {
                      operation: 'containerRemove',
                      args: [container.Id]
                    }
                  })  
                }}
              />
            </div>
          </div>
        }
      </Paper>
    )
  }

  render () {

    let state = store().getState()
    let { docker, request } = state.docker

    if (docker === null) {
      dispatch({ 
        type: 'DOCKER_OPERATION', 
        operation: {
          operation: 'get'
        }
      })
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
          { containers.map(this.buildRowItem) }
        </div>
      </div>
    )
  }
}

class InstalledApps extends React.Component {

  render() {

    let state = window.store.getState().docker

    return (
      <div>
        <ContainerCard />
      </div> 
    )
  }
}

export default () => {
  return <InstalledApps key='installed-apps-list' />
}


