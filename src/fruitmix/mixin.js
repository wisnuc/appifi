
/**
This is a mixin example.

All mixed-in function will appear in fruitmix class doc page. 
They also have a separate page, where all functions are labelled `static`.

@mixin apidoc-example
*/
const mixin = {

  /**
  Returns 'world'
  @param {string} name  
  */
  hello () {
    return 'world'
  }
}

module.exports = mixin
