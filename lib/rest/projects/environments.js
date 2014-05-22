'use strict';

/**
 * Project Environments API
 * @module rest/projects/environments
 */

var express = require('express');
var app = module.exports = express();

var mw = require('dat-middleware');
var flow = require('middleware-flow');
var me = require('middleware/me');
var project = require('middleware/projects');
var utils = require('middleware/utils');
var validations = require('middleware/validations');

var findProject = flow.series(
  mw.params('id').require().validate(validations.isObjectId),
    project.findById('params.id'),
    project.checkFound);

/* *** ENVIRONMENTS *** */

/** List the environments of a {@link module:models/project Project}
 *  @returns {object} body
 *  @returns {ObjectId} body._id ID of the Project
 *  @returns {array.object} body.environments Environments of the project
 *  @returns {ObjectId} body.environments.context Context belonging to the environment
 *  @returns {ObjectId} body.environments.version Version of the given Context
 *  @event GET rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.get('/:id/environments',
  findProject,
  flow.or(
    project.model.checkPublic(),
    me.isOwnerOf('project'),
    me.isModerator),
  project.respondEnvironments());

/** Create an environment on a {@link module:models/project Project}
 *  @param {ObjectId} id ID of the Project to which to add an environment
 *  @param {object} body
 *  @param {string} body.name Proposed name of the new environment
 *  @returns {object} The {@link module:models/project project}, and new environment
 *  @event POST rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.post('/:id/environments',
  findProject,
  flow.or(
    project.model.checkPublic(),
    me.isOwnerOf('project'),
    me.isModerator),
  // FIXME: add some validation of body.name
  mw.body('name').require(),
  project.model.checkEnvironmentNameConflict('body.name'),
  project.model.createEnvironment('body.name', 'user_id'),
  project.pullContexts(),
  project.copyContexts('body.name'),
  project.model.save(),
  utils.code(201),
  project.respondEnvironments('body.name'));

/** Update an environment on a {@link module:models/project Project}
 *  @param {ObjectId} id ID of the Project to which to add an view
 *  @param {ObjectId} envid ID of the environment of which to update
 *  @returns {object} The {@link module:models/project project}, with updated environment
 *  @event PATCH rest/projects/:id/environment/:envid
 *  @memberof module:rest/projects/environments */
app.patch('/:id/environments/:envid',
  findProject,
  flow.or(
    me.isOwnerOf('project'),
    me.isModerator),
  mw.body('name').require().pick(),
  project.update({
    '_id': 'params.id',
    'environments._id': 'params.envid'
  }, {
    $set: {
      'environments.$.name': 'body.name'
    }
  }),
  project.model.save(),
  findProject,
  project.respondEnvironments());

/** Delete a Project's environment
 *  @param {ObjectId} id ID of the project to fetch
 *  @param {ObjectId} envid ID of the environment to delete
 *  @returns 204 (w/ no content)
 *  @event DELETE rest/projects/:id/environments/:envid
 *  @memberof module:rest/projects/environments */
app.delete('/:id/environments/:envid',
  findProject,
  flow.or(
    me.isOwnerOf('project'),
    me.isModerator),
  project.model.update({
    $pull: {
      environments: {
        _id: 'params.envid'
      }
    }
  }),
  utils.respondNoContent);

/* *** PROTECTED ROUTES *** */

/*  @returns {error} 405 - not allowed
 *  @event PATCH rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.patch('/:id/environments/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event PUT rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.put('/:id/environments/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event DELETE rest/projects/:id/environments
 *  @memberof module:rest/projects/environments */
app.delete('/:id/environments/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event GET rest/projects/:id/environments/:envid
 *  @memberof module:rest/projects/environments */
app.get('/:id/environments/:envid', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event POST rest/projects/:id/environments/:envid
 *  @memberof module:rest/projects/environments */
app.post('/:id/environments/:envid', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event PUT rest/projects/:id/environments/:envid
 *  @memberof module:rest/projects/environments */
app.put('/:id/environments/:envid', function (req, res) { res.send(405); });