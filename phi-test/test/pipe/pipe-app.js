const request = require('superagent')
const path = require('path')

const urlpath = path.join(__dirname, '/1.json')
console.log(urlpath)

// const deviceSN = '1plp0panrup3aaaa'
// const data = '%7B%22verb%22%3A%22POST%22%2C%22urlPath%22%3A%22%2Fdrives%2F19bad6a0-7aed-427f-820f-0b067f259ee3%2Fdirs%2F19bad6a0-7aed-427f-820f-0b067f259ee3%2Fentries%22%7D'
// const data = '{"verb":"POST","urlPath":"/drives/19bad6a0-7aed-427f-820f-0b067f259ee3/dirs/19bad6a0-7aed-427f-820f-0b067f259ee3/entries"}'
const url = 'https://sohon2dev.phicomm.com/ResourceManager/app/pipe/resource?deviceSN=1plp0panrup3aaaa&data=%7B%22verb%22%3A%22POST%22%2C%22urlPath%22%3A%22%2Fdrives%2F645796d5-81be-4a5b-aa33-f28efd8936b8%2Fdirs%2F645796d5-81be-4a5b-aa33-f28efd8936b8%2Fentries%22%2C%22params%22%3A%7B%7D%2C%22body%22%3A%7B%7D%7D'

request
  .post(url)
  .set('Authorization', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImtpZCI6IjMifQ.eyJ1aWQiOiI4ODY0ODI1NyIsImNvZGUiOiJmZWl4dW4uU0hfMSIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJpc3MiOiJQaGljb21tIiwibmJmIjoxNTI4MjUzMDE4LCJleHAiOjE1Mjg3NzE0MTgsInJlZnJlc2hUaW1lIjoiMjAxOC0wNi0wOCAxMDo0MzozOCJ9.o6MbhMET5ektj9Y1otqfAtTZyVzJM7dQ1kgzhdv16_k')
  .attach('1', urlpath, JSON.stringify({
    op: 'newfile',
    size: 516,
    sha256: '5a9c70ceb688554c858d9d0a02c70805946684b61067caba1b6a30708e647d7c'
  }))
  .end((err, res) => {
    console.log(err, res.text)
  })
