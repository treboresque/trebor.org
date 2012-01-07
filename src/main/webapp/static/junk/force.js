var w = screen.width,
    h = screen.height,
    fill = d3.scale.category20();

var vis = d3.select("#chart")
  .append("svg:svg")
    .attr("width", w)
    .attr("height", h);

d3.json("http://localhost:8080/trebor/thumbs", function(json) {
//d3.json("http://localhost:8080/trebor/forceTest.json", function(json) {
//d3.json("http://localhost/~trebor/d3tut/miserables2.json", function(json) {
  var force = d3.layout.force()
      .charge(-120)
      .distance(30)
      .nodes(json.nodes)
      .links(json.links)
      .size([w, h])
      .start();

  var link = vis.selectAll("line.link")
      .data(json.links)
    .enter().append("svg:line")
      .attr("class", "link")
      .style("stroke-width", function(d) { return d.value; })
      // .style("stroke-width", function(d) { return Math.sqrt(d.value); })
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

  var node = vis.selectAll("circle.node")
      .data(json.nodes)
    .enter().append("svg:circle")
      .attr("class", "node")
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .attr("r", 5)
      .style("fill", function(d) { return fill(d.group); })
      .on("click", function(d) {window.location = "http://www.google.com?q=" + d.name;})
      .call(force.drag);


//  node.filter(function(d) { return !d.children; }).append("svg:text")
//      .attr("text-anchor", "middle")
//      .attr("dy", ".3em")
//      .text(function(d) { return d.name.substring(0, d.r / 3); });
//   });

 // node.append("svg:title").text(function(d) { return d.name; });
   
  
  
  node.append("svg:title")
      .text(function(d) { return d.name; });

  vis.style("opacity", 1e-6)
    .transition()
      .duration(1000)
      .style("opacity", 1);

  force.on("tick", function() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  });
});