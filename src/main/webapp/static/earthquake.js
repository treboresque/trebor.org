// google map

var mapStyle = 
[ 
  { featureType: "poi.park", elementType: "geometry", stylers: [ { gamma: 1 }, { lightness: 50 }, { saturation: -45 } ] },
  { featureType: "water", elementType: "geometry", stylers: [ { saturation: -25 }, { lightness: 50 } ] },
  { featureType: "road", stylers: [ { visibility: "on" }, { saturation: -70 }, { lightness: 40 } ] },
  { featureType: "administrative", stylers: [ { saturation: -100 }, { lightness: 20 } ] },
  { elementType: "labels", stylers: [ { lightness: 52 }, { saturation: -80 } ] } 
];

var map = new google.maps.Map(d3.select("#map").node(),
{
  zoom: 2,
  center: new google.maps.LatLng(20.8255, -156.9199),
  mapTypeId: google.maps.MapTypeId.ROADMAP,
  styles: mapStyle,
});

// globals

var maxMagnitude = 10;

// initialize data

initialize();

// have a look at the radius computation

//testRadiusComputation();

// compute color space

var colorScale = new chroma.ColorScale({
  colors: ['#00ff00','#0000ff','#ffff00','#ff0000'],
//    positions: [0,.07,1],
    mode: 'rgb'
});

// construct the color scale

constructScale();

function initialize()
{
//  d3.csv("/quake?test=false", displayData);
  d3.csv("/quake?test=true&name=data1.csv", displayData);
  setTimeout("change()", 5000);
  console.log("inited");
}

function change()
{
  d3.csv("/quake?test=true&name=data2.csv", displayData);
  console.log("changed");
}

// put loaded data on the map

function displayData(data)
{
  // if there is no data, return

  if (!data)
    return;

  console.log("size: ", data.length);

  // sort the smallest quakes to the top of the view

  data.sort(function (a, b)
  {
    if (a.Magnitude < b.Magnitude)
      return 1;
    if (a.Magnitude > b.Magnitude)
      return -1;
    return 0;
  });

  var quakeDateFormat = d3.time.format("%A, %B %e, %Y %H:%M:%S UTC");
  var minDate = null;
  var maxDate = null;

  // establish size, date and date ranges

  for (var i = 0; i < data.length; ++i)
  {
    var d = data[i];
    d.size = computeMarkerRadius(d.Magnitude);
    d.date = quakeDateFormat.parse(d.Datetime);

    if (!minDate || minDate.getTime() > d.date.getTime())
      minDate = d.date;

    if (!maxDate || maxDate.getTime() < d.date.getTime())
      maxDate = d.date;
  }

  // establish age

  var ageRange = maxDate.getTime() - minDate.getTime();

  for (var i = 0; i < data.length; ++i)
  {
    var d = data[i];
    d.age = (d.date.getTime() - minDate.getTime()) / ageRange;
  }

  // create overlay

  var overlay = new google.maps.OverlayView();

  // Add the container when the overlay is added to the map.

  overlay.onAdd = function() 
  {
    // create date format for parsing
    // example: Friday, March  9, 2012 14:29:10 UTC

    // create the div to put this all in

    var layer = d3.select(this.getPanes().overlayLayer)
      .append("div")
      .attr("class", "readings");

    // draw each marker as a separate SVG element

    overlay.draw = function() 
    {
      var projection = this.getProjection(),
          padding = 30;

      // create svg

      var updates = layer.selectAll("svg")
        .data(data, function(d) {return d.Eqid;})
        .each(function(d) {console.log("update", d.Eqid);})
        .each(transform); // update existing markers

      var enters = updates.enter()
        .append("svg:svg")
        .each(function(d) {console.log("enter", d.Eqid);})
        .each(transform);

      // add the one and only marker for this svg

      enters
        .append("svg:circle")
        .attr("r", 0)
        .attr("cx", function(d) {return d.size;})
        .attr("cy", function(d) {return d.size;})
        .attr("opacity", 0.5)
//        .attr("opacity", function(d) {return d.age;})
        .style("fill", "red")
        .transition()
        .duration(function(d) {return 500 * d.Magnitude})
        .attr("r", function(d) {return d.size - 1;});

//         .style("fill", function (d) {return colorScale.getColor(d.Magnitude / maxMagnitude);});

      // at label to this marker

//       enters
//         .append("svg:text")
//         .attr("x", "50%")
//         .attr("y", "52%")
//         .attr("text-anchor", "middle")
//         .attr("dominant-baseline", "middle")
//         .text(function(d) {return "" + d.Magnitude;});

      // remove the exits

      updates.exit()
        .each(function(d) {console.log("exit", d.Eqid);})
        .remove();

      // transform lat long to screen coordinates

      function transform(d) 
      {
        var size = d.size;
        d = new google.maps.LatLng(d.Lat, d.Lon);
        d = projection.fromLatLngToDivPixel(d);

        return d3.select(this)
          .style("left", d.x - size + "px")
          .style("top", d.y - size + "px")
          .style("width", size * 2 + "px")
          .style("height", size * 2 + "px");
      }
    };
  };

  // be sure to remove readings when overlay is removed

  overlay.onRemove = function() 
  {
    d3.select(".readings").remove();
  };

  // add new layer

  overlay.setMap(map);
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

  return 2.5 + radius / (1 - 1/(0.02 * (magnitude - maxMagnitude)));
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
    console.log("mag:", i, "rad:", rad, "area:", area, "ratio", ratio);
    prev = area;
  }
}

// construct the reading scale

function constructScale()
{
  var max = 10;

  // create scale div and add to map

  var scaleDiv = document.createElement('DIV');
  scaleDiv.id = "scale";
  scaleDiv.style.width="3em";
  scaleDiv.style.height="0%";
  scaleDiv.style.padding="20px 40px";
  map.controls[google.maps.ControlPosition.RIGHT_TOP].push(scaleDiv);

  // add label

  var innerDiv = d3.select(scaleDiv)
    .append("div")
    .style("height", "0%")
    .style("width", "100%")
    .style("text-align", "center");

   innerDiv.append("a")
    .attr("href", "http://wikipedia.org/wiki/Richter_magnitude_scale")
    .text("mag");

  // add reading values

  for (var i = 0; i < max; ++i)
  {
    var val = i / max;
    var valStr = "" + Math.round(val * maxMagnitude * 10) / 10;
    if (valStr.length == 1)
      valStr += ".0";

    innerDiv
      .append("div")
      .style("opacity", 0.8)
      .style("background", function (d) {return colorScale.getColor(val);})
      .style("width", "100%")
      .style("height", "2em")
      .style("line-height", "2em")
      .style("text-align", "center")
      .text(valStr);
  }
}
