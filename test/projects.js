var Lab = require('lab');
var describe = Lab.experiment;
var it = Lab.test;
var before = Lab.before;
var after = Lab.after;
var beforeEach = Lab.beforeEach;
var afterEach = Lab.afterEach;
var expect = Lab.expect;

var uuid = require('uuid');
var clone = require('clone');
var api = require('./fixtures/api-control');
var dock = require('./fixtures/dock');
var nockS3 = require('./fixtures/nock-s3');
var users = require('./fixtures/user-factory');

describe('Projects - /projects', function () {
  var ctx = {};

  before(api.start.bind(ctx));
  before(dock.start.bind(ctx));
  after(api.stop.bind(ctx));
  after(dock.stop.bind(ctx));
  afterEach(require('./fixtures/clean-mongo').removeEverything);
  afterEach(require('./fixtures/clean-ctx')(ctx));


  describe('POST', function () {
    beforeEach(function (done) {
      nockS3();
      ctx.user = users.createRegistered(done);
    });
    afterEach(require('./fixtures/clean-ctx')(ctx));

    describe('dockerfile', function () {
      var json = {
        name: uuid(),
        dockerfile: 'FROM ubuntu\n'
      };
      var requiredProjectKeys = Object.keys(json);

      requiredProjectKeys.forEach(function (missingBodyKey) {
        it('should error if missing ' + missingBodyKey, function (done) {
          var incompleteBody = clone(json);
          delete incompleteBody[missingBodyKey];
          ctx.user.createProject({ json: incompleteBody }, function (err) {
            expect(err).to.be.ok;
            expect(err.message).to.match(new RegExp(missingBodyKey));
            expect(err.message).to.match(new RegExp('is required'));
            done();
          });
        });
      });
      it('should create a project', function(done) {
        ctx.user.createProject({ json: json }, function (err, body, code) {
          if (err) { return done(err); }

          expect(code).to.equal(201);
          expect(body).to.have.property('_id');
          expect(body).to.have.property('name', json.name);
          expect(body).to.have.property('owner', ctx.user.id());
          expect(body).to.have.property('public', true);
          expect(body.environments).to.be.an('array');
          expect(body.environments).to.have.a.lengthOf(1);
          expect(body.environments[0].contexts).to.be.an('array');
          expect(body.environments[0].contexts).to.have.a.lengthOf(1);
          expect(body.environments[0].contexts[0].context).to.be.ok;
          expect(body.environments[0].contexts[0].version).to.be.ok;
          done();
        });
      });
    });
  });


  // describe('GET', function () {
  //   beforeEach(function (done) {
  //     var count = createCount(done);
  //     nockS3();
  //     ctx.owner = users.createRegistered(count.inc().next);
  //     ctx.project = projects.createProjectBy(ctx.owner, count.inc().next);
  //   });
  //   afterEach(function (done) {
  //     delete ctx.project;
  //     delete ctx.user;
  //     done();
  //   });
  // });
});

