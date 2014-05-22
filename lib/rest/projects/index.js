'use strict';

/**
 * Project API
 * @module rest/projects
 */

var express = require('express');
var app = module.exports = express();
var flow = require('middleware-flow');
var mw = require('dat-middleware');

var contexts = require('middleware/contexts');
var me = require('middleware/me');
var project = require('middleware/projects');
var utils = require('middleware/utils');
var validations = require('middleware/validations');

function validQuerySortParams (field) {
  var validFields = [
    '-votes',
    'votes',
    '-created',
    'created',
    '-views',
    'views',
    '-runs',
    'runs'
  ];
  return validFields.indexOf(field) === -1 ?
    mw.Boom.badRequest('field not allowed for sorting: ' + field) :
    null;
}

var findProject = flow.series(
  mw.params('id').require().validate(validations.isObjectId),
    project.findById('params.id'),
    project.checkFound);

// list all projects
app.get('/',
  mw.query('all', 'search', 'channel', 'owner', 'sort', 'page', 'limit').pick(),
  mw.query('search').require()
    .then(
      project.search('query.search'),
      project.respond),
  utils.formatPaging(),
  mw.query('all', 'search', 'channel', 'owner', 'sort', 'page', 'limit')
    .validate(validQuerySortParams),
  project.respond);

/** Create a new {@link module:models/project Project}
 *  @param {object} [query]
 *  @param {ObjectId} [query.from] ID of the Project from which to copy
 *  @param {object} body
 *  @param {string} body.name Name of the project to create
 *  @param {array.string} body.contexts Array of contexts to create within the project
 *  @param {string} body.contexts[].name Name of the context to create
 *  @param {string} body.contexts[].dockerfile Contents of the Dockerfile for the context
 *  @returns {object} The new project, with NO containers
 *  @event POST rest/projects/
 *  @memberof module:rest/projects */
app.post('/',
  me.isRegistered,
  // mw.query().if('from').then(
  //   project.findByIds('query.from'),
  //   project.checkFound,
  //   flow.or(
  //     project.model.checkPublic(),
  //     me.isOwnerOf('project'),
  //     me.isModerator),
  //   project.copyActionUpdateName),
  mw.body().set('owner', 'user_id'),
  mw.body('owner', 'name', 'contexts').require(),
  // FIXME: do we need/want any name validation here?
  mw.body('name').matches(/.*/),
  mw.query('from').require()
    .then(mw.body('parent').require()),
  contexts.checkValidContexts('name', 'dockerfile'),
  mw.params().set('contexts', 'body.contexts'),
  mw.body('name', 'description', 'parent', 'owner').pick(),
  project.create('body'),
  project.model.createDefaultEnvironment(),
  mw.body().set('contexts', 'params.contexts'),
  mw.params().unset('contexts'),
  me.findMe,
  contexts.createContexts({
    owner: 'user_id',
    ownerUsername: 'me.lower_username'
  }),
  // TODO: projects will be all private soon
  project.model.set({ public: true }),
  project.model.addContexts('contexts'),
  contexts.models.save(),
  project.model.save(),
  project.respond);

/* Get a {@link module:models/project Project}
 *  @param {ObjectId} id ID of the project to fetch
 *  @returns {object} The {@link module:models/project project}.
 *    What did you expect, a puppy?
 *  @event GET rest/projects/:id
 *  @memberof module:rest/projects */
app.get('/:id',
  findProject,
  flow.or(
    project.model.checkPublic(),
    me.isOwnerOf('project'),
    me.isModerator),
  project.respond);

/** Update a {@link module:models/project Project}
 *  @param {ObjectId} id ID of the Project to update
 *  @returns {object} The {@link module:models/project project}
 *  @event PATCH rest/projects/:id
 *  @memberof module:rest/projects */
app.patch('/:id',
  findProject,
  flow.or(
    me.isOwnerOf('project'),
    me.isModerator),
  // FIXME: is this all I need to update
  mw.body('name', 'description', 'public').pick(),
  project.model.setAndSave('body'),
  project.respond);

/** Delete a {@link module:models/project Project}
 *  @param {ObjectId} id ID of the project to fetch
 *  @returns 204 (w/ no content)
 *  @event DELETE rest/projects/:id
 *  @memberof module:rest/projects */
app.delete('/:id',
  findProject,
  flow.or(
    me.isOwnerOf('project'),
    me.isModerator),
  project.removeById('project._id'),
  utils.respondNoContent);

/* *** PROTECTED ROUTES *** */

/*  @returns {error} 405 - not allowed
 *  @event PUT rest/projects
 *  @memberof module:rest/projects */
app.put('/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event PATCH rest/projects
 *  @memberof module:rest/projects */
app.patch('/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event DELETE rest/projects
 *  @memberof module:rest/projects */
app.delete('/', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event POST rest/projects/:id
 *  @memberof module:rest/projects */
app.post('/:id', function (req, res) { res.send(405); });

/*  @returns {error} 405 - not allowed
 *  @event PUT rest/projects/:id
 *  @memberof module:rest/projects */
app.put('/:id', function (req, res) { res.send(405); });