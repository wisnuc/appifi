import React from 'react'
import ReactDom from 'react-dom'

import { mixin, dispatch } from '../utils/utils'

import AppBar from 'material-ui/AppBar'
import { Menu, MenuItem } from 'material-ui/Menu'
import { Tabs, Tab } from 'material-ui/Tabs'
import Paper from 'material-ui/Paper'
import {Card, CardActions, CardHeader, CardMedia, CardTitle, CardText} from 'material-ui/Card'
import FlatButton from 'material-ui/FlatButton'
import RaisedButton from 'material-ui/RaisedButton'
import Divider from 'material-ui/Divider'

import InstalledAppsPage from './InstalledApps'
import StoragePage from './Storage'

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
const decoration = [
      {
        name: 'APP',
        parent: null,
        text: { en_US: 'App', zh_CN: 'Ying Yong' },
        icon: IconNavigationApps,
        themeColor: 'cyan',
      },
      {
        name: 'INSTALLED_APPS',
        parent: 'APP',
        text: { en_US: 'Installed Apps' },
        content: InstalledAppsPage
      },
      {
        name: 'WINSUN_STORE',
        parent: 'APP',
        text: { en_US: 'WinSun Store' },
      },
      {
        name: 'DOCKER_HUB', 
        parent: 'APP',
        text: { en_US: 'Docker Hub' },
      },
      {
        name: 'STORAGE',
        parent: null,
        text: { en_US: 'Storage' },
        icon: IconDeviceStorage,
        themeColor: 'blueGrey', 
        content: StoragePage
      },
      {
        name: 'ETHERNET',
        parent: null,
        text: { en_US: 'Ethernet' },
        icon: IconActionSettingsEthernet,
      },
      {
        name: 'COOLING',
        parent: null,
        text: { en_US: 'Cooling' },
        icon: IconHardwareToys,
      },
      {
        name: 'DATETIME',
        parent: null,
        text: { en_US: 'Date & Time' },
        icon: IconDeviceAccessTime,
      },
      {
        name: 'SYSUPDATE',
        parent: null,
        text: { en_US: 'System Update', },
        icon: IconNotificationSystemUpdate,
      },
      {
        name: 'PASSWORD',
        parent: null,
        text: { en_US: 'Password', },
        icon: IconHardwareSecurity,
      },
      {
        name: 'POWEROFF',
        parent: null,
        text: { en_US: 'Power Off', },
        icon: IconActionPowerSettingsNew,
      } 
    ]

const CardPage = ({ title }) => {
  return (
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
  )
}

class Navigation extends React.Component {

  /* this must be declared for component accessing context */
  static contextTypes = {
    muiTheme: React.PropTypes.object.isRequired,
  }

  componentWillMount() {

    let debug = false
    let navlist = window.store.getState().navigation.nav
    debug && console.log(navlist)

    let menu = this.menuSelect(navlist)
    debug && console.log(menu)

    let dec = decoration.find(item => item.name === menu.name) 
    debug && console.log(dec)

    if (dec !== undefined && dec.themeColor !== undefined) {
      dispatch({type: 'THEME_COLOR', color: dec.themeColor})
    }
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
              style={{width:180, fontWeight: 900}} 
              key={item.name} 
              label={langText(item.text)} 
              value={item.name}
              onActive={() => dispatch({type: 'NAV_SELECT', select: item.name})}
            />)
  }

  buildTabs(tabList) {

    let selectedName = tabList.find(item => item.selected === true).name
    return ( 
      <div style={{display: 'flex', justifyContent: 'center'}}>
        <Tabs inkBarStyle={{backgroundColor:'white', height:4}} value={selectedName}>
          { tabList.map(this.buildTabItem) }
        </Tabs>
      </div>
    )
  }

  // this must be an fat arrow function since it is used
  // in array function callback
  buildMenuItem = (item) => {

    let iconProps, fontStyle, leftIcon

    if (item.selected) {
      iconProps = {
        style: {
          fill: this.getColor('primary1Color')
        }
      }
      fontStyle = {
        color: this.getColor('primary1Color')
      }
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

    return (
      <div style={{width: '100%'}} >
        <ReactCSSTransitionGroup transitionName="content" transitionEnterTimeout={300} transitionLeaveTimeout={1}>
          { navSelect.content !== undefined ? React.createElement(navSelect.content, {key: navSelect.name}) : <CardPage /> }
        </ReactCSSTransitionGroup>
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
      // height: '100%',
      transition: 'all 200ms ease',
      padding: 6,   // for alignment of icons
      left: state.menu ? 0 : '-100%'
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
      height: hasTabs ? 50 : 0,
      top: hasTabs ? 0 : '-200px', // double height
      opacity: hasTabs ? 100 : 0,
      transition: 'all 300ms ease'
    }

    let paperNavStyle = { 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width:'100%', 
      backgroundColor:this.getColor('primary1Color'),
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100 
    } 
 
    return (
      <div>
        <Paper style={paperNavStyle} rounded={false} zDepth={2}>
          <AppBar onLeftIconButtonTouchTap={this.handleToggle} zDepth={0} title='WISNUC Cloud' />
          <div style={tabAnimationStyle}>
            { hasTabs && this.buildTabs(tabList) }
          </div>
        </Paper>
        <div style={{transition: 'all 200ms ease'}}>
          <div style={leftNavStyle}>
            { this.buildMenu(navList) }
          </div>
          <div style={contentStyle}>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width: '100%'}}>
              <div style={{width: '90%', maxWidth:1084, position: 'relative'}}>
                { this.renderContentPage(navSelect) }
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  } 
}

export default Navigation
