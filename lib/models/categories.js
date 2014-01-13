var ObjectId, Schema, async, categorySchema, channels, configs, error, images, mongoose, users, _, __indexOf = [].indexOf || function (item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (i in this && this[i] === item) {
        return i;
      }
    }
    return -1;
  };
async = require('async');
channels = require('./channels');
configs = require('../configs');
error = require('../error');
images = require('./images');
users = require('./users');
mongoose = require('mongoose');
_ = require('lodash');
Schema = mongoose.Schema;
ObjectId = Schema.ObjectId;
categorySchema = new Schema({
  name: {
    type: String,
    index: true,
    unique: true
  },
  description: { type: String },
  aliases: {
    type: [String],
    index: true,
    unique: true,
    'default': []
  }
});
categorySchema.set('autoIndex', false);
categorySchema.statics.getCategory = function (domain, categoryId, cb) {
  return this.findOne({ _id: categoryId }, domain.intercept(function (category) {
    if (!category) {
      return cb(error(404, 'not found'));
    } else {
      return channels.find({ 'tags.category': category._id }).count().exec(domain.intercept(function (count) {
        var json;
        json = category.toJSON();
        json.count = count;
        return cb(null, json);
      }));
    }
  }));
};
categorySchema.statics.getCategoryByName = function (domain, categoryName, cb) {
  return this.findOne({ aliases: categoryName.toLowerCase() }, domain.intercept(function (category) {
    if (!category) {
      return cb(error(404, 'not found'));
    } else {
      return channels.find({ 'tags.category': category._id }).count().exec(domain.intercept(function (count) {
        var json;
        json = category.toJSON();
        json.count = count;
        return cb(null, json);
      }));
    }
  }));
};
categorySchema.statics.listCategories = function (domain, cb) {
  return this.find({}, domain.intercept(function (categories) {
    return async.map(categories, function (category, cb) {
      return channels.find({ 'tags.category': category._id }).count().exec(domain.intercept(function (count) {
        var json;
        json = category.toJSON();
        json.count = count;
        return cb(null, json);
      }));
    }, cb);
  }));
};
categorySchema.statics.createCategory = function (domain, userId, name, desc, cb) {
  var _this = this;
  return users.findUser(domain, { _id: userId }, function (err, user) {
    if (err) {
      return cb(err);
    } else {
      if (!user) {
        return cb(error(403, 'user not found'));
      } else {
        if (!user.isModerator) {
          return cb(error(403, 'permission denied'));
        } else {
          if (name == null) {
            return cb(error(400, 'name required'));
          } else {
            return _this.findOne({ aliases: name.toLowerCase() }, domain.intercept(function (existing) {
              var category;
              if (existing) {
                return cb(error(403, 'category by that name already exists'));
              } else {
                category = new _this();
                category.name = name;
                if (desc) {
                  category.description = desc;
                }
                category.aliases = [name.toLowerCase()];
                if (name !== name.toLowerCase()) {
                  category.aliases.push(name);
                }
                return category.save(domain.intercept(function () {
                  return cb(null, category.toJSON());
                }));
              }
            }));
          }
        }
      }
    }
  });
};
categorySchema.statics.createImplicitCategory = function (domain, name, cb) {
  var category;
  category = new this();
  category.name = name;
  category.aliases = [name.toLowerCase()];
  if (name !== name.toLowerCase()) {
    category.aliases.push(name);
  }
  return category.save(domain.intercept(function () {
    return cb(null, category.toJSON());
  }));
};
categorySchema.statics.updateCategory = function (domain, userId, categoryId, newName, newDesc, cb) {
  var _this = this;
  return users.findUser(domain, { _id: userId }, function (err, user) {
    if (err) {
      return cb(err);
    } else {
      if (!user) {
        return cb(error(403, 'user not found'));
      } else {
        if (!user.isModerator) {
          return cb(error(403, 'permission denied'));
        } else {
          if (newName == null || newDesc == null) {
            return cb(error(400, 'name and desc field required'));
          } else {
            return _this.findOne({ _id: categoryId }, domain.intercept(function (category) {
              var _ref;
              if (newDesc) {
                category.description = newDesc;
              }
              if (category.name !== newName) {
                category.name = newName;
                if (_ref = !newName, __indexOf.call(category.aliases, _ref) >= 0) {
                  category.alias.push(newName);
                }
              }
              return category.save(domain.intercept(function () {
                return cb(null, category.toJSON());
              }));
            }));
          }
        }
      }
    }
  });
};
categorySchema.statics.updateAliases = function (domain, userId, categoryId, newAliases, cb) {
  var _this = this;
  return users.findUser(domain, { _id: userId }, function (err, user) {
    if (err) {
      return cb(err);
    } else {
      if (!user.isModerator) {
        return cb(error(403, 'permission denied'));
      } else {
        if (newAliases == null) {
          return cb(error(400, 'aliases required'));
        } else {
          return _this.findOne({ _id: categoryId }, domain.intercept(function (channel) {
            channel.aliases = newAliases;
            return channel.save(domain.intercept(function () {
              return cb(null, channel.toJSON());
            }));
          }));
        }
      }
    }
  });
};
categorySchema.statics.deleteCategory = function (domain, userId, categoryId, cb) {
  var _this = this;
  return users.findUser(domain, { _id: userId }, function (err, user) {
    if (err) {
      return cb(err);
    } else {
      if (!user.isModerator) {
        return cb(error(403, 'permission denied'));
      } else {
        return _this.remove({ _id: categoryId }, domain.intercept(function () {
          return cb();
        }));
      }
    }
  });
};
module.exports = mongoose.model('Categories', categorySchema);