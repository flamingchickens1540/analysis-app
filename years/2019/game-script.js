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
    values: {
      allHatch: function(stand_json) {
        let mod = module.exports.standJSON.values;
        return parseInt(mod.getHatchLow(stand_json)) + parseInt(mod.getHatchMid(stand_json)) + parseInt(mod.getHatchHigh(stand_json)) + parseInt(mod.getHatchShip(stand_json));
      },
      allCargo: function(stand_json) {
        let mod = module.exports.standJSON.values;
        return parseInt(mod.getCargoLow(stand_json)) + parseInt(mod.getCargoMid(stand_json)) + parseInt(mod.getCargoHigh(stand_json)) + parseInt(mod.getCargoShip(stand_json));
      },
      getHatchLow: function(stand_json) {
        return stand_json["Teleop"]["Hatch Low"];
      },
      getHatchMid: function(stand_json) {
        return stand_json["Teleop"]["Hatch Mid"];
      },
      getHatchHigh: function(stand_json) {
        return stand_json["Teleop"]["Hatch High"];
      },
      getHatchShip: function(stand_json) {
        return stand_json["Teleop"]["Hatch Ship"];
      },
      getCargoLow: function(stand_json) {
        return stand_json["Teleop"]["Cargo Low"];
      },
      getCargoMid: function(stand_json) {
        return stand_json["Teleop"]["Cargo Mid"];
      },
      getCargoHigh: function(stand_json) {
        return stand_json["Teleop"]["Cargo High"];
      },
      getCargoShip: function(stand_json) {
        return stand_json["Teleop"]["Cargo Ship"];
      },
      getHatchDropped: function(stand_json) {
        return stand_json["Teleop"]["Dropped Hatch"];
      },
      getCargoDropped: function(stand_json) {
        return stand_json["Teleop"]["Dropped Cargo"];
      },
      getClimbPlatform: function(stand_json) {
        return stand_json["Endgame"]["Platform"];
      },
      getClimbAssistance: function(stand_json) {
        return stand_json["Endgame"]["Assistance"];
      },
      getDefensePlayed: function(stand_json) {
        return stand_json["Teleop"]["Played Defense"];
      },
      getDefenseFaced: function(stand_json) {
        return stand_json["Teleop"]["Faced Defense"];
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
    }
  },
  // all the values displayed on a team's table
  table_values: ["Cross", "Hatch", "Cargo", "Stop"],
  // all the buttons that appear above the team's table, and the title of each column of their modals
  button_values: {
    "hatch": ["match", "ship", "low", "mid", "high", "total", "dropped"],
    "cargo": ["match", "ship", "low", "mid", "high", "total", "dropped"],
    "climb": ["match", "level", "assistance"],
    "defense": ["match", "played", "against"]
  },
  ranking_values: {
    // calculates median hatch count
    "Hatch": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.standJSON.values.allHatch));
      return median;
    },
    // calculates median cargo count
    "Cargo": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.standJSON.values.allCargo));
      return median;
    },
    // calculates median game piece count
    "Total Pieces": function(team) {
      let hatch_scores = allScoresForTeam(team, module.exports.standJSON.values.allHatch);
      let cargo_scores = allScoresForTeam(team, module.exports.standJSON.values.allCargo);
      // combines both lists in this method [1, 3, 5] + [2, 5, 5] = [3, 8, 10]
      let total_scores = hatch_scores.map(function(x,i){
        return x + cargo_scores[i]
      });
      return jStat.median(total_scores);
    },
    // calculates percentage of time defense is played
    "% Defense": function(team) {
      let defense_total = 0;
      let defense_scores = allScoresForTeam(team, module.exports.standJSON.values.getDefensePlayed);
      for (let scoreId in defense_scores) {
        let score = defense_scores[scoreId];
        if (score == "true" || score == "yes" || score == ["yes"]) { defense_total += 1; }
      }
      // calculates percentage of the time defense is played
      let percentage = (defense_total * 100.0) / defense_scores.length;
      return percentage;
    }
  },
  // to be displayed on the match summary page
  summary_values: {
    // calculates median hatch count
    "Hatch": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.standJSON.values.allHatch));
      return median;
    },
    // calculates median cargo count
    "Cargo": function(team) {
      let median = jStat.median(allScoresForTeam(team, module.exports.standJSON.values.allCargo));
      return median;
    },
    // calculates median game piece count
    "Total Pieces": function(team) {
      let hatch_scores = allScoresForTeam(team, module.exports.standJSON.values.allHatch);
      let cargo_scores = allScoresForTeam(team, module.exports.standJSON.values.allCargo);
      // combines both lists in this method [1, 3, 5] + [2, 5, 5] = [3, 8, 10]
      let total_scores = hatch_scores.map(function(x,i){
        return x + cargo_scores[i]
      });
      return jStat.median(total_scores);
    },
    // calculates climb percentages
    "Climb 3 %": function(team) {
      let climb_total = 0;
      let climb_scores = allScoresForTeam(team, module.exports.standJSON.values.getClimbPlatform);
      for (let scoreId in  climb_scores) {
        let score = climb_scores[scoreId];
        if (score == "level 3" || score == "3") { climb_total += 1; }
      }
      // calculates percentage of the time defense is played
      let percentage = (climb_total * 100.0) / climb_scores.length;
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
    }
  },
  team_stats_values: {
    "hatch": function(stand_json) { return module.exports.standJSON.values.allHatch(stand_json); },
    "cargo": function(stand_json) { return module.exports.standJSON.values.allCargo(stand_json); }
  },
  stats_page_values: {
    "Average Points": function(stand_json) { return module.exports.general.calculateScore(stand_json); },
    "Hatch Pieces": function(stand_json) { return module.exports.standJSON.values.allHatch(stand_json); },
    "Cargo Pieces": function(stand_json) { return module.exports.standJSON.values.allCargo(stand_json); }
  },
  button_details: {
    hatch: [
      function(stand_json) { return module.exports.standJSON.getMatchNumber(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getHatchShip(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getHatchLow(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getHatchMid(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getHatchHigh(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.allHatch(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getHatchDropped(stand_json); }
    ],
    cargo: [
      function(stand_json) { return module.exports.standJSON.getMatchNumber(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getCargoShip(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getCargoLow(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getCargoMid(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getCargoHigh(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.allCargo(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getCargoDropped(stand_json); }
    ],
    climb: [
      function(stand_json) { return module.exports.standJSON.getMatchNumber(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getClimbPlatform(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getClimbAssistance(stand_json); }
    ],
    defense: [
      function(stand_json) { return module.exports.standJSON.getMatchNumber(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getDefensePlayed(stand_json); },
      function(stand_json) { return module.exports.standJSON.values.getDefenseFaced(stand_json); }
    ]
  },
  table_details: {
    Cross: function(json) {
      return json["Start"]["Cross Line"];
    },
    Hatch: function(json) {
      // totals up all hatch values
      return parseInt(json["Teleop"]["Hatch Ship"]) + parseInt(json["Teleop"]["Hatch Low"]) + parseInt(json["Teleop"]["Hatch Mid"]) + parseInt(json["Teleop"]["Hatch High"]);
    },
    Cargo: function(json) {
      // totals up all cargo values
      return parseInt(json["Teleop"]["Cargo Ship"]) + parseInt(json["Teleop"]["Cargo Low"]) + parseInt(json["Teleop"]["Cargo Mid"]) + parseInt(json["Teleop"]["Cargo High"]);
    },
    Stop: function(json) {
      return json["Notes"]["Stopped"];
    }
  },
  general: {
    // calculates team score based on one data file for a match
    calculateScore: function(json) {
      let score = 0;
      // cross line
      if (json["Start"]["Cross Line"] == "1") {
        score += 3;
      } else if (json["Start"]["Cross Line"] == "2") {
        score += 6;
      }
      let climb_score = 0;
      // platform
      if (json["Endgame"]["Platform"] == "level 1") {
        climb_score += 3;
      } else if (json["Endgame"]["Platform"] == "level 2") {
        climb_score += 6;
      } else if (json["Endgame"]["Platform"] == "level 3") {
        climb_score += 12;
      }
      if (json["Endgame"]["Assistance"] == "received") {
        climb_score = 0;
      } else if (json["Endgame"]["Assistance"] == "gave 1") {
        climb_score *= 2;
      } else if (json["Endgame"]["Assistance"] == "gave 2") {
        climb_score *= 3;
      }
      score += climb_score;
      // hatch
      let hatch_vals = ["Hatch Ship", "Hatch Low", "Hatch Mid", "Hatch High"];
      for (let i in hatch_vals) {
        score += (parseInt(json["Teleop"][hatch_vals[i]]) * 2);

      }
      // cargo
      let cargo_vals = ["Cargo Ship", "Cargo Low", "Cargo Mid", "Cargo High"];
      for (let i in cargo_vals) {
        score += (parseInt(json["Teleop"][cargo_vals[i]]) * 3);
      }
      return score;
    },
    // a JSON file which matches headers to functions
    exportObjectCSV: {
      "1540 Data" : function(allMatches) {
        return module.exports.standJSON.getTeamNumber(allMatches[0]);
      },
      "Hatch Mean": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let hatch_scores = allScoresForTeam(team, module.exports.standJSON.values.allHatch);
        return jStat.mean(hatch_scores);
      },
      "Hatch Median": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let hatch_scores = allScoresForTeam(team, module.exports.standJSON.values.allHatch);
        return jStat.median(hatch_scores);
      },
      "Hatch Maximum": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let hatch_scores = allScoresForTeam(team, module.exports.standJSON.values.allHatch);
        return jStat.max(hatch_scores);
      },
      "Cargo Mean": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cargo_scores = allScoresForTeam(team, module.exports.standJSON.values.allCargo);
        return jStat.mean(cargo_scores);
      },
      "Cargo Median": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cargo_scores = allScoresForTeam(team, module.exports.standJSON.values.allCargo);
        return jStat.median(cargo_scores);
      },
      "Cargo Maximum": function(allMatches) {
        let team = module.exports.standJSON.getTeamNumber(allMatches[0]);
        let cargo_scores = allScoresForTeam(team, module.exports.standJSON.values.allCargo);
        return jStat.max(cargo_scores);
      },
      "Climb": function(allMatches) {
        let climb_results = "";
        for (let match_index in allMatches) {
          let match = allMatches[match_index];
          climb_results += (match["Endgame"]["Platform"])
          if (match["Endgame"]["Assistance"] !== "none") {
            climb_results += (" (" + match["Endgame"]["Assistance"] + ")");
          }
          climb_results += "; ";
        }
        return climb_results;
      }
    }
  }
}
