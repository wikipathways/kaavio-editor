/******************************
  * identifier control
  *****************************/

var _ = require('lodash');
var editorUtils = require('../../../editor-utils');
var highland = require('highland');
// TODO figure out why m.redraw doesn't work with browserify
// and kaavio-editor
//var m = require('mithril');
var m = window.m;

//module for identifierControl
//for simplicity, we use this module to namespace the model classes
var identifierControl = {};

//the view-model,
identifierControl.vm = (function() {
  var vm = {};

  vm.disabled = m.prop(false);

  vm.init = function(ctrl) {
    vm.identifier = m.prop('');
  }
  return vm
}());

//the controller defines what part of the model is relevant for the current page
//in our case, there's only one view-model that handles everything
identifierControl.controller = function(ctrl) {
  identifierControl.vm.init(ctrl);
}

//here's the view
identifierControl.view = function(ctrl, args) {
  return m('input', {
    'class': 'pvjs-editor-identifier form-control input input-sm',
    placeholder: 'Identifier',
    onchange: m.withAttr('value', function(identifier) {
      args.identifier(identifier);
      args.onchange(identifier);
    }),
    value: args.identifier() || '',
    disabled: args.disabled()
  });
};

module.exports = identifierControl;