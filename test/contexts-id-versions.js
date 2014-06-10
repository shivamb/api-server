var Lab = require('lab');
var describe = Lab.experiment;
var it = Lab.test;
var before = Lab.before;
var after = Lab.after;
var beforeEach = Lab.beforeEach;
var afterEach = Lab.afterEach;
var expect = Lab.expect;

var api = require('./fixtures/api-control');
var dock = require('./fixtures/dock');
var nockS3 = require('./fixtures/nock-s3');
var multi = require('./fixtures/multi-factory');

var join = require('path').join;
var uuid = require('uuid');

describe('Versions - /contexts/:contextid/versions', function () {
  var ctx = {};

  before(api.start.bind(ctx));
  before(dock.start.bind(ctx));
  after(api.stop.bind(ctx));
  after(dock.stop.bind(ctx));
  afterEach(require('./fixtures/clean-mongo').removeEverything);
  afterEach(require('./fixtures/clean-ctx')(ctx));

  beforeEach(function (done) {
    nockS3();
    multi.createRegisteredUserProjectAndEnvironments(function (err, user, project, environments) {
      if (err) { return done(err); }

      ctx.user = user;
      ctx.project = project;
      ctx.environments = environments;
      ctx.environment = environments.models[0];
      ctx.versionId = environments.models[0].toJSON().versions[0];
      ctx.contextId = environments.models[0].toJSON().contexts[0];
      ctx.context = ctx.user.fetchContext(ctx.contextId, done);
    });
  });

  describe('GET', function () {
    it('should NOT list us the versions', function (done) {
      ctx.context.fetchVersions(function (err) {
        expect(err).to.be.ok;
        expect(err.output.statusCode).to.equal(501);
        done();
      });
    });

    it('should list multiple versions by id', function (done) {
      var query = { qs: {
        _id: [
          ctx.environment.attrs.versions[0]
        ]
      }};
      ctx.context.fetchVersions(query, function (err, body) {
        if (err) { return done(err); }

        expect(body).to.be.an('array');
        expect(body).to.have.length(1);
        expect(body[0]._id).to.equal(ctx.environment.attrs.versions[0].toString());
        done();
      });
    });
  });

  describe('POST', function () {
    it('should create a new version', function (done) {
      ctx.context.createVersion({ json: {
        versionId: ctx.versionId,
        files: [{
          Key: join(ctx.contextId, 'source', 'file.txt'),
          ETag: uuid(),
          VersionId: 'Po.EGeNr9HirlSJVMSxpf1gaWa5KruPa'
        }]
      }}, function (err, body) {
        if (err) { return done(err); }

        expect(body).to.be.ok;
        expect(body.files).to.be.an('array');
        expect(body.files).to.have.length(2);
        done();
      });
    });
  });

});