/* ***********************************************************************

   Stack Overflow Duty 

   This is a Cloud-Foundry Node.js app designed to power a web service
   that allows a team of developer advocates to deal with Stack Overflow
   questions held in a Cloudant database.

   *********************************************************************** */

// dependencies
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();
var db = require('./lib/db.js');

// get Bluemix port to listen to
var port = appEnv.port;

// process slack tokens
var slackTokens = process.env.SLACK_TOKEN;
if (!slackTokens) {
  console.error('Expected SLACK_TOKEN environment variable');
  process.exit(1);
}
slackTokens = slackTokens.split(',');

// body parsing
app.use(bodyParser.urlencoded());

// static files
app.use(express.static('public'));

app.get('/home.html', function (req, res) {
  res.redirect('/')
})

// slack /soduty handler login handler
// receives webhook from Slack an creates a token in a Cloudant database
// the Slack user then follows the link they are given to redeem the token
app.post('/slack', function (req, res) {
  
  // get incoming token
  var token = req.body.token;

  // if it matches our expected Slack token
  if (slackTokens.indexOf(token) > -1) {

    // create token containing the Slack request
    var doc = req.body;
    doc.ts = new Date().getTime()/1000 + 60*5;

    // put it into Cloudant
    db.tokens.insert(doc).then(function(data) {

      // reply back to the user with a URL to visit
      res.send('Welcome to Stack Overflow duty. To login, please visit ' + appEnv.url + '/login.html?'+ data._id);

    }).catch(function() {
      res.send(400);
    });
  } else {
    res.status(403).end();
  }
});

// redeem token handler
app.post('/redeem/:id', function (req, res) {
  var user = null;
  var newUser = null;

  // fetch the token from the database
  db.tokens.get(req.params.id).then(function(data) {

    // tokens only last five minutes
    var now = new Date().getTime()/1000;
    if (data.ts &&  data.ts < now) {
      throw(new Error('token out of date'));
    }

    // create a user (or update an existing one)
    data._id = data.user_id;
    data.type = 'user';
    user = data;

    // delete the token
    return db.tokens.del(req.params.id);

  }).then(function(d) {
    // merge in this user data if necessary - other keys in the document will remain intact
    return db.so.update(user, true); 
  }).then(function(data) {

    // create a new Cloudant apikey/password 
    return db.so.createUser(['_reader','_writer','_replicator']);
  }).then(function(data) {
    newUser = data;

    // read the _security document from the events database
    return db.events.get('_security');
  }).then(function(data) {

    // ensure that the new user has the correct permissions on this database too
    data['_id'] = '_security';
    data.cloudant[newUser.key] = ['_reader','_writer','_replicator'];
    return db.events.update(data);
  }).then(function(data) {
    
    // pass the Cloudant URL, username, password and user data back to the caller
    return res.send({ url: db.url, username: newUser.key, password: newUser.password, ok: true, user: user });
  }).catch(function(e) {
    console.log('Error', e);
    res.status(400).end();
  });
});

// listen on the correct port
app.listen(port, function () {
  console.log('Example app listening on port ', port)
});