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

  /* this must be declared for Components exporting context */  
  static childContextTypes = {
    muiTheme: React.PropTypes.object.isRequired,
  }

  getChildContext() {

    let muiTheme = getMuiTheme({
      palette: palette(window.store.getState().themeColor)
    });

    return {muiTheme};
  }

  render() {
    return (<div><Navigation /></div>)
  }
}

const render = () => {
  ReactDom.render(<App/>, document.getElementById('app'))
}
/* TODO this will suppress containercard display change, maybe some material ui components are stateful, retry in future
let mem = null
store.subscribe(() => {

  if (mem !== store.getState()) {
    mem = store.getState()
    render()
  }
})
*/
store.subscribe(render)
window.store = store
render()

