import React from 'react'

import { Paper, Avatar, LinearProgress, Divider } from 'material-ui'
import { List, ListItem } from 'material-ui/List'
import { Card, CardActions, CardHeader, CardMedia, CardTitle, CardText } from 'material-ui/Card'
import { Tabs, Tab } from 'material-ui/Tabs'
import { FloatingActionButton, IconButton, FlatButton, RaisedButton, Toggle, CircularProgress } from 'material-ui'

import IconAVPlayArrow from 'material-ui/svg-icons/av/play-arrow'
import IconAVStop from 'material-ui/svg-icons/av/stop'

import { dispatch, dockerStore, serverOpStore, dockerState, taskStates, installedStore } from '../utils/storeState'
import imagePrefix from '../utils/imagePrefix'

import {
  BouncyCardHeaderLeftText,
  BouncyCardHeaderLeft
} from '../components/bouncy'

const C = x => f => f ? C(f(x)) : x

const encodingIndex = enc => C(enc)
  (x => ['en_US', 'zh_CN'].indexOf(x))
  (i => i === -1 ? 0 : i)
  ()

const langMap = {
  undefined: ['[undefined]', '【未定义】'],
  openWebPage: ['open', '打开'],
  seeDetail: ['SEE DETAIL', '详细'],
  btnStart: ['start', '启动'],
  btnStop: ['stop', '停止'],
  btnUninstall: ['uninstall', '卸载'],
  appOfficial: ['Official', '官方应用'],
  statusInstalling: ['Installing...', '正在安装...'],
}

const langText = (prop = 'undefined') => C(prop)
  (x => langMap[x] === undefined ? 'undefined' : x)
  (x => langMap[x][encodingIndex(window.store.getState().lang)])
  ()

const labeledTextStyle = {
  display: 'flex',
  flexDirection: 'row',
  fontSize: 14,
  lineHeight: 1.5
}

const LabeledText = ({label, text, right, styleOverlay}) => 
  ( 
    <div style={styleOverlay ? Object.assign({}, labeledTextStyle, styleOverlay) : labeledTextStyle}>
      <div style={{flex:1, fontWeight:100, fontFamily:'monospace', opacity:'0.54'}}>{label}:</div>
      <div style={{flex:(right || 2), fontFamily:'monospace', opacity:'0.87'}}>{text}</div>
    </div>
  )

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

const containerStartingMe = (container) => {
  
  let op = serverOpStore()
  return (op&& 
          op.operation && 
          op.operation.operation === 'containerStart' && 
          op.operation.args[0] && 
          op.operation.args[0] === container.Id)
}

const installedStartingMe = (installed) => {

  let op = serverOpStore()
  return (op &&
          op.operation &&
          op.operation.operation === 'installedStart' &&
          op.operation.args[0] &&
          op.operation.args[0] === installed.uuid)
}

const containerStoppingMe = (container) => {

  let op = serverOpStore()
  return (op && 
          op.operation &&
          op.operation.operation === 'containerStop' && 
          op.operation.args[0] && 
          op.operation.args[0] === container.Id)
}

const installedStoppingMe = (installed) => {

  let op = serverOpStore()
  return (op &&
          op.operation &&
          op.operation.operation === 'installedStop' &&
          op.operation.args[0] &&
          op.operation.args[0] === installed.uuid)
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

  if (busy) return (<div style={containerButtonStyle}><CircularProgress size={0.5} /></div>)
  return (<div style={containerButtonStyle}><FlatButton label={label} disabled={disabled} onTouchTap={onTouchTap} /></div>)
}

const OpenButton = ({container}) => {

  let port
  if (container.State === 'running') {
    let portObj = container.Ports.find(p => p.Type === 'tcp' && p.PublicPort !== undefined)
    if (portObj) port = portObj.PublicPort 
  }

/*
  const openable = (container) =>
    ( container.State === 'running' &&
      container.Ports.length &&
      container.Ports[0].Type === 'tcp' &&
      container.Ports[0].PublicPort) 


  if (!openable(container)) return <div style={containerButtonStyle} /> 
*/
 
  if (!port) return <div style={containerButtonStyle} /> 

  let url = `http://${window.location.hostname}:${port}`
  let onOpen = () => window.open(url) 
  return (
    <div style={containerButtonStyle}>
      <FlatButton label={langText('openWebPage')} primary={true} onTouchTap={ onOpen } />
    </div>
  )
}

const renderContainerHeaderRight = (container) => {

  let startButtonTap = () => 
    dispatch({
      type: 'SERVEROP_REQUEST',
      data: {
        operation: 'containerStart',
        args: [container.Id]
      }
    })

  let stopButtonTap = () => 
    dispatch({
      type: 'SERVEROP_REQUEST',
      data: {
        operation: 'containerStop',
        args: [container.Id]
      }
    })

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding:8 }}> 
      <BusyFlatButton busy={containerStartingMe(container)} 
        label={langText('btnStart')}
        disabled={buttonDisabled[container.State].start} 
        onTouchTap={startButtonTap} />
      <BusyFlatButton busy={containerStoppingMe(container)} 
        label={langText('btnStop')}
        disabled={buttonDisabled[container.State].stop} 
        onTouchTap ={stopButtonTap} />
      <OpenButton container={container} /> 
    </div>
  )
}

const renderContainerCardHeader = (container) => {

  let avatar = 'http://lorempixel.com/100/100/nature/'
  let onClick = () => {
    let select = installedStore().select
    if (select && select.type === 'container' && select.id === container.Id) {
      dispatch({type: 'INSTALLED_DESELECT'})
    }
    else {
      dispatch({
        type: 'INSTALLED_SELECT',
        select: {
          type: 'container',
          id: container.Id
        }
      })
    }
  }

  return (
    <div style={{display:'flex', alignItems: 'center'}}>
      <BouncyCardHeaderLeft title={container.Image} onClick={onClick}>
        <BouncyCardHeaderLeftText text={container.Status} />
      </BouncyCardHeaderLeft>
      { renderContainerHeaderRight(container) }
    </div>
  ) 
}

// TODO this function may be implemented in backend
const installedMainContainer = (installed) => {

  let containers = dockerState().containers
  let compo = installed.recipe.components[0]
  let image = `${compo.namespace}/${compo.name}`
  return containers.filter(c => installed.containerIds.find(id => id === c.Id))
          .find(c => c.Image === image)
}

const renderInstalledHeaderRight = (installed) => {

  let startButtonTap = () => 
    dispatch({
      type: 'SERVEROP_REQUEST',
      data: {
        operation: 'installedStart',
        args: [installed.uuid]
      }
    })

  let stopButtonTap = () => 
    dispatch({
      type: 'SERVEROP_REQUEST',
      data: {
        operation: 'installedStop',
        args: [installed.uuid]
      }
    })

  let container = installedMainContainer(installed)
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding:8 }}> 
      <BusyFlatButton busy={installedStartingMe(installed)} 
        label={langText('btnStart')}
        disabled={buttonDisabled[container.State].start} 
        onTouchTap={startButtonTap} />
      <BusyFlatButton busy={installedStoppingMe(installed)} 
        label={langText('btnStop')}
        disabled={buttonDisabled[container.State].stop} 
        onTouchTap ={stopButtonTap} />
      <OpenButton container={container} /> 
    </div>
  )
}

const renderInstalledCardHeader = (installed) => {

  let avatar = imagePrefix(`/images/${installed.recipe.components[0].imageLink}`)
  let onClick = () => {
    let select = installedStore().select
    if (select && select.type === 'installed' && select.id === installed.uuid) {
      dispatch({type: 'INSTALLED_DESELECT'})
    }
    else {
      dispatch({
        type: 'INSTALLED_SELECT',
        select: {
          type: 'installed',
          id: installed.uuid
        }
      })
    }
  }

  let container = installedMainContainer(installed)
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <BouncyCardHeaderLeft avatar={avatar} title={installed.recipe.appname} onClick={onClick}>
        <BouncyCardHeaderLeftText text={container.Status} />
      </BouncyCardHeaderLeft>
      { renderInstalledHeaderRight(installed) }
    </div>
  ) 
}

const renderContainerCardContent = (container) => {

  let ccdRowStyle = {display: 'flex'}
  let ccdLeftColStyle = {paddingTop:16, paddingBottom:16, width: 200}
  let ccdRightColStyle = {paddingTop:16, paddingBottom:16, flex: 3}
  let split = container.Image.split('/')
  let namespace = split[0]
  if (namespace === 'library') namespace = langText('appOfficial')
  let name = split[1]

  return (
    <div>
      <div style={ccdRowStyle}>
        <div style={{width:56}} />
        <div style={ccdLeftColStyle}>
          <div style={{fontSize:20, fontWeight:500, opacity:0.87}}>{name}</div>
          <div style={{fontSize:15, fotnWeight:300, opacity:0.54}}>{namespace}</div>
        </div>
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

  let onTouchTap = () => dispatch({ type: 'SERVEROP_REQUEST', data: { operation: 'containerDelete', args: [container.Id] }})   
  return (<div style={{padding:8}}><FlatButton label={langText('btnUninstall')} onTouchTap={onTouchTap} /></div>)  
}

const renderInstalledCardFooter = (installed) => {

  let onTouchTap = () => dispatch({ type: 'SERVEROP_REQUEST', data: { operation: 'appUninstall', args: [installed.uuid] }})
  return (<div style={{padding:8}}><FlatButton label={langText('btnUninstall')} onTouchTap={onTouchTap} /></div>)
}

const renderContainerCard = (container) => {

  let deselected = { width: '98%', marginTop: 0, marginBottom: 0 }
  let selected = { width: '100%', marginTop: 24, marginBottom: 24 }

  let select = installedStore().select
  let me = (select && select.type === 'container' && select.id === container.Id)

  return (
    <Paper style={ me ? selected : deselected } key={container.Id} rounded={false} zDepth={ me ? 2 : 1 } >
      { renderContainerCardHeader(container) }
      { me && <Divider /> }
      { me && renderContainerCardContent(container) } 
      { me && <Divider /> }
      { me && renderContainerCardFooter(container) }
    </Paper>
  )
}

const renderInstalledCard = (installed) => {

  let deselected = { width: '98%', marginTop: 0, marginBottom: 0 }
  let selected = { width: '100%', marginTop: 24, marginBottom: 24 }

  let select = installedStore().select
  let me = (select && select.type === 'installed' && select.id === installed.uuid)

  let container = installedMainContainer(installed)
  return (
    <Paper style={ me ? selected : deselected } key={installed.uuid} rounded={false} zDepth={ me ? 2 : 1 } >
      { renderInstalledCardHeader(installed) }
      { me && <Divider /> }
      { me && renderContainerCardContent(container) }
      { me && <Divider /> }
      { me && renderInstalledCardFooter(installed) }
    </Paper>
  ) 
}

const renderInstallingHeaderRight = (task) => {

  // FIXME
  let stopButtonTap = () => 
    dispatch({
      type: 'SERVEROP_REQUEST',
      operation: {
        operation: 'containerStop',
        args: [task.uuid]
      }
    })

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding:8 }}> 
      <BusyFlatButton busy={false} label={langText('btnStop')} disabled={true} 
        onTouchTap ={stopButtonTap} />
    </div>
  )
}

const renderInstallingCardHeader = (task) => {

  let avatar = imagePrefix(`/images/${task.recipe.components[0].imageLink}`)
  let onClick = () => {
    let select = installedStore().select
    if (select && select.type === 'installed' && select.id === task.uuid) {
      dispatch({type: 'INSTALLED_DESELECT'})
    }
    else {
      dispatch({
        type: 'INSTALLED_SELECT',
        select: {
          type: 'installed',
          id: task.uuid
        }
      })
    }
  }

  return (
    <div style={{display:'flex',alignItems: 'center', justifyContent:'space-between'}}>
      <BouncyCardHeaderLeft avatar={avatar} title={task.recipe.appname} onClick={onClick}>
        <BouncyCardHeaderLeftText text={langText('statusInstalling')} width={200} />
        <LinearProgress mode='indeterminate' style={{maxWidth:300}} />
      </BouncyCardHeaderLeft>
      { renderInstallingHeaderRight(task) }
    </div>
  ) 
}

const renderInstallingCardContentJob = (compo, job) => {

  let threadText = (t) => {
    if (t.progress) {
      let {current, total} = t.progressDetail
      return `${t.status} ( ${current} / ${total} )`
    } 
    return t.status
  }

  let ccdRowStyle = {display: 'flex'}
  let ccdLeftColStyle = {paddingTop:16, paddingBottom:16, width:200}
  let ccdRightColStyle = {paddingTop:16, paddingBottom:16, flex:3}

  // FIXME workaround
  // let key = `${compo.namespace}::${compo.name}`

  return (
    <div style={ccdRowStyle}>
      <div style={{width:56}} />
      <div style={ccdLeftColStyle}>
        <div style={{fontSize:20, fontWeight:500, opacity:0.87}}>{compo.name}</div>
        <div style={{fontSize:15, fotnWeight:300, opacity:0.54}}>{compo.namespace}</div>
      </div>
      <div style={ccdRightColStyle}>
        { job.image.threads && job.image.threads.map(t => <LabeledText key={t.id} label={t.id} text={threadText(t)} right={4} />) }
      </div>
    </div>
  )
}

const renderInstallingCardContent = (task) => {

  return (
    <div>
      { task.jobs.map((j, index) => renderInstallingCardContentJob(task.recipe.components[index], j)) }
    </div>
  )
}

 

const renderInstallingCard = (task) => {

  let deselected = { width: '98%', marginTop: 0, marginBottom: 0 }
  let selected = { width: '100%', marginTop: 24, marginBottom: 24 }

  let select = installedStore().select
  let me = (select && select.type === 'installed' && select.id === task.uuid)

  return (
    <Paper style={ me ? selected : deselected } key={task.uuid} rounded={false} zDepth={ me ? 2 : 1 } >
      { renderInstallingCardHeader(task) }
      { me && (<Divider />) }
      { me && renderInstallingCardContent(task) }
    </Paper>
  ) 
}

/******************************************************************************

  Three elements renders in this page

  1) installing task + no containers
  2) installing task + partly installed containers (transient)
  3) installed task success + all installed containers
  4) installed task failed + partly installed containers
  5) unmanaged containers (orphan)

  in case 2, 3, and 4, there would be a matching uuid between installeds and tasks

  case 3/4 should be considered as truly-installed (properInstalleds)
  case 2 shoudl be considered as installing

*******************************************************************************/

const getInstallingTasks = () => taskStates().filter(t => t.type === 'appInstall' && t.status ==='started')

const getProperInstalleds = () => {
  
  let { installeds } = dockerState()
  let tasks = getInstallingTasks()

  return installeds.filter(inst => 
    undefined === tasks.find(t => t.uuid === inst.uuid))
}

const getOrphanContainers = () => {

  let { installeds, containers } = dockerState()

  let installedContainerIds = 
    installeds.reduce((prev, inst) => 
      [...prev, ...inst.containerIds], [])

  let orphans = containers.filter(c => !installedContainerIds.find(i => i === c.Id)) 
  return orphans
}

const PAGEKEY = 'installed-apps-list'

const renderMyAppsPage = () => {

  let docker = dockerState()
  if (docker === null) {      
    // TODO
    return <div /> 
    return <div key={PAGEKEY}><CircularProgress size={1} /></div>
  }

  let installeds = docker.installeds
  let containers = docker.containers
  
  // TODO marginLeft not accurate
  return (
    <div key={PAGEKEY}>
      {/* <div style={{ fontSize:14, marginLeft:30 }} >Installing</div> */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop:0 }}>
        { getInstallingTasks().map(renderInstallingCard) }
        { getProperInstalleds().map(renderInstalledCard) }
        { getOrphanContainers().map(renderContainerCard) }
      </div>
    </div>
  ) 
}

export default renderMyAppsPage


