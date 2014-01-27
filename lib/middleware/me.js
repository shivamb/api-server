var bcrypt = require('bcrypt');
var configs = require('configs');
var User = require('models/users');
var users = require('middleware/users');
var containers = require('./containers');
var body = require('./body');
var createModelMiddleware = require('./createModelMiddleware');
var error = require('error');
var utils = require('./utils');
var series = utils.series;
var reqUnless = utils.reqUnless;

var me = module.exports = createModelMiddleware(User, {
  findMe: function (req, res, next) {
    if (!req.user_id) {
      throw new Error('NO USER_ID');
    }
    series(
      this.findById('user_id'),
      this.checkFound
    )(req, res, next);
  },
  isUser: function (req, res, next) {
    if (!utils.equalObjectIds(req.user_id, req.params.userId)) {
      return next(error(403, 'access denied (!user)'));
    }
    next();
  },
  isOwnerOf: function (key) {
    return function (req, res, next) {
      var model = req[key];
      if (!model || !utils.equalObjectIds(model.owner, req.user_id)){
        return next(error(403, 'access denied (!owner)'));
      }
    };
  },
  isRegistered: function (req, res, next) {
    this.permission('registered')(req, res, next);
  },
  isVerified: function (req, res, next) {
    this.permission('isVerified')(req, res, next);
  },
  isModerator: function (req, res, next) {
    this.permission('isModerator')(req, res, next);
  },
  permission: function (attr) {
    return series(
      reqUnless('me',
        this.findMe),
      this.model.unless(attr,
        utils.error(403, 'access denied (!'+attr+')'))
    );
  },
  respond: function (req, res, next) {
    series(
      addAccessToken,
      this.super.respond
    )(req, res, next);
    function addAccessToken (req, res, next) {
      if (req.me && req.access_token) {
        if (req.me.toJSON) {
          req.me = req.me.toJSON();
        }
        req.me.access_token = req.access_token;
      }
      next();
    }
  },
  register: function (req, res, next) {
    series(
      body.require('email', 'username', 'password'),
      this.findConflictEmailOrUsername,
      body.pick('email', 'username', 'password'),
      registeredFields,
      this.findMe,
      this.model.set('body'),
      utils.log('MEMEME', 'me'),
      this.model.save()
    )(req, res, next);
    function registeredFields (req, res, next) {
      bcrypt.hash(req.body.password + configs.passwordSalt, 10,
        req.domain.intercept(function (hashedPassword) {
          req.body.password = hashedPassword;
          req.body.permission_level = 1;
          next();
        }));
    }
  },
  findConflictEmailOrUsername: function (req, res, next) {
    var query = { // used users here so not override the session user
      $or: [
        { email: req.body.email },
        { lower_username: req.body.username.toLowerCase() }
      ]
    };
    User.findOne(query, { _id:1, email:1, lower_username:1 }, req.domain.intercept(function (user) {
      if (user) {
        if (utils.equalObjectIds(user._id, req.user_id)) {
          next(400, 'already registered');
        }
        else {
          var field = (user.email === req.body.email) ? 'email' : 'username';
          next(error(409, 'user with '+field+' already exists'));
        }
      }
      else {
        next();
      }
    }));
  },
  login: function (loginData) {
    return series(
      body.requireOne('username', 'email'),
      body.require('password'),
      body.pick('username', 'email', 'password'),
      this.find({
        $or: [
          { email: 'body.email' },
          { username: 'body.username' }
        ]
      }),
      this.checkFound,
      this.checkUserPassword('me', 'body.password'),
      containers.authChangeUpdateOwners);
  },
  checkUserPassword: function (user, password) {
    return function (req, res, next) {
      user.checkPassword(password, req.domain.intercept(function (matches) {
        if (!matches) {
          return next(error(403, 'invalid password'));
        }
        next();
      }));
    };
  }
}, 'me');