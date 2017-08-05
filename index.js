
require('dotenv').config();
var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var hogan = require('hogan-express');
var path = require('path');

var db = require('diskdb');
db = db.connect('./database', ['users', 'sponsor_payments', 'events']);

var users = require('./helpers/users');
var { getRandValue } = require('./helpers/money-methods');

var Pusher = require('pusher');
var pusher = new Pusher({
  appId: '375211',
  key: 'b189220d550c56f9e80b',
  secret: '380291124452d49810bc',
  cluster: 'eu',
  encrypted: true
});
var PUSHER_CHANNEL = process.env.CLIENT_ID;

var logAndNotify = function(message) {
  pusher.trigger(PUSHER_CHANNEL, 'notify', { message });
  console.log(message);
};

app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: false }));

var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;
var OAUTH_REDIRECT_URL = process.env.OAUTH_REDIRECT_URL;
var OAUTH_URL = 'https://api.root.co.za/v1/oauth/authorize?redirect_uri=' + OAUTH_REDIRECT_URL + '&client_id=' + CLIENT_ID + '&response_type=code';
var MAX_SPEED = 120;

// Set up view engine
app.set('view engine', 'html');
app.engine('html', hogan);
app.set('views', path.resolve(__dirname, 'views'));

// Serve static files from public folder
app.use(express.static(__dirname + '/public'));

//==========================================================//
//======================= HOME PAGE ========================//
//==========================================================//

// Serve homepage
app.get('/', function (req, res) {
  res.render('index', { // => /views/index.html
    // Variables go here and gets included in view as {{ name }}
    client_id: process.env.CLIENT_ID,
    pusher_channel: process.env.CLIENT_ID,
    oauth_url: OAUTH_URL,
  });
});

//==========================================================//
//===================== OAUTH ENDPOINT =====================//
//==========================================================//

// This is specified as our app's redirect_uri on Root.
// The user is redirected here after the oauth process.
// We store the user's details in our database.
app.get('/callback', function(req, res) {
  var params = req.query;
  
  // If Oauth error, log the error
  if (params.error) {
    console.error('OAUTH ERROR: ' + JSON.stringify(params.error));
  } else {
    // Store user in database
    var user = {
      first_name: params.first_name,
      last_name: params.last_name,
      email: params.email,
      user_id: params.user_id,
    };
    db.users.update({ user_id: params.user_id }, user, { upsert: true });

    logAndNotify('New user: ' + params.first_name + ' ' + params.last_name);

    // Get and store user's access token
    users.getAccessToken(params.code, function(err, data) {
      if (err) {
        console.error('ERROR GETTING ACCESS TOKEN:', err);
      } else {
        user.access_token = data.access_token;
        user.refresh_token = data.refresh_token;
        db.users.update({ user_id: user.user_id }, user);
      }
    });
  }

  // Redirect user to home page
  res.redirect('/?user_id=' + params.user_id);
});

//==========================================================//
//================== EXTERNAL DATA INPUT ===================//
//==========================================================//

// This endpoint is used to log a date that a user went to gym.
app.post('/log-date', function(req, res) {
  var data = req.body;

  // Validate value is non-negative integer
  var value = parseInt(data.value);
  if (data.value !== value.toString() || value < 0) {
    return res.status(400).json({ error: 'invalid_value' });
  }

  // Save event in database
  var event = {
    value,
    time: data.time,
    user_id: data.user_id,
  };
  db.events.save(event);

  logAndNotify('Event: ' + value);

  // Get average of user's 10 most recent speeds
  var user = db.users.findOne({ user_id: event.user_id });
  var userData = db.events.find({ user_id: event.user_id });
  var recentData = userData.slice(-10);
  var averageSpeed = recentData.reduce(function(ave, current) {
    return ave + parseInt(current.value) / recentData.length;
  }, 0);

  // If at least 10 events AND average speed less than max AND
  // user has not been added to sponsor:
  //   add user to sponsor
  if (recentData.length >= 10 && averageSpeed <= MAX_SPEED && !user.added_to_sponsor) {
    db.users.update({ user_id: event.user_id }, { added_to_sponsor: true });
    users.addUserToConfigVariables(data.user_id, process.env.SPONSOR_ID, function(err, result) {
      if (err) {
        console.error('ERROR ADDING USER TO SPONSOR:', err);
        user.added_to_sponsor = false;
        db.users.update({ user_id: event.user_id }, { added_to_sponsor: false });
      } else {
        logAndNotify('User added to sponsor');
      }
    })
  }

  res.send();
});

//==========================================================//
//============== SPONSOR WEBHOOK HANDLER ===================//
//==========================================================//

// This endpoint is specified as our sponsor item's redirect url
// on Root. It is POSTed to after a sponsor payment is paid out
// or an error occurred in the sponsorPayment function.
app.post('/webhooks/sponsors', function(req, res) {
  var data = req.body;
  var userId = data.user_id;
  var sponsorId = data.sponsor_id;
  var sponsorAmount = data.sponsor_amount;
  var transactionId = data.transaction_id;
  var error = data.error;
  
  if (error) {
    console.error('SPONSOR ERROR: ' + JSON.stringify(error));
  } else {
    var transaction = {
      user_id: userId,
      sponsor_id: sponsorId,
      sponsor_amount: sponsorAmount,
      transaction_id: transactionId,
    };

    db.sponsor_payments.save(transaction);

    users.removeUserFromConfigVariables(userId, sponsorId, function(err, result) {
      if (err) {
        console.error('Error removing user from config variables:', err);
      } else {
        user = db.users.findOne({ user_id: userId });
        user.added_to_sponsor = false;
        db.users.update({ user_id: userId }, user);
        logAndNotify('User removed from sponsor')
      }
    });
  }

  res.send();
});

//==========================================================//
//================== USER APP ENDPOINTS ====================//
//==========================================================//

// Return all the users that have OAuth'ed with
// our app and are stored in our database.
app.get('/users', function(req, res) {
  res.json(db.users.find());
});

// Return the average speed for the specified user.
app.get('/users/:user_id/average', function(req, res) {
  var userId = req.params.user_id;
  var userData = db.events.find({ user_id: userId });

  var averageSpeed = userData.reduce(function(ave, current) {
    return ave + parseInt(current.value) / userData.length;
  }, 0);

  res.json({ average_speed: averageSpeed.toFixed(2) });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
});
