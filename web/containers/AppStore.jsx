import React from 'react'

import { Card, CardTitle, CardHeader, CardMedia, CardActions, CardText } from 'material-ui/Card'
import { FlatButton, RaisedButton, Paper, Dialog, TextField } from 'material-ui'
import { grey50, grey100, grey200, grey300, grey400, grey500 } from 'material-ui/styles/colors'
import ContentAdd from 'material-ui/svg-icons/content/add'

import JumbotronText from './JumbotronText'

import { dispatch, appstoreStore, dockerState, appstoreState, taskStates } from '../utils/storeState'

import imagePrefix from '../utils/imagePrefix'

const C = x => f => f ? C(f(x)) : x

const encodingIndex = enc => C(enc)
  (x => ['en_US', 'zh_CN'].indexOf(x))
  (i => i === -1 ? 0 : i)
  ()

const langMap = {
  undefined: ['[undefined]', '【未定义】'],
  seeDetail: ['SEE DETAIL', '详细'],
  thisAppAlreadyInstalled: ['This app is already installed.', '该应用已经安装。'],
  thisAppIsInstalling: ['This app is installing.', '该应用正在安装。'],
  thisAppIsNotInstalled: ['This app is not installed.', '该应用尚未安装。'],
  appstoreRefresh: ['refresh', '刷新'],
  btnInstall: ['INSTALL', '安装'],
  appEngineNotStarted: ['AppEngine not started', '应用引擎尚未启动'],
  appstoreUnavail: ['AppStore not ready', '应用商店尚未准备好'],
  appstoreError: ['AppStore Error, failed to loading recipes from github.com', 
    '应用商店错误，未能从Github.com载入应用列表。'],
  appstoreLoading: ['Loading Apps from AppStore', '正在载入应用列表'],
  appstoreErrorDockerhub: ['AppStore Error, failed loading repository information from hub.docker.com',
    '应用商店错误，未能从hub.docker.com载入应用的软件池信息'],
  recommendedApps: ['Recommended Apps', '推荐应用'],
}

const langText = (prop = 'undefined') => C(prop)
  (x => langMap[x] === undefined ? 'undefined' : x)
  (x => langMap[x][encodingIndex(window.store.getState().lang)])
  ()


const formatNumber = (num) => 
  (num > 999999) ? (num/1000000).toFixed(1) + 'M' : 
    (num > 999) ? (num/1000).toFixed(1) + 'K' : num

const appInstalled = (app) => 
  dockerState().installeds.find(inst => inst.recipeKeyString === app.key)

const appInstalling = (app) => {
  let tasks = taskStates()
  if (!tasks || !tasks.length) return false
  return tasks.find(t => t.type === 'appInstall' && t.id === app.key && t.status === 'started')
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


class CustomAppDialog extends React.Component {

  constructor(props) {
    super(props)
    this.state = {}
    this.state.value = props.value ? props.value : ''
  }

  render() {
    return (
      <Dialog 
        bodyStyle={{overflowX: 'hidden'}}
        title='创建自定义Docker应用'
        actions={[
          <FlatButton label='Cancel' primary={true} 
            onTouchTap={() => dispatch({ type: 'STORE_CUSTOMAPP', data: false })}
          />,
          <FlatButton label='OK' primary={true} />
        ]}
        modal={true}
        open={this.props.open}
      >
        <TextField 
          textareaStyle={{border: `solid 1px ${grey200}`, fontFamily: 'monospace'}}
          floatingLabelText='编辑自定义Docke应用配置'
          fullWidth={true}
          multiLine={true}
          rows={12}
          rowsMax={12}
          underlineShow={false}
        />
      </Dialog>
    )
  }
}

/* equivalent to container component */
const renderSelectedApp = (app) => {
  
  if (!app) return null

  let buttonDisabled, buttonLabel, buttonText, buttonOnTouchTap
  let installed = appInstalled(app)
  let installing = appInstalling(app)

  if (installed) {
    buttonDisabled = false
    buttonLabel = langText('seeDetail')
    buttonText = langText('thisAppAlreadyInstalled')
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
    buttonLabel = langText('seeDetail')
    buttonText = langText('thisAppIsInstalling')
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
    buttonLabel = langText('btnInstall')
    buttonText = langText('thisAppIsNotInstalled')
    buttonOnTouchTap = () => {
      dispatch({
        type: 'SERVEROP_REQUEST',
        data: {
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

const PAGEKEY = 'appstore-content-page'
const JUMBOKEY = 'appstore-content-page-jumbo-text'
const APPSKEY = 'appstore-content-apps'

const RenderBanner = ({text, busy, refresh}) => (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
      <div style={{display:'flex', alignItems:'center'}}>
        <div style={{fontSize:16, opacity:0.54}}>{text}</div>
        { busy && <CircularProgress size={0.4} /> }
      </div> 
      { refresh && <RaisedButton label={langText('appstoreRefresh')} onTouchTap={() => dispatch({
          type: 'SERVEROP_REQUEST',
          data: {
            operation: 'appstoreRefresh'
          }
        })}/> }
    </div>
  ) 

const render = () => {

  console.log('====')
  console.log(appstoreStore())
  console.log('====')

  let { selectedApp, customApp } = appstoreStore()
  let appstore = appstoreState()
  let docker = dockerState()

  if (!docker) {
    return <div key={PAGEKEY}><JumbotronText key={JUMBOKEY} text={langText('appEngineNotStarted')} /></div>
  }
  else if (!appstore) {
    return <div key={PAGEKEY}><JumbotronText key={JUMBOKEY} text={langText('appstoreUnavail')} /></div>
  }
  else if (appstore.status === 'ERROR') {
    return <div key={APPSKEY}><RenderBanner text={langText('appstoreError')} refresh={true} /></div>
  }
  else if (appstore.status === 'LOADING') {
    return <div key={PAGEKEY}><JumbotronText key={JUMBOKEY} text={langText('appstoreLoading')} busy={true} /></div>
  }
  else if (appstore.result
            .reduce((prev, curr) => prev.concat(curr.components), [])
            .every(compo => compo.repo === null)) {
    return <div key={APPSKEY}><RenderBanner text={langText('appstoreErrDockerhub')} refresh={true} /></div>
  }

  return (
    <div key={APPSKEY} >
      <RenderBanner text={langText('recommendedApps')} refresh={true} />
      <div>
        <div style={{display: 'flex', flexWrap: 'wrap'}}>
          { appstore.result.map(app => renderAppCard(app)) }
          <Paper style={{width:160, height: 160+62, marginTop:16, marginRight:8, backgroundColor: grey50,
            display:'flex', alignItems: 'center', justifyContent: 'center'}} 
            onTouchTap={() => dispatch({type: 'STORE_CUSTOMAPP', data: true})}
          >
            <ContentAdd style={{width: 80, height:80}} color={grey500} />            
          </Paper>
        </div>
        <Dialog
          style={{overflowY: scroll}}
          actions={null}
          modal={false}
          open={selectedApp !== null}
          onRequestClose={() => dispatch({ type: 'STORE_SELECTEDAPP', selectedApp: null })}
        >
          { renderSelectedApp(selectedApp) }
        </Dialog>
        <CustomAppDialog open={customApp} />
      </div>
    </div>
  )
}

export default render

