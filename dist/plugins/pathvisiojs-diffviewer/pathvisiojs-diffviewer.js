(function(window, $){

  var optionsDefault = {
        sourceData: []
      }
    , instancesMap = {}

  /**
   * Init plugin
   *
   * @param {pathvisiojs instance} pvjs
   * @param {objects} options
   */
  function init(pvjs, options) {
    // Create new instance if it does not exist
    if (!instancesMap.hasOwnProperty(pvjs.instanceId)) {
      instancesMap[pvjs.instanceId] = new PathvisiojsDiffViewer(pvjs, options)
    }
  }

  /**
   * Costructor
   *
   * @param {Object} pvjs
   */
  var PathvisiojsDiffViewer = function(pvjs, options) {
    this.options = $.extend({}, optionsDefault, options)

    this.pvjs = pvjs
    this.$pvjsElement = $(this.pvjs.$element[0][0])

    this.initContainer()
    this.initSecondPvjs()
    this.hookEvents()
    this.pvjs2.render()
  }

  PathvisiojsDiffViewer.prototype.initContainer = function() {
    this.$diffviewer = $('<div class="pathvisiojs-diffviewer"/>')

    // Create panes
    this.$paneLeft = $('<div class="pane-inner"></div>').appendTo($('<div class="pane pane-left"></div>').appendTo(this.$diffviewer))
    this.$paneRight = $('<div class="pane-inner"></div>').appendTo($('<div class="pane pane-right"></div>').appendTo(this.$diffviewer))
    this.$paneCenter = $('<div class="pane pane-center"></div>').appendTo(this.$diffviewer)

    // Insert diffviewer container before pvjs element
    this.$diffviewer.insertBefore(this.$pvjsElement)

    // Move instance element into left pane
    this.$paneLeft.append(this.$pvjsElement)
  }

  PathvisiojsDiffViewer.prototype.initSecondPvjs = function() {
    // Create second instance container
    this.$pvjsElement2 = $('<div/>').appendTo(this.$paneRight)

    // Get original options
    var pvjsOptions = this.pvjs.getOptions()
    // Set new source data
    pvjsOptions.sourceData = this.options.sourceData
    pvjsOptions.manualRender = true

    // Create second pvjs instance
    this.pvjs2 = window.pathvisiojs(this.$pvjsElement2[0], pvjsOptions)[0]
  }

  PathvisiojsDiffViewer.prototype.hookEvents = function() {
    var that = this
      , pvjsRendered = false
      , pvjs2Rendered = false
      , noDiff = false

    // pvjs renderer barrier
    this.pvjs.on('rendered', function(){
      pvjsRendered = true
      if (pvjs2Rendered && !noDiff) {
        that.onPvjsesRendered()
      }
    })
    this.pvjs2.on('rendered', function(){
      pvjs2Rendered = true
      if (pvjsRendered && !noDiff) {
        that.onPvjsesRendered()
      }
    })

    this.pvjs.on('error.sourceData', function(){
      if (!noDiff) {
        that.onNoDiff('One or both pathways were not rendered. Most probably one pathways uses old format that is not supported by PathvisioJS.')
      }

      noDiff = true
    })
    this.pvjs2.on('error.sourceData', function(){
      if (!noDiff) {
        that.onNoDiff('One or both pathways were not rendered. Most probably one pathways uses old format that is not supported by PathvisioJS.')
      }

      noDiff = true
    })

    // On destroy pvjs
    this.pvjs.on('destroy.pvjs', function(){
      that.pvjs2.destroy()
      // Put back pvjs element container
      that.$pvjsElement.insertBefore(that.$diffviewer)
      that.$diffviewer.remove()
    })

    // Pan and zoom events
    var pvjsPanned = false
      , pvjsZoomed = false
      , pvjs2Panned = false
      , pvjs2Zoomed = false

    this.pvjs.on('zoomed.renderer', function(level){
      if (pvjs2Zoomed) { // prevent recursive call
        pvjs2Zoomed = false
        return
      }
      pvjsZoomed = true

      that.pvjs2.zoom(level / that.zoomScale)
      that.pvjs.panBy({x: 0, y: 0}) // trigger pan to sync pathways
      that.pvjs2.pan(that.pvjs.getPan())
    })

    this.pvjs.on('panned.renderer', function(point){
      if (pvjs2Panned) {
        pvjs2Panned = false
        return
      }
      pvjsPanned = true
      that.pvjs2.pan(point)
    })

    this.pvjs2.on('zoomed.renderer', function(level){
      if (pvjsZoomed) {
        pvjsZoomed = false
        return
      }
      pvjs2Zoomed = true

      that.pvjs.zoom(level * that.zoomScale)
      that.pvjs2.panBy({x: 0, y: 0}) // trigger pan to sync pathways
      that.pvjs.pan(that.pvjs2.getPan())
    })

    this.pvjs2.on('panned.renderer', function(point){
      if (pvjsPanned) {
        pvjsPanned = false
        return
      }
      pvjs2Panned = true
      that.pvjs.pan(point)
    })
  }

  /**
   * Create an overlay with a message
   * @param  {String} message Message why diff viewer shows nothing
   */
  PathvisiojsDiffViewer.prototype.onNoDiff = function(message) {
    // Create an overlay
    if (this.$overlay === void 0) {
      this.$overlay = $('<div class="overlay"></div>').appendTo(this.$diffviewer)
    }

    // Add a message
    this.$overlay.append($('<div class="alert alert-info"></div>').text(message))
  }

  PathvisiojsDiffViewer.prototype.onPvjsesRendered = function() {
    if (this.checkPvjsesData()) {
      this.getZoomScale()
      this.displayDiff()
    } else {
      this.onNoDiff('One or both pathways were rendered using a format (ex. png) that has no details about nodes.')
    }
  }

  PathvisiojsDiffViewer.prototype.checkPvjsesData = function() {
    return (this.pvjs.getSourceData().pvjson && this.pvjs2.getSourceData().pvjson)
  }

  PathvisiojsDiffViewer.prototype.zoomScale = 1

  PathvisiojsDiffViewer.prototype.getZoomScale = function() {
    this.zoomScale = this.pvjs.getZoom() / this.pvjs2.getZoom()
  }

  PathvisiojsDiffViewer.prototype.displayDiff = function() {
    this.elements = this.pvjs.getSourceData().pvjson.elements
    this.elements2 = this.pvjs2.getSourceData().pvjson.elements
    this.elementsMerge = this.mergeElements(this.elements2, this.elements) // New elements have priority

    var diff = this.computeDiff()

    // IF no diffs then display an overlay message and stop further rendering
    if (diff.added.length + diff.updated.length + diff.removed.length === 0) {
      this.onNoDiff('Pathways have no visual differences between them.')
      return
    }

    var $changesList = this.initDiffView()

    // Store elements grouped by change type and group name
    this.elementsCache = {added: {}, updated: {}, removed: {}}
    this.elementsReferences = {}

    this.renderDiffsOfType('added', diff.added, $changesList, this.elements2)
    this.renderDiffsOfType('updated', diff.updated, $changesList, this.elementsMerge)
    this.renderDiffsOfType('removed', diff.removed, $changesList, this.elements)

    this.hookDiffNavigation()

    // Highlight all changes
    this.highlight('added')
    this.highlight('updated')
    this.highlight('removed')
  }

  /**
   * Merge lists by appending unique elements from second list to first list
   * @param  {Array} elements
   * @param  {Array} elements2
   * @return {Array}
   */
  PathvisiojsDiffViewer.prototype.mergeElements = function(elements, elements2) {
    var elementsMerge = elements.slice()
      , elementFound = false

    for (e in elements2) {
      elementFound = false
      for (e2 in elementsMerge) {
        if (elementsMerge[e2].id === elements2[e].id) {
          elementFound = true
          break
        }
      }

      // If element is unique then add it to merge
      if (!elementFound) {
        elementsMerge.push(elements2[e])
      }
    }

    return elementsMerge
  }

  PathvisiojsDiffViewer.prototype.computeDiff = function() {
    // Clone lists to be safe from modifying them internally (in case that pvjson was not deep-cloned)
    var elements = this.elements.slice()    // Old pathway elements
      , elements2 = this.elements2.slice()  // New pathway elements
      , diff = {
          updated: []
        , added: []
        , removed: []
        }
      , element
      , found

    for (var i = elements.length - 1; i >= 0; i--) {
      element = elements[i]
      found = false

      // Search for element by ID in second list
      for (var j = elements2.length - 1; j >= 0; j--) {
        if (elements[i].id === elements2[j].id) {
          found = true

          // Check for changes
          if (calculateElementDiff(elements[i], elements2[j])) {
            diff.updated.push({
              id: elements2[j].id
            , 'gpml:element': elements2[j]['gpml:element'] || elements[i]['gpml:element'] || undefined
            , type: elements2[j].type || elements[i].type || undefined
            , shape: elements2[j].shape || elements[i].shape || undefined
            , textContent: elements2[j].textContent || elements[i].textContent || elements2[j].title || elements2[j].displayName || elements[i].title || elements[i].displayName || undefined
            , points: elements2[j].points || elements[i].points || undefined
            , diff: calculateElementDiff(elements[i], elements2[j])
            , _element: elements[i]
            , _element2: elements2[j]
            })
          }

          // Remove found elements from search poll
          elements.splice(i, 1)
          elements2.splice(j, 1)

          break
        }
      }

      if (!found) {
        diff.removed.push(elements[i])
      }
    }

    // All not matched elements from second list are new
    diff.added = elements2.slice()

    return diff
  }

  function calculateElementDiff(element, element2) {
    var diff = {
          added: []
        , removed: []
        , updated: []
        }

    for (e in element) {
      if (!element2.hasOwnProperty(e)) {
        diff.removed.push({key: e, value: element[e]})
      } else {
        if (element[e] !== element2[e] && isStringOrNumber(element[e]) && isStringOrNumber(element2[e])) {
          diff.updated.push({key: e, value: element2[e], old: element[e]})
        }
        // else nothing
      }
    }

    // Check for elements in element2 that are not in element
    for (e in element2) {
      if (!element.hasOwnProperty(e)) {
        diff.added.push({key: e, value: element2[e]})
      }
    }

    if (diff.added.length || diff.removed.length || diff.updated.length) {
      return diff
    } else {
      return null
    }
  }

  function isStringOrNumber(obj) {
    return (Object.prototype.toString.apply(1) === Object.prototype.toString.apply(obj)
         || Object.prototype.toString.apply('') === Object.prototype.toString.apply(obj))
  }

  /**
   * Creates containers for titles and changes list
   *
   * @return {object} jQuery object
   */
  PathvisiojsDiffViewer.prototype.initDiffView = function() {
    return $('<div class="changes changes-list"></div>').appendTo(this.$paneCenter)
  }

  PathvisiojsDiffViewer.prototype.initDiffViewList = function($changesList, type, title) {
    var $changesContainer = $('<div class="changes-container" data-level="1" data-type="' + type + '">')
      .appendTo($changesList)
      .append($('<div class="changes-title changes-parent change-' + type + '"><span>' + title + '</span></div>'))

    // Return jQuery element of changes list
    return $('<div class="changes-list"></div>').appendTo($changesContainer)
  }

  PathvisiojsDiffViewer.prototype.renderDiffsOfType = function(type, elementsDiff, $changesList, elements) {
    if (elementsDiff.length === 0) {return}

    // Sort by gpml:element and shape
    elementsDiffSorted = elementsDiff.sort(sorterByElmentAndShape)

    // Group elements
    var groups = {}
      , groupName = ''
      , elementType = ''
      , _type = ''
      , $listContainer = null
      , groupsOrdered = []

    for (d in elementsDiffSorted) {
      elementType = elementsDiffSorted[d]['gpml:element'] ? elementsDiffSorted[d]['gpml:element'].replace(/^gpml\:/, '') : '';
      _type = elementsDiffSorted[d]['type'] ? elementsDiffSorted[d]['type'] : ''

      if (elementType === 'Interaction') {
        groupName = 'Interactions'
      } else if (elementType === 'DataNode') {
        groupName = 'Data Nodes'
      } else if (elementType === '' && _type !== '') { // Assuming it is a reference
        // groupName = 'Reference'
        continue
      } else if (elementType === 'Group') {
        groupName = 'Groups'
      } else {
        // Assume that there are no other groups
        groupName = 'Graphical Objects'
      }

      // If this is first element in group then init it
      if (groups[groupName] === void 0) {
        groups[groupName] = []
      }

      groups[groupName].push(elementsDiffSorted[d])
    }

    // Render only if at least one group exists
    if (!$.isEmptyObject(groups)) {
      $listContainer = this.initDiffViewList($changesList, type, type.charAt(0).toUpperCase() + type.slice(1))

      // Create an array of ordered groups
      groupsOrdered = orderGroups(groups)

      for (var i in groupsOrdered) {
        this.renderDiffGroup(type, groupsOrdered[i].name, groupsOrdered[i].group, $listContainer, elements)
      }
    }
  }

  var groupsOrder = ['Data Nodes', 'Groups', 'Interactions', 'Graphical Objects']

  function orderGroups(groups) {
    var groupName = ''
      , groupsOrdered = []

    // First add ordered groups
    for (var i in groupsOrder) {
      groupName = groupsOrder[i]

      if (groups.hasOwnProperty(groupName)) {
        groupsOrdered.push({group: groups[groupName], name: groupName})
        delete groups[groupName]
      }
    }

    // If there are still groups, add them to the end in any order
    for(groupName in groups) {
      groupsOrdered.push({group: groups[groupName], name: groupName})
    }

    return groupsOrdered
  }

  PathvisiojsDiffViewer.prototype.renderDiffGroup = function(type, groupName, groupElements, $listContainer, elements) {
    var $container = $('<div class="changes-container" data-level="2" data-type="' + type + '"/>').appendTo($listContainer)
      , $containerTitle = $('<div class="changes-title changes-parent change-' + type + '"><span>' + groupName + '</span></div>')
          .appendTo($container)
          .data('group', groupName)
      , $containerList = $('<div class="changes-list" />').appendTo($container)
      , elementTitle = ''
      , $elementContainer
      , $elementTitle
      , elementChanges = null
      , $elementChanges

    // Sort group elements
    groupElements = groupElements.sort(function(a, b){
      return getElementTitle(a, elements).toLowerCase() > getElementTitle(b, elements).toLowerCase() ? 1 : -1
    })

    // Render elements
    for (e in groupElements) {
      elementTitle = getElementTitle(groupElements[e], elements)

      $elementContainer = $('<div class="changes-container" data-level="3" data-type="' + type + '"/>').appendTo($containerList)
      $elementTitle = $('<div class="changes-title change-' + type + '"><span>' + elementTitle + '</span></div>').appendTo($elementContainer)

      elementChanges = this.getElementChanges(type, groupElements[e], elements)

      // Render element changes (if any)
      if (elementChanges && elementChanges.length) {
        $elementChanges = $('<ul class="element-changes"></ul>')
        for (change in elementChanges) {
          $elementChanges.append('<li>' + elementChanges[change] + '</li>')
        }

        $elementChanges.appendTo($elementTitle)
      }

      // Store id and group
      $elementTitle
        .data('id', groupElements[e].id)
        .data('group', groupName)

      // TODO only for debug purpose
      $elementTitle[0].pvjson = groupElements[e]

      // Cache element
      this.cacheElement(type, groupName, groupElements[e].id)
    }
  }

  PathvisiojsDiffViewer.prototype.cacheElement = function(type, group, element_id) {
    // Create group if it does not exist
    if (this.elementsCache[type][group] === void 0) {
      this.elementsCache[type][group] = []
    }

    // Add element to group
    this.elementsCache[type][group].push(element_id)

    // Reference
    if (group === 'Reference') {
      this.elementsReferences[element_id] = true
    }
  }

  PathvisiojsDiffViewer.prototype.getAllElements = function(type, group) {
    if (type === null || type === void 0) {
      // Get all types
      return [].concat(this.getAllElements('added'), this.getAllElements('updated'), this.getAllElements('removed'))
    } else {
      if (group === null || group === void 0) {
        // Get all groups
        var elements = []

        for (var groupName in this.elementsCache[type]) {
          elements = elements.concat(this.getAllElements(type, groupName))
        }

        return elements
      } else {
        // Get that group
        return this.elementsCache[type][group].slice()
      }
    }
  }

  PathvisiojsDiffViewer.prototype.isIdReference = function(id) {
    return this.elementsReferences[id] === true
  }

  function sorterByElmentAndShape(a, b) {
    if (a['gpml:element'] === b['gpml:element']) {
      return a.shape > b.shape ? 1 : -1
    }
    if (a['gpml:element'] === undefined) return -1
    if (b['gpml:element'] === undefined) return 1
    return a['gpml:element'] > b['gpml:element'] ? 1 : -1
  }

  function getElementTitle(obj, elements) {
    if (obj['gpml:element'] === 'gpml:Interaction') {
      return '' + lookupTitleById(obj.points[0].isAttachedTo, elements) + ' <i class="icon icon-arrow-right"></i> ' + lookupTitleById(obj.points[1].isAttachedTo, elements)
    } else if (obj['gpml:element'] === 'gpml:DataNode') {
      return obj.textContent
    } else if (obj['gpml:element'] === 'gpml:Label') {
      return obj.textContent
    } else if (obj['gpml:element'] === 'gpml:Shape') {
      return obj.shape.slice(0, 1).toUpperCase() + obj.shape.slice(1)
    } else if (obj['gpml:element'] === 'gpml:GraphicalLine') {
      return 'Graphical line'
    } else if (obj['gpml:element'] === 'gpml:State') {
      return 'State ' + obj.textContent + ' (' + lookupTitleById(obj.isAttachedTo, elements) + ')'
    } else if (obj['gpml:element'] === 'gpml:Group') {
      return 'Group'
    } else if (obj['type'] !== void 0) { // Assume it is a reference
      return obj['textContent'] || obj['title'] || obj['displayName'] || 'no title'
    }

    return 'no title'
  }

  function lookupTitleById(id, elements) {
    // If element has no id then stop lookup
    if (id === void 0) {
      return 'Unknown'
    }

    for (var l in elements) {
      if (elements[l].id != null && id === elements[l].id) {
        // Check if it is an interaction to avoid circular recursion
        if (elements[l]['gpml:element'] === 'gpml:Interaction') {
          return 'Interaction'
        } else {
          return getElementTitle(elements[l], elements)
        }
      }
    }

    // If no match found then return initial ID
    return id;
  }

  var normalizationFloatKeys = ['width', 'height', 'x', 'y', 'rotation']
    , normalizationIdKeys = ['isPartOf', 'controller', 'controlled']

  function normalizeValue(value, key, elements) {
    if (normalizationFloatKeys.indexOf(key) !== -1) {
      return Math.round(parseFloat(value)*100)/100
    } else if (normalizationIdKeys.indexOf(key) !== -1) {
      return lookupTitleById(value, elements)
    } else {
      return value
    }
  }

  PathvisiojsDiffViewer.prototype.getElementChanges = function(type, element, elements) {
    var titles = []

    if (type === 'added') {
      if (element.hasOwnProperty('entityReference')) {
        titles.push('Added <strong>reference</strong>: ' + element.entityReference)
      }
    } else if (type === 'updated') {
      var oldValue = ''
        , newValue = ''
        , diff = element.diff

      for (u in diff.added) {
        newValue = normalizeValue(diff.added[u].value, diff.added[u].key, elements)
        titles.push('Added: <strong>' + diff.added[u].key + '</strong> ' + newValue)
      }

      for (u in diff.removed) {
        newValue = normalizeValue(diff.removed[u].value, diff.removed[u].key, elements)
        titles.push('Removed: <strong>' + diff.removed[u].key + '</strong> ' + newValue)
      }

      for (u in diff.updated) {
        oldValue = normalizeValue(diff.updated[u].old, diff.updated[u].key, elements)
        newValue = normalizeValue(diff.updated[u].value, diff.updated[u].key, elements)

        titles.push('<strong>' + diff.updated[u].key + ':</strong> ' + oldValue + ' <i class="icon icon-arrow-right"></i> ' + newValue)
      }
    }

    return titles
  }

  PathvisiojsDiffViewer.prototype.hookDiffNavigation = function() {
    var $paneCenter = this.$paneCenter
      , that = this
      , isFocused = false

    this.initHighlighting()

    $paneCenter.on('click', '.changes-title', function(ev){
      ev.preventDefault()
      ev.stopPropagation()

      isFocused = true

      // Visually opening/closing titles
      var $this = $(this)
        , $active = $this

      // Only if element is not active
      if (!$this.parent().hasClass('active')) {
        $paneCenter.find('.active').removeClass('active')
        $paneCenter.find('.open').removeClass('open')
        $paneCenter.find('.focus').removeClass('focus')
        $this.parent().addClass('active focus')
        $this.parentsUntil($paneCenter).addClass('open')

        // Attenuate all previous elements
        that.attenuate()
        // Highlight selected
        that.highlightTitle($active)
      }
    })

    var keysMap = {
      37: 'left'
    , 38: 'up'
    , 39: 'right'
    , 40: 'down'
    }

    $(document)
      .click(function(ev){
        isFocused = false
        $paneCenter.find('.focus').removeClass('focus')
      })
      .keydown(function(ev){
        if (!isFocused) return;
        if (ev.keyCode < 37 || ev.keyCode > 40) return;

        ev.preventDefault()
        ev.stopPropagation()

        that.navigate(keysMap[ev.keyCode])

        return false
      })
  }

  PathvisiojsDiffViewer.prototype.highlightTitle = function($active) {
    if ($active.length) {
      var level = +$active.parent().data('level')
        , type = $active.parent().data('type')

      if (level === 1) {
        this.highlight(type, null, null)
      } else if (level === 2) {
        this.highlight(type, $active.data('group'), null)
      } else if (level === 3) {
        this.highlight(type, $active.data('group'), $active.data('id'))
      }
    }
  }

  PathvisiojsDiffViewer.prototype.navigate = function(direction) {
    var $paneCenter = this.$paneCenter
      , $focused = $paneCenter.find('.focus').first()
      , $next = null
      , $nextTitle = null

    if (direction === 'up' || direction === 'left') {
      // Previous sibling
      $next = $focused.prev()

      // If no previous sibling than next is parent
      if ($next.length == 0) {
        $next = $focused.parent().closest('.changes-container')
      }
    } else if (direction === 'down' || direction === 'right') {
      // First child
      $next = $focused.children('.changes-list').children('.changes-container').first()

      // Next parent sibling if no childs
      if ($next.length == 0) {
        $next = $focused.next()

        if ($next.length == 0) {
          $next = $focused.parent().closest('.changes-container').next()
          if ($next.length == 0) {
            $next = $focused.parent().closest('.changes-container').parent().closest('.changes-container').next()
          }
        }
      }
    }

    if ($next && $next.length && $next.get(0) !== $focused.get(0)) {
      $paneCenter.find('.active').removeClass('active')
      $paneCenter.find('.open').removeClass('open')
      $paneCenter.find('.focus').removeClass('focus')
      $next.addClass('active focus open')
      $next.parentsUntil($paneCenter).addClass('open')

      $nextTitle = $next.children('.changes-title')

      // Scroll diffviewer to contain focused title
      if ($nextTitle.offset().top < 0) {
        $paneCenter.scrollTop($paneCenter.scrollTop() + $nextTitle.offset().top)
      } else if ($nextTitle.offset().top + $nextTitle.outerHeight() > $paneCenter.height()) {
        $paneCenter.scrollTop($paneCenter.scrollTop() + ($nextTitle.offset().top + $nextTitle.outerHeight() - $paneCenter.height()))
      }

      // Attenuate all previous elements
      this.attenuate()
      // Highlight selected
      this.highlightTitle($next.children('.changes-title'))
    }
  }

  PathvisiojsDiffViewer.prototype.initHighlighting = function() {
    this.hi = window.pathvisiojsHighlighter(this.pvjs, {displayInputField: false})
    this.hi2 = window.pathvisiojsHighlighter(this.pvjs2, {displayInputField: false})
  }

  PathvisiojsDiffViewer.prototype.highlight = function(type, group, id) {
    var ids = []
      , highlightString = ''

    // If we have type, group and id - get only that id
    if (type && group && id) {
      ids = [id]
    } else {
      ids = this.getAllElements(type, group)
    }

    // Find change type
    var colors = {}

    if (type === 'added') {
      colors.backgroundColor = colors.borderColor = '#0E53A7'
    } else if (type === 'updated') {
      colors.backgroundColor = colors.borderColor = '#FFF700'
    } else if (type === 'removed') {
      colors.backgroundColor = colors.borderColor = '#F10026'
    }

    for (var i in ids) {
      // If is a reference
      if (this.isIdReference(ids[i])) {
        highlightString = 'xref:id:' + ids[i]
      } else {
        highlightString = '#' + ids[i]
      }

      if (type === 'removed' || type === 'updated') {
        this.hi.highlight(highlightString, null, colors)
      }
      if (type === 'updated' || type === 'added') {
        this.hi2.highlight(highlightString, null, colors)
      }
    }
  }

  PathvisiojsDiffViewer.prototype.attenuate = function() {
    this.hi.attenuate(null)
    this.hi2.attenuate(null)
  }

  /**
   * Expose plugin globally as pathvisiojsDiffviewer
   */
  window.pathvisiojsDiffviewer = init
})(window, window.jQuery || window.Zepto)
