// constants

var HOUR_OF_A_WEEK_PROPORTION = 1 / (7 * 24);
var DAY_OF_A_WEEK_PROPORTION = 1 / (7);
var EPSILON_PROPORTION = 1 / (7 * 24 * 60);
var MILLISECONDS_INA_SECOND = 1000;
var MILLISECONDS_INA_MINUTE = 60 * MILLISECONDS_INA_SECOND;
var MILLISECONDS_INA_HOUR = 60 * MILLISECONDS_INA_MINUTE;
var MILLISECONDS_INA_DAY = 24 * MILLISECONDS_INA_HOUR;
var MILLISECONDS_INA_WEEK = 7 * MILLISECONDS_INA_DAY;

var ANIMATE_INITIAL_LOAD = false;
var USE_TEST_DATA = false;
var CHECK_FOR_UPDATE = false;
var CHECK_FOR_UPDATE_MILLISECONDS = 10 * MILLISECONDS_INA_SECOND;

var HOUR_DATA_SETS = ["eqs1hour-M0"];
var DAY_DATA_SETS = ["eqs1day-M0"];
var WEEK_DATA_SETS = ["eqs7day-M1", "eqs1day-M0"];
var TEST_DATA_SETS = ["data1", "data2"];
var DATE_FORMAT = d3.time.format("%d %b %Y");
var TIME_FORMAT = d3.time.format("%H:%M:%S");
var ZONE_FORMAT = d3.time.format("%Z");
var QUAKE_DATE_FORMAT = d3.time.format.utc("%A, %B %e, %Y %H:%M:%S UTC");
var ANIMATION_FRAMES = 2 * 7;
var ANIMATION_DURATION = 10 * 1000;
var ANIMATION_DELAY = ANIMATION_DURATION / ANIMATION_FRAMES;
var MAX_MAGNITUDE = 9;
var SUMMARY_WIDTH = 240;
var SUMMARY_HEIGHT = 180;
var WEDGE_WIDTH = 30;
var DEFAULT_OPACITY = 0.55;
var QUAKE_BASE = "http://earthquake.usgs.gov/earthquakes/recenteqsus/Quakes/";
var QUAKE_TAIL = ".php";
var MARKER_STROKE_WIDTH = 8;
var MARKER_OFFSET = 40;
var MAX_OPACITY = 0.8;
var MIN_OPACITY = 0.1;
var KEY_WIDTH = 250;
var KEY_HEIGHT = 350;
var KEY_PADDING = 10;
var CHART_QUAKE_ROLLIN_MILLISECONDS = 2000;
var FADE_IN_DURATION = function (d) {return d.Magnitude * 500;};
var FADE_OUT_DURATION = function (d) {return d.Magnitude * 100;};

// globals

var overlay = null;
var quakeData = null;
var quakeTesseract = null;
var quakesByMag = null;
var quakesByDate = null;
var projection = null;
var dateWindowMax = null;
var dateWindowMin = null;
var observedMinMag = null;
var observedMaxMax = null;
var observedMinDate = null;
var observedMaxDate = null;
var timeScale = null;
var dateLimitScale = null;
var magLimitScale = null;
var dateWindowExtent = MILLISECONDS_INA_WEEK;
var dataSets = WEEK_DATA_SETS;
var updateQuakeChart = null;
var timeScaleChanged = true;

// google map style

var mapStyle = 
[ 
  { featureType: "poi.park", elementType: "geometry", stylers: [ { gamma: 1 }, { lightness: 50 }, { saturation: -45 } ] },
  { featureType: "water", elementType: "geometry", stylers: [ { saturation: -25 }, { lightness: 50 } ] },
  { featureType: "road", stylers: [ { visibility: "on" }, { saturation: -70 }, { lightness: 40 } ] },
  { featureType: "administrative", stylers: [ { saturation: -100 }, { lightness: 20 } ] },
  { elementType: "labels", stylers: [ { lightness: 52 }, { saturation: -80 } ] } 
];

// google map

var map = new google.maps.Map(d3.select("#map").node(),
{
  zoom: 2,
  center: new google.maps.LatLng(20.8255, -156.9199),
  mapTypeId: google.maps.MapTypeId.ROADMAP,
  styles: mapStyle,
});

// usgs colors

var usgsMarkerColorScale = new chroma.ColorScale(
  {
    colors: ['red','#f00','#00f','#00f','#ff0', '#ff0'],
    positions: [0,HOUR_OF_A_WEEK_PROPORTION-EPSILON_PROPORTION,HOUR_OF_A_WEEK_PROPORTION,DAY_OF_A_WEEK_PROPORTION,DAY_OF_A_WEEK_PROPORTION+EPSILON_PROPORTION, 1],
    mode: 'rgb'
  });

// marker edge color scale (based on age)

var usgsMarkerEdgeColorScale = new chroma.ColorScale(
  {
    colors: ['#a00','#a00','#00a','#00a','#aa0', '#aa0'],
    positions: [0,HOUR_OF_A_WEEK_PROPORTION-EPSILON_PROPORTION,HOUR_OF_A_WEEK_PROPORTION,DAY_OF_A_WEEK_PROPORTION,DAY_OF_A_WEEK_PROPORTION+EPSILON_PROPORTION, 1],
    mode: 'rgb'
  });

var treborMarkerColorScale = new chroma.ColorScale({
  colors: ['#ff0', '#f00','#888'],
  positions: [0,HOUR_OF_A_WEEK_PROPORTION,1],
  mode: 'rgb'
});

// marker edge color scale (based on age)

var treborMarkerEdgeColorScale = new chroma.ColorScale({
  colors: ['#aa0','#a00', '#666'],
  positions: [0,HOUR_OF_A_WEEK_PROPORTION,1],
  mode: 'rgb'
});

var jbMarkerColorScale = new chroma.ColorScale({
  colors: ['#00f', '#aaa'],
//  positions: [0,HOUR_OF_A_WEEK_PROPORTION,1],
  mode: 'rgb'
});

// marker edge color scale (based on age)

var jbMarkerEdgeColorScale = new chroma.ColorScale({
  colors: ['#00f', '#aaa'],
//  positions: [0,HOUR_OF_A_WEEK_PROPORTION,1],
  mode: 'rgb'
});

// marker color scale (based on age)

//var markerColorScale = usgsMarkerColorScale;
//var markerColorScale = treborMarkerColorScale;
var markerColorScale = jbMarkerColorScale;

// marker edge color scale (based on age)

//var markerEdgeColorScale = usgsMarkerEdgeColorScale;
var markerEdgeColorScale = jbMarkerEdgeColorScale;

// initialize the system, this is the main entry point for bulk of the code

initialize();

// initialize the sytems

function initialize()
{
  loadDataSets();

  // reload chainging function which calls itself to keep hope alive

  var reloadChainFunction = function()
  {
    setTimeout(reloadChainFunction, CHECK_FOR_UPDATE_MILLISECONDS);

    // structure this way so that the value can be changed

    if (CHECK_FOR_UPDATE)
      loadDataSets();
  }

  // fire off the chain function

  reloadChainFunction();
}

// load all data sets combine them and present them on the display
// the helper function must be recursive because the data is loaded asynchronously

function loadDataSets()
{
  loadDataHelper((USE_TEST_DATA ? TEST_DATA_SETS : dataSets).slice(), []);
}

// recursivly load and combinde data, when all data is loaded, display that data

function loadDataHelper(dataSets, dataAccumulation)
{
  // if there are no more data sets to load, register the data for display

  if (dataSets.length == 0)
  {
    registerQuakeData(dataAccumulation);
    return;
  }

  // load data set
  var dataSetName = dataSets.pop();
  d3.csv("/quake?test=" + USE_TEST_DATA + "&name=" + dataSetName + ".txt", 
         function(data)
         {
           loadDataHelper(dataSets, dataAccumulation.concat(data));
         });
}

function registerQuakeData(data)
{
  // remove duplicate quakes

  var quakeIds = {};
  data = data.filter(
    function (d)
    {
      var found = quakeIds[d.Eqid];
      if (found)
        return false;

      quakeIds[d.Eqid] = true;
      return true;
    });

  // pre compute radius and date
  
  for (var i in data)
  {
    var d = data[i];
    d.radius = computeMarkerRadius(d.Magnitude) + MARKER_STROKE_WIDTH / 2;
    d.date = QUAKE_DATE_FORMAT.parse(d.Datetime);
  }

  // initialize tesseract

  quakeTesseract = tesseract(data);
  quakeData = data;
  quakesByMag = quakeTesseract.dimension(function(d) {return d.Magnitude;});
  quakesByDate = quakeTesseract.dimension(function(d) {return d.date;});

  // establish size, date and date ranges

  var magData = quakesByMag.top(Infinity);
  if (magData.length > 0)
  {
    observedMaxMag = magData[0].Magnitude;
    observedMinMag = magData[magData.length - 1].Magnitude;
  }

  var dateData = quakesByDate.top(Infinity);
  if (dateData.length > 0)
  {
    observedMaxDate = dateData[0].date;
    observedMinDate = dateData[dateData.length - 1].date;
  }

//   console.log("min mag", observedMinMag);
//   console.log("max mag", observedMaxMag);

//   console.log("min date", observedMinDate);
//   console.log("max date", observedMaxDate);

  // estalish date window

  dateWindowMax = new Date();
  dateWindowMin = USE_TEST_DATA ? observedMinDate : new Date(dateWindowMax.getTime() - dateWindowExtent);
  timeScale = d3.time.scale.utc().domain([dateWindowMin, dateWindowMax]).range([MIN_OPACITY, MAX_OPACITY]);

  // apply any filters to data

  quakesByMag.filter(magLimitScale ? magLimitScale.domain() : null);
  quakesByDate.filter(dateLimitScale ? dateLimitScale.domain() : timeScale.domain());

//   // if first time, animate in the quakes

//   if (ANIMATE_INITIAL_LOAD && isFirstRender())
//   {
//     var animateTimeScale = d3.time.scale().domain([observedMaxDate, observedMinDate]).range([ANIMATION_FRAMES - 1, 0]);
//     animate(0, animateTimeScale, data);
//   }

//   // otherwise just update the data
  
//  else
    updateDisplayedData();
}

// animate in the data

function animate(frame, animateTimeScale, data)
{
  if (frame >= ANIMATION_FRAMES)
    return;
    
  var acceptDate = animateTimeScale.invert(frame);
//   updateDisplayedData(data.filter(
//       function (d)
//       {
//         return d.date.getTime() <= acceptDate.getTime();
//       }));
    
    // if overlya has not been initialize, do that
    
  setTimeout(function() {animate(frame + 1, animateTimeScale, data);}, ANIMATION_DELAY);
}

// update display

function updateDisplayedData()
{
  if (isFirstRender())
  {
    initializeOverlay();
    constructKey();
  }
    
  // otherwise redraw the overlay
    
  else if (overlay.draw)
    overlay.draw();

  // update the key chart

  updateQuakeChart();
}

// test if this is the first rendering of the data

function isFirstRender()
{
  return overlay == null;
}

// put loaded data on the map

function initializeOverlay()
{
  // create the overlay

  overlay = new google.maps.OverlayView();

  // Add the container when the overlay is added to the map.

  overlay.onAdd = function() 
  {
    // create the div to put this all in

    var layer = d3.select(this.getPanes().overlayMouseTarget)
      .append("div")
      .attr("class", "markers");

    // draw each marker as a separate svg element

    overlay.draw = function() 
    {
      var proParent = this;
      projection = this.getProjection();

      // create svg to put marker in

      var dd = quakesByMag.top(Infinity);
      var updates = layer.selectAll("svg.quakeBox")
        .data(dd, function(d) {return d.Eqid;})

      // update existing markers

        .each(function(d) {projectOntoMap(this, d, projection, -d.radius, -d.radius);});

      var enters = updates.enter()
        .append("svg:svg")
        .attr("class", "quakeBox")
        .style("width",  function(d) {return 2 * d.radius + "px";})
        .style("height", function(d) {return 2 * d.radius + "px";})
        .style("visibility", "hidden")
        .on("mouseover", function(d) {mouseoverQuake(d, proParent);})
        .on("mouseout", function(d) {mouseoutQuake(d, proParent);})
        .each(function(d) {projectOntoMap(this, d, projection, -d.radius, -d.radius);});

      // add the one and only marker for this svg

      enters
        .append("svg:circle")
        .attr("cx", function(d) {return d.radius;})
        .attr("cy", function(d) {return d.radius;})
        .each(function(d) {styleMaker(d, this, true);});

      // fade out circles

      updates.exit().selectAll("circle")
        .transition()
        .duration(FADE_OUT_DURATION)
        .attr("r", 0);

      // remove the exits

      updates.exit()
        .transition()
        .duration(FADE_OUT_DURATION)
        .remove();

      // sort quakes

      d3.selectAll(".quakeBox")
        .sort(function (a, b)
          {
            if (a.Magnitude > b.Magnitude)
              return -1;
            if (a.Magnitude < b.Magnitude)
              return 1;
            return 0;
          });
    };
  };

  // be sure to remove markers when overlay is removed

  overlay.onRemove = function() 
  {
    d3.select(".markers").remove();
  };

  // add new layer

  overlay.setMap(map);
}

function styleMaker(quake, marker, animate)
{
  var marker = d3.select(marker);

  marker
    .attr("class", "markerShape")
    .attr("opacity", function(d) {return timeScale(quake.date);});

  if (animate)
  {
    marker
      .attr("r", 0)
      .transition()
      .duration(FADE_IN_DURATION)
      .attr("r", function(d) {return quake.radius - MARKER_STROKE_WIDTH / 2;});
  }
  else
  {
    marker
      .attr("r", function(d) {return quake.radius - MARKER_STROKE_WIDTH / 2;});
  }

//          .style("fill", function (d) {return markerColorScale.getColor(d.opacity);})
//          .style("stroke", function (d) {return markerEdgeColorScale.getColor(d.opacity);})
//      .style("fill", function (d) {return markerColorScale.getColor(d.Magnitude / MAX_MAGNITUDE);})
}

// projectOntoMap lat long to screen coordinates

function projectOntoMap(svg, d, projection, xOffset, yOffset) 
{
  d = new google.maps.LatLng(d.Lat, d.Lon);
  d = projection.fromLatLngToDivPixel(d);
  return d3.select(svg)
    .style("left", d.x + xOffset + "px")
    .style("top" , d.y + yOffset + "px");
}
    
// compute usgs quake detail url

function quakeUrl(quake)
{
  return QUAKE_BASE + quake.Src + quake.Eqid + QUAKE_TAIL;
}

// construct html to go into summary text

function constructSummaryHtml(quake)
{
  var result = 
    table({id: "summary"},
          tRow({},
               tCell({id: "magnitudeText"}, quake.Magnitude) +
               tCell({},
                     table({id: "timeTable"}, 
                           tRow({},
                                tCell({id: "date"}, DATE_FORMAT(quake.date))) + 
                           tRow({}, 
                                tCell({id: "time"}, 
                                      TIME_FORMAT(quake.date) + span({id: "zone", class: "label"}, ZONE_FORMAT(quake.date))
                                     )))
                    )
              ) +
          tRow({},
               tCell({id: "region", colspan: 2}, capitaliseFirstLetter(quake.Region))) +
          tRow({}, 
               tCell({colspan: 2},
                     table({id: "summarySubtable"},
                           tRow({},
                                tCell({class: "label"}, "id") +
                                tCell({class: "value"}, quake.Eqid) +
                                tCell({class: "label"}, "source") +
                                tCell({class: "value"}, quake.Src.toUpperCase())) +
                           tRow({},
                                tCell({class: "label"}, "lat") +
                                tCell({class: "value"}, quake.Lat) +
                                tCell({class: "label"}, "lon") +
                                tCell({class: "value"}, quake.Lon)))))
         );

  return result;
}

function input(attributes, text) {return html("input", attributes, text);}
function form(attributes, text) {return html("form", attributes, text);}
function table(attributes, text) {return html("table", attributes, text);}
function tRow(attributes, text) {return html("tr", attributes, text);}
function tCell(attributes, text) {return html("td", attributes, text);}
function div(attributes, text) {return html("div", attributes, text);}
function span(attributes, text) {return html("span", attributes, text);}
function text(attributes, text) {return html("text", attributes, text);}
function htmlImg(attributes, source, altText)
{
  attributes = typeof attributes !== 'undefined' ? attributes : {};
  attributes = mergeProperties({src: source, alt: altText}, attributes);
  return html("img", attributes, "");
}
function htmlA(attributes, text, link)
{
  attributes = typeof attributes !== 'undefined' ? attributes : {};
  attributes = mergeProperties({href: link}, attributes);
  return html("a", attributes, text);
}

function svg( attributes, content)
{
  attributes = typeof attributes !== 'undefined' ? attributes : {};
  attributes = mergeProperties({xmlns: "http://www.w3.org/2000/svg"}, attributes);
  return html("svg", attributes, content);
}

function html(tag, attributes, content)
{
  attributes = typeof attributes !== 'undefined' ? attributes : {};

  var result = [];
  result.push('<' + tag);
  for (var attribute in attributes)
    result.push(' ' + attribute + '="' + attributes[attribute] + '"');
  result.push('>' + content + '</' + tag + '>');
  return result.join('');
}

function mergeProperties(obj1,obj2)
{
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

function mouseoverQuake(quake, map)
{
  addQuakeDtail(quake, map);

  // highlight matching quake

  d3
    .selectAll(".chartQuakes")
    .filter(function (d) {return d == quake;})
    .each(function (d) {console.log("d", d);})
    .attr("class", "mapMouseOver");
}


function mouseoutQuake(quake, map)
{
  removeQuakeDtail(quake, map);

  // un-highlight matching quake

  d3
    .selectAll(".mapMouseOver")
    .filter(function (d) {return d == quake;})
    .each(function (d) {console.log("d", d);})
    .attr("class", "chartQuakes");
}

function addQuakeDtail(quake, map)
{
  // create quake detail window

  var quakeDetail = d3.select(".markers")
    .append("svg:svg")
    .attr("class", "quakeDetail")
    .each(function(d) {projectOntoMap(this, quake, map.getProjection(), 0, 0);})
    .style("width", SUMMARY_WIDTH  + MARKER_OFFSET * 2 + "px")
    .style("height",SUMMARY_HEIGHT + MARKER_OFFSET * 2 + "px")
    .on("mouseover", function(d) {mouseoverQuake(quake, map);})
    .on("mouseout", function(d) {mouseoutQuake(quake, map);})
  //    .style("background", "green");
    .style("visibility", "hidden");

  // add line
  
  quakeDetail
    .append("svg:path")
    .attr("class", "quakeDetailLine")
    .style("visibility", "visible")
    .attr("d", function() {return quakeDetailLine(quake);});

//   // add html

  quakeDetail
    .append("svg:foreignObject")
    .style("visibility", "visible")
    .attr("class", "summaryTextObject")
    .attr("width",  SUMMARY_WIDTH + "px")
    .attr("height", SUMMARY_HEIGHT + "px")
    .attr("x", MARKER_OFFSET)
    .attr("y", MARKER_OFFSET - WEDGE_WIDTH)
    .append("xhtml:body")
    .attr("class", "quakeDetailText")
    .html(function() {return constructSummaryHtml(quake);});
}

function removeQuakeDtail(quake, map)
{
  d3.select(".quakeDetail")
    .remove();
}

// return path for line to quake detail text

function quakeDetailLine(quake)
{
  var path = 
    " m 0 0" +
    " l " + MARKER_OFFSET + " " + MARKER_OFFSET +
    " v " + -WEDGE_WIDTH +
    " h " + (SUMMARY_WIDTH) + 
    " v " + SUMMARY_HEIGHT +
    " h " + -SUMMARY_WIDTH + 
    " v " + -(SUMMARY_HEIGHT - 2 * WEDGE_WIDTH) + 
    " z";

//  console.log("path", path);
  return path;
}

// compute the radiuse from a magnitude 

function computeMarkerRadius(magnitude)
{
  // compute the ideal area (10^magnitude)

  var area = Math.pow(10, magnitude);

  // establish the radius which will produce that visual area

  var radius = Math.sqrt(area / Math.PI);

  // scale down the radius (add error) so markes fit on screen
  // note: error increased with magnitude

  return 2.5 + radius / (1 - 1/(0.02 * (magnitude - MAX_MAGNITUDE)));
}

function testRadiusComputation()
{
  console.log("-----------------");
  var prev = null;
  for (var i = 1; i < 11; ++i)
  {
    var rad = computeMarkerRadius(i);
    var area = Math.PI * rad * rad;
    var ratio = Math.round(area / (prev != null ? prev : area));
    var error = 10 - ratio;
    console.log("mag:", i, "rad:", rad, "area:", area, "ratio", ratio, "error", error);
    prev = area;
  }
}

// construct the reading scale

function constructKey()
{
  var stockMagnitude = 5.2;
  var stockAge = 4;
  var examples = 7;
  var baseMagnitude = 1;
  var headerPercent = 20;
  var examplePercentStep = (100 - headerPercent) / (examples + 1);

  // create scale div and add to map

  var keyDiv = document.createElement("div");
  keyDiv.id = "keyDiv";
  keyDiv.style.width =  KEY_WIDTH + "px";
  keyDiv.style.height = KEY_HEIGHT + "px";
  keyDiv.style.padding = "0px " + KEY_PADDING + "px";

  // attach key to map (removing old one first)

  var topRight = map.controls[google.maps.ControlPosition.RIGHT_TOP];
  if (topRight.length > 0)
    topRight.pop();
  topRight.push(keyDiv);

  // add inner div

  var innerDiv = d3.select(keyDiv)
    .append("div")
    .attr("id", "keyInner");

  // add header area

  var headerDiv = innerDiv
    .append("div")
    .attr("id", "keyHeader");

  // add quake chart area

  var chartDiv = innerDiv
    .append("div")
    .attr("id", "chartDiv");
  
  var chartSvg = chartDiv
    .append("svg:svg")
    .attr("id", "chartSvg");

  createQuakeChart(chartSvg, headerDiv);

//   // add detail area

//   var detailDiv = innerDiv
//     .append("div")
//     .attr("id", "detailDiv");

//   var detailSvg = detailDiv
//     .append("svg:svg")
//     .attr("id", "detailSvg");

//   // create the magnitude quakes

//   var sizeQuakes = [];
//   for (var magnitude = 0; magnitude <= examples; ++magnitude)
//   {
//     var quake = new Object();
//     var date = new Date(dateWindowMax.getTime() - stockAge * MILLISECONDS_INA_DAY);
//     quake.opacity = timeScale(date);
//     quake.Magnitude = baseMagnitude + magnitude;
//     quake.radius = computeMarkerRadius(quake.Magnitude);
//     quake.yPos = headerPercent + examplePercentStep * magnitude;
//     sizeQuakes.push(quake);
//   }

//   // add the magnitude quakes

//   var sizeMarkers = detailSvg.selectAll("g.magnitude")
//     .data(sizeQuakes)
//     .enter()
//     .append("svg:g")
//     .attr("class", "magnitude");

//   sizeMarkers
// //     .filter(function (d) {return d.Magnitude <= 4;})
//     .append("svg:circle")
//     .attr("r", 0)
//     .each(function(d) {styleMaker(d, this, false);})
//     .attr("cx", "75%")
//     .attr("cy", function (d) {return d.yPos + "%";});

//   sizeMarkers
//     .append("svg:text")
//     .attr("x", "55%")
//     .attr("y", function (d) {return d.yPos + "%";})
//     .style("text-anchor", "middle")
//     .attr("dominant-baseline", "middle")
//     .text(function(d) {return d.Magnitude;});

//   sizeMarkers
//     .append("svg:line")
//     .attr("x1", "60%")
//     .attr("y1", function (d) {return d.yPos + "%";})
//     .attr("x2", "75%")
//     .attr("y2", function (d) {return d.yPos + "%";});

//   var magicNumber = 6.65;
//   sizeMarkers
//     .filter(function (d) {return d.Magnitude > 4;})
//     .append("svg:line")
//     .attr("x1", "75%")
//     .attr("y1", function (d) {return d.yPos + "%";})
//     .attr("x2", function (d) {return (75 + 0.5 * d.radius / magicNumber) + "%";})
//     .attr("y2", function (d) {return (d.yPos - d.radius / magicNumber) + "%";});

//   sizeMarkers
//      .filter(function (d) {return d.Magnitude > 4;})
//     .append("svg:path")
//     .attr("transform", function(d) {return "translate(" +
//                                     (180) + ", " + 
//                                     (112 + 56.2 * (d.Magnitude - 1)) + ") rotate(9)";})
//     .attr("d", function (d) 
//           {
//             var r = d.radius;
//             var theta = -87 * Math.PI / 180;
//             var x2 = r * Math.cos(theta);
//             var y2 = r * Math.sin(theta);
//             return "m 0 0 v " + -r + "A " + r + " " + r + " 0 0 1 " + x2  + " " + y2 + " z";
//           });

//   // create the age quakes

//   var ageQuakes = [];
//   for (var daysBack = 0; daysBack <= examples; ++daysBack)
//   {
//     var quake = new Object();
//     var date = new Date(dateWindowMax.getTime() - daysBack * MILLISECONDS_INA_DAY);
//     quake.daysBack = daysBack;
//     quake.opacity = timeScale(date);
//     quake.Magnitude = stockMagnitude;
//     quake.radius = computeMarkerRadius(quake.Magnitude);
//     quake.yPos = headerPercent + examplePercentStep * quake.daysBack;
//     ageQuakes.push(quake);
//   }

//   // add rectangle to block out size marker

//   detailSvg.append("svg:rect")
//     .attr("x", "0%")
//     .attr("y", headerPercent + "%")
//     .attr("width", "50%")
//     .attr("height", (100 - headerPercent) + "%")
//     .style("fill", "white");

//   // add the age quakes

//   var ageMarkers = detailSvg.selectAll("g.age")
//     .data(ageQuakes)
//     .enter()
//     .append("svg:g")
//     .attr("class", "age");

//   ageMarkers
//     .append("svg:circle")
//     .attr("r", 0)
//     .each(function(d) {styleMaker(d, this, false);})
//     .attr("cx", "25%")
//     .attr("cy", function(d) {return d.yPos + "%";});

//   ageMarkers
//     .append("svg:text")
//     .attr("x", "25%")
//     .attr("y", function(d) {return d.yPos + "%";})
//     .style("text-anchor", "middle")
//     .attr("dominant-baseline", "middle")
//     .text(function(d) {return d.daysBack;});
}

function createQuakeChart(svg, headerDiv)
{
  var m = {top: 5, left: 30, bottom: 25, right: 10};
  var w = (KEY_WIDTH * 1.0) - m.left - m.right;
  var h = (KEY_HEIGHT * 0.70) - m.top - m.bottom;


  // initialize the scales

  var quakeChartTimeScale = d3.time.scale.utc().range([0, w]);
  var quakeChartMagScale = d3.scale.linear().range([h, 0]);

  // frame to attach axes too

  var frame = svg
    .append("g")
    .attr("transform", "translate(" + m.left + "," + m.top + ")");

  // create x-axis

  var xAxis = frame.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + h + ")");

  // create y-axis

  var yAxis = frame.append("g")
    .attr("class", "y axis");

  var chartMarkers;

  // the function used to update this chart, defined here so it has access to 
  // chart variables but can be called globally 

  updateQuakeChart = function()
  {
    // update the header html

    headerDiv
      .html(keyHeaderHtml);

    // set the domain of the chat scales

    quakeChartTimeScale.domain(timeScale.domain());
    quakeChartMagScale.domain([0, observedMaxMag]).nice();

    // set the x-axis scale

    var xAxisScale = null;
    var xAxisTickFormat = null;
    var xAxisTickNumber;
    switch(dataSets)
    {
    case HOUR_DATA_SETS:
      xAxisInterval = d3.time.minutes;
      xAxisTickFormat = d3.time.format("%H:%M");
      xAxisTickNumber = 10;
      break;
    case DAY_DATA_SETS:
      xAxisInterval = d3.time.hours;
      xAxisTickFormat = d3.time.format("%H:00");
      xAxisTickNumber = 8;
      break;
    case WEEK_DATA_SETS:
      xAxisInterval = d3.time.days;
      xAxisTickFormat = d3.time.format("%d %b");
      xAxisTickNumber = 2;
      break;
    }

    var xAxisScale = d3.svg.axis().scale(quakeChartTimeScale)
      .tickSubdivide(1)
      .tickSize(6, 3, 0)
      .ticks(xAxisInterval, xAxisTickNumber)
      .tickFormat(xAxisTickFormat)
      .orient("bottom");

    var yAxisScale = d3.svg.axis().scale(quakeChartMagScale).orient("left");

    if (timeScaleChanged)
    {
      xAxis 
        .transition()
        .duration(CHART_QUAKE_ROLLIN_MILLISECONDS)
        .call(xAxisScale);

      yAxis
        .transition()
        .duration(CHART_QUAKE_ROLLIN_MILLISECONDS)
        .call(yAxisScale);
    }
    else
    {
      xAxis.call(xAxisScale);
      yAxis.call(yAxisScale);
    }
    
    // establish the cirlce updates
    
    chartMarkers = svg.selectAll("circle")
      .data(quakeData.filter(
        function (d) 
        {
          return d.date >= dateWindowMin && d.date < dateWindowMax;
        }), function(d) {return d.Eqid;});
    
    // add the new circles

    var updateMarkers = chartMarkers
      .enter()
      .append("circle")
      .attr("opacity", 0)
      .attr("class", "chartQuakes")
      .attr("r", 3);

    // if timescale changed, roll in new points from left edge

    if (timeScaleChanged)
    {
      // place markers flush left of the chart

      updateMarkers.attr("transform", function(d)
              {
                return "translate(" + m.left + "," + (quakeChartMagScale(d.Magnitude) + m.top) + ")"; 
              });

      // remove the exits
      
      chartMarkers.exit()
        .transition()
        .duration(CHART_QUAKE_ROLLIN_MILLISECONDS)
        .attr("opacity", 0)
        .attr("transform", function(d)
              { return "translate(" + m.left + "," + 
                (quakeChartMagScale(d.Magnitude) + m.top) + ")"; 
              })
        .remove();

      // (re)position all quakes
      
      chartMarkers
        .transition()
        .duration(CHART_QUAKE_ROLLIN_MILLISECONDS)
        .attr("opacity", 1)
        .attr("transform", function(d)
              { return "translate(" + (quakeChartTimeScale(d.date) + m.left) + "," + 
                (quakeChartMagScale(d.Magnitude) + m.top) + ")"; 
              });
    }
    
    // otherwise just fade them in where they belong
    
    else
    {
      // place markers at final destination

      updateMarkers
        .attr("transform", function(d)
              {
                return "translate(" + (quakeChartTimeScale(d.date) + m.left) + "," + (quakeChartMagScale(d.Magnitude) + m.top) + ")";
              });

      // remove the exits
      
      chartMarkers.exit()
        .transition()
        .duration(CHART_QUAKE_ROLLIN_MILLISECONDS)
        .attr("opacity", 0)
        .remove();

      // (re)position all quakes
      
      chartMarkers
        .attr("transform", function(d)
              { return "translate(" + (quakeChartTimeScale(d.date) + m.left) + "," + 
                (quakeChartMagScale(d.Magnitude) + m.top) + ")"; 
              })
        .transition()
        .duration(CHART_QUAKE_ROLLIN_MILLISECONDS)
        .attr("opacity", 1);
    }

    if (timeScaleChanged)
    {
      chartMarkers.classed("unselected", false);
      svg.classed("selecting", false);
      magLimitScale = null;
      dateLimitScale = null;
      quakesByMag.filter(null);
      quakesByDate.filter(timeScale);

      svg.selectAll("g.brush").remove();
      svg.append("g")
        .attr("class", "brush")
        .attr("transform", function(d) { return "translate(" + m.left + "," + m.top + ")"; })
        .call(d3.svg.brush().x(quakeChartTimeScale).y(quakeChartMagScale)
              .on("brushstart", brushstart)
              .on("brush", brush)
              .on("brushend", brushend));

      timeScaleChanged = false;
    }

  }

  // be sure update chart data after we create the chart

  updateQuakeChart();
  
  // brush functions

  function brushstart()
  {
    svg.classed("selecting", true);
  }
  
  function brush() 
  {
    var e = d3.event.target.extent();
    var minDate = e[0][0];
    var maxDate = e[1][0];
    var minMag = e[0][1];
    var maxMag = e[1][1];

    function select(d)
    {
      return minDate <= d.date && d.date <= maxDate
        && minMag <= d.Magnitude && d.Magnitude <= maxMag;
    };

    chartMarkers.classed("unselected", function(d) {return !select(d);});
  }
  
  function brushend() 
  {
    var e = d3.event.target.extent();

    if (d3.event.target.empty())
    {
      chartMarkers.classed("unselected", false);

      magLimitScale = null;
      dateLimitScale = null;
      quakesByMag.filter(null);
      quakesByDate.filter(timeScale);
      updateDisplayedData();
    }
    else
    {
      magLimitScale = d3.scale.linear().domain([e[0][1],e[1][1]]);
      dateLimitScale = d3.time.scale().domain([e[0][0],e[1][0]]);
      quakesByMag.filter(magLimitScale.domain());
      quakesByDate.filter(dateLimitScale.domain());
      updateDisplayedData();
    }

    svg.classed("selecting", !d3.event.target.empty());
  }
}

function keyHeaderHtml()
{
  var space = "&nbsp;";
  var selectHour = span({class: "spanSelector", onclick: "setHourSpan()"}, "Hour");
  var selectDay = span({class: "spanSelector", onclick: "setDaySpan()"},  "Day");
  var selectWeek = span({class: "spanSelector", onclick: "setWeekSpan()"}, "Week");

  // use dataSets as proxy for which time mode is selected

  var unitName = null;
  var space1 = space;
  var space2 = space;
  switch(dataSets)
  {
  case HOUR_DATA_SETS:
    unitName = "this Hour";
    selectHour = span({class: "spanSelected"}, "");
    space1 = "";
    break;
  case DAY_DATA_SETS:
    unitName = "this Day";
    selectDay = span({class: "spanSelected"}, "");
    space2 = "";
    break;
  case WEEK_DATA_SETS:
    unitName = "this Week";
    selectWeek = span({class: "spanSelected"}, "");
    space2 = "";
    break;
  }

  var selectors = selectHour + space1 + selectDay + space2 + selectWeek;

  // construct the header table

  var result = 
    table({id: "keyHeaderTable"},
          tRow({}, 
               tCell({},
                     table({id: "titleTable"},
                           tRow({}, tCell({id: "keyTitle"}, "Earthquakes" + space + unitName)) +
                           tRow({id: "spanSelectors"}, tCell({}, selectors))
                          )
                    )
              ) +
          tRow({}, 
               tCell({id: "selectHint"}, "Quake Chart (drag to select)") 
              )
  );

  return result;
}

// set the time span to the last hour

function setHourSpan()
{
  dateWindowExtent = MILLISECONDS_INA_HOUR;
  dataSets = HOUR_DATA_SETS;
  timeScaleChanged = true;
  loadDataSets();
}

// set the time span to the last day

function setDaySpan()
{
  dateWindowExtent = MILLISECONDS_INA_DAY;
  dataSets = DAY_DATA_SETS;
  timeScaleChanged = true;
  loadDataSets();
}

// set the time span to the last week

function setWeekSpan()
{
  dateWindowExtent = MILLISECONDS_INA_WEEK;
  dataSets = WEEK_DATA_SETS;
  timeScaleChanged = true;
  loadDataSets();
}


function timeAgo(date)
{
  var now = new Date();

  var delta = now.getTime() - date.getTime();
  var bigUnit = establishTimeUnit(delta);

  var deltaRemainder = delta % bigUnit.divisor;
  var smallUnit = establishTimeUnit(deltaRemainder);

  return Math.floor(delta / bigUnit.divisor) + " " + bigUnit.short + " " + 
    Math.floor(deltaRemainder / smallUnit.divisor) + " " + smallUnit.short;
}

function establishTimeUnit(milliseconds)
{
  var units = [
    {threshold: MILLISECONDS_INA_MINUTE, divisor: MILLISECONDS_INA_SECOND, unit: "seconds", short: "sec"},
    {threshold: MILLISECONDS_INA_HOUR, divisor: MILLISECONDS_INA_MINUTE, unit: "minutes", short: "min"},
    {threshold: MILLISECONDS_INA_DAY, divisor: MILLISECONDS_INA_HOUR, unit: "hours", short: "hrs"},
    {threshold: MILLISECONDS_INA_WEEK, divisor: MILLISECONDS_INA_DAY, unit: "days", short: "day"},
  ];

  for (var i in units)
    if (milliseconds < units[i].threshold)
      return units[i];

  return units[units.length - 1];
}

function convertToUtc(date)
{
  date = typeof date !== 'undefined' ? date : new Date();
  return new Date(
    date.getUTCFullYear(), 
    date.getUTCMonth(), 
    date.getUTCDate(),  
    date.getUTCHours(), 
    date.getUTCMinutes(), 
    date.getUTCSeconds());
}

function capitaliseFirstLetter(string)
{
  return string.charAt(0).toUpperCase() + string.slice(1);
}

