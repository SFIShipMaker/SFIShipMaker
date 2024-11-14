//Setting up global variables 
var default_config = {
    "sort":["name"],
    "sort_high_to_low":[false],
	"races":[],
    "day":new Date().getDOY(),
}
if(constants.races.length>2){
	for(var i = 2; i<constants.races.length; i++){
		default_config.races[i-2] = i;
	}
}
var configs = {};
var config = {};
//copies the default config to the current config
function restoreConfigToDefault(){
    config = $.extend(true,{},default_config);
}
restoreConfigToDefault();
var weaponData = {};
var weaponRanges = {};
var weaponVariants = [];
var craftables = {};
var galaxyData = {};

//creates a list of "extensions" which are table headers whose key data starts with a % or #.
function compileExtensions(){
    let extensions = [];
	var headers = $("#main_table thead tr th");
    for(var header of headers){
        header = $(header);
        var key = header.data("key");
        if(key.startsWith("%")||key.startsWith("#")||key.startsWith("@")){
            extensions.push(key);
        }
    }
    return extensions;
}
function insertTrades(weaponData, day){
	for(var system in galaxyData){
		let systemData = galaxyData[system];
		
		for(var i = 0; i < systemData.sectors.length; i++){
			var columns = systemData.sectors[i].columns;
			for(var j = 0; j < columns.length; j++){
				
				var sectorObject = columns[j];
				let type = constants.lookup.sectorType[sectorObject.type]
				
				if(type == "Storbital"){
					let systemID = systemData.id;
					let offset = -systemID - day;
					for(var race of constants.races){
						for(let k = 0; k< race.bossLootDrops.length; k++){
							let itemData = weaponData[race.bossLootDrops[k]];
							
							let index = (((offset + k) % race.bossLootDrops.length) + race.bossLootDrops.length) % race.bossLootDrops.length;
							let item = weaponData[race.bossLootDrops[index]];
							
							if(!item){
								console.log(index);
								console.log(race.bossLootDrops[index]);
							}
							else
							{
								itemData.swapSectorsFrom = itemData.swapSectorsFrom || {};
								itemData.swapSectorsFrom[sectorObject.name] = item.id;
								
								item.swapSectorsFor = item.swapSectorsFor || {};
								item.swapSectorsFor[sectorObject.name] = itemData.id;
							}
						}
					}
				}
			}
		}
	}
}
//populates the table 
function repopulateTable(data){
    saveConfigToQuery();
	insertTrades(data,config.day);
    var extensions = compileExtensions();
    var filteredSortedData = sortData(filterData(extendData(extensions,data)));
    var headers = $("#main_table thead tr th");
    var tableBody = $("#main_table").find("tbody");
    tableBody.empty();
	
	var array = new Array();
    for(var key of filteredSortedData){
        //var row = document.createElement("tr");
		var wep = key[1];
		array[array.length] = "<tr>";
        
        headers.each(function(){
            array[array.length] = createTableData(wep,this);
        });
        array[array.length] = "</tr>";
        //tableBody.append($(row));
    }
	tableBody.html(array.join(""));
}
/*populates an individual cell of the table with data (does not place said cell into the html though)
    Uses the data- attribute of the provided header to pull/generate a value from the weapon object. 
*/
function createTableData(wep, header){
    var key = $(header).data("key")
    var value = "";
    
    value = wep[key];
    if(!isNaN(parseInt(value)) && "" != value){
        value = Math.round(value*1000)/1000;
    }
        
    //var td = document.createElement("td");
    if($(header).data("scroll")){
        value = "<div class=scroll-cell>"+value+"</div>"
    }
    //td.innerHTML = value;
    return "<td>"+value+"</td>";
}
function customExtension(weapon, extension){
	if(extension in weapon){
	//	return weapon[extension];
	}
	let list = {};
	switch(extension){
		case "@fromList":
			list = weapon.swapSectorsFrom || {};
			break;
		case "@forList":
			list = weapon.swapSectorsFor || {};
			break;
	}
	let val = [];
	for(let sector in list){
		let weaponSwap = weaponData[list[sector]];
		val[val.length] = '<abbr title="' + sector + " " + weaponSwap.name + '">';
		val[val.length] = calcExtension(weaponSwap, "#icon");
		val[val.length] = '</abbr>';
	}
	return weapon[extension] = val.join("");
}

//Filters the weapon data based off of the config object.
function filterData(data){
    var filtered_data = $.extend(true,{},data);
    for(var key in filtered_data){
        if(!config.races.includes(filtered_data[key].race)){
            delete filtered_data[key];
        }
    }
    return filtered_data;
}


//Sorts the weapon object dictionary based off of the config object. Takes and ordinary object and returns an ordered map.
function sortData(data){
    var pairs = []
    for(var key in data){
        pairs.push([key,data[key]]);
    }
    pairs.sort(function(wep1, wep2){
        return compareViaConfig(wep1[1],wep2[1],0);
    });
    var sorted_data = new Map(pairs);
    return sorted_data;
}
/*A recursive function that takes two weapon objects and an index, and compares them using the field in the config objects sort array
that corresponds to the index. If the values are equal it increments the index and calls itself.*/ 
function compareViaConfig(wep1, wep2, index){
    if(index>=config.sort.length){
        return 0;
    }
    var key = config.sort[index];
    var backwards = config.sort_high_to_low[index];
    var val = 0;
    if(wep1[key]==wep2[key]){
        return compareViaConfig(wep1, wep2, index+1);
    }
    else if(wep1[key]>wep2[key]){
        val = 1;
    }
    else{
        val = -1
    }
    return val*(backwards?-1:1);
}
function updateDay(){
    if($(this).val()>366){
        $(this).val(366);
    }
    else if($(this).val()<1){
        $(this).val(1);
    }
    config.day=$(this).val();
    repopulateTable(weaponData);
}
//manages user inputs for race buttons.
function updateRace(){
    var index = $(this).data("index")
    var checked = $(this).prop("checked");
    
    if(checked){
        config.races.push(index);
    }
    else{
        if(config.races.length == 1){
            $(this).prop("checked",true);
            return;
        }
        config.races.remove(index);
    }
    
    repopulateTable(weaponData);
}
function updateRaceSingle(){
    var index = $(this).data("index")
    
    config.races = [index];
	$(".races-container input").prop("checked",false);
    $(this).prop("checked",true);
    
    repopulateTable(weaponData);
}


//creates checkboxes for each race.
function populateRaceButtons(){
    
    for(var i = 2; i<constants.races.length; i++){
        var race = constants.races[i];
        if(typeof(race)=="undefined"){
            continue;
        }
        var div = $("<div></div>");
        var label = $('<label for="race_'+race.name+'"></label>').text(race.name);
        var input = $('<input id="race_'+race.name+'" type="checkbox" data-index="'+i+'">');
        
        div.append(input,label);
        $(".races-container").append(div);
    }
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
    repopulateTable(weaponData);
}
//synchs the ui with the config by changing the value of ui elements to match the config.
function synchronizeConfig(){

    
    $("#day_of_year").val(config.day);
    $(".races-container input").each(function(){
        var input = $(this);
        if(config.races.includes(input.data("index"))){
            input.prop("checked", true);
        }
        else{
            input.prop("checked", false);
        }
    });
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
    repopulateTable(weaponData);
}
getJsonP("weapons");
getJsonP("ranges");
getJsonP("craftable");
getJsonP("variant_ranges");
getJsonP("systems");

//Once the dom has loaded, load the weapondata info via json-p.
$(document).ready(function(){
    //config.need_buyable = $("#need_buyable").prop("checked");
    populateRaceButtons();
    addSortingButtons();
    var query = getQuerys();
    if(!$.isEmptyObject(query)){
        for(var item in query){
            if(item in config){
                config[item] = JSON.parse(query[item]);
            }
        }
        if(query.table){
            currentTable = query.table;
        }
    }
    synchronizeConfig();
    galaxyData = constants.systems;
    weaponData = constants.weapons
	weaponRanges = constants.ranges;
    weaponVariants = constants.variant_ranges;
	craftables = constants.craftable;
	//found in common.js
	linkRangesAndSubWeapons(weaponRanges,weaponVariants,weaponData);
	//found in common.js
	linkCraftables(craftables,weaponData);
	//found in common.js
	fixEngines(weaponRanges,weaponData);
    repopulateTable(weaponData);
    
    $(document).on("input","#day_of_year",updateDay);
    $(document).on("input",".races-container input",updateRace);
    $(document).on("dblclick",".races-container input",updateRaceSingle);
    $(document).on("click",".sorter",doSort);
    //prevent the user from inputing invalid characters into number type inputs.
    $(document).on('keydown', 'input[type=number]', function(e) {
      if(e.key.match(/[0-9]|(Backspace)/)){
        return true;
      }
      return false;
    });
    
   
})
