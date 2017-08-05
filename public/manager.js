
// Wrap alertify into custom function
function customAlert() {
  var content = Array.from(arguments).join(' ');
  alertify.logPosition("top right");
  alertify.maxLogItems(15).delay(3000).log(content);
}

// Fetch all authenticated users from server
function fetchUsers(callback) {
  $.get('/users').done(function(data) {
    callback(data);
  })
  .fail(function(error) {
    alert('Could not fetch users!');
  });
}

function renderUsers(users) {
  if (users.length === 0) {
    return;
  }

  // Update users table
  var $tbody = $('#users-table');
  $tbody.find("tr").remove();
  users.forEach(function(user) {
    var tr = `<tr>
      <td>${user.first_name} ${user.last_name}</td>
      <td>${user.email}</td>
      <td>${user.user_id}</td>
    </tr>`;
    $tbody.append(tr);
  });
  // Update users dropdown
  var $select = $('#users-dropdown');
  $select.find('option').remove();
  users.forEach(function(user) {
    var option = `<option value='${user.user_id}'>${user.first_name} ${user.last_name}</option>`;
    $select.append(option);
  });
}

// Wait for jQuery to load
$(document).ready(function() {

  // Submit once-off events with AJAX
  $("#form-once-off-events").submit(function(event) {
    event.preventDefault();
    var $form = $(this);
    var url = $form.attr('action');
    var user_id = $('#users-dropdown').val();
    var data = $form.serializeArray().reduce(function(obj, item) { obj[item.name] = item.value; return obj; }, {});
    data.user_id = user_id;
    data.time = (new Date()).getTime();

    $.post(url, data).done(function(data) {
      // customAlert(data);
    })
    .fail(function(error) {
      alert('Could not post event!');
    });
  });

  // Submit event stream with AJAX on interval
  // Clear previous stream if exists and start new one
  var streamInterval = undefined;
  $("#form-event-stream").submit(function(event) {
    event.preventDefault();
    clearInterval(streamInterval); // Clear any previous interval
    var $form = $(this);
    var url = $form.attr('action');
    var user_id = $('#users-dropdown').val();
    var data = $form.serializeArray().reduce(function(obj, item) { obj[item.name] = item.value; return obj; }, {});
    var millis = data.millis || 1000;
    var values = data.values.split(',');

    if (data.values === "") {
      return customAlert("Nothing to publish");
    }

    // Send values in sequence
    var i = 0;
    streamInterval = setInterval(function() {
      var postData = {
        value: values[i],
        time: (new Date()).getTime(),
        user_id,
      };
      $.post(url, postData).done(function(data) {
        // customAlert(data);
      })
      .fail(function(error) {
        alert('Could not post event!');
        return clearInterval(streamInterval);
      });
      i++;
      // If past last item, stop the interval
      if (i === values.length) {
        return clearInterval(streamInterval);
      }
    }, millis);
  });

});

// ======================== //
// ======== PUSHER ======== //
// ======================== //

var pusher = new Pusher('b189220d550c56f9e80b', {
  cluster: 'eu',
  encrypted: true
});
var channel = pusher.subscribe(PUSHER_CHANNEL);

channel.bind('notify', function(data) {
  customAlert(data.message);
});

channel.bind('new_user', function(data) {
  customAlert(data.message);
  fetchUsers(function(users) {
    renderUsers(users);
  });
});

// ======================== //
// ========= INIT ========= //
// ======================== //
var queryParams = {};
location.search.substr(1).split("&").forEach(function(item) {
  queryParams[item.split("=")[0]] = item.split("=")[1]
});
var userId = queryParams.user_id;

fetchUsers(function(users) {
  renderUsers(users);

  var currentUser = users.find(function(user) {
    return user.user_id === userId;
  });

  if (currentUser) {
    $("#iphone").attr('class', 'iphone signed-in');
    $("#greeting").text('Hi, ' + (currentUser.first_name || 'there'));
    CURRENT_USER = currentUser;
  }
});
