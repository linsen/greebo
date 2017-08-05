var db = require('diskdb');
db = db.connect('./database', ['users']);
require('dotenv').config();

var request = require('request');

var ROOT_API_URL = 'https://api.root.co.za/v1';

// This function updates a user in a sponsor item's config variable `users`
// The config variable `users` is a JSON string of user ID's and credit values
exports.updateUserCreditInConfigVariables = (userId, credit, sponsorId, callback) => {
  var uri = ROOT_API_URL + '/sponsors/' + sponsorId + '/root-code';
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
      var usersString = JSON.parse(body).config_variables.users || '{}';
      var users = JSON.parse(usersString);

      // Update credit
      users[userId] = credit;

      // Stringify back to JSON
      usersString = JSON.stringify(users);

      uri = ROOT_API_URL + '/sponsors/' + sponsorId + '/config-variables';
      var postOptions = {
        uri,
        auth,
        json: {
          config_variables: { users: usersString },
        },
      };

      // Update config variables
      request.post(postOptions, function(err, response, body) {
        if (err) {
          typeof callback === 'function' && callback(err);
        } else {
          typeof callback === 'function' && callback(null, 'User credit updated.');
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