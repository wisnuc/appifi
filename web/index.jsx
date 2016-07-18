import React from 'react'
import ReactDom from 'react-dom'

import injectTapEventPlugin from 'react-tap-event-plugin'
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider'
import getMuiTheme from 'material-ui/styles/getMuiTheme'

import { createStore } from 'redux'

import reducer from './reducers/index'
import Navigation from './containers/Navigation'
import palette from './utils/palette'

injectTapEventPlugin()

// creat store (a.k.a world in the sense of functional programming)
window.store = createStore(reducer) 

// theme
const muiTheme = () => getMuiTheme({ palette: palette(window.store.getState().themeColor)}) 

// root component
const App = () => <MuiThemeProvider muiTheme={muiTheme()}><Navigation /></MuiThemeProvider>

// render method
const render = () => ReactDom.render(<App/>, document.getElementById('app'))

// subscribe render
store.subscribe(render)

// first render
render()

