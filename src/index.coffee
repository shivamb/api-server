configs = require './configs'
connect_redis = require 'connect-redis'
express = require 'express'
http = require 'http'
mongoose = require 'mongoose'
runnables = require './rest/runnables'
session = require './session'
users = require './rest/users'
channels = require './rest/channels'
util = require 'util'
domain = require 'domain'

redis_store = connect_redis express
mongoose.connect configs.mongo

app = express()

app.use (req, res, next) ->
  d = domain.create()
  res.on 'close', ->
    d.dispose()
  res.on 'finish', ->
    d.dispose()
  d.on 'error', (err) ->
    console.error 'Error:', err.stack
    try
      killtimer = setTimeout ->
        process.exit(1)
      , 30000
      killtimer.unref()
      server.close()
      res.json 500, { message: 'something bad happened' }
    catch err2
      console.error('Error sending 500!', err2.stack)
  d.add req
  d.add res
  d.run(next)

app.use express.bodyParser()
app.use express.cookieParser()
app.use express.session
  key: configs.cookieKey
  secret: configs.cookieSecret
  store: new redis_store
    ttl: configs.cookieExpires
  cookie:
    path: '/'
    httpOnly: false,
    maxAge: configs.cookieExpires
app.use session
app.use users
app.use runnables
app.use channels
app.use app.router
app.use (err, req, res, next) ->
  res.json 500, { message: 'something bad happened' }

app.get '/', (req, res) ->
  res.json { message: 'hello!' }

app.get '/throws', ->
  throw new Error 'zomg'

app.all '*', (req, res) ->
  res.json 404, { message: 'operation not found' }

server = http.createServer app

module.exports =
  configs: configs
  start: (cb) ->
    server.listen configs.port, cb
  stop: (cb) ->
    server.close cb