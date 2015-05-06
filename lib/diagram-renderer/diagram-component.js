/***********************************
 * diagramComponent
 **********************************/

var _ = require('lodash');
var DiagramRenderer = require('./diagram-renderer.js');
var highland = require('highland');
var Highlighter = require('../highlighter/highlighter.js');
var Notifications = require('../notifications/notifications.js');
var JSONStream = require('JSONStream');
var m = require('mithril');
var hyperquest = require('hyperquest');
var resolveUrl = require('resolve-url');

function DiagramComponent(kaavio) {
  var diagramComponent = {};

  //*
  diagramComponent.SelectedElement = function(selectedElementId) {
    var that = this;

    if (!selectedElementId || !kaavio.highlighter) {
      return;
    }

    this.selector = m.prop('#' + selectedElementId);

    this.pvjson = m.prop(
        _.find(kaavio.sourceData.pvjson.elements, function(pvjsElement) {
          return pvjsElement.id === selectedElementId;
        }));

    var groups = kaavio.highlighter.groups;
    //var highlightedElements = (groups.typeahead || []).concat(groups.preset || []);

    if (!_.isEmpty(groups.preset)) {
      this.previousHighlighting = _(groups.preset).map(function(presetItem) {
        return _.zip(presetItem.element, presetItem.highlighting).map(function(zipped) {
          var element = zipped[0];
          var highlighting = zipped[1];
          return {
            element: element,
            highlighting: highlighting
          };
        })
        .filter(function(item) {
          return item.element.id === selectedElementId;
        })
        /*
        .map(function(item) {
          return _.partial(kaavio.highlighter.highlight,
              that.selector(), 'preset', item.highlighting);
        });
        //*/
        //*
        .map(function(item) {
          return _.bind(kaavio.highlighter.highlight, kaavio.highlighter,
            that.selector(), 'preset', item.highlighting);
        });
        //*/
      })
      .flatten()
      .first();

    }

    if (!this.previousHighlighting) {
      // de-highlight previous selection, if it exists and
      // was not highlighted by preset or typeahead
      this.previousHighlighting = _.bind(kaavio.highlighter.attenuate,
          kaavio.highlighter, that.selector(), 'selected');
    }

    /*
    _.find(_.reduce(highlightedElements, function(group) {
      return group.element.id === 'what';
    }, []);
    //*/

    /*
    _.find(_.map((groups.typeahead || []).concat(groups.preset || []), function(group) {
      return group.element.id === 'what';

    });
    //*/

    //this.element = m.prop(selectedPvjsElement);
    this.id = m.prop(selectedElementId);
    this.unselectedStyle = m.prop({});
    this.unselect = function() {
      kaavio.highlighter.attenuate('#' + that.id());
    };
  };
  //*/

  diagramComponent.vm = (function() {
    var vm = {};
    vm.init = function() {
      vm.diagramRenderer = new DiagramRenderer();
      vm.footerState = m.route.param('editorState');

      vm.selectedPvjsElement = m.prop();

      // Listen for renderer errors
      kaavio.on('error.renderer', function() {
        vm.diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
      });

      kaavio.whiz = {};
      kaavio.zeew = function() {
        console.log('zeew');
      };

      kaavio.highlighter = function() {};
      kaavio.notifications = function() {};

      kaavio.on('rendered', function() {
        // TODO using __proto__ is not rec. Fix it.
        var highlighter = new Highlighter(kaavio, kaavio.options);
        _.assign(kaavio.highlighter, highlighter);
        kaavio.highlighter.__proto__ = highlighter.__proto__;
        var notifications = new Notifications(kaavio, kaavio.options);
        _.assign(kaavio.notifications, notifications);
        kaavio.notifications.__proto__ = notifications.__proto__;

        vm.selectedElement = new diagramComponent.SelectedElement();

        var highlightEntitiesList = kaavio.options.highlights;

        //TODO remove this. It's just for testing.
        //kaavio.highlighter.highlight('PHB-2', 'preset', {backgroundColor: 'red'});

        if (!!highlightEntitiesList && highlightEntitiesList.length !== 0) {
          highlightEntitiesList.map(function(entity) {
            var selector = entity.selector;
            var selectorMatch = selector.match(/xref:id:(.*)\,(.*)/);
            if (selectorMatch) {
              var dbName = selectorMatch[2];
              var dbId = selectorMatch[1];
              var entityReferenceId = kaavio.sourceData.pvjson.elements
              /*
              .filter(function(element) {
                return !!element.isDataItemIn;
              })
              .filter(function(element) {
                return element.isDataItemIn.dbName === dbName && element.isDataItemIn.dbId === dbId;
              })
              //*/
              /*
              .filter(function(element) {
                return element.dbName === dbName && element.dbId === dbId;
              })
              //*/
              .filter(function(element) {
                var iriRegex = new RegExp('^http:\/\/.*' + dbId + '.*')
                return element.id && iriRegex.test(element.id);
              })
              .map(function(entity) {
                //return entity['@id'];
                return entity.id;
              })[0];
              entity.selector = 'xref:id:' + entityReferenceId;
            }

            return entity;
          }).forEach(function(entity) {
            kaavio.highlighter.highlight(entity.selector, 'preset', entity);
          });

        }
      });

      vm.destroy = function() {
        vm.diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
      };

      /***********************************************
       * DataNode onclick event handler
       **********************************************/
      vm.onClickHandler = function(e) {

        if (!!vm.selectedElement && !!vm.selectedElement.previousHighlighting) {
          // return highlighting to previous state, if it exists
          vm.selectedElement.previousHighlighting();
        }

        var selectedElementId = e.target.id;

        vm.selectedElement = new diagramComponent.SelectedElement(selectedElementId);

        if (!selectedElementId) {
          //return vm.init(kaavio);
          vm.selectedPvjsElement(null);
          return;
        }

        //*/

        vm.selectedPvjsElement(kaavio.sourceData.pvjson.elements.filter(
                function(pvjsElement) {
              return pvjsElement.id === selectedElementId;
            })
            .map(function(pvjsElement) {
              return pvjsElement;
            })[0]);

        /*
        if (!vm.selectedPvjsElement()) {
          return vm.init(kaavio);
        }
        //*/

        if (!!vm.selectedPvjsElement()) {
          kaavio.highlighter.highlight('#' + selectedElementId, 'selected', {
            backgroundColor: 'white', borderColor: 'green'
          });
        }

        var kaaviodiagramelementclickEvent = new CustomEvent('kaaviodiagramelementclick', {
          detail: {
            selectedPvjsElement: vm.selectedPvjsElement()
          }
        });
        kaavio.containerElement.dispatchEvent(kaaviodiagramelementclickEvent);
      }

      vm.clearSelection = function clearSelection() {
        if (vm.selectedPvjsElement()) {
          kaavio.highlighter.attenuate(
              '#' + vm.selectedPvjsElement.id, 'selected');
        }

        vm.selectedPvjsElement(null);
      }

      vm.onunload = function() {
        return;
      };

      vm.reset = function() {
      };
    };

    return vm;
  })();

  diagramComponent.controller = function() {
    diagramComponent.vm.init();
  };

  /*
  //here's an example plugin that determines whether data has changes.
  //in this case, it simply assumes data has changed the first time, and never changes after that.
  var renderOnce = (function() {
    var cache = {};
    return function(view) {
      if (!cache[view.toString()]) {
        cache[view.toString()] = true;
        return view(cache);
      } else {
        return {subtree: 'retain'};
      }
    };
  }());
  //*/

  diagramComponent.view = function() {
    //return renderOnce(function() {
    return m('div', {
      'class': 'diagram-container footer-' + diagramComponent.vm.footerState,
      onclick: diagramComponent.vm.onClickHandler,
      config: function(el, isInitialized) {
        if (!isInitialized) {
          //integrate with the auto-redrawing system...
          //m.startComputation();

          kaavio.diagramContainerElement = el;

          // Init sourceData object
          kaavio.sourceData = {
            pvjson: null, // pvjson object
            selector: null, // selector instance
          };

          highland([kaavio.options]).flatMap(function(options) {
            var pvjson = options.pvjson;
            var src = options.src;

            if (!!pvjson) {
              return highland([pvjson]);
            } else if (!!src) {
              var absoluteSrc = resolveUrl(src);
              return highland(hyperquest(absoluteSrc))
              .through(JSONStream.parse())
              .collect()
              .map(function(body) {
                return body[0];
              });
            } else {
              throw new Error('Missing or invalid source pvjson data. The input options ' +
                  'require either a "src" property with a string value representing ' +
                  'an IRI to a pvjson JSON resource ' +
                  'or a "pvjson" property with a parsed JavaScript object representing a ' +
                  'pvjson JSON resource.')
            }
          })
          .errors(function(err, push) {
            throw err;
          })
          .each(function(pvjson) {
            kaavio.sourceData.pvjson = pvjson;
            diagramComponent.vm.diagramRenderer.render(kaavio);
          });

          /*
          kaavio.on('rendered', function() {
            //kaavio.panZoom.resizeDiagram();
            kaavio.highlighter = new Highlighter(
              kaavio, kaavio.options);
            //m.endComputation();
          });
          //*/
        }
      }
    });
    //});
  };

  return diagramComponent;
}

module.exports = DiagramComponent;