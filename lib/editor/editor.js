var _ = require('lodash');
var insertCss = require('insert-css');
var fs = require('fs');
var EditorTabsComponent = require('./editor-tabs-component/editor-tabs-component');
var m = require('mithril');

var css = [
  fs.readFileSync(__dirname + '/editor.css')
];

module.exports = function(kaavio) {
  var containerElement = kaavio.containerElement;
  var editorTabsComponentContainerElement;
  css.map(insertCss);

  //module for editor
  //for simplicity, we use this module to namespace the model classes
  var editor = {};

  //*
  editor.ActiveElement = function(selectedPvjsElement) {

    var editableElementTypes = [
      'biopax:Protein',
      'biopax:Pathway',
      'biopax:Rna',
      'gpml:GeneProduct',
      'gpml:Metabolite'
    ];

    if (_.isEmpty(selectedPvjsElement)) {
      //return vm.init(kaavio);
      return editor.vm.reset();
    }

    var selectedPvjsElementType = _.isArray(selectedPvjsElement.type) ?
      selectedPvjsElement.type : [selectedPvjsElement.type];

    if (_.isEmpty(_.intersection(selectedPvjsElementType, editableElementTypes))) {
      return editor.vm.reset();
    }

    this.id = m.prop(selectedPvjsElement.id);
  };
  //*/

  //the view-model,
  editor.vm = (function() {
    var vm = {};

    vm.init = function() {

      vm.state = m.prop(m.route.param('editorState'));

      vm.activeSelection = m.prop(new editor.ActiveElement(null));

      if (vm.state() === 'open') {
        var editorTabsComponent = editor.editorTabsComponent = new EditorTabsComponent(kaavio);

        kaavio.containerElement.addEventListener('kaaviodiagramelementclick', function(event) {
          var selectedpvjselement = event.detail.selectedPvjsElement;
          vm.activeSelection(new editor.ActiveElement(selectedpvjselement));
        });

        editorTabsComponent.vm.init(kaavio);
      }

      vm.onunload = function() {
        vm.state(m.route.param('editorState'));
        // TODO remove this once we can verify it's not needed.
        // Right now, it duplicates the call at the bottom.
        vm[m.route.param('editorState')]();
      };

      vm.tester = m.prop('');

      // react to user updating tester value
      vm.updateTester = function(newTester) {
        if (!!newTester) {
          vm.tester = m.prop(newTester);
        }
      };

      vm.open = function() {
        kaavio.kaavioComponent.vm.state.footer('open');
        vm.state('open');
        editorTabsComponentContainerElement = containerElement.querySelector(
            '.kaavio-editor-tabs');

        kaavio.on('rendered', function() {
          kaavio.containerElement.addEventListener(
              'click', vm.onClickDiagramContainer, false);
          //m.endComputation();
        });
      };

      vm.closed = function() {
        kaavio.kaavioComponent.vm.state.footer('closed');
        editor.vm.state('closed');

        if (!!kaavio.containerElement) {
          //clearSelection();
          save();
          kaavio.containerElement.removeEventListener(
              'click', vm.onClickDiagramContainer, false);
          editor.editorTabsComponent.vm.close();
          kaavio.panZoom.resizeDiagram();
        }
      };

      vm.disabled = vm.closed;

      //vm[m.route.param('editorState')]();
    };

    vm.reset = function() {
      //vm.activeSelection(null);
    };

    return vm;
  }());

  //the controller defines what part of the model is relevant for the current page
  //in our case, there's only one view-model that handles everything
  editor.controller = function() {
    editor.vm.init();
  };

  //here's the view
  editor.view = function() {
    if (editor.vm.state() === 'open') {
      return [
        m('div.kaavio-editor-tabs', {
          onchange: m.withAttr('value', editor.vm.updateTester),
          value: editor.vm.tester()
        }),
        editor.editorTabsComponent.view()
      ];
    } else {
      return;
    }
  };

  function cancel() {
    //clearSelection();
    close();
  }

  function save() {
    if (editor.editorTabsComponent.vm.dataChanged()) {
      var kaaviodatachangeEvent = new CustomEvent('kaaviodatachange', {
        detail: {
          pvjson: kaavio.sourceData.pvjson
        }
      });
      containerElement.dispatchEvent(kaaviodatachangeEvent);
    }
  }

  return editor;

};