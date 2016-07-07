import React from 'react'

import { Card, CardTitle, CardHeader, CardMedia, CardActions, CardText } from 'material-ui/Card'
import { FlatButton, RaisedButton, Paper, Dialog } from 'material-ui'

// TODO
import Progress from './Progress'

import { dispatch, appstoreStore, dockerState, storageState, appstoreState, taskStates } from '../utils/storeState'
import imagePrefix from '../utils/imagePrefix'

const formatNumber = (num) => {

  if (num > 999999) {
    return (num/1000000).toFixed(1) + 'M'
  }
  else if (num > 999) {
    return (num/1000).toFixed(1) + 'K'
  }
  return num
}

// return installed 
const appInstalled = (app) => {
  let installeds = dockerState().installeds
  return installeds.find(inst => inst.recipeKeyString === app.key)
}

// return task
const appInstalling = (app) => {
  let tasks = taskStates()
  if (!tasks || !tasks.length) return false
  return tasks.find(t => t.type === 'appInstall' && t.id === app.key && t.status === 'started')
}

const InstallingBoard = ({}) => {
  
}

const SelectedApp = ({
    imgSrc, 
    title, 
    subtitle,
    stars,
    pulls,
    buttonDisabled,
    buttonLabel,
    buttonText,
    buttonOnTouchTap,
    description
  }) => (
    <div>
      <div style={{display: 'flex', flexDirection: 'row'}}>
        <div><img src={imgSrc} /></div>
        <div style={{marginLeft: 16, width:'100%', display:'flex', flexDirection:'column', alignItems:'stretch', justifyContent:'space-between'}} >
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{fontSize:28, fontWeight:100, lineHeight:'32px'}}>{title}</div>
              <div style={{width:160, display:'flex', alignItems:'center'}}>
                <div style={{flex:1, fontSize:14, fontWeight:900, lineHeight:'18px', color:'gray'}}>{'\u2605 ' + formatNumber(stars)}</div>
                <div style={{flex:1, fontSize:14, fontWeight:900, lineHeight:'18px', color:'gray'}}>{'\u2198 ' + formatNumber(pulls)}</div> 
              </div>
            </div>
            <div style={{fontSize:14, fontWeight:500, lineHeight:'32px'}}>{subtitle}</div>
            <div style={{height:8}} />
            <div>{description}</div>
          </div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div>{buttonText}</div>
            <RaisedButton style={{width:120}} label={buttonLabel} primary={true} disabled={buttonDisabled} onTouchTap={buttonOnTouchTap}/>
          </div>
        </div>
      </div>
    </div>
  )

/* equivalent to container component */
const renderSelectedApp = (app) => {
  
  if (!app) return null

  let buttonDisabled, buttonLabel, buttonText, buttonOnTouchTap
  let installed = appInstalled(app)
  let installing = appInstalling(app)

  if (installed) {
    buttonDisabled = false
    buttonLabel = 'SEE DETAIL'
    buttonText = 'This app is already installed'
    buttonOnTouchTap = () => {
      dispatch({
        type: 'STORE_SELECTEDAPP',
        selectedApp: null
      })
      dispatch({
        type: 'NAV_SELECT',
        select: 'INSTALLED_APPS'
      })
      dispatch({
        type: 'INSTALLED_SELECT',
        select: {
          type: 'installed',
          id: installed.uuid 
        }
      })
    }
  }
  else if (installing) {
    buttonDisabled = false
    buttonLabel = 'SEE DETAIL'
    buttonText = 'This app is installing.'
    buttonOnTouchTap = () => {
      dispatch({
        type: 'STORE_SELECTEDAPP',
        selectedApp: null
      })
      dispatch({
        type: 'NAV_SELECT',
        select: 'INSTALLED_APPS'
      })
      dispatch({
        type: 'INSTALLED_SELECT',
        select: {
          type: 'installed',
          id: installing.uuid 
        }
      })
    }
  }
  else {
    buttonDisabled = false
    buttonLabel = 'INSTALL'
    buttonText = 'This app is not installed.'
    buttonOnTouchTap = () => {
      dispatch({
        type: 'DOCKER_OPERATION',
        operation: {
          operation: 'appInstall',
          args: [app.key]
        } 
      })
    }
  }

  let repo = app.components[0].repo

  return (
    <SelectedApp
      imgSrc={imagePrefix(`/images/${app.components[0].imageLink}`)}
      title={app.appname}
      subtitle={app.components[0].namespace}
      stars={repo ? repo.star_count : 'n/a'}
      pulls={repo ? repo.pull_count : 'n/a'}
      buttonDisabled={buttonDisabled}
      buttonLabel={buttonLabel}
      buttonText={buttonText}
      buttonOnTouchTap={buttonOnTouchTap}
      description={repo ? repo.description : 'n/a'}
    /> 
  )
}

const AppCard = ({
    imgSrc,
    title,
    stars,
    pulls,
    status,
    onTouchTap
  }) => (
    <Paper style={{width:160, marginTop:16, marginRight:8}}>
      <div 
        style={{padding:16, display:'flex', alignItems:'center' }} 
        onTouchTap={onTouchTap}
      >
        <img style={{width:128, height:128}} src={imgSrc} />
      </div>
      <div style={{paddingLeft:16, paddingRight:16, paddingBottom:16}} >
        <div style={{fontSize:16, lineHeight:'28px', opacity:0.87}}>{title}</div>
        <div style={{display:'flex'}}>
          <div style={{flex:1, fontSize:12, lineHeight:'18px', opacity:0.54}}>{'\u2605 ' + formatNumber(stars)}</div>
          <div style={{flex:1, fontSize:12, lineHeight:'18px', opacity:0.54}}>{'\u2198 ' + formatNumber(pulls)}</div>
        </div>
      </div>
    </Paper> 
  )

const renderAppCard = (app) => {

  let repo = app.components[0].repo

  return (
    <AppCard
      key={app.appname}
      imgSrc={imagePrefix(`/images/${app.components[0].imageLink}`)} 
      title={app.appname}
      stars={repo ? repo.star_count : 'n/a'}
      pulls={repo ? repo.pull_count : 'n/a'}
      onTouchTap={() => dispatch({
        type: 'STORE_SELECTEDAPP',
        selectedApp: app
      })}
    />
  )
}

const PAGEKEY = 'appstore-page-key'

let render = () => {

  let { error, request, timeout, selectedApp } = appstoreStore()
  let appstore = appstoreState()
  let storage = storageState()
  let docker = dockerState()

  if (!storage || storage instanceof Error) {
    return <div key={PAGEKEY}><Progress key='appstore_loading' text='Connecting to AppStation' busy={true} /></div>
  }

  if (docker === null) {

    console.log(`[AppStore] docker is null`)
    if (storage.volumes.length === 0) {
      console.log(`[AppStore] storage no volume`)
      return null
    }
    return <div key={PAGEKEY}><Progress key='appstore_loading' text='AppEngine not started' busy={false} /></div>
  }

  if (appstore === null) {
    return <Progress key='appstore_loading' text='AppStore not started' busy={false} />
  }

  if (appstore.status === 'ERROR') { // TODO
    return (<div key='appstore_loading'>Error loading appstore, please refresh</div>
    )
  }

  if (appstore.status === 'LOADING') {
    return <Progress key='appstore_loading' text='Loading Apps from AppStore' busy={true} />
  }

  // Assert status is success
  if (appstore.result.length === 0) {
    return <Progress key='appstore_loading' text='It seems that your computer can not connect to docker hub (hub.docker.com)' busy={false} />
  }

  return (
    <div key='appstore' >
      <div style={{fontSize:16, opacity:0.54}}>Recommended Apps</div>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
      }}>
        { appstore.result.map(app => renderAppCard(app)) }
      </div>
      <Dialog
        style={{overflowY: scroll}}
        actions={null}
        modal={false}
        open={selectedApp !== null}
        onRequestClose={() => dispatch({
          type: 'STORE_SELECTEDAPP',
          selectedApp: null
        })}
      >
        { renderSelectedApp(selectedApp) }
      </Dialog>
    </div>
  )
}

export default render

