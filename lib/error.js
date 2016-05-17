class HttpRequestError extends Error {

  constructor(e) {
    super()
    this.code = e.code
  }
}

class HttpResponseError extends Error {

  constructor(res) {
    super()
    this.statusCode = res.statusCode
    this.statusMessage = res.statusMessage
  }
}

class JSONParserError extends Error {

  constructor(text) {
    super()
    this.text = text
  }
}

export { HttpRequestError, HttpResponseError, JSONParserError }

