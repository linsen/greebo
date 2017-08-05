var USER_ID = "123";
// Wait for jQuery to load
$(document).ready(function() {

  // Handle button press
  $("#button-average").click(function(event) {
    // Button has been clicked
    var user_id = CURRENT_USER.user_id;
    $.get('/users/' + user_id + '/average').done(function(data) {
      $("#body-text").text('Current credit: ' + (data.credit || 'No data'));
    })
    .fail(function(error) {
      alert('Could not fetch credit!');
    });
  });

});
