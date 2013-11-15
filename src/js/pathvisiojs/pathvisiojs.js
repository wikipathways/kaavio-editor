pathvisiojs = function(){

  var svg, pathway, args;

  function getUriFromWikiPathwaysId(wikiPathwaysId, revision) {

    // be sure server has set gpml mime type to application/xml or application/gpml+xml

    return 'http://pointer.ucsf.edu/d3/r/data-sources/gpml.php?id=' + wikiPathwaysId + '&rev=' + revision;
  }

  function getInputDataDetails(inputData) {

    // inputData can be a WikiPathways ID (WP1), a uri for a GPML file (http://www.wikipathways.org/gpmlfile.gpml)
    // or a uri for another type of file.

    var results = {};
    if (!inputData.revision) {
      inputData.revision = 0;
    }

    if (pathvisiojs.utilities.getObjectType(inputData) === 'Object') {
      results = inputData;
      if (pathvisiojs.utilities.isWikiPathwaysId(inputData.wikiPathwaysId)) {
        results.uri = getUriFromWikiPathwaysId(inputData.wikiPathwaysId, inputData.revision);
        results.type = 'GPML';
      }
    }
    else {
      if (pathvisiojs.utilities.isUrl(inputData)) {
        results.uri = inputData;
        if (results.uri.indexOf('.gpml') > -1) {
          results.type = 'GPML';
        }
      }
      else {
        if (pathvisiojs.utilities.isWikiPathwaysId(inputData)) {
          results.uri = getUriFromWikiPathwaysId(inputData);
          results.type = 'GPML';
        }
        else {
          return new Error('Pathvisio.js cannot handle the data source type entered: ' + data);
        }
      }
    }

    return results;
  }


  function load(args) {

    // this function gets JSON and draws SVG representation of pathway

    // ********************************************
    // Check for minimum required set of parameters
    // ********************************************

    if (!args.target) { return console.warn('Error: No target selector specified as target for pathvisiojs.'); }
    if (!args.data) { return console.warn('Error: No input data source (URL or WikiPathways ID) specified.'); }

    async.parallel({
      preload: function(callback) {
        pathvisiojs.view.pathwayDiagram.preload(args, function(loadArgs) {
          callback(null, loadArgs);
        })
      },
      pathway: function(callback){
        getJson(args.data, function(json) {
          console.log('json');
          console.log(json);
          callback(null, json);
        })
      }
    },
    function(err, results){
      self.results = results;
      var viewLoadArgs = results.preload;
      viewLoadArgs.pathway = results.pathway;

      pathvisiojs.view.pathwayDiagram.load(viewLoadArgs, function() {
        // do something here
      })


///*

      ///* Node Highlighter

      var nodeLabels = [];
      var dataNodes = results.pathway.elements.filter(function(element) {return element.nodeType === 'data-node';});
      dataNodes.forEach(function(node) {
        if (!!node.textLabel) {
          nodeLabels.push(node.textLabel.text);
        }
      });


      // see http://twitter.github.io/typeahead.js/

      $('#highlight-by-label-input').typeahead({
        name: 'Highlight node in pathway',
        local: nodeLabels,
        limit: 10
      });
//*/

      /*
      $('.icon-eye-open').click(function(){
        var nodeLabel = $("#highlight-by-label-input").val();
        if (!nodeLabel) {
          console.warn('Error: No data node value entered.');
        }
        else {
          pathvisiojs.view.pathwayDiagram.svg.node.highlightByLabel(svg, nodeLabel);
        }
      });
//*/
      // see http://api.jquery.com/bind/
      // TODO get selected value better and make function to handle

      $( "#highlight-by-label-input" ).bind( "typeahead:selected", function() {
        var nodeLabel = $("#highlight-by-label-input").val();
        if (!nodeLabel) {
          console.warn('Error: No data node value entered.');
        }
        else {

          // TODO refactor this so it calls a generic highlightDataNodeByLabel function that can call
          // a highlighter for svg, png, etc. as appropriate.

          pathvisiojs.view.pathwayDiagram.svg.node.highlightByLabel(results.preload.svg, results.pathway, nodeLabel);
        }
      });

    });
  }

  return {
    load:load,
    getJson:getJson
  };
}();