// Draw nodes. Includes data nodes, shapes, labels, cellular components...

pathvisiojs.view.pathwayDiagram.svg.useElement = function(){
  
  var pathwayHere, allSymbolNamesHere;

  function dragmove(d) {
    console.log(d3.event.x);
    console.log('d');
    console.log(d);
    console.log(d.id);
    console.log('this');
    console.log(this);
    // don't have anchors rendered yet
    /*
    var changingAnchors = pathwayHere.elements.filter(function(element) {return element.parentId === d.id});
    var d3Node = self.d3Node = d3.select(this);
    console.log('changingAnchors');
    console.log(changingAnchors);
    d3Node.attr('transform', function(d) {return 'translate(' + d3.event.x + ' ' + d3.event.y + ')';});
    changingAnchors.forEach(function(anchor){
      console.log('anchor');
      console.log(anchor);
      console.log(d3Node);
      self.d3Node = d3Node;
      self.anchor = anchor;
      anchor.x = d3Node.select('#' + anchor.id)[0][0].getCTM().e;
      anchor.y = d3Node.select('#' + anchor.id)[0][0].getCTM().f; 
    })
    //*/
    d.x = d3.event.x;
    d.y = d3.event.y;


    var args = {};
    args.svg = d3.select('svg');
    args.pathway = pathwayHere;
    args.allSymbolNames = allSymbolNamesHere;
    pathvisiojs.view.pathwayDiagram.svg.render(args, function(){console.log('rendered after drag');});
  }

  function render(useElement) {
    useElement.attr("id", function (d) {return 'shape-' + d['@id'];})
    .attr('transform', function(d) {
      var transform = 'scale(1)';
      if (d.hasOwnProperty('rotation')) {
        transform = 'rotate(' + d.rotation + ' ' + d.Width / 2 + ' ' + d.Height / 2 + ')';
      }
      return transform;
    })
    .attr("class", function (d) {
      var styleClass = 'shape ';
      if (d.elementType === 'data-node') {
        styleClass += d.dataNodeType + ' ';
      }
      if (d.strokeStyle === 'double') {
        styleClass += 'double-original ';
      }
      return styleClass;
    })
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", function (d) { return d.Width;})
    .attr("height", function (d) { return d.Height;})
    .attr("z-index", function (d) { return d.zIndex;})
    .attr("style", function (d) {
      var style = '';

      if (d.hasOwnProperty('fill')) {
        style += 'fill:' + d.fill + '; ';
      }

      if (d.hasOwnProperty('fillOpacity')) {
        style += 'fill-opacity:' + d.fillOpacity + '; ';
      }

      if (d.hasOwnProperty('stroke')) {
        style += 'stroke:' + d.stroke + '; ';
      }

      var strokeWidthEffective = null;
      if (d.hasOwnProperty('strokeWidth')) {

        // Doubling strokeWidth to create strokeWidthEffective.
        // Reason: stroke is centered on perimeter of node, requiring us to use an SVG clipping Path to clip off the outermost half
        // of the stroke so that the stroke does not go outside its bounding box. Because the outer half of the stroke is not displayed, we need to
        // double the stroke width so that the stroke's apparent width matches the value specified in GPML.

        strokeWidthEffective = 2 * d.strokeWidth;
      }
      else {
        strokeWidthEffective = 2;
      }

      style += 'stroke-width:' + strokeWidthEffective + '; ';

      if (d.hasOwnProperty('strokeStyle')) {
        if (d.strokeStyle === 'dashed') {
          style += 'stroke-dasharray: 5,3; ';
        }

        /*
        if (d.strokeStyle === 'double') {

          // render second element

          d3.select(nodesContainer[0][i]).append("use")
          .attr("id", function (d) {return 'node-double' + d.id;})
          .attr("class", function (d) {
            var styleClass = '';
            if (d.elementType === 'data-node') {
              styleClass = 'node ' + d.dataNodeType;
            }
            else {
              styleClass = 'node';
            }
            return styleClass;
          })
          .attr('transform', function(d) {
            var transform = 'scale(1)';
            if (d.hasOwnProperty('rotation')) {

              // the reference to width and height here is to specify the center of rotation as the center of the second element

              transform = 'rotate(' + d.rotation + ' ' + (d.width/2) + ' ' + (d.height/2) + ')';
            }
            return transform;
          })
          .attr("x", function(d) {return strokeWidthEffective;})
          .attr("y", function(d) {return strokeWidthEffective;})
          .attr("width", function (d) { return d.width - 2*strokeWidthEffective;})
          .attr("height", function (d) { return d.height - 2*strokeWidthEffective;})
          .attr("xlink:xlink:href", function (d) {return "#" + d.ShapeType;})
          //.attr("class", "stroke-color-equals-default-fill-color")
          .attr("style", function(d) { return style + 'fill-opacity:0; ';});
        }
        //*/
      }

      // be careful that all additions to 'style' go above the 'double-line second element' above
      // so that they are applied to both the first and second elements.

      return style;
    })
    .attr("xlink:xlink:href", function(d) {return '#' + d.ShapeType;});
  }

  function getPortCoordinates(boxDimensions, relX, relY) {
    var port = {};
    port.x = boxDimensions.x + (relX * boxDimensions.width);
    port.y = boxDimensions.y + (relY * boxDimensions.height);
    return port;
  }

  function highlightByLabel(svg, pathway, nodeLabel) {
    svg.selectAll('.highlighted-node').remove();
    var dataNodesWithText = pathway.elements.filter(function(d, i) {return d.nodeType === 'data-node' && (!!d.textLabel);});
    var selectedNodes = dataNodesWithText.filter(function(d, i) {return d.textLabel.text.indexOf(nodeLabel) !== -1;});
    selectedNodes.forEach(function(node) {
      var nodeDomElement = svg.select('#node-' + node.id);
      var height = nodeDomElement[0][0].getBBox().height;
      var width = nodeDomElement[0][0].getBBox().width;
      nodeDomElement.append('rect')
      .attr('class', 'highlighted-node')
      .attr('x', -2.5)
      .attr('y', -2.5)
      .attr('width', width + 5)
      .attr('height', height + 5);
    });
  }

  return {
    render:render,
    getPortCoordinates:getPortCoordinates,
    highlightByLabel:highlightByLabel
  };
}();
