# sodashboard

This is a Bluemix Cloud-Foundry app that powers a Stack Overflow dashboard for the Dev Advocacy team. It is deployed automatically via a Bluemix continuous integration pipeline. Simple create a PR and if it's accepted and merged into the 'master' branch, it will be deployed.

## Configuration

Environment variables

- CLOUDANT_URL - the url of your Cloudant instance e.g. https://USER:PASS@HOST.cloudant.com
- CLOUDANT_DB - the name of the database e.g. questions
- SLACK_TOKEN - the Slack token or comma-separated list of tokens that are allowed for incoming webhooks to `POST /slack`

You need to configure a Slack "slash command" to post to this app's `/slack` endpoint. This is the starting point for authentication.

## Authentication

1) The user types `/sodashboard` in Slack, Slack makes a POST to this app's `/slack` endpoint.
2) Ths slack user is given a URL of the form `http://thisservice.mybluemix.net/login.html?asfafasaf`
3) When the user follows the URL, the token is validated and if it checks out, the web page is supplied with Cloudant
authentication credentials and the details of the user that is logging in.
4) The web page creates a local, in-browser database using PouchDB storing `_local/user` document containing the Cloudant credentials and details of the logged-in user
5) The user is bounced to the `home.html` page - the main page of this web app

## The web app

The web page `home.html` contains the entire web app. It uses the following technologies:

- PouchDB - an in-browser database that syncs with Cloudant
- Bootstrap - an HTML/CSS framework for creating responsive websites
- Vue.js - a framework that moves data between your client-side JavaScript code and the HTML DOM
- jQuery.js - the popular library

On loading `home.html` the user and Cloudant credentials are loaded from PouchDB (the `_local/user` document) and a two-way "sync" replication is set up between PouchDB and Cloudant.

The whole user interface is powered by queries against the local PouchDB instance.

As new changes arrive from the Cloudant database, our data model is updated so that the UI reflects changes as they happen. i.e.

- if you are watching the "Unassigned Tickets" page, you should see new tickets arrive as they are added to the Cloudant database by the ingestor
- if someone else assigns a ticket, you should see the data change in front of you

The user can also edit their own user profile, adding their Stack Overflow details. These are stored in the user record in the PouchDB database which is replicated up to Cloudant.

## Databases

### Tokens database - `tokens`

Contains the token documents which are used to store intermediate data during the authentication process.

### Questions database - `questions`

Another project already populates a Cloudant database with Stack Overflow questions that need answering. This project
connects to that database.

The questions look like this:

```js
{ 
    _id: '43388438',
  _rev: '1-188b33dd216a4297844ae0e758f1a5c5',
  type: 'question',
  owner: null,
  status: 'new',
  question: { 
     last_activity_date: 1492075585,
     view_count: 5,
     is_answered: false,
     tags: [ 'node.js', 'redis', 'socket.io' ],
     score: 0,
     creation_date: 1492075585,
     question_id: 43388438,
     link: 'http://stackoverflow.com/questions/43388438/approach-for-building-a-realtime-application-node-js-socket-io-redis',
     owner: 
     { 
        reputation: 33,
        display_name: 'enrichz',
        user_id: 5961962,
        user_type: 'registered',
        link: 'http://stackoverflow.com/users/5961962/enrichz',
        profile_image: 'https://www.gravatar.com/avatar/9840e58df70f493a36c8554e3cc370d7?s=128&d=identicon&r=PG' 
     },
     title: 'Approach for building a realtime application [Node.js Socket.io Redis]',
     answer_count: 0 
   }
}
```

The `question` part of the document comes straight from Stack Overflow. It may get updated by the ingestor process at any time.
Our meta data is stored at the top level of the document:

- type - identifies the type of document: `question` / `user`
- owner - which user id the question has been assigned to: default `null` meaning unassigned
- status - the status of the document: `new` / `updated`. 

#### Assignment

When a question is assigned to another user, the following top-level attributes are added to the doc:

```js
{
  ...
  "owner": "U0988EU",
	"assigned": true,
	"assigned_by": "U0Z2VN3EU",
	"assigned_by_name": "glynn.bird",
	"assigned_at": "2017-04-14T07:37:56.509Z"
  ...
}
```

#### Answered

When an a user affirms that they have answered a question, the following top-level attributes are added to the doc:

```js
{
  ...
	"answered": true,
	"answered_by": "U0Z2VN3EU",
	"answered_by_name": "glynn.bird",
	"answered_at": "2017-05-05T15:46:54.083Z",
  ...
}
```

