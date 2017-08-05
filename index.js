
require('dotenv').config();
var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var hogan = require('hogan-express');
var path = require('path');
var request = require('request');
const cheerio = require('cheerio');
const scrapeIt = require("scrape-it");

var db = require('diskdb');
db = db.connect('./database', ['users', 'sponsor_payments', 'dates']);

var users = require('./helpers/users');
var { getRandValue } = require('./helpers/money-methods');
var { getDateFromString } = require('./helpers/date-methods');

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

  var dateString = data.date;
  var date = getDateFromString(dateString);
  var currentYear = new Date().getFullYear();
  if ((date.getFullYear() <  currentYear - 1) || (date > new Date())) {
    logAndNotify('Invalide date: ' + dateString);
    return res.status(400).json({ error: 'invalid_value' });
  }

  // Check that date isn't already in the database
  var existingDates = db.dates.find({ user_id: data.user_id, date: dateString });

  if (existingDates.length == 0) {
    // Save event in database
    var gymDay = {
      date: dateString,
      time: data.time,
      user_id: data.user_id,
    };
    db.dates.save(gymDay);

    logAndNotify('Saved date: ' + dateString);

    // Update user's available credit and store in env variables
    var userData = db.dates.find({ user_id: data.user_id });
    var credit = userData.length;

    users.updateUserCreditInConfigVariables(data.user_id, credit, process.env.SPONSOR_ID, function(err, result) {
      if (err) {
        console.error('ERROR UPDATING USER CREDIT ON SPONSOR:', err);
      } else {
        logAndNotify('User credit updated on sponsor');
      }
    });

  } else {
    logAndNotify('Date already present: ' + dateString);
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

    // Check that sponsor payment isn't already in the database
    var existingPayments = db.sponsor_payments.find({ transaction_id: transactionId });
    if (existingPayments.length == 0) {
      db.sponsor_payments.save(transaction);

      logAndNotify('User sponsored: ' + getRandValue(sponsorAmount));
    } else {

      logAndNotify('Duplicate webhook ignored – user sponsored: ' + getRandValue(sponsorAmount));
    }

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

// Return the available credit for the specified user.
app.get('/users/:user_id/credit', function(req, res) {
  var userId = req.params.user_id;
  var userData = db.dates.find({ user_id: userId });

  var credit = userData.length;

  var payments = db.sponsor_payments.find({ user_id: userId });
  var spend = payments.reduce(function(sum, current) {
    return sum + parseInt(current.sponsor_amount);
  }, 0);

  res.json({ credit: credit, spend: getRandValue(spend) });
});


// Return the available credit for the specified user.
app.post('/users/:user_id/fetch_gym_data', function(req, res) {
  var userId = req.params.user_id;

  // Update config variables
  // https://www.discovery.co.za/vitality-online/gymTrackerMonthlyBreakdown.do
  var uri = 'http://localhost:3000/gym_data.json';
  var getOptions = {
    uri
  };
  console.log(getOptions);
  request.get(getOptions, function(err, response, body) {
    if (err) {
      typeof callback === 'function' && callback(err);
    } else {
      console.log('Get successful');

      var pageData = JSON.parse(body);
      var dates = [];

      var curMonth = new Date().getMonth();
      var curYear = new Date().getFullYear();

      for (var i = 0; i < pageData.monthlyBreakdownDto.length; i++) {
        var monthData = pageData.monthlyBreakdownDto[i];
        var month = curMonth - i;
        var year = curYear;
        if (month < 0) {
          year -= 1;
          month += 12;
        }

        for (var j = 0; j < monthData.gymEventDtos.length; j++) {
          var event = monthData.gymEventDtos[j];
          var date = event.eventDate.date;

          if (month < 10) month = '0' + month;
          if (date < 10) date = '0' + date;

          dateString = year + '-' + month + '-' + date;
          dates.push(dateString);

          var existingDates = db.dates.find({ user_id: userId, date: dateString });
          if (existingDates.length == 0) {
            // Save event in database
            var gymDay = {
              date: dateString,
              user_id: userId,
            };
            db.dates.save(gymDay);
          }
        }
      }

      // Update user's available credit and store in env variables
      var userData = db.dates.find({ user_id: userId });
      var credit = userData.length;

      users.updateUserCreditInConfigVariables(userId, credit, process.env.SPONSOR_ID, function(err, result) {
        if (err) {
          console.error('ERROR UPDATING USER CREDIT ON SPONSOR:', err);
        } else {
          logAndNotify('User credit updated on sponsor');
        }
      });

    }
  });


  res.json({  });
});


app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
});
