//Setting up global variables 
var default_config = {
    "sort":["system"],
    "sort_high_to_low":[false],
}
var config = {}
//copies the default config to the current config
function restoreConfigToDefault(){
    config = $.extend(true,{},default_config);
}
restoreConfigToDefault();
var galaxyData = {};
var sectorData = {};
var miningData = {};
var mineralNames = [];
function checkData(){
	
	var query = getQuerys();
	var headerRow = $("#main thead tr");
	for(var mineralName in miningData){
		var mineral = miningData[mineralName];
		if(mineral.level == 0 && !mineral.isRare){
			var header = $('<th class = "sorter" data-key="##'+mineral.name+'"></th>');
			header.html(mineral.name);
			headerRow.append(header);
			
			var header = $('<th class = "sorter" data-key="#'+mineral.name+'"></th>');
			header.html(mineral.name + ' (%)');
			headerRow.append(header);
		}
	}

	addSortingButtons();
	if(!$.isEmptyObject(query)){
		for(var item in query){
			if(item in config){
				config[item] = JSON.parse(query[item]);
			}
		}
		synchronizeConfig();
	}
	
	for(var key in galaxyData){
		var system = galaxyData[key];
		for(var i = 0; i < system.sectors.length; i++){
			var columns = system.sectors[i].columns;
			for(var j = 0; j < columns.length; j++){
				var sector = {...columns[j], requiredLevel: system.requiredLevel, system: system.name, system_id: key};
				if(!("mineralDensities" in sector)){
					var extraAsteroids = false;
					if(getSectorType(sector.type) != "Empty"){
						if(getSectorType(sector.type) == "Asteroids"){
							extraAsteroids = true;
						}
					}
					var num = (3+10)/2;
					if(extraAsteroids){
						num = (25+45)/2;
						sectorData[columns[j].name] ||= sector;
					}
					else{
						continue;
					}
					sector.mineralDensities = getMinerals(i, j, num, key);
					for(var mineralName in miningData){
						sector.mineralDensities[miningData[mineralName].name] ||= {percent:0, amount:0};
					}
				}
			}
		}
	}
	repopulateTable(sectorData);

}
function getSectorType(id){
	return constants.lookup.sectorType[id];
}


function getMinerals(x, y, asteroids, system){
	
    var systemObj = galaxyData[system];
	var rates = {};
	var remainder = 1;
	var value = 0;
	var space = 0;
	for(var spawn of systemObj.mineralSpawns){
		var mineral = miningData[spawn.name.split(" ").join("_")];
		var distance = benRound(distanceToSector(x,y,spawn.location.x,spawn.location.y));
		var density = lerp(mineral.density, 0, distance / mineral.spawnRange);
		if(density){
			if(!(spawn.name in rates)){
				rates[spawn.name] = 0;
			}
			var add = remainder * density;
			remainder -= add;
			rates[spawn.name] += add;
		}
	}
	rates["Nickel"] = (rates["Nickel"] || 0) + remainder;
	
	var mineralRates = Object.entries(rates).sort(function(a,b){return b[1]-a[1]});
	var mineralAmounts = {};
	for(mineral of mineralRates){
		var mineralObj = miningData[mineral[0].split(" ").join("_")];
		//           % with mineral      
		mineral[2] =  mineral[1]  *  asteroids  *  getAverageYield(mineralObj.scarcity);
		mineralAmounts[mineral[0]] = {
			percent	: mineral[1],
			amount	: mineral[2]
		};
	}
	return mineralAmounts;
}
//populates the table 
function repopulateTable(data){
    saveConfigToQuery();
    var filteredSortedData = sortData(filterData(data));

    var headers = $("#main thead tr th");
    var tableBody = $("#main").find("tbody");
    tableBody.empty();
    for(var key of filteredSortedData){
        var row = document.createElement("tr");
        var system = key[1];
		row.dataset.system = key[1].system_id;
		
        headers.each(function(){
            row.appendChild(createTableData(system,this));
        });
        tableBody.append($(row));
    }
}
/*populates an individual cell of the table with data (does not place said cell into the html though)
    Uses the data- attribute of the provided header to pull/generate a value from the ship object. 
*/
function createTableData(system, header){
    var key = $(header).data("key")
    var value = "";
	if(key.startsWith("%")){
		switch(key){
			case "%averageDark":
				value = 5 * (1 + 1 * 0.6) / system["averageCharge"];
		}
	}
	else if(key.startsWith("#")){
		var mineral = key.substring(1,key.length);
		var raw = false;
		if(mineral.startsWith('#')){
			mineral = mineral.substring(1,mineral.length);
			value = system.mineralDensities[mineral].amount;
		}
		else{
			value = system.mineralDensities[mineral].percent * 100;
		}
	}
	else{
		value = system[key];
	}
	if(!isNaN(parseFloat(value)) && "" != value){
		value = Math.round(parseFloat(value)*100)/100;
	}
	
    
    var td = document.createElement("td");
    if($(header).data("scroll")){
        value = "<div class=scroll-cell>"+value+"</div>"
    }
    td.innerHTML = value;
    return td;
}
//Filters the ship data based off of the config object.
function filterData(data){
    var filtered_data = $.extend(true,{},data);
    for(var key in filtered_data){
        if(config.max_level<filtered_data[key].requiredLevel){
            delete filtered_data[key];
        }
    }
    return filtered_data;
}
//Sorts the ship object dictionary based off of the config object. Takes and ordinary object and returns an ordered map.
function sortData(data){
    var pairs = []
    for(var key in data){
        pairs.push([key,data[key]]);
    }
    pairs.sort(function(ship1, ship2){
        return compareViaConfig(ship1[1],ship2[1],0);
    });
    var sorted_data = new Map(pairs);
    return sorted_data;
}
/*A recursive function that takes two ship objects and an index, and compares them using the field in the config objects sort array
that corresponds to the index. If the values are equal it increments the index and calls itself.*/ 
function compareViaConfig(ship1, ship2, index){
    if(index>=config.sort.length){
        return 0;
    }
    var key = config.sort[index];

    var backwards = config.sort_high_to_low[index];
    var val = 0;
	if(key.startsWith("#")){
		var mineral = key.substring(1,key.length);
		var raw = false;
		var first, second;
		if(mineral.startsWith('#')){
			mineral = mineral.substring(1,mineral.length);
			first = ship1.mineralDensities[mineral].amount;
			second = ship2.mineralDensities[mineral].amount;
		}
		else{
			first = ship1.mineralDensities[mineral].percent;
			second = ship2.mineralDensities[mineral].percent;
		}
		if(first==second){
			return compareViaConfig(ship1, ship2, index+1);
		}
		else if(first>second){
			val = 1;
		}
		else{
			val = -1
		}
	}
	else{
		if(ship1[key]==ship2[key]){
			return compareViaConfig(ship1, ship2, index+1);
		}
		else if(ship1[key]>ship2[key]){
			val = 1;
		}
		else{
			val = -1
		}
	}
    return val*(backwards?-1:1);
}

//makes the sorting arrows match the sorting status of their collumn 
function synchronizeSortingButtons(){
    $(".sorter").each(function(){
        var key = $(this).data("key");
        if(config.sort.includes(key)){
            var index = config.sort.indexOf(key);
            var reverse = config.sort_high_to_low[index];
            if(reverse){
                $(this).children(".sort-arrow").html(repeatString("&uarr;",index+1));
            }
            else
            {
                $(this).children(".sort-arrow").html(repeatString("&darr;",index+1));
            }
        }
        else{
            $(this).children(".sort-arrow").html("&varr;");
        }
    });
}
//Adds span elements to each sorter header containing an arrow indicating if its sorting the data or not. and which way.
function addSortingButtons(){
    
    var span = $("<span class=sort-arrow></span>");
    $(".sorter").append(span);
    synchronizeSortingButtons()
}
//Changes the sorting order of the ships based on the the headed clicked. Also updates the headers UI to reflect the new order.
function doSort(){
    var key = $(this).data("key");
    if(config.sort.includes(key)){
        var reverse = config.sort_high_to_low[config.sort.indexOf(key)];
        if(reverse){
            while(config.sort.includes(key)){
               var index = config.sort.indexOf(key)
               config.sort.splice(index,1);
               config.sort_high_to_low.splice(index,1);
            }
        }
        else
        {
            var index = config.sort.indexOf(key)
            config.sort_high_to_low[index]=true;
        }
    }
    else
    {
        config.sort.unshift(key);
        config.sort_high_to_low.unshift(false);
    }
    synchronizeSortingButtons();
    repopulateTable(sectorData);
}
//synchs the ui with the config by changing the value of ui elements to match the config.
function synchronizeConfig(){

    $("#max_level").val(config.max_level);
    synchronizeSortingButtons();
}
//puts the config in the query. This allows users to sort and filter a page and then send it to other users (once the page is hosted) and have them see the same thing.
function saveConfigToQuery(){
    var query = {};
    for(line in config){
        query[line] = JSON.stringify(config[line]);
    }
    setQuerys(query);
}

function resetConfig(){
    restoreConfigToDefault();
    synchronizeConfig();
    repopulateTable(sectorData);
}
//Opens the ship builder in a new tab
function goToSystem(){
	var system = $(this).attr("data-system");
	var locationString = location.href;
	locationString = locationString.substring(0, locationString.lastIndexOf("/"));
	locationString += '/SystemViewer.html?'+"system="+encodeURIComponent(system);
	window.location.href = locationString;
}

getJsonP("systems");
getJsonP("minerals");

//Once the dom has loaded, load the galaxyData info via json-p.
$(document).ready(function(){
	
	galaxyData = constants.systems;
    miningData = constants.minerals;
	for(var mineralName in miningData){
		if(miningData[mineralName].level == 0 && miningData[mineralName].baseID >=0){
			mineralNames[miningData[mineralName].baseID] = mineralName;
		}
	}
	checkData();
    config.max_level = $("#max_level").val();
    synchronizeConfig();
    $(document).on("click",".sorter",doSort);
	$(document).on("click","tbody tr",goToSystem);
    //prevent the user from inputing invalid characters into number type inputs.
    $(document).on('keydown', 'input[type=number]', function(e) {
      if(e.key.match(/[0-9]|(Backspace)/)){
        return true;
      }
      return false;
    });
   
});
