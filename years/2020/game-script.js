// Analysis app code specific to the 2019 game, Destination: Deep Space

"use strict";

// general statistics library
const jStat = require("jStat").jStat;
const fs = require("fs");

const request = require("request-promise");
let comp = JSON.parse(fs.readFileSync("./data/resources/event.json"));
let tbaCache = JSON.parse(fs.readFileSync("./resources/tbaCache.json"));

let auth_key = JSON.parse(fs.readFileSync("./resources/keys.json"))["tba-api-key"];

let options = {
  uri: "https://www.thebluealliance.com/api/v3/event/" + comp["key"] + "/rankings",
	headers: {
    "X-TBA-Auth-Key": auth_key
  },
  json: true
}

// cacheTime represents how many minutes should have passed before it tries to find a new result rather than pulling from the cache
function loadFromTBA(uri, cacheTime) {
  let currentTime = new Date().getTime();
  // checks to see if we already have recent-enough data
  if (uri in tbaCache) {
    if ((currentTime - tbaCache[uri]["time"]) <= (cacheTime*60000)) {
      return Promise.resolve(tbaCache[uri]["result"]);
    }
  }
  options["uri"] = "https://www.thebluealliance.com/api/v3/" + uri;
  return new Promise((resolve) => {
    request(options).then(function(data) {
      resolve(data);
    }).catch(function(err) {
      console.log(err);
      if (uri in tbaCache) {
        resolve(tbaCache[uri]["result"]);
      }
    });
  }).then((result) => {
    if (!(uri in tbaCache)) { tbaCache[uri] = {}; }
    tbaCache[uri]["result"] = result;
    tbaCache[uri]["time"] = currentTime;
    fs.writeFileSync("./resources/tbaCache.json", JSON.stringify(tbaCache));
    return Promise.resolve(result);
  });
}

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
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

module.exports = {
  // obtaining data from stand json file
  standJSON: {
    getLogin: function(stand_json) {
      return stand_json["Stand"]["Login"];
    },
    getTeamNumber: function(stand_json) {
      return stand_json["info"]["team"];
    },
    getMatchNumber: function(stand_json) {
      return stand_json["info"]["match"];
    },
    getRole: function(stand_json) {
      return stand_json["info"]["role"];
    },
    getTime: function(stand_json) {
      return stand_json["info"]["time"];
    },
    getDevice: function(stand_json) {
      return stand_json["info"]["device"];
    },
    values: {
      getAllCells: function(stand_json) {
        let mod = module.exports.standJSON.values;
        return parseInt(mod.getAllLowCells(stand_json)) + parseInt(mod.getAllHighCells(stand_json));
      },
      getAllMissedCells: function(stand_json) {
        let mod = module.exports.standJSON.values;
        return parseInt(mod.getDroppedCells(stand_json)) + parseInt(mod.getMissedCellsLow(stand_json)) + parseInt(mod.getMissedCellsHigh(stand_json));
      },
      getAllLowCells: function(stand_json) {
        let mod = module.exports.standJSON.values;
        return parseInt(mod.getCellLow(stand_json)) + parseInt(mod.getAutoCellLow(stand_json));
      },
      getAllHighCells: function(stand_json) {
        let mod = module.exports.standJSON.values;
        return parseInt(mod.getCellHigh(stand_json)) + parseInt(mod.getAutoCellHigh(stand_json));
      },
      getCellLow: function(stand_json) {
        return stand_json["Teleop"]["Low Goal"];
      },
      getCellHigh: function(stand_json) {
        return stand_json["Teleop"]["High Goal"];
      },
      getDroppedCells: function(stand_json) {
        return stand_json["Teleop"]["Dropped Cell"];
      },
      getMissedCellsLow: function(stand_json) {
        return stand_json["Teleop"]["Missed Low"];
      },
      getMissedCellsHigh: function(stand_json) {
        return stand_json["Teleop"]["Missed High"];
      },
      getControlPanel: function(stand_json) {
        return stand_json["Teleop"]["Control Panel"];
      },
      getDefensePlayed: function(stand_json) {
        return stand_json["Teleop"]["Played Defense"];
      },
      getDefenseFaced: function(stand_json) {
        return stand_json["Teleop"]["Faced Defense"];
      },
      getAutoCellLow: function(stand_json) {
        return stand_json["Autonomous"]["Cells in Low"];
      },
      getAutoCellHigh: function(stand_json) {
        return stand_json["Autonomous"]["Cells in High"];
      },
      getLeaveLine: function(stand_json) {
        return stand_json["Autonomous"]["Leave Line"];
      },
      getCargoDropped: function(stand_json) {
        return stand_json["Teleop"]["Dropped Cargo"];
      },
      getClimb: function(stand_json) {
        return stand_json["Endgame"]["Climb"];
      },
      getClimbAssistance: function(stand_json) {
        return stand_json["Endgame"]["Assistance"];
      },
      getLevelClimb: function(stand_json) {
        return stand_json["Endgame"]["Level"];
      },
      getNotes: function(stand_json) {
        return stand_json["Notes"]["Notes"];
      },
      getStopped: function(stand_json) {
        return stand_json["Notes"]["Stopped"];
      }
    }
  },
  // obtaining data from pit json files
  pitJSON: {
    getLogin: function(pit_json) {
      return pit_json["Login"]["Scout"];
    },
    getTeamNumber: function(pit_json) {
      return pit_json["info"]["team"];
    },
    getTime: function(pit_json) {
      return pit_json["info"]["time"];
    },
    getDevice: function(pit_json) {
      return pit_json["info"]["device"];
    }
  },
  // all the values displayed on a team's table
  table_values: ["Cross", "Cells", "Spinner", "Climb", "Stop"],
  // all the buttons that appear above the team's table, and the title of each column of their modals
  button_values: {
    "cell": ["Match", "Auto Low", "Auto High", "Low", "High", "Total", "Missed"],
    "climb": ["match", "climb", "assistance", "level"],
    "defense": ["match", "played", "against"]
  },
  ranking_values: {
    // calculates median cell count
    "Median Cells": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.standJSON.values.getAllCells));
      return Promise.resolve(median);
    },
    // PCPR - Power Cell Power Ranking
    "PCPR": function(team) {
      let team_matches = stand_data[team];
      return Promise.all(
        team_matches.map((match) => {
          let match_num = match["info"]["match"];
          let role = match["info"]["role"][0];
          let alliance = role == "r" ? "red":"blue";
          return new Promise((resolve) => {
            resolve(loadFromTBA("match/" + comp["key"] + "_qm" + match_num, 45));
          }).then(data => {
            // until I receive a breakdown for the TBA API Score Breakdown 2020, I'm going to use random 2019 values
            let num_alliance_inner_cells = data["score_breakdown"][alliance]["cargoPoints"];
            let num_alliance_high_cells = data["score_breakdown"][alliance]["hatchPanelPoints"];
            let num_alliance_total_high_cells = num_alliance_high_cells + num_alliance_inner_cells;
            if (num_alliance_total_high_cells == 0) { resolve(0); }
            let percentage_inner = 1.0 * num_alliance_inner_cells / num_alliance_total_high_cells;
            let num_high_cells = module.exports.standJSON.values.getAllHighCells(match);
            let num_inner_cells_prediction = percentage_inner * num_high_cells;
            return Promise.resolve(num_inner_cells_prediction);
          });
        })
      ).then(function(inner_cell_predictions) {
        let median = jStat.median(inner_cell_predictions);
        return Promise.resolve(median);
      });
    },
    // calculates number of times the robot had a level climb
    "Level Climbs": function(team) {
      let level_total = 0;
      let climb_scores = allScoresForTeam(team, module.exports.standJSON.values.getClimb);
      let level_scores = allScoresForTeam(team, module.exports.standJSON.values.getLevelClimb);
      for (let scoreId in level_scores) {
        let climb = climb_scores[scoreId];
        let level = level_scores[scoreId];
        if (level == "balanced" && climb != "center") { level_total += 1; }
      }
      // calculates percentage of the time climb is level
      return Promise.resolve(level_total);
    },
    // calculates percentage of time defense is played
    "% Defense": function(team) {
      let defense_total = 0;
      let defense_scores = allScoresForTeam(team, module.exports.standJSON.values.getDefensePlayed);
      for (let scoreId in defense_scores) {
        let score = defense_scores[scoreId];
        if (score == "true" || score == "yes" || score == ["yes"] || score == ["true"]) { defense_total += 1; }
      }
      // calculates percentage of the time defense is played
      let percentage = (defense_total * 100.0) / defense_scores.length;
      return Promise.resolve(percentage);
    },
    // PCPR - Power Cell Power Ranking
    "Event Ranking": function(team) {
      return new Promise((resolve, reject) => {
        resolve(loadFromTBA("event/" + comp["key"] + "/rankings", 10));
      }).then((data) => {
        let ranking = data["rankings"].find(obj => {
          return obj["team_key"] == "frc" + team;
        });
        // multiply by negative to make it sort in the opposite direction
        return Promise.resolve(ranking["rank"]*-1);
      });
    }
  },
  // to be displayed on the team page and match summary page
  summary_values: {
    // gets team's ranking from TBA
    "Ranking": function(team) {
      return new Promise((resolve, reject) => {
        resolve(loadFromTBA("event/" + comp["key"] + "/rankings", 10));
      }).then((data) => {
        let ranking = data["rankings"].find(obj => {
          return obj["team_key"] == "frc" + team;
        });
        // multiply by negative to make it sort in the opposite direction
        return Promise.resolve(ranking["rank"]);
      });
    },
    // calculates median game piece count
    "Median Cells": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.standJSON.values.getAllCells));
      return Promise.resolve(median);
    },
    // calculates climb percentages
    "Climb %": function(team) {
      let climb_total = 0;
      let climb_scores = allScoresForTeam(team, module.exports.standJSON.values.getClimb);
      for (let scoreId in  climb_scores) {
        let score = climb_scores[scoreId];
        if (score == "side" || score == "center") { climb_total += 1; }
      }
      // calculates percentage of the time climb succeeds
      let percentage = (climb_total * 100.0) / climb_scores.length;
      return Promise.resolve(percentage);
    },
    // calculates percentage of time climb is level with other bots
    "Level %": function(team) {
      let double_total = 0;
      let level_total = 0;
      let climb_scores = allScoresForTeam(team, module.exports.standJSON.values.getClimb);
      let level_scores = allScoresForTeam(team, module.exports.standJSON.values.getLevelClimb);
      for (let scoreId in climb_scores) {
        let climb = climb_scores[scoreId];
        let level = level_scores[scoreId];
        if (level == "balanced" && climb != "center") { double_total += 1; level_total += 1; }
        if (level == "unbalanced" && climb != "center") { double_total += 1; }
      }
      if (double_total == 0) {
        return Promise.resolve(0);
      }
      // calculates percentage of the time climb is level
      let percentage = (level_total * 100.0) / double_total;
      return Promise.resolve(percentage);
    },
    // calculates percentage of time defense is played
    "Defense %": function(team) {
      let defense_total = 0;
      let defense_scores = allScoresForTeam(team, module.exports.standJSON.values.getDefensePlayed);
      for (let scoreId in defense_scores) {
        let score = defense_scores[scoreId];
        if (score == "true" || score == "yes" || score == ["yes"]) { defense_total += 1; }
      }
      // calculates percentage of the time defense is played
      let percentage = (defense_total * 100.0) / defense_scores.length;
      return Promise.resolve(percentage);
    },
    "Median Score": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.general.calculateScore));
      return Promise.resolve(median);
    },
  },
  team_stats_values: {
    "cell": function(stand_json) { return module.exports.standJSON.values.getAllCells(stand_json); },
  },
  stats_page_values: {
    "Average Points": function(team) {
      return allScoresForTeam(team, function(json) {
        return module.exports.general.calculateScore(json);
      });
    },
    "Cells": function(team) {
      return allScoresForTeam(team, function(json) {
        return module.exports.standJSON.values.getAllCells(json);
      });
    }
  },
  button_details: {
    cell: [
      function(stand_json) { return module.exports.standJSON.getMatchNumber(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getAutoCellLow(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getAutoCellHigh(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getCellLow(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getCellHigh(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getAllCells(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getAllMissedCells(stand_json); }
    ],
    climb: [
      function(stand_json) { return module.exports.standJSON.getMatchNumber(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getClimb(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getClimbAssistance(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getLevelClimb(stand_json); }
    ],
    defense: [
      function(stand_json) { return module.exports.standJSON.getMatchNumber(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getDefensePlayed(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getDefenseFaced(stand_json); }
    ]
  },
  table_details: {
    Cross: function(json) {
      return module.exports.standJSON.values.getLeaveLine(json);
    },
    Cells: function(json) {
      return module.exports.standJSON.values.getAllCells(json);
    },
    Spinner: function(json) {
      // join converts array of strings into a string separated by commas
      return module.exports.standJSON.values.getControlPanel(json).join(", ");
    },
    Climb: function(json) {
      return module.exports.standJSON.values.getClimb(json);
    },
    Stop: function(json) {
      return module.exports.standJSON.values.getStopped(json);
    }
  },
  general: {
    // calculates team score based on one data file for a match
    calculateScore: function(json) {
      let score = 0;
      // cross line
      if (module.exports.standJSON.values.getLeaveLine(json) == "yes") { score += 5; }
      // cell scores
      score += (parseInt(module.exports.standJSON.values.getAutoCellLow(json)) * 2);
      score += (parseInt(module.exports.standJSON.values.getAutoCellHigh(json)) * 4);
      score += (parseInt(module.exports.standJSON.values.getCellLow(json)));
      score += (parseInt(module.exports.standJSON.values.getCellHigh(json)) * 3);
      // control panel
      let panel = module.exports.standJSON.values.getControlPanel(json);
      if (panel.indexOf("stage2") >= 0) { score += 10; }
      if (panel.indexOf("stage3") >= 0) { score += 20; }
      // climb
      let climb = module.exports.standJSON.values.getClimb(json);
      let assist = module.exports.standJSON.values.getClimbAssistance(json);
      let level = module.exports.standJSON.values.getLevelClimb(json);
      if (climb == "park" || climb == "attempted" || climb == "assisted") { score += 5; }
      else if (climb == "side" || climb == "center") { score += 25; }
      if ((level == "balanced" && climb != "center") || (climb == "center" && level == "alone")) { score += 15; }
      if (assist == "gave1") { score += 25; }
      else if (assist == "gave2") { score += 50; }
      return score;
    },
    // a JSON file which matches headers to functions
    exportObjectCSV: {
      "1540 Data" : function(allMatches) {
        return module.exports.standJSON.getTeamNumber(allMatches[0]);
      },
      "Low Cell Mean": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllLowCells);
        return jStat.mean(hatch_scores);
      },
      "Low Cell Median": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllLowCells);
        return jStat.median(hatch_scores);
      },
      "Low Cell Maximum": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllLowCells);
        return jStat.max(hatch_scores);
      },
      "High Cell Mean": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllHighCells);
        return jStat.mean(cargo_scores);
      },
      "High Cell Median": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllHighCells);
        return jStat.median(cargo_scores);
      },
      "High Cell Maximum": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllHighCells);
        return jStat.max(cargo_scores);
      },
      "Cell Mean": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllCells);
        return jStat.mean(cargo_scores);
      },
      "Cell Median": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllCells);
        return jStat.median(cargo_scores);
      },
      "Cell Maximum": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cell_scores = allScoresForTeam(team, module.exports.standJSON.values.getAllCells);
        return jStat.max(cargo_scores);
      },
      "Climb": function(allMatches) {
        let climb = module.exports.standJSON.values.getClimb;;
        let assist = module.exports.standJSON.values.getClimbAssistance;;
        let climb_results = "";
        for (let match_index in allMatches) {
          let match = allMatches[match_index];
          climb_results += (climb(match));
          if (climb(assist) !== "none") {
            climb_results += (" (" + climb(assist) + ")");
          }
          climb_results += "; ";
        }
        return climb_results;
      }
    }
  }
}
