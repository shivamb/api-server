var helpers = require('./lib/helpers');
var users = require('./lib/userFactory');
var images = require('./lib/imageFactory');
var extendContext = helpers.extendContext;
var extendContextSeries = helpers.extendContextSeries;

describe('Images', function () {
  before(extendContext({
    image: images.createImageFromFixture.bind(images, 'node.js')
  }));
  after(helpers.cleanup);
  afterEach(helpers.cleanupExcept('image'));

  describe('GET /runnables/:id', function () {
    beforeEach(extendContext({
      user : users.createAnonymous
    }));
    it('should respond 404 if image not found', function (done) {
      this.user.specRequest(helpers.fakeShortId())
        .expect(404)
        .end(done);
    });
    it('should return an image', function (done) {
      this.user.specRequest(this.image._id)
        .expect(200)
        .end(done);
    });
    describe('tags', function () {
      beforeEach(extendContextSeries({
        publ: users.createPublisher,
        container: ['publ.createContainer', ['image._id']],
        rename: ['publ.patchContainer', ['container._id', {
          body: { name: 'new-name' },
          expect: 200
        }]],
        tag: ['publ.tagContainerWithChannel', ['container._id', 'brand-new-channel']],
        image2: ['publ.postImage', [{
          qs: { from: 'container._id' },
          expect: 201
        }]]
      }));
      it('should include the container\'s tags', function (done) {
        var self = this;
        this.user.specRequest(this.image2._id)
          .expect(200)
          .expectBody(function (body) {
            body.tags.should.be.instanceof(Array).and.have.lengthOf(1);
            body.tags[0].name.should.equal(self.tag.name);
          })
          .end(done);
      });
    });
  });

  describe('POST /runnables', function () {
    describe('from container id', function () {
      describe('anonymous', function () {
        beforeEach(extendContextSeries({
          user: users.createAnonymous,
          container: ['user.createContainer', ['image._id']]
        }));
        it('should respond 403', accessDeniedErrorFromContainerId);
      });
      describe('registered', function () {
        beforeEach(extendContextSeries({
          user: users.createRegistered,
          container: ['user.createContainer', ['image._id']]
        }));
        it('should respond 403', accessDeniedErrorFromContainerId);
      });
      describe('publisher', function () {
        beforeEach(extendContextSeries({
          user: users.createPublisher,
          container: ['user.createContainer', ['image._id']]
        }));
        it('should respond error if name already exists', function (done) {
          this.user.specRequest({ from: this.container._id })
            .expect(409)
            .expectBody('message', /name already exists/)
            .end(done);
        });
        describe('rename container', function () {
          beforeEach(extendContextSeries({
            rename: ['user.patchContainer', ['container._id', {
              body: { name: 'newname' },
              expect: 200
            }]]
          }));
          it('should create a container', function (done) {
            this.user.specRequest({ from: this.container._id })
              .expect(201)
              .end(done);
          });
        });
      });
      function accessDeniedErrorFromContainerId (done) {
        this.user.specRequest({ from: this.container._id })
          .expect(403)
          .end(done);
      }
    });
  });
});