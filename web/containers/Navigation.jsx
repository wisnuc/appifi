import React from 'react'
import ReactDom from 'react-dom'
import Transition from '../utils/transition'
import { mixin, dispatch } from '../utils/utils'

import { AppBar, Paper, Snackbar } from 'material-ui'
import { Tabs, Tab } from 'material-ui/Tabs'

import FlatButton from 'material-ui/FlatButton'
import Divider from 'material-ui/Divider'

import AppStoreRender from './AppStore'
import InstalledAppsRender from './InstalledApps'

import IconButton from 'material-ui/IconButton'
import IconNavigationApps from 'material-ui/svg-icons/navigation/apps'
import IconActionLock from 'material-ui/svg-icons/action/lock'

import CSSTransition from 'react-addons-css-transition-group'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'            

import { snackbarStore } from '../utils/storeState'

// C combinator, :)
const C = x => f => f ? C(f(x)) : x

const encodingIndex = enc => C(enc)
  (x => ['en_US', 'zh_CN'].indexOf(x))
  (i => i === -1 ? 0 : i)
  ()

const langMap = {
  undefined: ['[undefined]', '【未定义】'],
  title: ['WISNUC Cloud Apps', '闻上私有云应用'],
  appstore: ['App Store', '应用市场'],
  installedApps: ['Installed Apps', '已安装应用'],
  switchToLang: ['中文', 'English']
}

const langText = (prop = 'undefined') => C(prop)
  (x => langMap[x] === undefined ? 'undefined' : x)
  (x => langMap[x][encodingIndex(window.store.getState().lang)])
  ()


/* This list must be consistent with the list defined in reducer */
export const decoration = [
  {
    name: 'APPSTORE',
    text: 'appstore',
    render: AppStoreRender,
    themeColor: 'lime'
  },
  {
    name: 'INSTALLED_APPS',
    text: 'installedApps',
    render: InstalledAppsRender,
    themeColor: 'lime'
  }
]

class Navigation extends React.Component {

  /* this must be declared for component accessing context */
  static contextTypes = {
    muiTheme: React.PropTypes.object.isRequired,
  }

  getColor(name) {
    return this.context.muiTheme.palette[name]
  }

  // this must be an fat arrow function
  buildTabItem = (item) => { 
    return (<Tab 
              style={{width:180}}
              key={item.name} 
              label={langText(item.text)} 
              value={item.name}
              onActive={() => {
                dispatch({type: 'NAV_SELECT', select: item.name})
                dispatch({type: 'THEME_COLOR', color: item.themeColor}) 
              }}
            />)
  }

  buildTabs(tabList) {

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

  renderContentPage(navSelect) {

    return (
      <div style={{width: '100%'}} >
        <Transition opts={['content', true, true, false, 1000, 1000, 5000]}>
          { navSelect.render !== undefined ? React.createElement(navSelect.render, { key: navSelect.name }) : null}
        </Transition>
      </div>
    )
  }

  render() {

    console.log(window.store.getState())

    let navList = window.store.getState().navigation
      .map((item, index) => 
        Object.assign({}, item, decoration[index]))

    let navSelect = navList.find(item => item.selected)

    return (
      <div>
        <div id='appbar-container' className='appbar-container-style' >
          <Transition opts={['appbar', false, true, true, 300, 600, 400]}>
            <div style={{transition: 'all 300ms ease'}}>
              <Paper rounded={false} zDepth={2} style={{ backgroundColor:this.getColor('primary1Color') }}>
                <AppBar id='appbar' className='appbar-fix' zDepth={0} title={langText('title')}>
                  <div style={{display:'flex', alignItems:'center'}}>
                    <FlatButton style={{color:'white'}} label={langText('switchToLang')} 
                      onTouchTap={() => window.store.dispatch({
                        type: 'TOGGLE_LANG'
                      })}
                    />
                  </div>
                </AppBar>
                  <Transition opts={ ['tabs', false, true, false, 300, 600, 5000 ] }>
                    <div>
                      { this.buildTabs(navList) }
                    </div>
                  </Transition>
              </Paper>
            </div> 
          </Transition>
        </div>
        {/* end of appbar */}

        {/* content container */}
        <div id="content-container-flex" style={{
          width: '100%',
          marginTop: 64 + 50,
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
            <Transition opts={['content', false, true, false, 300, 600, 100]}>
              { navSelect.render(navSelect) }
            </Transition>
          </div>
        </div>

        {/* snackbar */}
        <Snackbar 
          open={snackbarStore().open} 
          message={snackbarStore().message} 
          autoHideDuration={3000} 
          onRequestClose={() => dispatch({
            type: 'SNACKBAR_CLOSE' 
          })} />
      </div>
    )
  } 
}

export default Navigation
