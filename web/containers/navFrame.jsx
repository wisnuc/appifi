import React from 'react'
import ReactDom from 'react-dom'

import AppBar from 'material-ui/AppBar'
import { Menu, MenuItem } from 'material-ui/Menu'
import { Tabs, Tab } from 'material-ui/Tabs'
import Paper from 'material-ui/Paper'
import {Card, CardActions, CardHeader, CardMedia, CardTitle, CardText} from 'material-ui/Card'
import FlatButton from 'material-ui/FlatButton'
import RaisedButton from 'material-ui/RaisedButton'
import Divider from 'material-ui/Divider'

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

/* This list must be consistent with the list defined in reducer */
const decoration = [
      {
        name: 'APP',
        parent: null,
        text: { en_US: 'App', zh_CN: 'Ying Yong' },
        icon: IconNavigationApps,
        themeColor: 'orange'
      },
      {
        name: 'INSTALLED_APPS',
        parent: 'APP',
        text: { en_US: 'Installed Apps' },
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
        themeColor: 'blueGrey' 
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

const dispatch = (action) => {
  window.store.dispatch(action)
  console.log(action)
}

const CardPage = () => {
  return (
    <div style={{position:'relative', opacity: 100, transition: 'all 400ms ease'}}>  
    <Card>
      <CardTitle title="Card title" subtitle="Card subtitle" />
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

const PaperPage = () => {
  return (
    <Paper style={{padding: 16}}>
      <h2>Hello World</h2>
      <Divider />
      <p>This is the best part</p>
    </Paper>
  )
}
 
class NavFrame extends React.Component {

  /* this must be declared for component accessing context */
  static contextTypes = {
    muiTheme: React.PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props)
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
                console.log('dispatch lime')
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

  pageAnimationStyle(visible) {

    return {
      position: 'relative',
      top: visible ? 0 : '200px',
      opacity: visible ? 100 : 0,
      transition: 'all 300ms ease-out'
    } 
  }

  render() {

    console.log(window.store.getState())

    let state = window.store.getState().nav

    let leftNavStyle = {
      display: 'block',
      position: 'fixed',
      height: '100%',
      transition: 'all 200ms ease',
      padding: 6      
    }

    let contentStyle = {
      display: 'block',
      transition: 'margin-left 300ms ease',
      padding: 24
    }

    if (state.menu) {
      leftNavStyle.left = 0
      contentStyle.marginLeft = 240
    }
    else {
      leftNavStyle.left = '-100%'
      contentStyle.marginLeft = 0
    }

    let navList = state.nav.map((item, index) => {
      return Object.assign({}, item, decoration[index])
    })

    let menuSelect = this.menuSelect(navList)
    let navSelect = this.navSelect(navList)

    let tabList = this.getTabList(navList)
    let hasTabs = tabList.length !== 0

    let tabAnimationStyle = {
      position: 'relative',
      height: hasTabs ? 50 : 0,
      top: hasTabs ? 0 : '-100px', // double height
      opacity: hasTabs ? 100 : 0,
      transition: 'all 300ms ease'
    }
 
    return (
      <div>
        <div>
        <Paper style={{backgroundColor:this.getColor('primary1Color') }} rounded={false} zDepth={1}>
          <AppBar onLeftIconButtonTouchTap={this.handleToggle} zDepth={0} title='WISNUC Cloud' />
          <div style={tabAnimationStyle}>
            { hasTabs && this.buildTabs(tabList) }
          </div>
        </Paper>
        </div>
        <div>
          <div style={leftNavStyle}>
            { this.buildMenu(navList) }
          </div>
          <div style={contentStyle}>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width: '100%'}}>
              <div style={{width: '90%', maxWidth:1084}}>
                <div style={this.pageAnimationStyle(navSelect.name === 'INSTALLED_APPS')}>
                  { navSelect.name === 'INSTALLED_APPS' && <CardPage />}
                </div>
                <div style={this.pageAnimationStyle(navSelect.name === 'WINSUN_STORE')}>
                  { navSelect.name === 'WINSUN_STORE' && <CardPage />}
                </div>
                <div style={this.pageAnimationStyle(navSelect.name === 'STORAGE')}>
                  { navSelect.name === 'STORAGE' && <PaperPage />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  } 
}

export default NavFrame
