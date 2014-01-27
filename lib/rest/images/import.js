var express = require('express');
var app = module.exports = express();
var users = require('middleware/users');
var me = require('middleware/me');
var images = require('middleware/images');
var query = require('middleware/query');
var votes = require('middleware/votes');

app.post('/',
  me.isVerified,
  query.require('name'),
  images.findConflict({
    name: 'query.name'
  }),
  images.writeTarGz,
  images.findDockerfile,
  images.loadDockerfile,
  images.parseDockerFile,
  images.readTempFiles,
  images.create(),
  images.buildDockerImage,
  images.model.save(),
  votes.meVoteOn('image'),
  images.cleanTmpDir,
  images.respond);