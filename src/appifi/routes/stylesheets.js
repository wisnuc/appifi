import express from 'express'

import assets from '../../../assets'

const router = express.Router()

router.get('/style.css', (req, res) => {
  res
    .set('Content-Type', 'text/css')
    .send(assets.styleCSS)
})

router.get('/roboto.css', (req, res) => {
  res
    .set('Content-Type', 'text/css')
    .send(assets.robotoCSS)
})

router.get('/Roboto-Thin-webfont.woff', (req, res) => {
  res
    .set('Content-Type', 'application/font-woff')
    .send(assets.robotoThin)
})

router.get('/Roboto-Light-webfont.woff', (req, res) => {
  res
    .set('Content-Type', 'application/font-woff')
    .send(assets.robotoLight)
})

router.get('/Roboto-Regular-webfont.woff', (req, res) => {
  res
    .set('Content-Type', 'application/font-woff')
    .send(assets.robotoRegular)
})

router.get('/Roboto-Medium-webfont.woff', (req, res) => {
  res
    .set('Content-Type', 'application/font-woff')
    .send(assets.robotoMedium)
})

router.get('/Roboto-Bold-webfont.woff', (req, res) => {
  res
    .set('Content-Type', 'application/font-woff')
    .send(assets.robotoBold)
})

router.get('/Roboto-Black-webfont.woff', (req, res) => {
  res
    .set('Content-Type', 'application/font-woff')
    .send(assets.robotoBlack)
})

module.exports = router
