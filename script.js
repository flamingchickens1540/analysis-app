// Team 1540 Analysis App
// Written by Dylan Smith

"use strict";

window.$ = window.jQuery = require("jquery");
const fs = require("fs-extra");
const Fuse = require('fuse.js');

const exec = require("child_process"); // lets us run stuff from terminal
const shell = require("electron").shell; // opens web browsers
const OUR_TEAM = "1540"; // put your team number here!

// Package for alerts
let dialogs_opts = {}
const dialogs = require("dialogs")(dialogs_opts)

// the year of this game
let year = 2020;

// are photos currently visible?
let photos = false;

/********************************************/
/*        LOADING GAME SPECIFIC INFO        */
/********************************************/

// script for the 2020 game
let gameScript = require("./years/2020/game-script.js");

/********************************************/
/*            DETERMINING TEAMS             */
/********************************************/

// finds which teams are at the event using schedule.json
function determineTeams() {
  let matches = Object.keys(schedule);
  // loops through each match
  for (let match_id in matches) {
    let match = schedule[match_id];
    for (let team_id in match) {
      // checks to see if team is already in array
      if (teams.indexOf(match[team_id]) < 0) {
        // adds it to team list
        teams.push(match[team_id]);
      }
    }
  }
}

// actually inserts team into html, called by insertTeams()
function insertTeam(team) {
  // adds it to the team page with NUMBER, NAME, and ENTER BTN
  $(".teams-body").append(`
    <tr>
      <td>` + team + `</td>
      <td>` + team_id_to_name[team] + `</td>
      <td><button name="` + team + `" class="btn btn-success team-btn team` + team + `">Enter &#8594</button></td>
    </tr>
  `);
  // if ENTER BTN is pressed, switch to that team's page
  $(".team" + team).click(function() {
    switchPages("team", team, undefined, 1)
  });
  // this team is fully loaded, prepping sortTable()
  loaded_teams += 1;
}

// inserts teams into Teams page
function insertTeams() {
  // first, check to see if team_id_to_name matches teams
  if (fs.existsSync("./resources/teams.json")) {
    // if there is a teams file, use that to determine team names at the event
    let file = JSON.parse(fs.readFileSync("./resources/teams.json"));
    // if the list of teams we know equal to the keys of the teams.json file
    if (arraysEqual(teams, Object.keys(file))) {
      // put all the info into team_id_to_name
      team_id_to_name = file;
      for (let team_id in teams) {
        let team = teams[team_id];
        // adds them to the "teams page"
        insertTeam(team);
      }
    // if the arrays were not equal, just pull from TBA
    } else {
      insertTeamsWithTBA();
    }
  // if we don't know team names, get them from TBA
  } else {
    insertTeamsWithTBA();
  }
}

/********************************************/
/*           HANDLING DATA FILES            */
/********************************************/

// manifests and data
let manifest_stand = [];
let stand_data = {};
let manifest_pit = [];
let pit_data = {};
let manifest_images = [];
let image_data = {};
let manifest_notes = [];
let notes_data = {};

let prescout_data = {};

// a list of teams, equivalent to Object.keys(team_id_to_name)
let teams = [];
// team numbers to a team name
let team_id_to_name = {}

// number of loaded teams
let loaded_teams = 0;

// loads local stand, pit, notes, and image data
function loadData() {
  // Bluetooth
  loadDeviceData();
  // Manifests
  loadManifests();
  // STAND
  loadStandData();
  // PIT
  loadPitData();
  // IMAGES
  loadImageData();
  // NOTES
  loadNotesData();
  // PRESCOUTING
  loadPrescouting("./resources/prescout.csv");
}

// loads data from data/stand/manifest.json
function loadStandData() {
  // loads through each file in manifest
  for (let data_id in manifest_stand) {
    let file_name = manifest_stand[data_id]; // e.g. m1-r1-1540.json
    if (fs.existsSync("./data/stand/" + file_name)) {
      let data_point = fs.readFileSync("./data/stand/" + file_name);
      // Parses the data
      try {
        data_point = JSON.parse(data_point);
      } catch(e) {
        // if the data point isn't a valid JSON file, moves on
        continue;
      }
      // if no one logged in, we don't want the data point
      if (gameScript.standJSON.getLogin(data_point) == undefined) {
        continue;
      }
      // sets defaults if values are non-existent
      setDefaultsForStand(data_point, file_name);
      // if the file was not created recently enough to actually be for this event, it gets ignored
      if (!isFileForEvent(data_point)) {
        continue;
      }
      let team_name = gameScript.standJSON.getTeamNumber(data_point);
      // if this is first data point recorded for this team
      if (stand_data[team_name] === undefined) { stand_data[team_name] = []; }
      // adds data point to stand_data
      stand_data[team_name].push(data_point);
    }
  }
  // for each team, sorts by match
  for (let team_id in teams) {
    let team = teams[team_id];
    if (stand_data[team] !== undefined) {
      stand_data[team].sort(compareByMatch);
    }
  }
}

// loads data from data/pit/manifest.json
function loadPitData() {
  // loads through each file in manifest
  for (let data_id in manifest_pit) {
    let file_name = manifest_pit[data_id]; // e.g. 1540.json
    if (fs.existsSync("./data/pit/" + file_name)) {
      let data_point = JSON.parse(fs.readFileSync("./data/pit/" + file_name));
      let team_name = gameScript.standJSON.getTeamNumber(data_point);
      // sets defaults if values are non-existent
      setDefaultsForPit(data_point);
      // adds data point to pit_data
      pit_data[team_name] = data_point;
    }
  }
}

// loads data from data/images/manifest.json
function loadImageData() {
  // loads through each link/file in manifest
  for (let data_id in manifest_images) {
    let file_name = manifest_images[data_id]; // e.g. "1540-2.json" or "1540@https://i.imgur.com/2p3NEQB.png"
    // if there is an "@" in the name (i.e. if from the world wide web)
    if (file_name.split("@").length > 1) {
      // splits by "@" symbol, splitting into "1540" and "https://i.imgur.com/2p3NEQB.png"
      let split = file_name.split("@");
      if (image_data[split[0]] === undefined) { image_data[split[0]] = []; }
      image_data[split[0]].push(split[1]);
    // else, it is a local file
    } else if (fs.existsSync("./data/images/" + file_name)) {
      let team_name = file_name.split(".")[0].split("-")[0];
      // if this is first data point recorded for this team
      if (image_data[team_name] === undefined) { image_data[team_name] = []; }
      image_data[team_name].push("./data/images/" + file_name);
    }
  }
}

// loads data from data/notes/manifest.json
function loadNotesData() {
  // loads through each file in manifest
  for (let data_id in manifest_notes) {
    let file_name = manifest_notes[data_id]; // 5-135935359979.json (the second # is just for getting rid of duplicates)
    if (fs.existsSync("./data/notes/" + file_name)) {
      let data_point = JSON.parse(fs.readFileSync("./data/notes/" + file_name));
      let dp_match = data_point["match"];
      // finds what teams are in the data
      for (let team_index in schedule[dp_match]) {
        let team_name = schedule[dp_match][team_index];
        // if this is first data point recorded for this team
        if (notes_data[team_name] === undefined) { notes_data[team_name] = []; }
        notes_data[team_name].push([data_point[team_index.toString()], dp_match]);
      }
    }
  }
}

// loads prescouting data from a csv
function loadPrescouting(path) {
  // confirms file exists
  if (!fs.existsSync(path)) { return; }
  let csv_file = fs.readFileSync(path).toString();
  // splits file be "\n", the new line character
  let prescout_teams = csv_file.split("\n");
  let categories = prescout_teams.splice(0,1)[0].split(",");
  for (let row in prescout_teams) {
    let team_data = prescout_teams[row].split(",");
    let team_num = team_data.splice(0,1)[0];
    let formatted_data = {}
    for (let data_index in team_data) {
      let info = team_data[data_index];
      let cat_title = categories[parseInt(data_index) + 1];
      formatted_data[cat_title] = info;
    }
    prescout_data[team_num] = formatted_data;
  }
}

// sets default values for a stand data file
function setDefaultsForStand(data_point, file_name) {
  // sets default values to unfilled JSON requirements
  traverseScoutKitJSON(defaultStandJSON, function(json, page, page_index, question, question_index) {
    // if the question is not in the JSON
    if (data_point[page][question] === undefined) {
      // it adds the default response
      data_point[page][question] = defaultStandJSON[page][question];
    }
  });
}

// sets default values for a pit data file
function setDefaultsForPit(data_point) {
  // sets default values to unfilled JSON requirements
  traverseScoutKitJSON(defaultPitJSON, function(json, page, page_index, question, question_index) {
    // if the question is not in the JSON
    if (data_point[page][question] === undefined) {
      // it adds the default response
      data_point[page][question] = defaultPitJSON[page][question];
    }
  });
}

// checks if a file is for the current event
function isFileForEvent(json) {
  let json_time = gameScript.standJSON.getTime(json);
  if (json_time === undefined) { return false; }
  json_time = new Date(parseInt(json_time));
  let event_start_time = new Date(comp["start_date"]);
  return event_start_time <= json_time;
}

/********************************************/
/*           HANDLING MISC. FILES           */
/********************************************/

// event information
let comp = {}

// default pit
let defaultPitJSON = {}
// default stand
let defaultStandJSON = {}
// match schedule
let schedule = {};
// scouts on the team
let scouts = {};

// whether or not sensitive_info should be displayed
let sensitive_info = true;

// loads the manifests
function loadManifests() {
  // Loading manifest files
  if (fs.existsSync("./data/stand/manifest.json")) {
    manifest_stand = JSON.parse(fs.readFileSync("./data/stand/manifest.json"));
  };
  if (fs.existsSync("./data/pit/manifest.json")) {
    manifest_pit = JSON.parse(fs.readFileSync("./data/pit/manifest.json"));
  };
  if (fs.existsSync("./data/notes/manifest.json")) {
    manifest_notes = JSON.parse(fs.readFileSync("./data/notes/manifest.json"));
  };
  if (fs.existsSync("./data/images/manifest.json")) {
    manifest_images = JSON.parse(fs.readFileSync("./data/images/manifest.json"));
  };
}

// function that loads the important files (above)
function loadImportantFiles() {
  // Event information
  if (fs.existsSync("./resources/event.json")) {
    comp = JSON.parse(fs.readFileSync("./resources/event.json"));
    if (year != comp["year"]) {
      year = comp["year"];
      gameScript = require("./years/" + year + "/game-script.js");
      // all the values displayed on a team's table
      table_values = gameScript.table_values;
      // all the buttons that appear above the team's table, and the title of each column of their modals
      button_values = gameScript.button_values;
    }
    $("#event-text").text(comp["name"]);
    $("#team-text").text(OUR_TEAM);
  } else {
    // allows user to set team event
    getTeamEvents();
  }
  // Schedule
  if (fs.existsSync("./resources/schedule.json")) {
    schedule = JSON.parse(fs.readFileSync("./resources/schedule.json"));
  } else {
    alert("Please load a valid schedule."); return;
  }
  // Scouts
  if (fs.existsSync("./resources/scouts.json")) {
    scouts = JSON.parse(fs.readFileSync("./resources/scouts.json"));
  } else {
    alert("Please load a valid scouts file."); return;
  }
  // The app functions without the following files
  if (fs.existsSync("./years/" + year + "/default-pit.json")) {
    defaultPitJSON = JSON.parse(fs.readFileSync("./years/" + year + "/default-pit.json"));
  }
  if (fs.existsSync("./years/" + year + "/default-stand.json")) {
    defaultStandJSON = JSON.parse(fs.readFileSync("./years/" + year + "/default-stand.json"));
  }
  // Sensitive info mode
  if (fs.existsSync("./resources/sensitive.txt")) {
    sensitive_info = (fs.readFileSync("./resources/sensitive.txt").toString() == 'true');
  }
  // Initial color for drawing
  if (fs.existsSync("./resources/draw-color.txt")) {
    let color = fs.readFileSync("./resources/draw-color.txt").toString();
    $(".canvas-color").val(color);
  }
}

// exports stand data to CSV
function exportDataToCSV() {
  // an object connecting sheet headers to the data for each header
  const sheet_rules = gameScript.general.exportObjectCSV;
  // all the headers
  let headers = Object.keys(sheet_rules);
  // the text we will export
  let export_sheet = "";
  export_sheet += headers.join(",") + "\n";
  // adds data for each team
  teams.sort();
  for (let team_index in teams) {
    let team = teams[team_index];
    // adds data for each header
    for (let header_index in headers) {
      let header = headers[header_index];
      let team_matches = stand_data[team];
      // the text we add
      let export_text = sheet_rules[header](team_matches)
      export_sheet += export_text + ","
    }
    export_sheet += "\n";
  }
  // save the file
  fs.writeFileSync("./data/export/export.csv", export_sheet);
  alert("export.csv saved!");
}

/********************************************/
/*       GETTING DATA FROM FLASHDRIVE       */
/********************************************/

// which type of file we are uploading via settings
// either data, schedule, or scouts
let searching = undefined;

// loads a schedule or scouts file from a path
function loadFileFromPath(path) {
  if (searching == "scouts") {
    // copies the scouts file over
    let file = fs.readFileSync(path).toString();
    if (isJsonString(file) && file[0] == "{") {
      fs.writeFileSync("./resources/scouts.json", file);
    }
    // copies the schedule file over
  } else if (searching == "schedule") {
    let file = fs.readFileSync(path).toString();
    if (isJsonString(file) && file[0] == "{") {
      fs.writeFileSync("./resources/schedule.json", file);
    }
  }
  // reload that page!
  window.location.reload();
}

function acceptNewFile(old_file, new_file) {
  if (!isFileForEvent(new_file)) { return false; }
  if (!isFileForEvent(old_file)) { return true; }
  let old_time = gameScript.standJSON.getTime(old_file);
  let new_time = gameScript.standJSON.getTime(new_file);
  return new_time > old_time;
}

// loads data from a path and moves it to the "data" folder
function loadDataFromPath(path) {
  // if we are looking for data
  if (searching == "data") {
    // loading stand and pit data
    const types = ["stand", "pit", "notes"];
    // runs the following code for "stand", "pit", and "notes"
    for (let type_id in types) {
      let type = types[type_id];
      // if the manifest exists
      if (fs.existsSync(path + "/" + type + "/manifest.json")) {
        let temp_manifest = fs.readFileSync(path + "/" + type + "/manifest.json").toString();
        // if the manifest is actually in the correct format
        if (isJsonString(temp_manifest) && temp_manifest[0] == "[") {
          temp_manifest = JSON.parse(temp_manifest);
          // loops through each thing in the manifest
          for (let file_id in temp_manifest) {
            let file_name = temp_manifest[file_id];
            // if the file exists
            if (fs.existsSync(path + "/" + type + "/" + file_name)) {
              // the file
              let file = fs.readFileSync(path + "/" + type + "/" + file_name);
              // old existing file
              if (fs.existsSync("./data/" + type + "/" + file_name)) {
                let old_file = JSON.parse(fs.readFileSync("./data/" + type + "/" + file_name));
                // check if the new file is actually newer than the previous file (and if not, don't update)
                if (!acceptNewFile(old_file, file)) { continue; }
              }
              // creates the file locally in the data folder
              fs.writeFileSync("data/" + type + "/" + file_name, file);
              // depending on the type, adds it to a different manifest
              switch (type) {
                case "stand":
                  if (manifest_stand.indexOf(file_name) < 0) {
                    manifest_stand.push(file_name);
                  }
                  break;
                case "pit":
                  if (manifest_pit.indexOf(file_name) < 0) {
                    manifest_pit.push(file_name);
                  }
                  break;
                case "notes":
                  if (manifest_notes.indexOf(file_name) < 0) {
                    manifest_notes.push(file_name);
                  }
                  break;
              }
            }
          }
        }
      }
    }
    // writes new json files
    fs.writeFileSync("./data/stand/manifest.json", JSON.stringify(manifest_stand));
    fs.writeFileSync("./data/pit/manifest.json", JSON.stringify(manifest_pit));
    fs.writeFileSync("./data/notes/manifest.json", JSON.stringify(manifest_notes));
    // reloads the page
    window.location.reload();
  }
}

/********************************************/
/*       GETTING DATA FROM BLUETOOTH        */
/********************************************/

// whether or not bluetooth is presently running
let bluetooth_running = false;
let bluetooth_child = null;

function bluetoothScript() {
  if (bluetooth_running) {
    // stops the code
    try {
      bluetooth_child.kill();
    } catch(err) {
      console.log(err);
    }
    bluetooth_running = false;
    $(".bluetooth-server").text("Start Bluetooth Server");
    $(".bluetooth_display").hide();
  } else {
    // checks to see if MAC is in the platform you are using, as bluetooth doesn't work on MacOS
    // should be fairly futureproof --> https://stackoverflow.com/questions/10527983/best-way-to-detect-mac-os-x-or-windows-computers-with-javascript-or-jquery
    if (navigator.platform.toUpperCase().indexOf('MAC') < 0) {
      // exec.exec returns a child_process
      let bluetooth_child = exec.exec("python './python/bluetooth-server.py'");
      bluetooth_running = true;
      $(".bluetooth-server").text("Stop Bluetooth Server");
      $(".bluetooth_display").show();
    } else {
      alert("Bluetooth does not work on non-Windows devices.");
    }
  }
}

// function sets up device infrastructure
function loadDeviceData() {
  if (fs.existsSync("./data/devices/manifest.json")) {
    let device_manifest = JSON.parse(fs.readFileSync("./data/devices/manifest.json"));
    for (let device_id in device_manifest) {
      let device_name = device_manifest[device_id];
      let data_modes = ["stand", "pit", "notes"]
      // runs the following code for stand, pit, and notes app
      for (let data_mode_id in data_modes) {
        // "stand", "pit", or "notes"
        let data_mode = data_modes[data_mode_id];
        let old_manifest = JSON.parse(fs.readFileSync("./data/" + data_mode + "/manifest.json"));
        // checks for manifest
        if (fs.existsSync("./data/devices/" + device_name + "/" + data_mode + "/manifest.json")) {
          let data_mode_manifest = JSON.parse(fs.readFileSync("./data/devices/" + device_name + "/" + data_mode + "/manifest.json"));
          // decides which data deserve to be put in the main folder
          for (let data_point_id in data_mode_manifest) {
            let data_point = data_mode_manifest[data_point_id];
            // checks if file exists
            if (fs.existsSync("./data/devices/" + device_name + "/" + data_mode + "/" + data_point)) {
              let data_json = JSON.parse(fs.readFileSync("./data/devices/" + device_name + "/" + data_mode + "/" + data_point));
              // checks if file exists in main folder
              if (fs.existsSync("./data/" + data_mode + "/" + data_point)) {
                let old_json = JSON.parse(fs.readFileSync("./data/" + data_mode + "/" + data_point));
                if (acceptNewFile(old_json, data_json)) {
                  fs.writeFileSync("./data/" + data_mode + "/" + data_point, JSON.stringify(data_json));
                }
              } else {
                if (isFileForEvent(data_json)) {
                  fs.writeFileSync("./data/" + data_mode + "/" + data_point, JSON.stringify(data_json));
                  old_manifest.push(data_point);
                }
              }
            }
          }
        }
        fs.writeFileSync("./data/" + data_mode + "/manifest.json", JSON.stringify(old_manifest));
      }
    }
  }
}

// starts a thread that checks for new files in the data folder
// creates a "New Data" button in top-left when it notices new valid files
fs.watch("./data", { encoding: 'buffer', recursive: true }, (eventType, filename) => {
  // this catches all files that don't have a time logged, which includes all non-JSON files and manifest.json
  try {
    sleep(10000);
    let file = JSON.parse(fs.readFileSync("./data/" + filename));
    if ("time" in file["info"]) {
      $(".new-bluetooth-files").show();
    }
  } catch(err) { }
});

/********************************************/
/*          GETTING DATA FROM TBA           */
/********************************************/

// how many teams have we gotten images from yet
let loaded_images_from_tba = 0;

// TBA setup
const TbaApiV3client = require('tba-api-v3client');
const defaultClient = TbaApiV3client.ApiClient.instance;
const apiKey = defaultClient.authentications['apiKey'];
apiKey.apiKey = JSON.parse(fs.readFileSync("./resources/keys.json"))["tba-api-key"];
const team_api = new TbaApiV3client.TeamApi();
const event_api = new TbaApiV3client.EventApi();

// loads photos from TBA for a given team, inspired by 2521's Robot Scouter
function loadMediaFromTBA(team) {
  if (image_data[team] === undefined) { image_data[team] = []; }
  // gets images for a team for a given year
  team_api.getTeamMediaByYear("frc" + team, year, {}, function(error, data, response) {
    if (error) {
      loaded_images_from_tba += 1;
      console.error(error);
    } else {
      for (let img in data) {
        let key = data[img]["foreign_key"];
        let src = undefined;
        switch (data[img]["type"]) {
          case "imgur":
            src = "https://i.imgur.com/" + key + ".png";
            break;
          case "instagram-image":
            src = "https://www.instagram.com/p/" + key + "/media";
            break;
          // no longer works with new ChiefDelphi layout, will be updated later
          // case "cdphotothread":
          //   src = "https://www.chiefdelphi.com/media/img/" + data[img]["details"]["image_partial"];
        }
        // adding it to the manifest and image_data
        if (src !== undefined) {
          if (manifest_images.indexOf(team + "@" + src) < 0) {
            manifest_images.push(team + "@" + src);
          }
          image_data[team].push(src);
        }
      }
      loaded_images_from_tba += 1;
    }
  });
}

// called by insertTeams(), gets list of teams with names from thebluealliance
function insertTeamsWithTBA() {
  for (let team_id in teams) { // for each team
    let team = teams[team_id];
    // gets team name via TBA call
    team_api.getTeam("frc" + team, {}, function(error, data, response) {
      if (error) {
        console.error(error);
      } else {
        team_id_to_name[team] = data["nickname"];
        // inserts team information into the "teams" page
        insertTeam(team);
      }
    });
  }
}

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

// gets all events for OUR_TEAM
function getTeamEvents() {
  dialogs.prompt("What year is it?", function(target_year) {
    event_api.getTeamEventsByYear("frc" + OUR_TEAM, target_year, {}, function(error, data, response) {
      if (error) {
        console.error(error);
      } else {
        dialogs.alert("Select 'OK' for the event you want to switch to.", function() {
          // adds "test" as a possible
          data.push({
            "name": "Test Event",
            "key": "test",
            "year": target_year,
            "start_date": target_year + "-01-01T00:00:00.000Z"
          });
          // a recursive function that finds the correct event
          selectEvent(data, 0);
        });
      }
    });
  });
}

function checkForPreviousEventData(new_event) {
  fs.removeSync("./data");
  let new_year = new_event["year"];
  let new_name = new_event["name"]
  if (fs.existsSync("./years/" + new_year + "/data-storage/" + new_name)) {
    fs.copySync("./years/" + new_year + "/data-storage/" + new_name, "./data");
  } else {
    fs.copySync("./data-empty", "./data");
  }
}

// sees if user wants to select this event
function selectEvent(events, event_id) {
  let teamEvent = events[event_id];
  dialogs.confirm(teamEvent["name"] + " (" + teamEvent["key"] + ")", function(ok) {
    if (ok) {
      dialogs.alert("Switching to: " + teamEvent["key"]);
      // saves event file
      fs.writeFileSync("./resources/event.json", JSON.stringify(teamEvent));

      if (fs.existsSync("./years/" + year + "/data-storage/" + comp["name"])) {
        dialogs.confirm("Do you want to override the folder for the previous game?", function(override) {
          if (ok) {
            fs.removeSync("./years/" + year + "/data-storage/" + comp["name"]);
            fs.copySync("./data", "./years/" + year + "/data-storage/" + comp["name"]);
          }
          checkForPreviousEventData(teamEvent);
          window.location.reload();
        });
      } else {
        fs.removeSync("./years/" + year + "/data-storage/" + comp["name"]);
        fs.copySync("./data", "./years/" + year + "/data-storage/" + comp["name"]);
        checkForPreviousEventData(teamEvent);
        // reloads page
        window.location.reload();
      }
    } else {
      if (event_id != (events.length - 1)) {
        selectEvent(events, event_id + 1);
      } else {
        dialogs.alert("No event selected.");
      }
    }
  });
}

/********************************************/
/*           GETTING ROBOT IMAGES           */
/********************************************/

// gets images for all robots
function getImages() {
  alert("Page will reload once images are finished loading");
  // runs photos-from-email.py, which collects images from Gmail
  exec.execSync("python './python/photos-from-email.py'");
  loaded_images_from_tba = 0;
  // for each team, loads media
  for (let team_id in teams) {
    loadMediaFromTBA(teams[team_id]);
  }
  // gets local files
  let local_dir = fs.readdirSync("./data/images/");
  for (let team_id in local_dir) {
    try {
      let file = local_dir[team_id];
      if (manifest_images.indexOf(file) < 0) {
        manifest_images.push(file);
      }
    } catch (_) {}
  }
  // checks to see if all images are loaded, and saves a manifest if true
  window.setInterval(saveImageManifest, 3000);
}

// saves a manifest.json after loading images
function saveImageManifest() {
  // checks to see if data from all teams have been collected
  if (loaded_images_from_tba == teams.length) {
    fs.writeFileSync("data/images/manifest.json", JSON.stringify(manifest_images));
    // reloads the page afterwards
    window.location.reload();
  }
}

/********************************************/
/*              PAGE HISTORY                */
/********************************************/

// current page user is on
let current_page = "home"
// if on a "team" or "match" page, which team is selected
let selected_team = undefined;
// match number, found on drawing and summary pages
let selected_match = "1";

// an array of arrays, representing a stack of all previous pages
// inner arrays are ["page", "team", "match"]
let history = []

// this function changes the page when a button is selected
// team is the selected_team of that page
// direction is positive if we are going forward through history
function switchPages(new_page, team, match, direction) {
  window.scrollTo(0, 0); // sets the page scroll to its initial state
  $(".page").hide(); // hides all pages, but will show them again later in function
  $("#" + new_page).show(); // shows new page
  if (direction > 0) { history.push([current_page, selected_team, selected_match]); } // adds page to history if needed
  current_page = new_page;
  selected_team = team;
  // showing/hiding the home/back buttons
  if (history.length == 0) { $(".back").hide(); }
  else { $(".back").show(); }
  if (current_page == "home") { $(".go-to-home").hide(); }
  else { $(".go-to-home").show(); }
  // Page specifics
  if (current_page == "team") {
    $(".team-title").text(team + " - " + team_id_to_name[team]);
    addData();
    addSummaryRankingsToTeamPage(team);
  }
  if (current_page == "drawing") {
    if (match === undefined) { changeCanvasMatch("1"); }
    else { changeCanvasMatch(match); }
  }
  if (current_page == "matches") {
    displayMatchesForTeam(selected_team);
    if (selected_team !== undefined) { $(".matches-team-display").text("Team " + selected_team); }
    else { $(".matches-team-display").text("All Teams"); }
  } else { $(".match-col").html(""); }
  if (current_page == "match-summary") {
    displayMatchSummary(match);
  }
}

/********************************************/
/*                TEAM PAGE                 */
/********************************************/

// all the values displayed on a team's table
let table_values = gameScript.table_values;

// all the buttons that appear above the team's table, and the title of each column of their modals
let button_values = gameScript.button_values;

// resets the data in the team page
function resetTeamPage() {
  // erases all previous table data
  $("#indv-team-body").html("");
  // erases all images
  $("#team-image-div").html("");
  $(".carousel-inner").html("");
  $(".carousel-indicators").html("");
  // erases all previous modal data
  let button_values_keys = Object.keys(button_values);
  for (let btn in button_values_keys) {
    let btn_title = button_values_keys[btn];
    $(".tbody-" + btn_title).html("");
  }
  // erases pit data
  $(".tbody-pit").html("");
  $(".tbody-pre").html("");
}

// sets up team pages for data
function setupData() {
  // adding all the columns to the team table
  for (let value in table_values) {
    $("#indv-team-tr").append(`
      <th>` + capitalize(table_values[value]) + `</th>
    `);
  }
  $("#indv-team-tr").append(`
    <th>Score</th>
    <th>Notes</th>
    <th>Data</th>
  `);
  // creating all the buttons above the tables
  let button_values_keys = Object.keys(button_values);
  for (let btn in button_values_keys) {
    createButton(button_values_keys[btn], button_values_keys[btn], button_values[button_values_keys[btn]], "btn-lg btn-primary", "#team-button-div");
  }
  // creates pit data button
  createButton("pit", "Pit Data", ["question", "answer"], "btn-lg btn-danger", "#team-button-div");
  if (Object.keys(prescout_data).length !== 0) {
    // creates prescout data button
    createButton("pre", "Prescout", ["question", "answer"], "btn-lg btn-purple", "#team-button-div");
  }
  // creates view matches button
  $("#team-button-div").append(`
    <button class="btn btn-lg btn-secondary" onclick="switchPages('matches', selected_team, undefined, 1)">View Matches</button>
  `);
}

// adds data to team page
function addData() {
  // resets all info on the page
  resetTeamPage();
  // adds in images
  addImagesToPage();
  // adds in pit data
  addPitDataToPage();
  // adds in prescout data
  if (Object.keys(prescout_data).length !== 0) {
    addPrescoutDataToPage();
  }
  // adds in stand data
  addStandDataToPage();
  // adding average/mean/max to btn-div (non match-specific)
  addOverallStatsToPage();
  // adds in notes data
  addNotesToPage();
  // view data button functionality
  addDataToViewDataButton();
  // hides sensitive info if applicable
  displaySensitiveInfo();
}


// adds stand data to team page
function addStandDataToPage() {
  // loops through each match
  for (let match_id in stand_data[selected_team]) {
    let match = stand_data[selected_team][match_id];
    let match_number = gameScript.standJSON.getMatchNumber(match);
    // the HTML which will be appended to the <tbody>
    let append_html = `<tr class="team-pg-match" match="` + match_number + `"><td>` + match_number + `</td>`;
    if (gameScript.standJSON.getLogin(match) !== undefined) {
      // adds the scout name to the large table
      append_html += `<td class="scout-td">` + scouts[gameScript.standJSON.getLogin(match)] +`</td>`;
    } else {
      // continue; // if there is no scout, the data is discarded (gasp)
    }
    // for each value that is supposed to appear in the table (see table_values)
    for (let value in table_values) {
      // name of the value in array table_values
      let header = table_values[value];
      // what will be displayed
      let display = match[header];
      // based on specific game details, chooses display for table
      display = gameScript["table_details"][header](match);
      // adds it to the html
      append_html += `<td>` + display + `</td>`;
    }
    // adds score to row
    append_html += `<td>` + gameScript.general.calculateScore(match) + `</td>`;
    // adds notes to row
    append_html += `<td class="sensitive" id="notes-` + selected_team + `-` + gameScript.standJSON.getMatchNumber(match) + `">` + match["Notes"]["Notes"] + `</td>`;
    // creates buttons above table
    let button_values_keys = Object.keys(button_values);
    for (let btn in button_values_keys) {
      let btn_title = button_values_keys[btn];
      // addMatchRowToButton adds game details to the butoon btn_title
      addMatchRowToButton(btn_title, match);
    }
    // where the view button will go
    append_html += `
      <td id="view-data-cell-` + match_id + `"></td>
      </tr>
    `;
    // adds html to body
    $("#indv-team-body").append(append_html);
    // creates view buttons
    createButton("view" + match_id, "&#8594", ["question", "answer"], "btn-success", "#view-data-cell-" + match_id);
  }
  // when you click on the match, you go to the match page
  $(".team-pg-match").click(function() {
    switchPages("match-summary", undefined, $(this).attr("match"), 1);
  });
}

// adds pit data to the team page
function addPitDataToPage() {
  // pit scouting data
  let pit_data_point = pit_data[selected_team];
  // checks to see if pit data point actually exists
  if (pit_data_point !== undefined) {
    // traverses the pit JSON and runs addButtonData() for each question
    traverseScoutKitJSON(pit_data_point, function(json, p, pi, q, qi) {
      // adds the data to the "Pit Data" button
      addButtonData("pit", pi + "-" + qi, [
        // returns the question
        function() {
          return q;
        },
        // returns the response to the question
        function() {
          let answer = json[p][q];
          // instead of showing scout id, it shows scout name
          if (q == "Scout") {
            answer = scouts[answer];
          }
          return answer;
        }
      ]);
    });
  }
}

// adds prescout data to the team page
function addPrescoutDataToPage() {
  // prescouting data
  let prescout_data_point = prescout_data[selected_team];
  // checks to see if prescout data point actually exists
  if (prescout_data_point !== undefined) {
    let questions = Object.keys(prescout_data_point);
    for (let question_index in questions) {
      let question = questions[question_index];
      addButtonData("pre", question_index, [
        // returns the question
        function() {
          return question;
        },
        // returns the response to the question
        function() {
          let answer = prescout_data_point[question];
          return answer;
        }
      ]);
    }
  }
}

// calculates all of one type of score for one team and returns an array, where each match is a different value in the array
// len(array) == num matches played by team
function allScoresForTeam(team, scoreMethod) {
  let team_matches = stand_data[team];
  let scores = [];
  for (let match_index in team_matches) {
    let match = team_matches[match_index];
    scores.push(scoreMethod(match));
  }
  return scores;
}

// adds overall statistics to buttons
function addOverallStatsToPage() {
  // all categories for stats (e.g. ["hatch", "cargo"])
  let categories = Object.keys(gameScript.team_stats_values);
  // calculates scores for all matches
  for (let functionId in categories) {
    // the category name
    let category_name = categories[functionId];
    let pieceFunction = gameScript.team_stats_values[category_name];
    // scores = [1, 5, 3, 2, 3, 3, 2, 4]
    let scores = allScoresForTeam(selected_team, pieceFunction);
    // adds "Mean", "Median", "Maximum", "StDev"
    addButtonOverallStat(category_name, "Mean", jStat.mean(scores));
    addButtonOverallStat(category_name, "Median", jStat.median(scores));
    addButtonOverallStat(category_name, "Maximum", jStat.max(scores));
    addButtonOverallStat(category_name, "StDev", jStat.stdev(scores));
  }
}

// adds summary rankings to the team page
function addSummaryRankingsToTeamPage(team) {
  let summaryText = "";
  let categories = Object.keys(gameScript.summary_values);
  for (let category_id in categories) {
    let category = categories[category_id];
    let calculateScore = gameScript.summary_values[category];
    summaryText += (category + ": <b>" + roundto100th(calculateScore(team)) + "</b> | ");
  }
  $("#team-summary-stats").html(summaryText.slice(0, -3));
}

// adds notes to team page
function addNotesToPage() {
  // for each data_point in this team's notes_data
  for (let data_point_index in notes_data[selected_team]) {
    // data_point is new notes to add
    let data_point = notes_data[selected_team][data_point_index];
    // adds a new line
    $("#notes-" + selected_team + "-" + data_point[1]).prepend('<h4>Stand app:</h4>').append("<br><hr><h4>Notes app:</h4>" + data_point[0]);
  }
}

// adds team images to their team page
function addImagesToPage() {
  // number of indicators the carousel currently has
  let num_carousel_indicators = 0;
  // checks to see if there is actually image data for the team
  if (image_data[selected_team] !== undefined) {
    // if so, loops through each image
    for (let image_id in image_data[selected_team]) {
      // src for the image, either a url or local file
      let src = image_data[selected_team][image_id];
      // adds the image
      $(".carousel-inner").append(`
        <div class="carousel-item item item-` + num_carousel_indicators + `">
          <img class="carousel-image" alt="` + selected_team + `" name="` + image_id + `" src="` + src + `" height="250px" />
        </div>
      `);
      // adds the indicator
      $(".carousel-indicators").append(`
        <li data-target="#myCarousel" data-slide-to="` + num_carousel_indicators + `" class="indicator indicator-` + num_carousel_indicators + `"></li>
      `);
      // if this is the first image added, the indicator and image are active
      if (num_carousel_indicators == 0) {
        $(".indicator-" + num_carousel_indicators).addClass("active");
        $(".item-" + num_carousel_indicators).addClass("active");
      }
      num_carousel_indicators += 1;
    }
  }
}

// adds to data to view data button
function addDataToViewDataButton() {
  // loops through each match selected_team was in
  for (let match_id in stand_data[selected_team]) {
    // match is an object
    let match = stand_data[selected_team][match_id];
    // traverses through each question in match and adds result to View Data Button
    traverseScoutKitJSON(match, function(json, page, page_index, question, question_index) {
      // adds data to the View Data Button
      addButtonData("view" + match_id, question_index + "-" + page_index, [
        // returns the question
        function() {
          return question;
        },
        // returns the answer to the question
        function() {
          let answer = match[page][question];
          // instead of returning scout number, return scout name
          if (match[page][question] == "Login") {
            answer = scouts[answer];
          }
          return answer;
        }
      ]);
    });
  }
}

// creates a data button for the team page, with a table in it
// addButtonData() fills in the table
/*
code - the unique code assigned to the button
title - the name of the button
names - the names of columns
btn_classes - extra classes to be applied to the button (e.g. "btn-lg btn-primary")
loc - where the button will be created
*/
function createButton(code, title, names, btn_classes, loc) {
  $(loc).append(`
    <button class="btn ` + btn_classes + ` btn-press-` + code +  `">` + capitalize(title) + `</button>
    <div style="display:none" class="modal modal-` + code + `">
      <div class="modal-content">
        <button class="btn close close-` + code + `">Close</button>
        <br />
        <table class="table modal-table table-hover">
          <thead>
            <tr class="tr-` + code + `">
            </tr>
          </thead>
          <tbody class="tbody-` + code + `">
          </tbody>
        </table>
        <br />
        <button class="btn close close-` + code + `">Close</button>
      </div>
    </div>
  `);
  // for each column name
  for (let name in names) {
    // create a <th> with the name
    $(".tr-" + code).append(`
      <th>` + capitalize(names[name]) + `</th>
    `);
  }
  // makes it so pressing the button triggers the modal
  $(".btn-press-" + code).click(function() {
    $(".modal-" + code).css("display", "block");
  });
  // you can now close the modal!
  $(".close-" + code).click(function() {
    $(".modal").css("display", "none");
  });
}

// adds team-specific data to button
// code is the unique id for the button
// match is the match number (or a unique code for the row)
// obtainValues is a list of functions which obtain values
function addButtonData(code, match, obtainValues) {
  $(".tbody-" + code).append(`<tr class="tr-` + code + `-` + match + `"></tr>`);
  // extra classes the tds will have
  let added_classes = "";
  // gives notes a sensitive class
  if (obtainValues[0]() == "Notes") {
    added_classes = "sensitive";
  }
  // loops through each value
  for (let f in obtainValues) {
    let value = obtainValues[f]();
    // adds a cell for each column in table, creating a row
    $(`.tr-` + code + `-` + match).append(`
      <td class="` + added_classes +`">` + value + `</td>
    `);
  }
}

// adds a match row to a button on the Team Page given a data file for that match
function addMatchRowToButton(btn_title, data) {
  let match = gameScript.standJSON.getMatchNumber(data);
  $(".tbody-" + btn_title).append(`<tr class="tr-` + btn_title + `-` + match + `"></tr>`);
  // extra classes the tds will have
  let added_classes = "";
  // list of functions to get the value of each cell
  let functions = gameScript.button_details[btn_title];
  // loops through each value
  for (let f in functions) {
    let value = functions[f](data);
    // adds a cell for each column in table, creating a row
    $(`.tr-` + btn_title + `-` + match).append(`
      <td class="` + added_classes +`">` + value + `</td>
    `);
  }
}

// adds an overall stat (e.g. median, maximum) "stat_value" to a div with code "code"
function addButtonOverallStat(code, stat_name, stat_value) {
  // rounds to hundredths
  stat_value = roundto100th(stat_value);
  // if there is not a div for holding the stats yet
  if ($(".tbody-btn-div-" + code).length == 0) {
    // creates a div to hold all overall stats
    $(".tbody-" + code).append(`<div class="tbody-btn-div tbody-btn-div-` + code + `"></div>`)
  }
  // adds stat to div previously added
  $(".tbody-btn-div-" + code).append(`
    <input type="button" class="modal-btn" value="` + stat_name + `: ` + stat_value + `" />
  `);
}

// traverses a JSON file put out by ScoutKit (i.e. pit or stand)
// runs "questionFunction" for each question in app
function traverseScoutKitJSON(json, questionFunction) {
  // keys of the function (e.g. ["Sandstorm", "Teleop", "Endgame"])
  let keys = Object.keys(json);
  // traverse through each page in the keys
  for (let page_index in keys) {
    let page = keys[page_index]; // e.g. "Sandstorm"
    let page_keys = Object.keys(json[page]); // e.g. ["Hatch Low", "Hatch Mid", "Hatch High"]
    for (let question_index in page_keys) {
      let question = page_keys[question_index] // e.g. "Weight", "Hatch Low"
      /* runs questionFunction passing
      json - the json file
      page - the page the question was on
      page_index - the unique index of the page
      question - the question
      question_index - the index of the question (unique to the page, but not the json)
      */
      questionFunction(json, page, page_index, question, question_index);
    }
  }
}

// sortTable() function sorts the teams page table after all teams are loaded
// sorts them by team number
function sortTable() {
  if (loaded_teams < teams.length) {
    window.setTimeout(sortTable, 200);
    return;
  }
  fs.writeFileSync("./resources/teams.json", JSON.stringify(team_id_to_name));
  var table, rows, switching, i, x, y, shouldSwitch;
  table = document.getElementById("teams-table");
  switching = true;
  /* Make a loop that will continue until
  no switching has been done: */
  while (switching) {
    // Start by saying: no switching is done:
    switching = false;
    rows = table.rows;
    /* Loop through all table rows (except the
    first, which contains table headers): */
    for (i = 1; i < (rows.length - 1); i++) {
      // Start by saying there should be no switching:
      shouldSwitch = false;
      /* Get the two elements you want to compare,
      one from current row and one from the next: */
      x = rows[i].getElementsByTagName("TD")[0];
      y = rows[i + 1].getElementsByTagName("TD")[0];
      // Check if the two rows should switch place:
      if (parseInt(x.innerHTML.toLowerCase()) > parseInt(y.innerHTML.toLowerCase())) {
        // If so, mark as a switch and break the loop:
        shouldSwitch = true;
        break;
      }
    }
    if (shouldSwitch) {
      /* If a switch has been marked, make the switch
      and mark that a switch has been done: */
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
    }
  }
}

/********************************************/
/*               SCOUTS PAGE                */
/********************************************/

// adds scout to table if it isn't there yet
function addScoutToTable(scout_name, scout_id) {
  $(".scout-list-table").append(`
    <tr>
      <td>` + scout_name + `</td>
      <td class=matches-` + scout_id + `>1</td>
    </tr>
  `);
}

// puts all of the scouts onto the scouts page
function populateScouts() {
  let stand_keys = Object.keys(stand_data);
  for (let team_id in stand_keys) {
    let team = stand_keys[team_id];
    for (let data_id in stand_data[team]) {
      let data_point = stand_data[team][data_id];
      let scout_id = gameScript.standJSON.getLogin(data_point);
      // is the scout actually real?
      if (scout_id !== undefined && scouts[scout_id] !== undefined) {
        // class already exists
        if ($(".matches-" + scout_id)[0]) {
          let current_total = parseInt($(".matches-" + scout_id).text());
          current_total += 1;
          $(".matches-" + scout_id).text(current_total);
        // class doesn't exist
        } else {
          addScoutToTable(scouts[scout_id], scout_id);
        }
      }
    }
  }
}

/********************************************/
/*              RANKINGS PAGE               */
/********************************************/

// adds a specific team to a table on the ranking page
function addTeamToRankingTable(team_num, score, rank) {
  $("#ranking-row-" + rank).append(`
    <td class="ranking-team-` + team_num + `"><strong>` + team_num + `</strong> (` + roundto100th(score) + `)</td>
  `);
}

// creates a ranking row for the table
function addRankingRow(rank) {
  $(".rankings-table-body").append(`
    <tr id="ranking-row-` + rank + `">
      <td>` + (parseInt(rank) + 1) + `</td>
    </tr>
  `);
}

// creates the ranking table
function addRankingsToPage() {
  // list of column titles
  let categories = Object.keys(gameScript.ranking_values);
  // adds each individual category to the table head
  for (let categoryId in categories) {
    let category_name = categories[categoryId];
    $(".rankings-table-headrow").append(`
      <th>` + category_name + `</th>
    `);
  }
  // creates a row for each team
  for (let team_id in teams) { addRankingRow(team_id); }
  // runs for each ranking from the game-script
  for (let categoryId in categories) {
    let category_name = categories[categoryId];
    // adds a category to the ranking table
    addCategoryToRankings(gameScript.ranking_values[category_name]);
  }
  // makes each team clickable to send them to their respective team pages
  for (let team_id in teams) {
    // each team when pressed switches the page
    $(".ranking-team-" + teams[team_id]).click(function() {
      switchPages("team", teams[team_id], undefined, 1);
    });
  }
}

// adds a category to the rankingTable
function addCategoryToRankings(categoryTest) {
  // an array of arrays of team numbers and scores
  let teamsAndScores = sortTeamsByCategory(categoryTest);
  for (let team_id in teamsAndScores) {
    let data = teamsAndScores[team_id];
    // adds a team to the table given their team name, score, and rank
    addTeamToRankingTable(data[0], data[1], team_id);
  }
}

// sorts all teams by a category
function sortTeamsByCategory(categoryTest) {
  let teamsAndScores = []
  for (let team_id in teams) {
    let team_num = teams[team_id];
    // gets rid of teams without data
    if (Object.keys(stand_data).indexOf(team_num) < 0) { continue; }
    teamsAndScores.push([parseInt(team_num), categoryTest(team_num)]);
  }
  teamsAndScores = teamsAndScores.sort((a, b) => b[1] - a[1]);
  return teamsAndScores;
}

/********************************************/
/*                MATCH PAGE                */
/********************************************/

// link to thebluealliance page for match
let tbaMatchLink = "https://www.thebluealliance.com";

const roles = ["r1", "r2", "r3", "b1", "b2", "b3"];

// loc is the location to add the match to
// team is the selected_team
function createMatch(loc, match_number, team) {
  // html to append to loc
  let append_html = `
    <div style="text-align:center">
      <h3>` + match_number + `</h3>
      <div>`;
  // for each team in the match
  for (let team_index in schedule[match_number.toString()]) {
    // e.g. "1540"
    let displayed_team = schedule[match_number.toString()][team_index];
    // classes for the btn
    let btn_type = "btn-danger";
    // if team_index > 2, they are on the blue alliance, hence btn-primary
    if (team_index > 2) { btn_type = "btn-primary"; }
    // if team is our team, make it a different class
    if (displayed_team == OUR_TEAM) { btn_type += " our-team-btn"; }
    // if team is selected_team, make it green but also display-team-btn
    else if (displayed_team == team) { btn_type = "btn-success display-team-btn"; }
    // that btn is about to be appended!
    append_html += `<button class="btn ` + btn_type + ` match-team-btn match-team-btn-` + match_number + `"><div style="position:relative" class="m` + match_number + `-` + displayed_team + `">` + displayed_team + `</div></button>`;
    // create a new row for the btns for the blue alliance
    if (team_index == 2) { append_html += `</div><div>`; }
  }
  append_html += `</div>
    <button style="margin-top:2px" class="btn btn-light summary-` + match_number + `">Summary</button>
  </div>`;
  // actually adds the html
  $(loc).append(append_html);
  // go to match summaries
  $(".summary-" + match_number).click(function() {
    switchPages("match-summary", undefined, match_number, 1);
  });
  // makes the btn switch pages
  $(".match-team-btn-" + match_number).click(function() {
    switchPages("team", $(this).text(), undefined, 1);
  });
}

// show collected data on buttons
function showCollectedMatches() {
  // loop through teams
  for (let team_index in teams) {
    let team = teams[team_index];
    // loop through stand data
    for (let stand_index in stand_data[team]) {
      let data = stand_data[team][stand_index];
      $(".m" + data["info"]["match"] + "-" + team).append("<span class='match-dot'></span>");
    }
  }
}

// predicts the score of a match
function predictMatch(match_number) {
  let red_alliance = 0;
  let blue_alliance = 0;
  for (let team_index in schedule[match_number.toString()]) {
    let team = schedule[match_number.toString()][team_index];
    // a list of scores
    let scores = allScoresForTeam(team, gameScript.general.calculateScore);
    // mean score
    let mean = roundto100th(jStat.mean(scores));
    // adds it to correct alliance
    if (team_index <= 2) {
      red_alliance += mean;
    } else {
      blue_alliance += mean;
    }
  }
  return [roundto100th(red_alliance), roundto100th(blue_alliance)];
}

// display matches for a team
// if "team" is undefined, all teams will be displayed
function displayMatchesForTeam(team) {
  let matches_to_display = [];
  let schedule_keys = Object.keys(schedule);
  // if team is undefined, go through each match
  if (team === undefined) {
    for (let x in schedule_keys) {
      matches_to_display.push(parseInt(x)+1);
    }
  } else {
    // go through each match
    for (let match_index in schedule_keys) {
      let match_number = schedule_keys[match_index];
      let match = schedule[match_number];
      // checks to see if match contains team
      if (match.indexOf(team) >= 0) {
        matches_to_display.push(match_number);
      }
    }
  }
  // display match for each match in matches_to_display
  for (let match_index in matches_to_display) {
    // ".match-col-"+match_index%3 is where the match will be appended, in one of three columns
    createMatch(".match-col-" + match_index % 3, matches_to_display[match_index], team);
  }
  showCollectedMatches();
}

//sets up all the match summary HTML
function setupMatchSummaryPage() {
  for (let x = 1; x < 4; x += 1) {
    $("#match-summary").append(`<div class="row summary-row summary-row-` + x + `"></div>`);
    $(".summary-row-" + x).html(`
      <div class="col-1"></div>
      <div class="col-5 match-summary-red match-summary-col match-summary-col-r` + x + `"></div>
      <div class="col-5 match-summary-blue match-summary-col match-summary-col-b` + x + `"></div>
      <div class="col-1"></div>
    `);
  }
  for (let role_index in roles) {
    let role = roles[role_index];
    let alliance = role[0] == "r" ? "red":"blue";
    $(".match-summary-col-" + role).append(`
      <h3 class="match-summary-team match-summary-team-` + role + `">Regular Team</h3>
      <div class="match-summary-team-info match-summary-team-info-` + role + `"></div>
      <p class="summary-check match-summary-` + role + `-check">&#10003;</p>
      <div class="summary-image-div"><img class="summary-image summary-image-` + alliance + ` summary-image-` + role + `" /></div>
    `);
  }
}

// displays the summary for a match
function displayMatchSummary(match_number) {
  // sets the global selected match
  selected_match = match_number;
  // tba link!
  if (comp["key"] != "test") {
    tbaMatchLink = "https://www.thebluealliance.com/match/" + comp["key"] + "_qm" + match_number;
  }
  $(".match-number").text("Match " + match_number);
  let match = schedule[match_number];
  let predicted_scores = predictMatch(match_number);
  $(".expected-score").html(`Predicted: <span style="color:red">` + predicted_scores[0] + `</span> - <span style="color:blue">` + predicted_scores[1] + `</span>`);
  // sets team info for each team
  for (let team_index in roles) {
    let role = roles[team_index];
    let team_id = match[team_index];
    let team_name = team_id_to_name[team_id];
    $(".match-summary-col-" + role).attr("team", team_id);
    $(".match-summary-team-" + role).text(team_id + " - " + team_name);
    $(".match-summary-team-info-" + role).html("");
    // list of column titles
    let categories = Object.keys(gameScript.summary_values);
    for (let category_id in categories) {
      let category = categories[category_id];
      let calculateScore = gameScript.summary_values[category];
      $(".match-summary-team-info-" + role).append(`
        <h5>` + category + ` - ` + roundto100th(calculateScore(team_id)) + `</h4>
      `);
    }
    // adds a checkmark if this match data has been collected
    if (team_id in stand_data && stand_data[team_id].find(o => o["info"]["match"] == match_number) !== undefined) {
      $(".match-summary-" + role + "-check").show();
    } else {
      $(".match-summary-" + role + "-check").hide();
    }
    if (image_data[team_id].length >= 0) {
      $(".summary-image-" + role).attr("src", image_data[team_id][0]);
    }
  }
}

/********************************************/
/*                STATISTICS                */
/********************************************/

// statistic library for doing t-tests
const simpleStats = require("simple-statistics");
// general statistics library
const jStat = require("jStat").jStat;

// the data present on the "Statistics" page
let stats_data = {
  "1": {},
  "2": {},
  "teams": 0
}

// sets up the stats table
function setupStatsTable() {
  // e.g. ["score", "hatch", "cargo"]
  let stats_page_values = Object.keys(gameScript.stats_page_values);
  for (let stat_id in stats_page_values) {
    // a parameter is like "hatch" or "cargo"
    let parameter = stats_page_values[stat_id];
    // the mean of the parameter
    stats_data["1"][parameter] = 0;
    stats_data["2"][parameter] = 0;
    // the list of all the data for the parameter
    stats_data["1"][parameter + "_scores"] = [];
    stats_data["2"][parameter + "_scores"] = [];
    // adds it to index.html
    $(".stats-table-body").append(`
      <tr>
        <td>` + parameter + `</td>
        <td class="stats-` + parameter.replace(/\s+/g, '-').toLowerCase() + `-1"></td>
        <td class="stats-` + parameter.replace(/\s+/g, '-').toLowerCase() + `-2"></td>
        <td class="stats-` + parameter.replace(/\s+/g, '-').toLowerCase() + `-result"></td>
      </tr>
    `);
  }
}

// updates the stats table once a new team is inputted
function updateStatsTable(team_number, alignment) {
  // makes sure there is enough data to run a t-test
  if (!(team_number in stand_data) || stand_data[team_number].length <= 1) {
    alert("Not enough data on this team!");
    return false;
  }
  // team previously inputted
  let prev_team = $(".stats-name-" + alignment).text();
  // the name of team_number
  let next_team = team_id_to_name[team_number];
  // checks to confirm that the input is a number, is a number of a team at the event, and is not the previous team inputted
  if (Number.isInteger(parseInt(team_number)) && teams.indexOf(team_number) >= 0 && prev_team != next_team) {
    // no team was previously inputted, thus we should add 1 to the team count
    if (prev_team == "") { stats_data["teams"] += 1; }
    // sets and displays the team's name
    stats_data[alignment]["name"] = next_team;
    $(".stats-name-" + alignment).text(next_team);
    // e.g. ["score", "hatch", "cargo"]
    let stats_page_values = Object.keys(gameScript.stats_page_values);
    for (let stat_id in stats_page_values) {
      // a parameter is like "hatch" or "cargo"
      let parameter = stats_page_values[stat_id];
      // the function that gets called by allScoresForTeam that finds all the data
      let parameter_function = gameScript.stats_page_values[parameter];
      // a list of all the team's scores for said parameter
      let parameter_scores = allScoresForTeam(team_number, parameter_function);
      // in stats_data, sets the team's scores and mean
      stats_data[alignment][parameter + "_scores"] = parameter_scores;
      stats_data[alignment][parameter] = simpleStats.mean(parameter_scores);
      // displays the results
      $(".stats-" + parameter.replace(/\s+/g, '-').toLowerCase() + "-" + alignment).text(roundto100th(stats_data[alignment][parameter]));
      // confirms that there are two teams to compare
      if (stats_data["teams"] == 2) {
        // calculates and displays the p-value for overall, hatch, and cargo
        displayPValue(parameter);
      }
    }
  }
}

// obtains the p-value for the data in stats_data, then diplays it on the "Statistics" page
function displayPValue(parameter) {
  // the p-value from a two sample t-test
  let result = getPValue(stats_data["1"][parameter + "_scores"], stats_data["2"][parameter + "_scores"]);
  // displays it, and gives the cell a background corresponding to the severity of the p-value
  $(".stats-" + parameter.replace(/\s+/g, '-').toLowerCase() + "-result").text(result).css({ background: significanceColor(result) });
}

// does a two sample t test, then uses tcdf() to find the t-value
// takes Honors Statistics with Kenny first to understand this magic
function getPValue(array1, array2) {
  // degrees of freedom
  let df = jStat.min([array1.length - 1, array2.length - 1]);
  // TwoSampleTTest
  let t_val = -Math.abs(simpleStats.tTestTwoSample(array1, array2));
  // tcdf
  let pValue = roundto100th(jStat.studentt.cdf(t_val, df) * 2);
  return pValue;
}

// Determining color based on significance of p-value
function significanceColor(sig) {
  if (sig <= 0.01) {
    return 'red';
  } else if (sig <= 0.05) {
    return 'orange';
  } else if (sig <= 0.1) {
    return 'gold';
  } else if (sig <= 0.2) {
    return 'green';
  } else {
    return '';
  }
}

/********************************************/
/*       Zebra Motion Data Analysis         */
/********************************************/

//Loose and contact defense seem important
//Not so much general and tight
//Comparing loose and contact

json = JSON.parse(json);
const display = document.getElementById("display").getContext("2d");
let heatmap = document.getElementById("heatmap");
let heat = simpleheat(heatmap);

const contactBoundary = 3.5;
const tightBoundary = 6.5;
const looseBoundary = 10;
const generalBoundary = "generalBoundary";

if (json["alliances"]["blue"]["0"]["xs"][0] > 25) {
  document.getElementById("display").style.backgroundImage = "url('fieldFlip.png')";
  document.getElementById("heatmap").style.backgroundImage = "url('fieldFlip.png')";
}

const constant = 10;

class team {
  constructor(object, color, isBlue) {
    this.number = object["team_key"];
    this.x = object["xs"];
    this.y = object["ys"];
    this.color = color;
    this.heatMapData = [];
    for (let i = 0; i < this.y.length; i++) {
      this.heatMapData.push([this.x[i] * constant, this.y[i] * constant, 1])
      // if (this.x[i]<25) {
      //     console.log("Found Point!!!!")
      //     console.log("x: " + this.x[i]);
      //     console.log("y: " + this.y[i]);
      //     console.log("time: " + json["times"][i]);
      // }
    }
    this.isBlue = isBlue;
    if (this.isBlue){
      this.teamVal = 3;
    } else {
      this.teamVal = 0
    }
  }

  drawBound() {
    display.moveTo(this.x[0], this.y[0]);
    display.beginPath();
    for (let i = 1; i < this.y.length; i++) {
      display.lineTo(this.x[i] * constant, this.y[i] * constant)
    }
    display.strokeStyle = this.color;
    display.stroke()
  }

  drawHeat(max) {
    heat.data(this.heatMapData);
    heat.max(max);
    heat.draw();
  }

  drawStart() {
    display.beginPath();
    display.arc(this.x[0] * constant, this.y[0] * constant, 3, 0, 2 * Math.PI, false);
    display.lineWidth = 7;
    display.strokeStyle = "black";
    display.stroke();
    display.beginPath();
    display.arc(this.x[0] * constant, this.y[0] * constant, 5, 0, 2 * Math.PI, false);
    display.lineWidth = 3;
    display.strokeStyle = this.color;
    display.stroke();
  }

  draw() {
    this.drawBound();
    this.drawHeat(18);
    this.drawStart();
  }

  getTotal(boundary) {
    this.contacts = 0;
    if (boundary === generalBoundary) {
      for (let team = this.teamVal; team < this.teamVal + 3; team++) {
        for (let i = 0; i < this.x.length; i++) {
          if (inGeneralBoundary(this, teams[team], i) && !(inGeneralBoundary(this, teams[team], i-1))){
            this.contacts++;
          }
        }
      }
    } else {
      for (let team = this.teamVal; team < this.teamVal + 3; team++) {
        for (let i = 0; i < this.x.length; i++) {
          if (inBoundary(this, teams[team], i, boundary)){
            this.contacts++;
          }
        }
      }
    }
    return this.contacts;
  }

  getPercentage(boundary) {
    this.contacts = 0;
    if (boundary === generalBoundary) {
      for (let i = 0; i < this.x.length; i++) {
        if (this.x[0] < 25){
          if (this.x[i] > 25) {
            this.contacts ++;
            console.log(0);
          }
        }
      }
    } else {
      for (let team = this.teamVal; team < this.teamVal + 3; team++) {
        for (let i = 0; i < this.x.length; i++) {
          if (inBoundary(this, teams[team], i, boundary)){
            this.contacts++;
          }
        }
      }
    }
    return Math.round(this.contacts/this.x.length * 100);
  }


}

function inBoundary(team1, team2, time, distance) {
  return (((team1.x[time] - team2.x[time]) ** 2 + (team1.y[time] - team2.y[time]) ** 2) < distance ** 2);
}

function inGeneralBoundary(team1, team2, time) {
  if (team1.x[0] < 25){
    return ((team1.x[time] < 25) && !(team1.x[time] < 25))
  } else {
    return ((team1.x[time] < 25) && !(team1.x[time] < 25))
  }
}

function getMin(array) {
  let minimum = 1000;
  for (let i = 0; i < array.length; i++) {
    if (array[i] < minimum) {
      minimum = array[i];
    }
  }
  return minimum;
}

function getMax(array) {
  let maximum = 0;
  for (let i = 0; i < array.length; i++) {
    if (array[i] > maximum) {
      maximum = array[i];
    }
  }
  return maximum;
}

let team0 = new team(json["alliances"]["blue"]["0"], "rgb(0,107,112)", true);
let team1 = new team(json["alliances"]["blue"]["1"], "rgb(0,38,112)", true);
let team2 = new team(json["alliances"]["blue"]["2"], "rgb(15,0,112)", true);
let team3 = new team(json["alliances"]["red"]["0"], "rgb(255,72,154)", false);
let team4 = new team(json["alliances"]["red"]["1"], "rgb(255,18,0)", false);
let team5 = new team(json["alliances"]["red"]["2"], "rgb(255,128,0)", false);

let teams = [
  team0,
  team1,
  team2,
  team3,
  team4,
  team5
];



/********************************************/
/*                PICKLISTS                 */
/********************************************/

// current picklists on the picklists page
let picklists = {}

// creates a picklist on the picklist page
function createPicklist() {
  // gets an available picklist index
  let index = findAvailablePicklistID().toString();
  // index will be undefined ONLY IF the maximum picklist limit has been reached (30)
  if (index === undefined) {
    alert("The maximum picklist limit of 30 has been reached!");
    return undefined;
  }
  picklists[index] = [];
  // The code for the picklist
  $(".picklist-container").append(`
    <br class="from-picklist-` + index +`" />
    <div length="0" class="from-picklist-` + index + ` picklist" id="picklist-div-` + index + `">
      <div class="row">
        <div class="col-8">
          <h3 contenteditable="true" class="picklist-content picklist-title" id="picklist-title-` + index + `">Picklist ` + index + `</h3>
        </div>
        <div class="col-2">
          <button class="picklist-content wide-btn btn btn-danger picklist-add-team" id="picklist-add-team-` + index + `">Add Team</button>
        </div>
        <div class="col-2">
          <div class="dropdown">
            <button data-toggle="dropdown" role="button" aria-expanded="false" class="btn btn-dark dropdown-toggle picklist-content wide-btn" type="button">Options</button>
            <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuButton">
              <a class="load-list dropdown-item" id="load-list-` + index + `" href="#">Load Picklist</a>
              <a class="save-list dropdown-item" id="save-list-` + index + `" href="#">Save Picklist </a>
              <a class="delete-list dropdown-item" id="delete-list-` + index + `" href="#">Delete Picklist </a>
            </div>
          </div>
        </div>
      </div>
      <table class="picklist-table picktable-` + index + `" border="0">
        <tbody class="picklist-table-` + index + `">
        </tbody>
      </table>
      <input id="csv-file-loader-` + index + `" hidden type="file" />
    </div>
    <div style="display:none" class="from-picklist-` + index + ` modal modal-picklist-` + index + `">
      <div class="modal-content">
        <input class="modal-input-` + index + `" type="text" value=""/>
        <br />
        <button class="btn close enter enter-picklist-` + index + `">Submit</button>
        <button class="btn close close-picklist-` + index + `">Cancel</button>
      </div>
    </div>
    <div style="display:none" class="from-picklist-` + index + ` modal modal-delete-list-` + index + `">
      <div class="modal-content">
        <h4 class="delete-list-text">Delete List?</h4>
        <br />
        <button class="btn close close-delete close-delete-list-` + index + `">Delete</button>
        <button class="btn close close-picklist-` + index + `">Cancel</button>
      </div>
    </div>
  `);
  // shows the delete list confirmation modal
  // DOES NOT DELETE THE LIST HERE
  $("#delete-list-" + index).click(function() {
    $(".modal-delete-list-" + index).show();
    $(".delete-list-text").text("Delete " + $("#picklist-title-" + index).text() + "?");
  });
  // opens the csv file loader
  $("#load-list-" + index).click(function() {
    $("#csv-file-loader-" + index).trigger("click");
  });
  // loads a picklist after using the file loader
  $("#csv-file-loader-" + index).change(function() {
    let path = document.getElementById("csv-file-loader-" + index).files[0].path;
    loadPicklist(index, path);
  });
  // saves a picklist
  $("#save-list-" + index).click(function() {
    savePicklist(index);
  });
  // opens the team adder modal
  $("#picklist-add-team-" + index).click(function() {
    $(".modal-picklist-" + index).show();
  });
  // deleting a picklist
  $(".close-delete-list-" + index).click(function() {
    deletePicklist(index);
  });
  // adding teams to a picklist
  $(".enter-picklist-" + index).click(function() {
    let team_number = $(".modal-input-" + index).val();
    addTeamToPicklist(index, team_number);
  });
  // selecting cancel to close the modal
  $(".close-picklist-" + index).click(function() {
    $(".modal").css("display", "none");
  });
}

// creates the table of teams in order for the picklist
// index is the picklist index.
// NOTE: this function clears HTML of picklist w/ index
function createPicklistTable(index) {
  // loc is the location (<tbody>) you want to add the table rows to
  let loc = ".picklist-table-" + index;
  // clears html before adding more
  $(loc).html("");
  // gets picklist
  let picklist = picklists[index];
  // goes through each team in order
  for (let team_index in picklist) {
    let team_number = picklist[team_index];
    let team_name = team_id_to_name[team_number];
    // code for the row, with the input box, team name, and delete button
    $(loc).append(`
      <tr>
        <td>
          <input team="` + team_number +`" value="` + (parseInt(team_index) + 1) + `" class="picklist-content picklist-input picklist-input-` + index + `" type="text" />
        </td>
        <td>
          <h5 class="picklist-content">` + team_number + ` - ` + team_name + `</h5>
        </td>
        <td>
          <input team="` + team_number + `" type="button" value="x" class="btn-danger picklist-del-team picklist-del-team-` + index + `"  />
        </td>
      </tr>
    `);
  }
  // deletes the team in question
  $(".picklist-del-team-" + index).click(function() {
    let team_num = $(this).attr("team");
    // deletes team from picklist
    deleteTeamFromPicklist(index, team_num);
  });
  // triggers when enter key is pressed and input is selected
  $('.picklist-input-' + index).keypress(function (e) {
    // keyCode 13 is "enter"
    if (e.keyCode == 13) {
      let input_val = parseInt($(this).val());
      let team_num = $(this).attr("team");
      // moves the team if able in the picklist
      moveTeamInPicklist(index, team_num, input_val);
    }
  });
}

// adds a team to a picklist
function addTeamToPicklist(picklist_index, team_number) {
  // first condition checks that the team is a team at the event
  // second condition checks that the team is not already in the picklist
  if (teams.indexOf(team_number) >= 0 && picklists[picklist_index].indexOf(team_number) < 0) {
    picklists[picklist_index.toString()].push(team_number);
    createPicklistTable(picklist_index);
  }
  // resets the team input box in the modal
  $(".modal-input-" + picklist_index).val("");
  // hides the modal
  $(".modal").css("display", "none");
}

// saves a picklist to data/picklists as a CSV
function savePicklist(picklist_index) {
  let list_name = $("#picklist-title-" + picklist_index).text();
  // uses regex to remove all characters but letters and numbers
  list_name = list_name.replace(/[^A-Za-z0-9]+/g, '');
  // uses regex to replace commas with newlines, then removes brackets
  let save_file = list_name + "\n" + JSON.stringify(picklists[picklist_index]).replace(/"/g, "").replace(/,/g, "\n").slice(1, -1);
  fs.writeFileSync("./data/picklists/" + list_name + ".csv", save_file);
  alert(list_name + ".csv saved!");
}

// loads a picklist onto the picklist page
// path is the path to the picklist csv
function loadPicklist(picklist_index, path) {
  let csv_file = fs.readFileSync(path).toString();
  // splits file be "\n", the new line character
  let picklist_teams = csv_file.split("\n");
  // gets the picklist title from teams
  // splice automatically removes the title from the list of things
  let picklist_title = picklist_teams.splice(0,1)[0];
  $("#picklist-title-" + picklist_index).text(picklist_title);
  // adds it to the picklists object
  picklists[picklist_index] = picklist_teams;
  createPicklistTable(picklist_index);
}

// deletes a picklist with index picklist_index
function deletePicklist(picklist_index) {
  // deletes picklist from object
  delete picklists[picklist_index];
  // deletes the div, modals, and <br>
  $(".from-picklist-" + picklist_index).remove();
  // closes the modal
  $(".modal").css("display", "none");
}

// deletes a team from the picklist with index "picklist_index"
function deleteTeamFromPicklist(picklist_index, team_number) {
  let picklist = picklists[picklist_index];
  // removes the team from the picklist object
  picklist.splice(picklist.indexOf(team_number), 1);
  // recreates the table
  createPicklistTable(picklist_index);
}

// moves team to a new_location in a picklist
function moveTeamInPicklist(picklist_index, team_number, new_location) {
  let picklist = picklists[picklist_index];
  if (Number.isInteger(new_location)) {
    // removes val from picklist
    picklist.splice(picklist.indexOf(team_number), 1);
    // re-adds to picklist, in new location
    picklist.splice(new_location - 1, 0, team_number);
    // recreates the table
    createPicklistTable(picklist_index);
  }
}

// finds a free unused ID for a new picklist div
// maximum of 30 picklists
function findAvailablePicklistID() {
  let index = 0;
  while (index < 30) {
    // checks to see if ID is taken
    if (picklists[index] === undefined) {
      return index;
    }
    index++;
  }
  alert("Maximum picklist capacity reached.");
  return undefined;
}

/********************************************/
/*               DRAWING PAGE               */
/********************************************/

// scale factor
let scaleFactor;

// array of arrays of xs, for each click/drag
// e.g. [[5,3,4], [3], [1,5,7,9,3,6,5,5]]
let xArray = [];
// array of arrays of ys, for each click/drag
let yArray = [];
// array of colors, for each click/drag
let colorArray = [];

// if you are dragging a box, this is the selected one
let selected_box = undefined;
// how far off from the top-left corner you selected the box;
let selected_box_offset = [0, 0];

// positions of all teams
const defaultPositions = [
  [767,156],
  [715,210],
  [767,265],
  [15,157],
  [15,265],
  [70,211]
];
let boxPositions = copyArray(defaultPositions);

// drawing: whether or not you are drawing
// context: what we use to draws
let drawing, context;

// the field image
let field_img = new Image();
field_img.src = './resources/field.png';

// resets EVERYTHING
function reset_canvas() {
  xArray = [];
  yArray = [];
  colorArray = [];
  boxPositions = copyArray(defaultPositions);
}

// deletes the last drawing
function undo_canvas() {
  xArray.splice(-1, 1);
  yArray.splice(-1, 1);
  colorArray.splice(-1, 1);
}

// draw that field
function fieldDraw() {
  context.drawImage(field_img, 0, 0);
}


// draws the new canvas
function draw() {
  context.lineJoin = "round";
  context.lineWidth = 5;

  // drawing paint
  for (let index in xArray) {
    // selects color of ".canvas-color"
    context.strokeStyle = colorArray[index];
    // lists of xVals and yVals for a given stroke
    let x_values = xArray[index];
    let y_values = yArray[index];
    for (let index2 in x_values) {
      // xVal and yVal are (x,y) coordinates
      let xVal = x_values[index2];
      let yVal = y_values[index2];
      // beings path
      context.beginPath();
      // if this is not the first point in the stroke
      if (index2 != 0) {
        context.moveTo(x_values[index2 - 1], y_values[index2 - 1]);
      } else {
        context.moveTo(x_values[index2] - 1, y_values[index2]);
      }
      // moves line to next point
      context.lineTo(x_values[index2], y_values[index2]);
      // closes path
      context.closePath();
      // this draws it
      context.stroke();
    }
  }

  // a black color and thinner line
  context.strokeStyle = "#000000";
  context.lineWidth = 2;

  // drawing boxes/teams
  for (let box_index in boxPositions) {
    // a given team's [x,y]
    let boxPosition = boxPositions[box_index];
    if (box_index <=2) {
      // red
      context.fillStyle = "#ff0000";
    } else {
      // blue
      context.fillStyle = "#0061ff";
    }
    // fills a rect for the team
    context.fillRect(boxPosition[0], boxPosition[1], 30, 30);
    context.beginPath();
    // draws a black line around team
    context.rect(boxPosition[0], boxPosition[1], 30, 30);
    // writes the team name
    context.fillStyle = "#000000";
    context.font = "11px Verdana";
    context.fillText(schedule[selected_match][box_index], boxPosition[0] + 1, boxPosition[1] + 18);
    // draws the outline
    context.closePath();
    context.stroke();
  }
}

// changes match number
function changeCanvasMatch(match_number) {
  $(".canvas-match-display").text("Match: " + match_number);
  selected_match = match_number;
  draw();
}

$(window).on('resize', function() {
  scaleFactor = $(document).width()*0.9 / 815;
});

// what happens with the canvas at start
$(document).ready(function() {
  // sets the context
  context = document.getElementById('canvas').getContext("2d");
  scaleFactor = $(document).width()*0.9 / 815;
  // draws field and stuff
  window.setTimeout(fieldDraw,5);
  window.setTimeout(draw,10);

  // when mouse is pressed down
  $("#canvas").mousedown(function(e) {
    // x and y coordinates
    let mouseX = (e.pageX - this.offsetLeft) / scaleFactor;
    let mouseY = (e.pageY - this.offsetTop) / scaleFactor;

    // checks to see if point is in any box
    for (let box_index in boxPositions) {
      let boxX = boxPositions[box_index][0];
      let boxY = boxPositions[box_index][1];
      if (inbox(mouseX, mouseY, boxX, boxY, 30, 30)) {
        selected_box = box_index;
        selected_box_offset = [boxX - mouseX, boxY - mouseY];
        break;
      }
    }

    // if there is not a selected box
    if (selected_box === undefined) {
      drawing = true;

      // adds stuff to the arrays
      let newInnerXArray = [mouseX];
      let newInnerYArray = [mouseY];
      xArray.push(newInnerXArray);
      yArray.push(newInnerYArray);
      colorArray.push($(".canvas-color").val());
      draw();
    }
  });

  // when the mouse moves
  $("#canvas").mousemove(function(e) {
    // x and y coordinates
    let mouseX = (e.pageX - this.offsetLeft) / scaleFactor;
    let mouseY = (e.pageY - this.offsetTop) / scaleFactor;
    // if we are drawing, add stuff to xArray and yArray
    if (drawing) {
      xArray[xArray.length - 1].push(mouseX);
      yArray[yArray.length - 1].push(mouseY);
      draw();
    // otherwise, if we are moving a box, set the boxes' new coordinates
    } else if (selected_box !== undefined) {
      boxPositions[selected_box][0] = mouseX + selected_box_offset[0];
      boxPositions[selected_box][1] = mouseY + selected_box_offset[1];
      fieldDraw();
      draw();
    }
  });
  // the following stop the drawing
  $('#canvas').mouseup(function(e){
    drawing = false;
    selected_box = undefined;
    selected_box_offset = [0,0];
  });
  $('#canvas').mouseleave(function(e){
    drawing = false;
    selected_box = undefined;
    selected_box_offset = [0,0];
  });
  // undo button
  $(".undo-canvas").click(function() {
    undo_canvas();
    fieldDraw();
    draw();
  });
  $(".erase-canvas").click(function() {
    reset_canvas();
    fieldDraw();
    draw();
  });
  // saves a color file, so you can keep your color of choice
  $(".canvas-color").change(function() {
    fs.writeFileSync("./resources/draw-color.txt", $(this).val());
  });
  // submits the match to the canvas
  $(".submit-match-to-canvas").click(function() {
    let input_val = parseInt($(".canvas-match-input").val());
    // confirms that the input is a correct match number
    if (Number.isInteger(input_val) && input_val < Object.keys(schedule).length && input_val >= 0) {
      changeCanvasMatch(input_val);
      // clears input box
      $(".canvas-match-input").val("");
    }
  });
});

/********************************************/
/*                  MODALS                  */
/********************************************/

// modal clicking
let modals = document.getElementsByClassName("modal");
// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  for (let modal in modals) {
    if (event.target == modals[modal]) {
      $(".modal").css("display", "none");
      return;
    }
  }
}

/********************************************/
/*             MISC. FUNCTIONS              */
/********************************************/

// compares two match objects to see which match came first
function compareByMatch(a,b) {
  return parseInt(gameScript.standJSON.getMatchNumber(a)) - parseInt(gameScript.standJSON.getMatchNumber(b));
}

// is a point in a box?
function inbox(point_x, point_y, box_x, box_y, box_width, box_height) {
  return (point_x >= box_x && point_x <= box_x + box_width && point_y >= box_y && point_y <= box_y + box_height);
}

// from https://stackoverflow.com/questions/1026069/how-do-i-make-the-first-letter-of-a-string-uppercase-in-javascript
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// copy array, because addresses
function copyArray(array) {
  return JSON.parse(JSON.stringify(array));
}

// rounds to nearest 100th
function roundto100th(number) {
  return Math.round(parseFloat(number)*100)/100;
}

// checks to see if a string can be parsed into a JSON
// from https://stackoverflow.com/questions/9804777/how-to-test-if-a-string-is-json-or-not
function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

//  checks if two arrays are equal
// from https://stackoverflow.com/questions/6229197/how-to-know-if-two-arrays-have-the-same-values
function arraysEqual(_arr1, _arr2) {
    if (!Array.isArray(_arr1) || ! Array.isArray(_arr2) || _arr1.length !== _arr2.length)
      return false;
    var arr1 = _arr1.concat().sort();
    var arr2 = _arr2.concat().sort();
    for (var i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i])
            return false;
    }
    return true;
}

/********************************************/
/*                  START                   */
/********************************************/

// runs on start
function onStart() {
  // loads manifests, scouts, schedule, event, etc.
  loadImportantFiles();
  // goes to the home page
  switchPages("home", undefined, undefined, 0);
  // determines a list of teams
  determineTeams();
  // uses list of teams to create "Teams" page
  insertTeams();
  // sorts "Teams" table once files are loaded
  window.setTimeout(sortTable, 200);
  // loads scouting data
  loadData();
  // sets up "Team" page for data to be inputted
  setupData();
  // "Picklist" page starts with one picklist
  createPicklist();
  // decides whether or not to display sensitive info
  displaySensitiveInfo();
  // hides several things
  $("#myCarousel").hide();
  $(".bluetooth_display").hide();
  $(".new-bluetooth-files").hide();
  $(".summary-check").hide();
  // puts scouts on Scouts page
  populateScouts();
  // sets up the summary page
  setupMatchSummaryPage();
  // sets up the stats table for the statistics page
  setupStatsTable();
  // sets up the rankings table
  addRankingsToPage();
}

// shows/hides sensitive info
function displaySensitiveInfo() {
  if (sensitive_info) {
    $(".toggle-sensitive-info").text("Show Sensitive Info");
    $(".sensitive").css("visibility", "hidden");
  } else {
    $(".toggle-sensitive-info").text("Hide Sensitive Info");
    $(".sensitive").css("visibility", "visible");
  }
}

$(document).ready(function() {
  // settings buttons
  // start searching for data folder
  // inspired by https://stackoverflow.com/questions/4502612/trigger-file-upload-dialog-using-javascript-jquery
  $(".load-flash-data").click(function() {
    searching = "data";
    $("#dir-loader").trigger("click");
  });
  // start searching for schedule.json
  $(".load-flash-sched").click(function() {
    searching = "schedule";
    $("#file-loader").trigger("click");
  });
  // start searching for scouts.json
  $(".load-flash-scouts").click(function() {
    searching = "scouts";
    $("#file-loader").trigger("click");
  });
  $(".cluck-scouts").click(function() {
  });
  $(".set-event").click(function() {
    getTeamEvents();
  });
  // for files
  $("#file-loader").change(function() {
    let path = document.getElementById("file-loader").files[0].path;
    // loads either the schedule or scouts
    loadFileFromPath();
  });
  // saving data to a directory
  $("#dir-finder").change(function() {
    // the path of the data folder we will save to
    let path = document.getElementById("dir-loader").files[0].path;
    // copy the data to this new folder
    fs.copySync("./data", path + "/exports");
  });
  // loading data from directories
  $("#dir-loader").change(function() {
    // the path of the data folder
    let path = document.getElementById("dir-loader").files[0].path;
    // copy the data over, then reload the page
    loadDataFromPath(path);
  });
  $(".bluetooth-server").click(function() {
	  bluetoothScript();
  });
  // going from match summary page to team page
  $(".match-summary-col").click(function() {
    let team_id = $(this).attr("team");
    switchPages("team", team_id, undefined, 1);
  });
  // whenever we "return" in the text box
  $('.stats-input').keypress(function (e) {
    // keyCode 13 is "enter"
    if (e.keyCode == 13) {
       // whether the team is on the left or right side of table, either 1 or 2
      let alignment = $(this).attr("team");
      let team_number = $(this).val();
      // collects the new information and displays it
      updateStatsTable(team_number, alignment);
    }
  });
  $(".toggle-photos").click(function() {
    $("#myCarousel").toggle();
  });
  // clears data and moves to storage
  // USE AT YOUR OWN RISK
  $(".clear-data").click(function() {
    // fs.removeSync("./data-storage/" + comp["name"]);
    // fs.copySync("./data", "./data-storage/" + comp["name"]);
    fs.removeSync("./data");
    fs.copySync("./data-empty", "./data");
    window.location.reload();
  });
  // exports data to a flashdrive, dropbox, etc.
  $(".export-as-folder").click(function() {
    $("#dir-finder").trigger("click");
  });
  // exports data to CSV
  $(".export-data").click(exportDataToCSV);
  // a button on the home screen
  $(".home-btn").click(function() {
    let name = $(this).attr("name");
    switchPages(name, undefined, undefined, 1);
  });
  // go to home page
  $(".go-to-home").click(function() {
    switchPages("home", undefined, undefined, 1);
  });
  // go back one page
  $(".back").click(function() {
    let last_page = history.pop();
    switchPages(last_page[0], last_page[1], last_page[2], -1);
  });
  // view all matches
  $(".all-matches-btn").click(function() {
    switchPages("matches", undefined, undefined, 1);
  });
  // view our matches
  $(".our-matches-btn").click(function() {
    switchPages("matches", OUR_TEAM, undefined, 1);
  });
  // opens tba link
  $(".view-on-tba").click(function() {
    if (comp["key"] != "test") {
      shell.openExternal(tbaMatchLink);
    }
  });
  $(".new-bluetooth-files").click(function() {
    window.location.reload();
  });
  // go draw for the match
  $(".draw-btn").click(function() {
    switchPages("drawing", undefined, selected_match, 1);
  });
  // add a picklist
  $(".add-picklist").click(createPicklist);
  // download Gmail photos and TBA photos
  $(".download-external-photos").click(getImages);
  // toggles potentially sensitive information
  $(".toggle-sensitive-info").click(function() {
    // toggles sensitive_info boolean
    sensitive_info = !sensitive_info;
    // saving updated file with new status
    fs.writeFileSync("./resources/sensitive.txt", sensitive_info.toString());
    // shows/hides info
    displaySensitiveInfo();
  });
  // does the things that must be done at the start
  onStart();

  // Listener to team search
  (() => {
    let teams = JSON.parse(fs.readFileSync('./resources/teams.json', 'utf8'));
    let list = [];
    for (const number in teams) {
      if (teams.hasOwnProperty(number)) {
        list.push({ team: number, name: teams[number] });
      }
    }
    let options = {
      shouldSort: true,
      threshold: 0.3,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 1,
      keys: [
        'team',
        'name'
      ]
    };
    let fuse = new Fuse(list, options);
    $('.team-search').change(function () {
      switchPages('team', fuse.search($(this).val())[0].team, undefined, 1);
      $(this).val('');
    });
  })();
});
