var db = require('diskdb');
db = db.connect('./database', ['users']);
require('dotenv').config();

var request = require('request');

var ROOT_API_URL = 'http://api.root.co.za/v1';

// This function adds a user to a sponsor item's config variable `users`
// The config variable `users` is a comma separated string of user ids
exports.addUserToConfigVariables = (userId, sponsorId, callback) => {
  var uri = ROOT_API_URL + '/sponsors/' + sponsorId + '/config-variables';
  var auth = {
    username: process.env.CLIENT_ID,
    password: process.env.CLIENT_SECRET,
  };
  var getOptions = { uri, auth };

  // First, fetch current config variables
  request.get(getOptions, function(err, response, body) {
    if (err) {
      console.error('Error getting config variables:', err);
      typeof callback === 'function' && callback(err);
    } else {
      var users = body.users || '';

      // Add userId to users
      if (!users.includes(userId)) {
        users = users.concat(',' + userId);
      }

      var postOptions = {
        uri,
        auth,
        json: {
          config_variables: { users },
        },
      };

      // Update config variables
      request.post(postOptions, function(err, response, body) {
        if (err) {
          typeof callback === 'function' && callback(err);
        } else {
          typeof callback === 'function' && callback(null, 'User added.');
        }
      });
    }
  });
};

// This function removes a user from a sponsor item's config variable `users`
exports.removeUserFromConfigVariables = (userId, sponsorId, callback) => {
  var uri = ROOT_API_URL + '/sponsors/' + sponsorId + '/config-variables';
  var auth = {
    user: process.env.CLIENT_ID,
    pass: process.env.CLIENT_SECRET,
  };

  var getOptions = { uri, auth };

  // First, fetch current config variables
  request.get(getOptions, function(err, response, body) {
    if (err) {
      callback(null, err);
    } else {
      var users = body.users || '';

      // Remove userId from users
      users = users.replace(userId + ',', '');

      // Update config variables with new users
      var postOptions = {
        uri,
        auth,
        json: {
          config_variables: { users },
        },
      };

      // Update config variables
      request.post(postOptions, function(err, response, body) {
        if (err) {
          typeof callback === 'function' && callback(err);
        } else {
          typeof callback === 'function' && callback(null, 'User removed.');
        }
      });
    }
  });
};

// Get a user's access token with the authcode obtained through OAuth
exports.getAccessToken = function(authCode, callback) {
  var options = {
    uri: 'https://api.root.co.za/v1/oauth/token',
    auth: {
      user: process.env.CLIENT_ID,
      pass: process.env.CLIENT_SECRET,
    },
    json:   {
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: process.env.OAUTH_REDIRECT_URL,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
    }
  };

  request.post(options, function(err, response, body) {
    if (err) {
      typeof callback === 'function' && callback(err);
    } else {
      typeof callback === 'function' && callback(null, body);
    }
  });
};