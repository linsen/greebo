# Root Hackathon Starter Kit

This is a simple Root integrated Node Express app that packages a simple oauth and sponsor management interface. It's designed to help devs get started quickly at hackathons.

The starter-kit is based around a simple app which encourages users to drive below the speed limit. The client receives (simulated) speed data from a device installed in the user's car. If the user's average speed stays below the speed limit for a certain amount of time, 5% of the user's next fuel purchase is sponsored by the client.

The starter-kit allows you to simulate a data stream from the interface which you can then interpret inside the NodeJS app.

## 1) Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. This app is not suitable for deployment to production.

### 1.1) Installing the Starter Kit

To get started, first fork this repo and clone it to your local machine using your command line tool. (You need [NodeJS](https://nodejs.org/en/) installed)

```
git clone git@github.com:RootBank/hackathon-starter-kit.git
```

Now that you have a local copy of this project, navigate into the folder and install the dependencies.

```
cd hackathon-starter-kit
npm install
```

### 1.2) Setting up ngrok

[Ngrok](https://ngrok.com/) is a sleek tool that allows you to expose `localhost` to the outside world. Download it from [their site](https://ngrok.com/) and, in a new terminal window, navigate to where the ngrok file is.

```
cd ~/path/to/ngrok/file
```

We'll be running our app on port `3000`, like so: [`http://localhost:3000`](http://localhost:3000). So to start up ngrok on this port, run the following command.

```
./ngrok http 3000
```

Look for the `https` forwarding url and copy it (`https://590381dc.ngrok.io` in the example below)
```
Forwarding        https://590381dc.ngrok.io -> localhost:3000
```

We'll now be able to connect to our localhost from the outside.

### 1.3) Creating a Client App on Root

Before we can run the starter kit locally, we need to create a Client App on Root first. Go to [Create New App](https://app.root.co.za/developer/apps/new-app) in the Root Developer section, and create a new app.

Enter a name for your app. Client app names must be unique, so you can use some varient of "DriveSafe", e.g. "DriveSafe X". You can copy the logo from the cloned repository in `/public`. For the redirect URL, use the ngrok URL copied above and append `/callback` to it, e.g. `https://590381dc.ngrok.io/callback`. You don't have to select any of the permissions below to do sponsors, but go ahead and select stuff like "View Transactions."

### 1.4) Creating a Sponsor on Root

To sponsor a user's payments, we need to create a sponsor add-on to our client app on Root. Go to your client app and click on "+ Create Add-on".

Choose a name for your sponsor add-on, e.g. "Fuel Discount". For the webhook URL, use the ngrok URL copied above with `/webhooks/sponsors` appended to it.

Save the code below in your sponsor's code editor. This will sponsor 5% towards transactions at service stations for all users defined in the `users` config variable. These users are determined and set by our NodeJS app.

```
// Sponsor 5% of qualifying users' fuel purchases
function sponsorAmount(transaction, history) {
  var amount = Math.abs(transaction.amount);
  var userId = transaction.user_id;
  var addedUsers = process.env.users;

  // Check valid user
  if (!addedUsers.includes(userId)) {
    return 0;
  }

  // Check fuel purchase
  if (transaction.merchant.category !== 'Service Stations') {
    return 0;
  }

  return Math.round(amount * 0.05);
}
```

### 1.5) Link to App to Root

The last step is to update the example app's config variables to link it to our Root client app and sponsor add-on. Fill in the values for the fields in the `.env-temp` file on the example app and change the name of the file to `.env`.

You can find your `CLIENT_ID` and `CLIENT_SECRET` if you view your client app on Root (App ID and App Secret). To get your `SPONSOR_ID`, navigate to the sponsor add-on created earlier and copy the string after `/sponsor/` in the URL. Your `OAUTH_REDIRECT_URL` will need to be the same one you entered when creating the client app, e.g. `https://590381dc.ngrok.io/callback`.

Your app should now be connected and ready to run with Root.

### 1.6) Let's run it

Time to get your app up and running!

```
npm start
```

You can now click on sign in with Root in the simulator, and it should redirect you back to your app.

## 2) Using the Event Generator

This tool allows you to simulate an inbound flow of data that could come from any source such as a smart watch, a sensor on a car, your raspberry pi, etc.

### 2.1) Once-off Events

With this you can publish single events to the server. It simply sends a value which is then received and processed on the server.

### 2.2) Streamed Events

Similar to once-off events, except it runners a timer browser-side that sends the values at a specified interval.

- `values`: Comma separated values. Will be split by `,` and sent one at a time.
- `interval`: Integer time in milliseconds.

## 3) Built With

* [NodeJS](https://nodejs.org/en/) - The web framework used
* [ExpressJS](https://expressjs.com/) - Dependency Management
* [DiskDB](https://www.npmjs.com/package/diskdb) - Local filesystem-based JSON database
* [Hogan Express](https://github.com/vol4ok/hogan-express) - A view/template engine for express
* [Alertify.js](https://alertifyjs.org/) - To show alerts that fade out
* [Pusher](https://pusher.com/) - To have real-time magic between express server and web page
* [DotEnv](https://www.npmjs.com/package/dotenv) - Loads environment variables from `.env` file

## 4) Author

* **[Elrich Groenewald](https://github.com/elrichgro)** @ [Root](https://github.com/RootBank)

## 5) License

This project is licensed under the MIT License.
