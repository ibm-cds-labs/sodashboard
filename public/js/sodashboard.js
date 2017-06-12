var db = new PouchDB('sodashboard');

var locateDoc = function(id) {
  for(var i in app.docs) {
    var d = app.docs[i];
    if (d._id === id) {
      return d;
    }
  }
  return null;
};

var validateAssignment = function(sel, inp) {
  var uid = sel ? sel.options[sel.selectedIndex].value : '';
  var uname = sel ? sel.options[sel.selectedIndex].text : '';
  if (uname && uid && uname.length>1 && uid.length == 9) {
    $('#assignUserBtn').prop('disabled', false);
  } else {
    var other = inp ? $(inp).val() : '';
    if (other && other.trim() && other.length > 1) {
      $('#assignUserBtn').prop('disabled', false);
    } else {
      $('#assignUserBtn').prop('disabled', true);
    }
  }
};

var parseHash = function() {
  if (window.location.hash && window.location.hash !== '#') {
    var hash = window.location.hash.replace(/^#/, '');
    if (hash === 'unassigned') {
      app.unAssignedTickets();
    } else if (hash === 'profile') {
      app.profileEditor();
    } else if (hash === 'mytickets') {
      app.myTickets();
    } else if (hash.match(/^edit/)) {
      var match = hash.match(/[0-9]+$/);
      if (match) {
        app.edit(match[0]);
      }
    }
  } else {
    app.mode = 'startup';
  }
}

var app = new Vue({
  el: '#app',
  data: {
    doc: null,
    docs: null,
    userlist: null,
    mode: 'startup',
    numDocs: null,
    loggedinuser: null,
    profile: null,
    syncInProgress: false,
    syncError: false,
    syncComplete: false,
    search: '',
    notetxt: '',
    customtags: '', 
    allcustomtags: [],
    suggestedtags: [],
    customtagsfocus: false,
    showNotes: false, 
    dateDisplayOpts: {
      weekday: 'long',
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true,
      month: 'long', 
      day: 'numeric' }
  },
  computed: {
    sortedDocs: function () {
      // get the app.docs but with tags sorted into order
      for(var i in this.docs) {
        this.docs[i].question.tags = this.docs[i].question.tags.sort();
      }
      return this.docs;
    },
    distinctTags: function() {
      // get distinct list of tags from tickets in the list
      var obj = {};
      for(var i in this.docs) {
        for(var j in this.docs[i].question.tags) {
          var tag = this.docs[i].question.tags[j];
          obj[tag] = true;
        }
      }
      return Object.keys(obj).sort();
    }
  },
  watch: {
    customtags: function(val, oldVal) {
      while(app.suggestedtags.length > 0) {
        app.suggestedtags.pop();
      }
      var t = val.trim().toLowerCase();
      if (t.length > 0 && app.allcustomtags.length > 0) {
        for (var i=0; i<app.allcustomtags.length; i++) {
          if (app.allcustomtags[i].indexOf(t) === 0) {
            app.suggestedtags.push(app.allcustomtags[i]);
          }
        }
      }
    }
  },
  methods: {
    notify: function(msg) {
      var opts = {
        element: 'body',
        position: null,
        type: "info",
        allow_dismiss: true,
        newest_on_top: false,
        offset: 20,
        spacing: 10,
        z_index: 1031,
        delay: 2500,
        timer: 1000,
        animate: {
          enter: 'animated fadeInDown',
          exit: 'animated fadeOutUp'
        }
      }
      $.notify({message: msg},opts);
    },
    edit: function(docid) {
      db.get(docid).then(function(data) {
        app.doc = data;
        app.mode = 'edit';
        app.notetxt = '';
        window.location.hash = '#edit?' + docid;

        app.getAllCustomTags();
      });
    },
    addNote: function() {
      if (!app.doc.notes) {
        app.doc.notes = [];
      }
      var obj = {
        time: new Date().toISOString(),
        note: app.notetxt,
        who: app.loggedinuser.user_name
      };
      app.doc.notes.push(obj);
      db.put(app.doc).then(function(data) {
        app.doc._rev = data.rev;
        app.notetxt = '';
      });
    },
    profileEditor: function(obj) {
      if (obj && !obj.clientX) { // make sure this isn't a MouseEvent 
        app.profile = obj;
        app.mode = 'profile';
        window.location.hash = '#profile';
      } else {
        // load the user profile
        db.get(app.loggedinuser._id).then(function (data) {
          // enable the profile editor
          app.profile = data;
          app.mode = 'profile';
          window.location.hash = '#profile';
        });
      }
    },
    saveProfile: function() {
      // save the profile to PouchDB
      db.put(app.profile).then(function(data) {
        // return to startup mode
        app.profile._rev = data.rev;
        app.mode = 'startup';
        window.location.hash = '#';
      });
    },
    getAllCustomTags: function() {
      db.query('search/customtags').then(function (resp) {
        if (resp && resp.rows) {
          app.allcustomtags = resp.rows[0].value || [];
        } else {
          console.warn(resp);
        }
      }).catch(function (err) {
        console.warn(err);
      });

    },
    myTickets: function() {
     // load tickets assigned to me  
      var map = function(doc) {
        if (doc.question && 
             (typeof doc.rejected === 'undefined' || doc.rejected === false) && 
             (typeof doc.answered === 'undefined' || doc.answered === false) &&
             doc.owner !== null) {
          emit(doc.owner, null);
        }
      };
      // get list of unassigned tickets, newest first
      db.query(map, {key: app.loggedinuser._id, include_docs:true}).then(function(data) {
        app.docs = [];
        for(var i in data.rows) {
          app.docs.push(data.rows[i].doc);
        }
        app.mode = 'mytickets';
      });
    },
    unAssignedTickets: function() {
      // load unassigned tickets
      var map = function(doc) {
        if (!doc.rejected && !doc.answered && doc.owner === null) {
          emit(doc.question.creation_date, null);
        }
      };
      // get list of unassigned tickets, newest first
      db.query(map, {include_docs:true, descending: true}).then(function(data) {
        console.log('unAssignedTickets', data);
        app.docs = [];
        for(var i in data.rows) {
          app.docs.push(data.rows[i].doc);
        }
        app.mode = 'unassigned';
      });
    },
    onSyncChange: function(change) {
      // when we receive notification of a change
      app.syncInProgress = true;
      app.syncComplete = false;

      // if it's an incoming change (rather than us sending one to the cloud)
      if (change.direction === 'pull') {
        
        // for each change
        var inTheList = false;
        for (var i in change.change.docs) {
          var d = change.change.docs[i];
          
          // see if the document id that is changing is on our app.docs list
          for (var j in app.docs) {
            if (app.docs[j]._id === d._id) {
              // overwrite our copy with the one that has changed
              app.docs[j] = d;
              inTheList = true;
              break;
            }
          }

          // if we have a new unassigned ticket and we're in unassigned mode
          if (!intheList && app.mode === 'unassigned' && d.owner === null && d.status === 'new') {
            // add it to the top of our list
            app.docs.unshift(d);
          }
        }
      }
      
    },
    onSyncPaused: function(err) {
      app.syncComplete = true;
      app.syncInProgress = false;

      // load the doc count
      db.info().then(function(data) {
        app.numDocs = data.doc_count;

        // get a list of users
        var map = function(doc) {
          if (doc.type && doc.type === 'user') {
            emit(doc.user_name, null);
          }
        };
        return db.query(map);
      }).then(function(users) {
        var userlist = {};
        for(var i in users.rows) {
          var u = users.rows[i];
          userlist[u.id] = u.key;
        }
        app.userlist = userlist;
      });
    },
    onSyncError: function(err) {
      // sync error
      app.syncInProgress = false;
      app.syncComplete = false;
      app.syncError = true;
      console.log('error', err);
    },
    assign: function(id) {
      // called when someone clicks the assign button
      // find the doc that was rejected an update the database
      var doc = null;
      if (app.mode === 'edit') {
        doc = app.doc;
      } else {
        doc = locateDoc(id);
      }
      if (doc) {
        doc.assigned = true;
        doc.assigned_by = app.loggedinuser.user_id;
        doc.assigned_by_name = app.loggedinuser.user_name;
        doc.assigned_at = new Date().toISOString();
        db.put(doc).then(function(reply) {
          if (app.mode === 'mytickets' && doc.owner !== app.loggedinuser.user_id) {
            app.removeFromList(doc._id);
          } else if (app.mode === 'unassigned') {
            app.removeFromList(doc._id);
          } else {
            doc._rev = reply.rev;
          }
          app.notify('Question ' + doc._id + ' reassigned');
        });
      }
    },
    reject: function(id) {
      // called when someone calls the reject button
      // find the doc that was rejected and update the database
      var doc = null;
      if (app.mode === 'edit') {
        doc = app.doc;
      } else {
        doc = locateDoc(id);
      }

      if (doc) {
        doc.rejected = true;
        doc.rejected_by = app.loggedinuser.user_id;
        doc.rejected_by_name = app.loggedinuser.user_name;
        doc.rejected_at = new Date().toISOString();
        db.put(doc).then(function(reply) {
          doc._rev = reply.rev;
          app.removeFromList(id);
          app.notify('Question ' + doc._id + ' rejected');
        });
      }
    },
    answered: function(id) {
      // called when someone hits the answered button
      // find the doc that was answered and update the database
      var doc = null;
      if (app.mode === 'edit') {
        doc = app.doc;
      } else {
        doc = locateDoc(id);
      }
      if (doc) {
        doc.answered = true;
        doc.answered_by = app.loggedinuser.user_id;
        doc.answered_by_name = app.loggedinuser.user_name;
        doc.answered_at = new Date().toISOString();
        db.put(doc).then(function(reply) {
          doc._rev = reply.rev;
          app.removeFromList(id);
          app.notify('Question ' + doc._id + ' answered');
        });
      }
    },
    selectcustomtag: function(tag) {
      app.customtags = tag;
      document.getElementById('custom-tags').focus();
    },
    addcustomtags: function(id) {
      if (app.doc) {
        app.doc.custom_tags = app.doc.custom_tags || [];

        var tags = app.customtags.split(',')
          .map(function (tag) {
            // normalize tags (i.e., lowercase, replace whitespace with hyphen)
            return tag.trim().toLowerCase().replace(/\s+/g, '-');
          })
          .filter(function(tag, idx, arr) {
            //remove empty and duplicate tags
            return tag && typeof tag === 'string' && arr.indexOf(tag) === idx;
          });

        for (var t in tags) {
          if (app.doc.custom_tags.indexOf(tags[t]) === -1) {
            app.doc.custom_tags.push(tags[t]);
          }
        }

        db.put(app.doc).then(function(data) {
          app.doc._rev = data.rev;
          app.customtags = '';
        });
      }
    },
    removecustomtag: function(id, tag) {
      if (app.doc && app.doc.custom_tags) {
        app.doc.custom_tags = app.doc.custom_tags.filter(function(t, idx ,arr) {
          return t && typeof t === 'string' && t !== tag;
        });

        db.put(app.doc).then(function(data) {
          app.doc._rev = data.rev;
        });
      }
    },
    handleKeyNav: function(dir) {
      var isInput = document.activeElement.id === 'custom-tags';
      var isPrev = dir === 'prev';

      if (isInput && !isPrev) {
        document.querySelector('.suggestedtag').focus();
      } else if (!isInput && !isPrev) {
        if (document.activeElement.nextSibling) {
          document.activeElement.nextSibling.focus();
        }
      } else if (!isInput && isPrev) {
        if (document.activeElement.previousSibling) {
          document.activeElement.previousSibling.focus();
        } else {
          document.getElementById('custom-tags').focus();
        }
      }
    },
    removeFromList: function(id) {
      for (var j in app.docs) {
        if (app.docs[j]._id === id) {
          console.log('Removed', id);
          app.docs.splice(j, 1);
          break;
        }
      }
    },
    logout: function() {
      db.destroy().then(function(data) {
        window.location = 'index.html';
      })
    },
    doSearch: function() {
      console.log('search', app.search)
      db.search({
        query: app.search,
        fields: ['question.title', 'question.tags'],
        include_docs: true
      }).then(function(data) {
        app.docs = [];
        for(var i in data.rows) {
          app.docs.push(data.rows[i].doc);
        }
        app.mode = 'search';
      });
      
    }
  }
});

// on startup
db.get('_local/user').then(function(data) {

  // set the logged in user
  app.loggedinuser = data.user;

  // sync with Cloudant
  var auth = data.username + ':' + data.password;
  var url = data.url.replace(/\/\//, '//' + auth + '@');
  var opts = { live: true, retry: true };

  db.replicate.from(url).on('complete', function(info) {
    console.log(info);
    console.log('initial sync complete - now syncing');
    db.sync(url, opts)
      .on('change', app.onSyncChange)
      .on('paused', app.onSyncPaused)
      .on('error', app.onSyncError);
  }).on('error', app.onSyncError);;

  // if user has an incomplete profile, take them to their profile page
  // get profile from remote db because sync is probably not yet complete
  var rdb = new PouchDB(url);
  rdb.get(app.loggedinuser["_id"]).then(function (userdata) {
    if (!userdata.so_id) {
      app.profileEditor(userdata);
    } else {
      // parse the hash
      parseHash();
    }
  }).catch(function(userdataerr) {
    console.log(userdataerr);
  });


  $(window).on('hashchange', function(evt) {
    parseHash();
  });

}).catch(function(e) {
  // if there's no _local/user document, you're not logged in
  window.location = 'index.html';
});