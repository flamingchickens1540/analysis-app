// Analysis app code specific to the 2019 game, Destination: Deep Space

"use strict";

// general statistics library
const jStat = require("jStat").jStat;

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
    "Cells": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.standJSON.values.getAllCells));
      return median;
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
      return level_total;
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
      return percentage;
    }
  },
  // to be displayed on the match summary page
  summary_values: {
    // calculates median game piece count
    "Cells": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.standJSON.values.getAllCells));
      return median;
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
      return percentage;
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
        return 0;
      }
      // calculates percentage of the time climb is level
      let percentage = (level_total * 100.0) / double_total;
      return percentage;
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
      return percentage;
    },
    "Scores": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.general.calculateScore));
      return median;
    },
  },
  team_stats_values: {
    "cell": function(stand_json) { return module.exports.standJSON.values.getAllCells(stand_json); },
  },
  stats_page_values: {
    "Average Points": function(stand_json) { return module.exports.general.calculateScore(stand_json); },
    "Cells": function(stand_json) { return module.exports.standJSON.values.getAllCells(stand_json); }
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
