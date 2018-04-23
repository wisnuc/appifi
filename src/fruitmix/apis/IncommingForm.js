
/**
@module IncomingForm
*/

/**
incoming formdata processor
*/
class IncomingForm {


  /**
  Create an incoming formdata processor 
  */
  constructor() {


    /**
    @property {object[]} parts
    @property {number} parts[].number
    */
    this.parts = []

    /**
    @property {object[]} parsers
    @property {number} parsers[].number
    @property 
    */
    this.parsers = []
    this.parsers_ = []

    this._dryrun = []
    this.dryrun = []
    this.dryrun_ = []


  }
} 
