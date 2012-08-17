// Generated by CoffeeScript 1.3.3
(function() {
  var MongoStore, app, browserCheck, color, colors, connect, cp, ensureSession, express, fs, hbpc, hydrateSettings, io, jbha, logger, logging, mode, mongo_uri, os, package_info, port, secrets, sessionStore, socketio, workers, _;

  _ = require("underscore");

  fs = require("fs");

  os = require("os");

  cp = require("child_process");

  colors = require("colors");

  connect = require("connect");

  express = require("express");

  socketio = require("socket.io");

  hbpc = require("handlebars-precompiler");

  MongoStore = require("connect-mongo")(express);

  jbha = require("./jbha");

  logging = require("./logging");

  secrets = require("./secrets");

  logger = new logging.Logger("SRV");

  package_info = JSON.parse(fs.readFileSync("" + __dirname + "/package.json", "utf-8"));

  console.log("Got here");

  app = express.createServer();

  io = socketio.listen(app, {
    log: false
  });

  mode = null;

  port = null;

  color = null;

  mongo_uri = null;

  app.configure('development', function() {
    mode = 'development';
    port = 8888;
    color = 'magenta';
    mongo_uri = secrets.MONGO_STAGING_URI;
    io.set("log level", 3);
    io.set("logger", new logging.Logger("SIO"));
    app.set('view options', {
      pretty: true
    });
    return console.log("devel");
  });

  app.configure('production', function() {
    mode = 'production';
    port = 80;
    color = 'green';
    mongo_uri = secrets.MONGO_PRODUCTION_URI;
    io.set('transports', ['xhr-polling', 'jsonp-polling', 'htmlfile']);
    app.set('view options', {
      pretty: false
    });
    return console.log("prod");
  });

  sessionStore = new MongoStore({
    db: 'keeba',
    url: mongo_uri,
    stringify: false,
    clear_interval: 432000
  }, function() {
    return app.listen(port);
  }, logger.info("Keeba " + package_info.version + " serving in " + mode[color] + " mode on port " + (port.toString().bold) + "."));

  app.configure(function() {
    app.use(express.cookieParser());
    app.use(express.bodyParser());
    hbpc.watchDir("" + __dirname + "/views/templates", "" + __dirname + "/static/js/templates.min.js", ['handlebars']);
    app.use(express.session({
      store: sessionStore,
      secret: secrets.SESSION_SECRET,
      key: "express.sid"
    }));
    app.use(app.router);
    app.use(express["static"]("" + __dirname + "/static"));
    app.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
    app.set('view engine', 'jade');
    return app.set('views', "" + __dirname + "/views");
  });

  app.dynamicHelpers({
    version: function(req, res) {
      return package_info.version;
    },
    development_build: function(req, res) {
      if (mode === 'development') {
        return true;
      } else {
        return false;
      }
    }
  });

  browserCheck = function(req, res, next) {
    var regex, ua, version;
    ua = req.headers['user-agent'];
    if (ua.indexOf("MSIE") !== -1) {
      regex = /MSIE\s(\d{1,2}\.\d)/.exec(ua);
      version = Number(regex[1]);
      if (version < 9) {
        return res.redirect("/unsupported");
      }
    }
    return next();
  };

  ensureSession = function(req, res, next) {
    req.token = req.session.token;
    if (!req.token) {
      return res.redirect("/?whence=" + req.url);
    } else {
      return next();
    }
  };

  hydrateSettings = function(req, res, next) {
    return jbha.Client.read_settings(req.token, function(err, settings) {
      req.settings = settings;
      if (!settings) {
        req.session.destroy();
        return res.redirect("/");
      }
      return next();
    });
  };

  app.get("/", browserCheck, function(req, res) {
    var token;
    token = req.session.token;
    if (token) {
      return jbha.Client.read_settings(token, function(err, settings) {
        return res.redirect("/app");
      });
    } else {
      return res.render("index", {
        failed: false,
        appmode: false,
        email: null
      });
    }
  });

  app.post("/", function(req, res) {
    var email, password, whence;
    email = req.body.email;
    password = req.body.password;
    whence = req.query.whence;
    return jbha.Client.authenticate(email, password, function(err, response) {
      if (err) {
        return res.render("index", {
          failed: true,
          appmode: false,
          email: email
        });
      } else {
        req.session.token = response.token;
        if (response.is_new) {
          return res.redirect("/setup");
        } else {
          if (whence) {
            return res.redirect(whence);
          } else {
            return res.redirect("/app");
          }
        }
      }
    });
  });

  app.get("/about", function(req, res) {
    return res.render("about", {
      appmode: false
    });
  });

  app.get("/help", function(req, res) {
    return res.render("help", {
      appmode: false
    });
  });

  app.get("/unsupported", function(req, res) {
    return res.render("unsupported", {
      appmode: false
    });
  });

  app.get("/feedback", function(req, res) {
    return jbha.Client.read_feedbacks(function(err, feedbacks) {
      return res.render("feedback", {
        feedbacks: feedbacks,
        appmode: false
      });
    });
  });

  app.get("/logout", function(req, res) {
    req.session.destroy();
    return res.redirect("/");
  });

  app.get("/setup", ensureSession, hydrateSettings, function(req, res) {
    if (req.settings.is_new) {
      return res.render("setup", {
        appmode: false,
        settings: JSON.stringify(req.settings)
      });
    } else {
      return res.redirect("/");
    }
  });

  app.post("/setup", ensureSession, function(req, res) {
    var settings;
    settings = {
      firstrun: true
    };
    if (req.body.nickname) {
      settings.nickname = req.body.nickname;
    }
    return jbha.Client.update_settings(req.token, settings, function() {
      return res.redirect("/");
    });
  });

  app.get("/app*", ensureSession, hydrateSettings, function(req, res) {
    return jbha.Client.by_course(req.token, function(courses) {
      if (!req.settings || req.settings.is_new) {
        return res.redirect("/setup");
      } else {
        return res.render("app", {
          appmode: true,
          courses: JSON.stringify(courses),
          firstrun: req.settings.firstrun,
          feedback_given: req.settings.feedback_given,
          nickname: req.settings.nickname,
          settings: JSON.stringify(req.settings),
          info: package_info
        });
      }
    });
  });

  io.set("authorization", function(data, accept) {
    if (data.headers.cookie) {
      data.cookie = connect.utils.parseCookie(data.headers.cookie);
      data.sessionID = data.cookie['express.sid'];
      data.sessionStore = sessionStore;
      return sessionStore.get(data.sessionID, function(err, session) {
        if (err) {
          return accept(err.message.toString(), false);
        } else {
          data.session = new connect.middleware.session.Session(data, session);
          if (!data.session.token) {
            return accept("No session token", false);
          } else {
            return accept(null, true);
          }
        }
      });
    } else {
      return accept("No cookie transmitted.", false);
    }
  });

  workers = {};

  io.sockets.on("connection", function(socket) {
    var L, broadcast, keepAlive, keep_alive_id, sync, token;
    token = socket.handshake.session.token;
    socket.join(token.username);
    L = function(message, urgency) {
      if (urgency == null) {
        urgency = "debug";
      }
      return logger[urgency]("" + token.username.underline + " :: " + message);
    };
    sync = function(model, method, data) {
      var event_name;
      event_name = "" + model + "/" + data._id + ":" + method;
      return socket.broadcast.to(token.username).emit(event_name, data);
    };
    broadcast = function(message, data) {
      return io.sockets["in"](token.username).emit(message, data);
    };
    keepAlive = function() {
      return jbha.Client.keep_alive(token, function(err) {
        return L("Kept remote session alive", "info");
      });
    };
    keep_alive_id = setInterval(keepAlive, 1500000);
    socket.on("disconnect", function() {
      return clearInterval(keep_alive_id);
    });
    socket.on("refresh", function(options) {
      var worker;
      worker = workers[token.username];
      if (worker) {
        L("Worker with pid " + worker.pid + " replaced", 'warn');
        worker.kill('SIGHUP');
      }
      worker = workers[token.username] = cp.fork("" + __dirname + "/worker.js", [], {
        env: process.env
      });
      L("Worker with pid " + worker.pid + " spawned", 'debug');
      worker.send({
        action: "refresh",
        token: token,
        options: options
      });
      broadcast("refresh:start");
      setTimeout(function() {
        return worker.kill('SIGKILL');
      }, 30000);
      worker.on("message", function(message) {
        return broadcast("refresh:end", {
          err: message[0],
          res: message[1]
        });
      });
      return worker.on("exit", function(code, signal) {
        delete workers[token.username];
        if (signal === 'SIGHUP') {
          return;
        }
        if (code !== 0) {
          if (signal === 'SIGKILL') {
            L("Worker with pid " + worker.pid + " timed out and was killed", 'error');
            return broadcast("refresh:end", {
              err: "Worker timed out"
            });
          } else {
            L("Worker with pid " + worker.pid + " crashed", 'error');
            return broadcast("refresh:end", {
              err: "Worker crashed"
            });
          }
        } else {
          return L("Worker with pid " + worker.pid + " exited successfully", 'debug');
        }
      });
    });
    socket.on("settings:read", function(data, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.read_settings(token, function(err, settings) {
        return cb(null, settings);
      });
    });
    socket.on("settings:update", function(data, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.update_settings(token, data, function() {
        socket.broadcast.to(token.username).emit("settings/0:update", data);
        return cb(null);
      });
    });
    socket.on("course:create", function(data, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.create_course(token, data, function(err, course) {
        socket.broadcast.to(token.username).emit("courses:create", course);
        return cb(null, course);
      });
    });
    socket.on("courses:read", function(data, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.by_course(token, function(courses) {
        return cb(null, courses);
      });
    });
    socket.on("course:update", function(data, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.update_course(token, data, function(err) {
        sync("course", "update", data);
        return cb(null);
      });
    });
    socket.on("course:delete", function(data, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.delete_course(token, data, function(err) {
        sync("course", "delete", data);
        return cb(null);
      });
    });
    socket.on("assignments:create", function(data, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.create_assignment(token, data, function(err, course, assignment) {
        socket.broadcast.to(token.username).emit("course/" + course._id + ":create", assignment);
        return cb(null, assignment);
      });
    });
    socket.on("assignments:update", function(data, cb) {
      return jbha.Client.update_assignment(token, data, function(err) {
        sync("assignments", "update", data);
        if (_.isFunction(cb)) {
          return cb(null);
        }
      });
    });
    socket.on("assignments:delete", function(data, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.delete_assignment(token, data, function(err) {
        sync("assignments", "delete", data);
        return cb(null);
      });
    });
    socket.on("feedback", function(message, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return jbha.Client.create_feedback(token, message, cb);
    });
    socket.on("d/a", function(account, cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      if (token.username !== "avi.romanoff") {
        return cb(null);
      }
      return jbha.Client._delete_account(token, account, function(err) {
        return cb(null);
      });
    });
    return socket.on("stats", function(cb) {
      if (!_.isFunction(cb)) {
        return;
      }
      return cb({
        loadavg: os.loadavg(),
        totalmem: os.totalmem() / 1048576,
        free: os.freemem() / 1048576
      });
    });
  });

}).call(this);
