var QUERY_URL = "http://dbpedia.org/sparql?default-graph-uri=http%3A%2F%2Fdbpedia.org&format=json&query=";

var debugging = false;

var prefixies = [
  {prefix: "rdf",         uri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#"},
  {prefix: "fn",          uri: "http://www.w3.org/2005/xpath-functions#"},
  {prefix: "dbcat",       uri: "http://dbpedia.org/resource/Category/"},
  {prefix: "rdfs",        uri: "http://www.w3.org/2000/01/rdf-schema#"},
  {prefix: "skos",        uri: "http://www.w3.org/2004/02/skos/core/"},
  {prefix: "xsd",         uri: "http://www.w3.org/2001/XMLSchema#"},
  {prefix: "dc",          uri: "http://purl.org/dc/elements/1.1/"},
  {prefix: "owl",         uri: "http://www.w3.org/2002/07/owl#"},
  {prefix: "wiki",        uri: "http://en.wikipedia.org/wiki/"},
  {prefix: "dbpedia-owl", uri: "http://dbpedia.org/ontology/"},
  {prefix: "dbprop",      uri: "http://dbpedia.org/property/"},
  {prefix: "dbpedia",     uri: "http://dbpedia.org/resource/"},
  {prefix: "prov",        uri: "http://www.w3.org/ns/prov#"},
  {prefix: "foaf",        uri: "http://xmlns.com/foaf/0.1/"},
  {prefix: "dcterms",     uri: "http://purl.org/dc/terms/"},
];

var predicates = {
  influenced:    "dbpedia-owl:influenced",
  influencedBy: "dbpedia-owl:influencedBy",
  depiction: "foaf:depiction",
  thumbnail: "dbpedia-owl:thumbnail",
  name: "foaf:name",
  wikiTopic: "foaf:isPrimaryTopicOf",
  occupation: "dbpprop:occupation",
  dob: "dbprop:dateOfBirth",
  dod: "dbprop:dateOfDeath",
};

var subjects = {
  mock:       "dbpedia:Mock_Data",
  bacon:      "dbpedia:Kevin_Bacon",
  duckworth:  "dbpedia:Eleanor_Duckworth",
  vonnegut:   "dbpedia:Kurt_Vonnegut",
  plath:      "dbpedia:Silvia_Plath",
  egoldman:   "dbpedia:Emma_Goldman",
  oats:       "dbpedia:Joyce_Carol_Oates",
  kahlo:      "dbpedia:Frida_Kahlo",
  bohm:       "dbpedia:David_Bohm",
  obama:      "dbpedia:Barack_Obama",
  chomsky:    "dbpedia:Noam_Chomsky",
  eroosevelt: "dbpedia:Eleanor_Roosevelt(Hato_Rey)",
  pinker:     "dbpedia:Steven_Pinker",
  sontag:     "dbpedia:Susan_Sontag",
  einstein:   "dbpedia:Albert_Einstein",
  kant:       "dbpedia:Immanuel_Kant",
};

var personalDetails = [
  {name: "name",       optional: false, type: "literal"},
  {name: "thumbnail",  optional: true,  type: "url"},
  {name: "depiction",  optional: true,  type: "url"},
  {name: "wikiTopic",  optional: false, type: "url"},
  {name: "dob",        optional: true,  type: "literal"},
  {name: "dod",        optional: true,  type: "literal"},
];

var personCache = {};

personCache[lengthen(subjects.mock, true)] = createMockData();

var personDetailsSelect = function() {
  var result = "";
  personalDetails.forEach(function(detail) {
    result += " ?" + detail.name;
  });
  return result;
};

var personDetailsWhere = function(target) {
  var result = "";
  personalDetails.forEach(function(detail) {
    var name = detail.name;
    var predicate = predicates[name];

    if (detail.optional) {
      result += "  OPTIONAL {" + target + " " + predicate + " ?" + name + " . }\n";
    } else {
      result += "  " + target + " " + predicate + " ?" + name + " .\n";
    }
  });
  return result; // + "\n  FILTER(langMatches(lang(?name), 'EN'))";
};

var query_relationship_details = "\n\
SELECT DISTINCT ?subject" + personDetailsSelect() + "\n\
WHERE\n\
{\n\
  %subject% %predicate% %object% .\n" +
  personDetailsWhere("?subject") + "\n\
}";


var query_details = "SELECT" + personDetailsSelect() + " \n\
WHERE\n\
{\n" +
  personDetailsWhere("%target%") + "\n\
}";

var query_describe = "DESCRIBE %target%";

var display_results = function(data){
  console.log(data);
  var keys = data.head.vars;
  data.results.bindings.forEach(function(result) {
    var line = "";
    keys.forEach(function(key) {
      line += binding_to_string(result[key]) + " ";
    });
    console.log(line);
  });
};

function binding_to_string(binding) {
  var result;

  if (binding !== undefined) {
    switch (binding.type) {
    case "uri":
      //result = binding.value;
      result = prefix_uri(prefixies, binding.value);
      break;
    case "literal":
      result = "[" + binding.value.substring(0, 30) + "]";
      break;
    default:
      result = "{" + binding.value.substring(0, 30) + "}";
    }
  }

  return result;
}

function sparqlQuery(query, variables, callback) {

  var execute = function() {
  // swap in variables

  Object.keys(variables).forEach(function(variable) {
    query = query.replace(new RegExp("%" + variable + "%", "g"), variables[variable]);
  });

  query = prefix_table_to_string(prefixies) + "\n" + query;
  
  if (debugging) {
    console.log("---------------- query ----------------");
    console.log(query);
    //console.log(escape(query));
    console.log("^^^^^^^^^^^^^^^^ query ^^^^^^^^^^^^^^^^");
  }

  $.getJSON(QUERY_URL + escape(query), function(data) {
    if (debugging) {
      console.log("---------------- results -----------------");
      display_results(data);
      console.log("^^^^^^^^^^^^^^^^ results ^^^^^^^^^^^^^^^^");
    }

    callback(data);
  })
    .error(function(error) {console.log("HTTP error"), callback(undefined)});
  };

  setTimeout(execute, 0);
};

// convert uri to prefixed thingy

function prefix_uri(prefixies, uri) {
  var result = uri;
  prefixies.some(function(prefix) {
    if (uri.indexOf(prefix.uri) >= 0) {
      result = uri.replace(prefix.uri, prefix.prefix + ":");
      return true;
    };
    return false;
  });
  return result;
}

function lengthen(uri, bracket) {
  var result = uri;
  bracket = bracket || false;

  if (uri.indexOf(':') < 0)
    return result;

  var symbols = uri.split(':');
  var prefixName = symbols[0];
  var id = symbols[1];

  prefixies.some(function(prefix) {
    if (prefix.prefix == prefixName) {
      result = prefix.uri + id;
      if (bracket) result = '<' + result + '>';
      return true;
    }
    return false;
  });
  return result;
}

function shorten(uri) {
  var len = uri.length;
  if (uri[0] == '<' && uri[len - 1] == '>')
    uri = uri.substring(1, len - 1);
  return prefix_uri(prefixies, uri);
}

// convert prefix table to string

function prefix_table_to_string(prefixies) {
  var result = "";
  prefixies.forEach(function(prefix) {
    result += "PREFIX " + prefix.prefix + ": <" + prefix.uri + ">\n";
  });
  return result;
}

function createMockData() {

  var mockData = [
    {id: lengthen(subjects.mock, true), name: "Mock Data"},
    {id: lengthen("dbpedia:foo"), name: "Foo Has A Long Mock Name"},
    {id: lengthen("dbpedia:bar"), name: "Bar Mock"},
  ];

  var mock = mockData[0];
  var foo = mockData[1];
  var bar = mockData[2];

  var mockGraph = new TGraph();

  mockGraph.addLink(mock.id, foo.id);
  mockGraph.addLink(mock.id, bar.id);

  mockGraph.getNodes().forEach(function(node) {
    mockData.forEach(function(datum) {
      if (datum.id == node.getId()) {
        node.setProperty("name", datum.name);
        node.setProperty("thumbnail", "images/unknown.png");
      }
    });
  });

  return  mockGraph;
}

function getPerson(id, callback) {

  // if the person is in the chache, use that

  var personGraph = personCache[id];
  if (personGraph !== undefined) {
    callback(personGraph);
  }

  // otherwise query for the person and be sure to cache that

  else
    queryForPerson(id, function(personGraph) {
      personCache[id] = personGraph;
      callback(personGraph);
    });
}

function queryForPerson(targetId, callback) {
  var targetGraph = new TGraph();
  queryForInfluencedBy1(targetGraph, targetId, function() {
    queryForInfluencedBy2(targetGraph, targetId, function() {
      queryForInfluenced1(targetGraph, targetId, function() {
        queryForInfluenced2(targetGraph, targetId, function() {
          var targetNode = targetGraph.getNode(targetId);
          if (targetNode !== undefined) {
            queryDetails(targetNode, function() {callback(targetGraph);});
          } else {
            callback(targetGraph);
          }
        })
      })
    })
  });
}

function queryForInfluenced1(targetGraph, targetId, callback) {
  queryForRelationship("?subject", predicates.influenced, targetId, function (binding) {
    var subjectId = "<" + binding.subject.value + ">";
    targetGraph.addLink(subjectId, targetId, {type: predicates.influenced});
    applyDetails(targetGraph.getNode(subjectId), binding);
  }, function() {
    callback(targetGraph);
  });
}

function queryForInfluenced2(targetGraph, targetId, callback) {
  queryForRelationship(targetId, predicates.influenced, "?subject", function (binding) {
    var subjectId = "<" + binding.subject.value + ">";
    targetGraph.addLink(targetId, subjectId, {type: predicates.influenced});
    applyDetails(targetGraph.getNode(subjectId), binding);
  }, function() {
    callback(targetGraph);
  });
}

function queryForInfluencedBy1(targetGraph, targetId, callback) {
  queryForRelationship("?subject", predicates.influencedBy, targetId, function (binding) {
    var subjectId = "<" + binding.subject.value + ">";
    targetGraph.addLink(targetId, subjectId, {type: predicates.influenced});
    applyDetails(targetGraph.getNode(subjectId), binding);
  }, function() {
    callback(targetGraph);
  });
}

function queryForInfluencedBy2(targetGraph, targetId, callback) {
  queryForRelationship(targetId, predicates.influencedBy, "?subject", function (binding) {
    var subjectId = "<" + binding.subject.value + ">";
    targetGraph.addLink(subjectId, targetId, {type: predicates.influenced});
    applyDetails(targetGraph.getNode(subjectId), binding);
  }, function() {
    callback(targetGraph);
  });
}

function queryForRelationship(subject, predicate, object, bind, callback) {
  var parameters = {
    subject: subject,
    predicate: predicate,
    object: object,
  };
  sparqlQuery(query_relationship_details, parameters, function(data) {
    if (data !== undefined) {
      data.results.bindings.forEach(bind);
    }
    callback();
  });
}

function applyDetails(node, binding) {
  personalDetails.forEach(function(detail) {
    node.setProperty(detail.name, binding[detail.name] !== undefined
                     ? binding[detail.name].value 
                     : undefined);
  });
}

function queryAllDetails(personNodes, callback) {

  if (personNodes.length == 0) {
    callback();
  }
  else {
    queryDetails(personNodes.shift(), function() {
      queryAllDetails(personNodes, callback);
    });
  }
}

function queryDetails(personNode, callback) {
  sparqlQuery(query_details, {target: personNode.getId()}, function(details) {
    if (details !== undefined) {
      if (details.results.bindings.length > 0) {
        var detailsBinding = details.results.bindings[0];
        details.head.vars.forEach(function(key) {
          if (detailsBinding[key] !== undefined)
            personNode.setProperty(key, detailsBinding[key].value);
        });
      }
    }
    callback();
  });
}
