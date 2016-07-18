import React from 'react'
import ReactDom from 'react-dom'
import { createStore } from 'redux'

import Login from './containers/Login'
import reducer from './reducers/index'
import Navigation from './containers/Navigation'
import injectTapEventPlugin from 'react-tap-event-plugin'
import getMuiTheme from 'material-ui/styles/getMuiTheme'
import palette from './utils/palette'

injectTapEventPlugin()

let store = createStore(reducer) 

class App extends React.Component {

  static childContextTypes = {
    muiTheme: React.PropTypes.object.isRequired,
  }

  getChildContext() {
    return getMuiTheme({
      palette: palette(window.store.getState().themeColor)
    });
  }

  render() {
    return (<div><Navigation /></div>)
  }
}

const render = () => {
  ReactDom.render(<App/>, document.getElementById('app'))
}

store.subscribe(render)
window.store = store
render()

