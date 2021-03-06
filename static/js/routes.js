// Copyright (C) 2013 Avi Romanoff <aviromanoff at gmail.com>

// Contains the router which is used ONLY
// on the app page itself.

var KeebaRouter = Backbone.Router.extend({

  current_view: null,

  routes: {
    "":                  "home",
    "courses/:id":       "course",
    "dates/:name":       "date",
  },

  home: function () {
    $("#content").html(Handlebars.templates.home());
    window.document.title = "Keeba";
  },

  course: function (id) {
    var course = courses.get(id);

    if (_.isUndefined(course)) {
      return this.navigate ('', true);
    }

    if (!_.isNull(this.current_view)) {
      this.current_view.remove();
    }

    this.current_view = new SectionView({model: course});

    this.current_view.model.on('change:title', function (model) {
      window.document.title = model.get('title');
    });
    
    window.document.title = course.get('title');
    $("#content").html(this.current_view.render().el);
    this.trigger("highlight");
  },

  date: function (link_name) {
    var date = DATE_MAP[link_name];

    if (_.isUndefined(date)) {
      return this.navigate ('', true);
    }

    if (!_.isNull(this.current_view)) {
      this.current_view.remove();
    }

    this.current_view = new DatesView({
      template: Handlebars.templates.dates,
      title: date.name,
      range: {start: date.start, end: date.end}
    });

    window.document.title = date.name;
    $("#content").html(this.current_view.render().el);
    this.trigger("highlight");
  }
});