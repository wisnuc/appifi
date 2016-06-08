import React from 'react'
import ReactDom from 'react-dom'
import Transition from '../utils/transition'
import { mixin, dispatch } from '../utils/utils'

import { AppBar, Paper, TextField, CircularProgress } from 'material-ui'
import { Menu, MenuItem } from 'material-ui/Menu'
import { Tabs, Tab } from 'material-ui/Tabs'
import { Card, CardActions, CardHeader, CardMedia, CardTitle, CardText } from 'material-ui/Card'
import FlatButton from 'material-ui/FlatButton'
import RaisedButton from 'material-ui/RaisedButton'
import Divider from 'material-ui/Divider'

import AppStoreRender from './AppStore'
import InstalledAppsRender from './InstalledApps'
import Storage from './Storage'

import IconButton from 'material-ui/IconButton'
import IconNavigationApps from 'material-ui/svg-icons/navigation/apps'
import IconNavigationMenu from 'material-ui/svg-icons/navigation/menu'
import IconDeviceStorage from 'material-ui/svg-icons/device/storage'
import IconActionSettingsEthernet from 'material-ui/svg-icons/action/settings-ethernet'
import IconHardwareToys from 'material-ui/svg-icons/hardware/toys'
import IconNotificationSystemUpdate from 'material-ui/svg-icons/notification/system-update'
import IconHardwareSecurity from 'material-ui/svg-icons/hardware/security'
import IconActionLock from 'material-ui/svg-icons/action/lock'
import IconDeviceAccessTime from 'material-ui/svg-icons/device/access-time'
import IconActionPowerSettingsNew from 'material-ui/svg-icons/action/power-settings-new'

import lang, { langText } from '../utils/lang'

import CSSTransition from 'react-addons-css-transition-group'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'            

/* This list must be consistent with the list defined in reducer */
export const decoration = [
      {
        name: 'APP',
        text: { en_US: 'App', zh_CN: 'Ying Yong' },
        icon: IconNavigationApps,
        themeColor: 'lime',
      },
      {
        name: 'APPSTORE',
        text: { en_US: 'App Store' },
        render: AppStoreRender,
      },
      {
        name: 'INSTALLED_APPS',
        text: { en_US: 'Installed Apps' },
        render: InstalledAppsRender
      },
      {
        name: 'STORAGE',
        text: { en_US: 'Storage' },
        icon: IconDeviceStorage,
        render: Storage.Volumes,
        themeColor: 'grey', 
      },
/*
      {
        name: 'VOLUMES',
        text: { en_US: 'Volumes' },
        render: Storage.Volumes
      },
      {
        name: 'DRIVES',
        text: { en_US: 'Drives' },
        render: Storage.Drives
      },
      {
        name: 'MOUNTS',
        text: { en_US: 'Mounts' },
        render: Storage.Mounts
      },
      {
        name: 'PORTS',
        text: { en_US: 'Ports' },
        render: Storage.Ports
      },
*/
      {
        name: 'ETHERNET',
        text: { en_US: 'Ethernet' },
        icon: IconActionSettingsEthernet,
        themeColor: 'teal'
      },
      {
        name: 'COOLING',
        text: { en_US: 'Cooling' },
        icon: IconHardwareToys,
      },
      {
        name: 'DATETIME',
        text: { en_US: 'Date & Time' },
        icon: IconDeviceAccessTime,
      },
      {
        name: 'SYSUPDATE',
        text: { en_US: 'System Update', },
        icon: IconNotificationSystemUpdate,
      },
      {
        name: 'PASSWORD',
        text: { en_US: 'Password', },
        icon: IconHardwareSecurity,
      },
      {
        name: 'POWEROFF',
        text: { en_US: 'Power Off', },
        icon: IconActionPowerSettingsNew,
      } 
    ]

/*****************************************************************************
 * 
 * Styles
 *
 *****************************************************************************/

const loginPageStyle = {
  display : 'flex',
  flexDirection: 'column',
  alignItems : 'center',
  justifyContent : 'center',
  minHeight : '100vh',
  minWidth : '100vw',
//      backgroundImage : 'url(images/party_orig.jpg)',
//      backgroundSize : 'cover'
}

const loginDialogStyle = {
  display : 'flex',
  flexDirection : 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: 120,
  width: 300,
  padding: 10
}

/*****************************************************************************
 *
 * Functions
 *
 *****************************************************************************/

const loginErrorText = () => {

  let err, state = window.store.getState().login.state

  switch (state) {
    
    case 'REJECTED':
      err = 'Incorrect password'
      break

    case 'TIMEOUT':
      err = 'Server timeout'
      break

    case 'ERROR':
      err = 'Server internal error, please retry'
      break

    case 'READY':
    case 'BUSY':
    default:
      err = null
      break
  }

  return err
}

const loginSubmit = () => {

  window.store.dispatch({
    type: "LOGIN"
  })
  
  setTimeout(() => {
    window.store.dispatch({
      type: 'LOGIN_SUCCESS'
    })
  }, 1000)
}

const loginBusy = () => {

  let state = window.store.getState().login.state
  return state === 'BUSY'
}

const loggedIn = () => {

  return window.store.getState().login.state === 'LOGGEDIN'
}

const pageStyle = () => {

  return {
    display : 'flex',
    flexDirection: 'column',
    alignItems : 'center',
    // justifyContent : 'center',
    minHeight : '100vh',
  //  minWidth : '100vw',
  //      backgroundImage : 'url(images/party_orig.jpg)',
  //      backgroundSize : 'cover'
  }
}

const CardPage = ({ title }) => {

  return (
    <div>
      <Card>
        <CardTitle title={title} subtitle="Card subtitle" />
        <CardText>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Donec mattis pretium massa. Aliquam erat volutpat. Nulla facilisi.
          Donec vulputate interdum sollicitudin. Nunc lacinia auctor quam sed pellentesque.
          Aliquam dui mauris, mattis quis lacus id, pellentesque lobortis odio.
        </CardText>
        <CardActions>
          <FlatButton label="Action1" />
        </CardActions>
      </Card>
    </div>
  )
}

const renderCardPage = (navSelect) => {

  return (
    <div key={navSelect}>
      <Card>
        <CardTitle title='Placeholder Page' subtitle="Card subtitle" />
        <CardText>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Donec mattis pretium massa. Aliquam erat volutpat. Nulla facilisi.
          Donec vulputate interdum sollicitudin. Nunc lacinia auctor quam sed pellentesque.
          Aliquam dui mauris, mattis quis lacus id, pellentesque lobortis odio.
        </CardText>
        <CardActions>
          <FlatButton label="Action1" />
        </CardActions>
      </Card>
    </div>
  )
}

class Navigation extends React.Component {

  /* this must be declared for component accessing context */
  static contextTypes = {
    muiTheme: React.PropTypes.object.isRequired,
  }

  submit() {
    window.store.dispatch({
      type: "LOGIN"
    })
    
    setTimeout(() => {
      window.store.dispatch({
        type: 'LOGIN_SUCCESS'
      })
    }, 1000)
  }

  handleToggle() {
    dispatch({type: 'NAV_MENU_TOGGLE'})
  }

  getColor(name) {
    return this.context.muiTheme.palette[name]
  }

  menuSelect(navList) {
    return navList.find((item) => (item.parent === null && item.selected))
  }

  navSelect(navList) {

    let menu = this.menuSelect(navList)
    let nav = navList.find((item) => (item.parent === menu.name && item.selected))

    return (nav !== undefined) ? nav : menu
  }

  getTabList(navList) {

    let parent = navList.find((navItem) => (navItem.parent === null && navItem.selected))
    let list = navList.filter((navItem) => (navItem.parent === parent.name))
    return list
  }

  // this must be an fat arrow function
  buildTabItem = (item) => { 
    return (<Tab 
              style={{width:180}}
              key={item.name} 
              label={langText(item.text)} 
              value={item.name}
              onActive={() => dispatch({type: 'NAV_SELECT', select: item.name})}
            />)
  }

  buildTabs(tabList) {

    let debug = false

    debug && console.log(tabList)

    let selectedName = tabList.find(item => item.selected === true).name
    let style = {display: 'flex', justifyContent: 'center', backgroundColor:this.getColor('primary1Color') }
    return ( 
      <div style={style}>
        <Tabs inkBarStyle={{backgroundColor:'white', height:4}} value={selectedName}>
          { tabList.map(this.buildTabItem) }
        </Tabs>
      </div>
    )
  }

  // this must be an fat arrow function since it is used
  // in array function callback
  buildMenuItem = (item) => {

    let iconProps, leftIcon 
    let fontStyle = {
      fontSize: 14,
      fontWeight: 40
    }

    if (item.selected) {
      iconProps = {
        style: {
          fill: this.getColor('primary1Color')
        }
      }
      fontStyle.color = this.getColor('primary1Color')
    }

    leftIcon = React.createElement(item.icon, iconProps) 
    return (<MenuItem 
              key={item.name} 
              primaryText={langText(item.text)} 
              leftIcon={leftIcon} 
              innerDivStyle={fontStyle}
              onTouchTap={ () => {
                dispatch({type: 'NAV_SELECT', select: item.name })
                dispatch({type: 'THEME_COLOR', color: item.themeColor ? item.themeColor : 'cyan'})
              }} 
            />)
  }

  buildMenu(navList) {

    let list = navList.filter((item) => item.parent === null)
                .map((item) => {
                  let selected = navList.find((navItem) => navItem.name === item.name).selected
                  return Object.assign({}, item, {selected})
                })

    return <Menu>{ list.map(this.buildMenuItem) }</Menu>
  }

  renderContentPage(navSelect) {

    let debug = false

    debug && console.log(navSelect)

    return (

      <div style={{width: '100%'}} >
        <Transition opts={['content', true, true, false, 2000, 1500, 5000]}>
          { navSelect.render !== undefined ? React.createElement(navSelect.render, {key: navSelect.name}) : 
            <CardPage /> }
        </Transition>
      </div>
    )
  }

  render() {

    let debug = true 

    debug && console.log(window.store.getState())

    let state = window.store.getState().navigation
    let navList = state.nav.map((item, index) => {
      return Object.assign({}, item, decoration[index])
    })

    let menuSelect = this.menuSelect(navList)
    let navSelect = this.navSelect(navList)

    let tabList = this.getTabList(navList)
    let hasTabs = tabList.length !== 0
    let contentTop = hasTabs ? (64 + 50) : 64

    let leftNavStyle = {
      display: 'block',
      position: 'fixed',
      height: '100%',
      transition: 'all 200ms ease',
      padding: 6,   // for alignment of icons
      left: state.menu ? 0 : '-100%',
      top: 114,
    }

    let contentStyle = {
      marginTop: contentTop,
      display: 'block',
      transition: 'margin-left 300ms ease',
      padding: 24,
      marginLeft: state.menu ? 240 : 0
    }

   let tabAnimationStyle = {
      position: 'relative',
    }

    let paperNavStyle = { 
      position: 'fixed', 
      left: 0, 
      width:'100%', 
      // backgroundColor:this.getColor('primary1Color'),
      backgroundColor: "#FF0000",
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
//      height: '168px' 
    }

    return (
      <div>
        <div id='login-container' className='login-container-style' >
          <Transition opts={['login-title', true, true, false, 100, 1000, 100]}>
            { !loggedIn() && 
              <div style={{ 
                height:"64px", 
                verticalAlign:"bottom",
                fontSize: 48,
              }}>
                <div>你好，主人！</div>
              </div> 
            }
          </Transition> 
          <Transition opts={['login-dialog', true, true, false, 100, 1000, 100]}>
            { !loggedIn() && <div> 
              <Paper className='login-paper-style' zDepth={2}>
                { loginBusy() && 
                  <CircularProgress /> 
                }
                { !loginBusy() && 
                  <TextField 
                    stype={{marginBottom: 10}} 
                    hintText="password" 
                    type="password" 
                    fullWidth={true} 
                    errorText={loginErrorText()} />
                }
                { !loginBusy() && 
                  <FlatButton 
                    style={{marginTop: 10}} 
                    label='UNLOCK ME' 
                    onTouchTap={this.submit} />
                }
              </Paper> 
            </div> }
          </Transition>   
        </div> 
        {/* end of login layout container */}

        {/* appbar */}
        <div id='appbar-container' className='appbar-container-style' >
          <Transition opts={['appbar', false, true, true, 300, 600, 400]}>
            { loggedIn() && <div style={{transition: 'all 300ms ease'}}>
              <Paper rounded={false} zDepth={2} style={{
                backgroundColor:this.getColor('primary1Color')
                // transition: 'height 1s ease'
              }}>
                <AppBar id='appbar' className='appbar-fix' onLeftIconButtonTouchTap={this.handleToggle} zDepth={0} title={'WISNUC Appifi'}>
                  <IconButton 
                    style={{margin:8, marginRight:-16 }} 
                    tooltip="lock screen" 
                    onTouchTap={() => {
                      console.log('lock')
                      window.store.dispatch({type: 'LOGOUT'})
                    }}
                  >
                    <IconActionLock color='#FFF' />
                  </IconButton>
                </AppBar>
                { hasTabs &&
                  <Transition opts={ /* enter delay 300ms to let appbar update first */
                    ['tabs', false, true, false, 300, 600, 5000 ]
                  }>
                    <div key={menuSelect.name}>
                      { this.buildTabs(tabList) }
                    </div>
                  </Transition>
                }
              </Paper>
            </div> }
          </Transition>
        </div>
        {/* end of appbar */}

        {/* left-nav */} 
        <div style={{
          display: 'block',
          position: 'fixed', 
          top: hasTabs ? 114 : 64, 
          transition: 'top 300ms ease'
        }}>
          <Transition opts={['left-nav', false, true, true, 5000, 400, 400]}>
            { loggedIn() && state.menu && 
              <div id="left-nav-container" style={{
                display: 'block',
                position: 'absolute',
                height: '100%',
                padding: 6,   // for alignment of icons
                // left: 0,
                // transition: 'all 900ms linear'
              }}>
                { this.buildMenu(navList) }
              </div>
            }
          </Transition> 
        </div> 
        {/* end of left-nav */}

        {/* content container */}
        <div id="content-container-flex" style={{
          width: '100%',
          marginTop: contentTop,
          // marginLeft: state.menu ? 240 : 0,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}> 
          <div id="content-container-width-limited" 
            style={{
              width:'80%', 
              maxWidth:1084, 
              position: 'relative', // VERY IMPORTANT! TODO Why?
            }}
          >
            <Transition opts={['content', false, true, false, 300, 1200, 100]}>
              { loggedIn() &&
                ( navSelect.render !== undefined ? 
                  /* React.createElement(navSelect.render, {key: navSelect.name}) : */
                  navSelect.render(navSelect) : 
                  /* React.createElement(CardPage, {key: navSelect.name})) */
                  renderCardPage(navSelect.name)
                )
              }
            </Transition>
          </div>
        </div>
      </div>
    )
  } 
}

export default Navigation
