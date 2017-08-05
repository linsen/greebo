var USER_ID = "123";
// Wait for jQuery to load
$(document).ready(function() {

  // Handle button press
  $("#button-balance").click(function(event) {
    // Button has been clicked
    var user_id = CURRENT_USER.user_id;
    $.get('/users/' + user_id + '/credit').done(function(data) {
      var text = ''

      var credit = 0;
      var spend = 0;

      if (data.credit) {
        credit = parseInt(data.credit) * 10.0;
        text += 'Total credits: ' + data.credit + ' (R ' + credit.toFixed(2) + ')';
      } else {
        text += 'No credits yet'
      }
      text += '<br />';

      if (data.spend) {
        spend = parseFloat(data.spend);
        text += 'Previous spend: R' + data.spend;
      } else {
        text += 'No spend yet'
      }
      text += '<br />';

      if (credit > spend) {
        text += 'Available credit: R' + (credit - spend).toFixed(2);
      } else {
        text += 'No available credit'
      }

      $("#body-text").html(text);
    })
    .fail(function(error) {
      alert('Could not fetch credit!');
    });
  });

  // Handle button press
  $("#button-gym-data").click(function(event) {
    // Button has been clicked
    var user_id = CURRENT_USER.user_id;
    // var username = $('#vitality-username').val();
    // var password = $('#vitality-password').val();
    // $('#vitality-username').val('');
    // $('#vitality-password').val('');

    // console.log(username, password);

    var post_data = {
      // 'username': username,
      // 'password': password
    };

    $.post('/users/' + user_id + '/fetch_gym_data', post_data).done(function(data) {
      var text = 'Gym Data fetched.';

      $("#body-text").html(text);
    })
    .fail(function(error) {
      alert('Could not fetch credit!');
    });
  });

});
