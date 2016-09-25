#!/usr/bin/env node
var program = require('commander');
var request = require('request');
var cheerio = require('cheerio');

// general utils
function strip(str) {
  return str.replace(/\s+/g, ' ').trim();      // strip spaces
}
function logEl(el) {
  console.log(el['0'].name, ': ', strip(el.html()));
}

// data extraction methods
function getDuration(rs) {
  if (rs == undefined) {
    return 15;
  }
  return parseInt(rs) * 15;
};
function getPos(el) {
  if (!el['0']) return 0;
  // if (el.prev() == null) return 0;
  // if (el.prev().html() == null) return 0;
  return 1 + getPos(el.prev());
};
function correctPosToCalendar(start, tablePos) {
  // remove the hour positioning
  if (start % 60 == 0) tablePos--;

  // remove the gap between the hour column and the calendar column
  tablePos--;

  // switch from 1-base to 0-base
  tablePos--;

  return tablePos;
}
function hrInMin(hr) {
  return hr*60;
}
function tzCorr() {
  return hrInMin(3);
  // return 0;
}
function timeInMin(hr, min) {
  return hrInMin(parseInt(hr)) + parseInt(min);
}
function minToTime(totalMin, dontShowAMPM) {
  var hr = Math.trunc(totalMin / 60);
  var ampm = ' am';
  if (!dontShowAMPM) {
    if (hr == 12) {
      ampm = ' pm';
    }
    if (hr > 12) {
      ampm = ' pm';
      hr -= 12;
    }
  }
  var min = totalMin % 60;
  if (min == 0) min = '00'
  return '' + hr + ':' + min + (dontShowAMPM?'':ampm);
}
function findObstacles(days, entriesByDay, entry) {

  // var debug = false;
  // if (entry.startTime == '10:45 am') {
  //   console.log('--- tgt entry: ', entry);
  //   debug = true;
  // }

  var obstableCnt = 0;
  days.forEach(function(day, dayNdx) {
    if (dayNdx>(entry.tablePos+obstableCnt)) return;
    entriesByDay[dayNdx].forEach(function(currEntry) {
      // by default assume that there are no obstacles for the the given entry that we are searching, i.e. use tablePos (instead of dayNdx which is only avaialble after obstacle searching)
      if (entry.start > currEntry.start && entry.start < (currEntry.start + currEntry.duration)) {
        // if (debug) {
        //   console.log('found obstacle for tgt -- for:' + entry.startTime + ' with: ' + currEntry.startTime + '-' + minToTime(currEntry.start + currEntry.duration));
        //   console.log('entry: ', entry);
        //   console.log('obstacle: ', currEntry);
        // }
        obstableCnt ++;
      }
    });

  });
  return obstableCnt;
}


// the actual model
var calModel = {
  days: [],
  entries: [],
  entriesByDay: [],

  logDays: function() {
    this.days.forEach(function(item, ndx) {
      console.log(ndx + ': ' + item);
    })
  },
  addDay: function(dayOfWeekNdx, dayOfWeekStr) {
    calModel.days[dayOfWeekNdx] = strip(dayOfWeekStr);
    calModel.entriesByDay[dayOfWeekNdx] = [];
  },

  findEntryDate: function(entry) {
    var pos = entry.tablePos;

    // html table cells skip columns where there are obstables
    pos += findObstacles(this.days, this.entriesByDay, entry);

    entry.dayNdx = pos;
    return this.days[entry.dayNdx];
  },
  addEntry: function(highlightCell, tableParent) {
    var start = tzCorr();
    var startStr = highlightCell.text();
    if (startStr.indexOf('PM') !== -1 && !startStr.includes('12:')) start += hrInMin(12);
    startStr = startStr.replace(/ [AP]M.*/, '');
    start += timeInMin(startStr.replace(/:.*/, ''), startStr.replace(/.*:/, ''));

    var entry = {
      start: start, 
      duration: getDuration(tableParent.attr('rowspan')),
      tablePos: correctPosToCalendar(start, getPos(tableParent))
    };
    entry.startTime = minToTime(entry.start);
    entry.durationTime = minToTime(entry.duration, true);
    entry.date = this.findEntryDate(entry);
    this.entriesByDay[entry.dayNdx].push(entry);
    this.entries.push(entry);

    // console.log(entry);
  },
  logEntries: function() {
    var outCal = {
      free: {},
      busy: {},
      entries: {}
    };
    this.days.forEach(function(day) {
      outCal.free[day] = [];
      outCal.busy[day] = [];
      outCal.entries[day] = [];
    });
    this.entries.forEach(function(item) {
      // console.log(item);
      // console.log(item.dateNdx + ': ' + item.startTime + '-' + minToTime(item.start+item.duration));
      outCal.busy[item.date].push(item.startTime + '-' + minToTime(item.start+item.duration));
      outCal.entries[item.date].push(item);
    });
    var freeBeg = timeInMin(     8, 0);
    var freeEnd = timeInMin(12 + 6, 0);
    this.days.forEach(function(day) {
      var curBeg = freeBeg;
      outCal.entries[day].forEach(function(item) {
        if (curBeg < item.start) {
          outCal.free[day].push(minToTime(curBeg) + '-' + item.startTime);
          curBeg = item.start + item.duration;
        }
      });
      if (curBeg < freeEnd) {
        outCal.free[day].push(minToTime(curBeg) + '-' + minToTime(freeEnd));        
      }
    });
    console.log('Busy times');
    console.log(outCal.busy);
    console.log('Free times');
    console.log(outCal.free);
  }
};


function finder(url) {
  request(url, function(error, response, html) {
    if (error) {
      console.log(error, error.stack);
      return;
    }
    var $ = cheerio.load(html, {xmlMode: true});
    $('.ZhCalDaySEP.ZhCalDayHeader, .ZhCalDaySEP.ZhCalDayHeaderToday').each(function(ndx, data) {
      calModel.addDay(ndx, $(data).text());
    });
    // calModel.logDays();

    // var data = $('td.OrangeLight').last();
    $('td.OrangeLight').each(function(ndx, data) {

      /*
      selection is busy start time
      first parent is the row
      second parent is the table-body (children are start time, gap, end time)
      third parent is table
      fourth parent is containing cell (rowspan tells duration)
      */

      var highlightCell = $(data);

      // var end = $(data).parent().siblings().last().text();
      // end = strip(end);

      var table = $(data).parent().parent().parent();

      calModel.addEntry(highlightCell, table);
    });
    calModel.logEntries();
  });
}

program
  .version('0.0.1')
  .usage('<url>');

program.action(function(url) {

  finder(url, function(error, response, body){
    if (error) {
      return console.log(error);
    }
    console.log(response);
  });

});

program
  .parse(process.argv);

if (program.args.length == 0) {
  program.outputHelp();
  console.log('Examples:');
  console.log("./parsez.js 'https://zimbra.concentricsky.com/home/anugent?view=week&fmt=freebusy'");
}
