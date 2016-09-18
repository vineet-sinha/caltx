#!/usr/bin/env node
var program = require('commander');
var request = require('request');
var cheerio = require('cheerio');

// general utils
function strip(str) {
  return str.replace(/\s+/g, ' ');      // strip spaces
}
function logEl(el) {
  console.log(el['0'].name, ': ', strip(el.html()));
}

// data extraction methods
function getDuration(rs) {
  if (rs == undefined) {
    return minToTime(15);
  }
  var totalMin = parseInt(rs) * 15;
  return minToTime(totalMin);
};
function getPos(el) {
  if (!el['0']) return 0;
  // if (el.prev() == null) return 0;
  // if (el.prev().html() == null) return 0;
  return 1 + getPos(el.prev());
};
function hrInMin(hr) {
  return hr*60;
}
function tzCorr() {
  // return hrInMin(-3);
  return 0;
}
function timeInMin(hr, min) {
  return hrInMin(parseInt(hr)) + parseInt(min);
}
function minToTime(totalMin, showAMPM) {
  var hr = Math.trunc(totalMin / 60);
  var ampm = ' am';
  if (showAMPM && hr > 12) {
    ampm = ' pm';
    hr -= 12;
  }
  var min = totalMin % 60;
  if (min == 0) min = '00'
  return '' + hr + ':' + min + (showAMPM?ampm:'');
}

// the actual model
var calModel = {
  days: [],
  logDays: function() {
    this.days.forEach(function(item, ndx) {
      console.log(ndx + ': ' + item);
    })
  },
  addDay: function(dayOfWeekNdx, dayOfWeekStr) {
    calModel.days[dayOfWeekNdx] = strip(dayOfWeekStr);
  },


  entries: [],

  addEntry: function(highlightCell, tableParent) {
    var start = tzCorr();
    var startStr = highlightCell.text();
    if (startStr.indexOf('PM') !== -1) start += hrInMin(12);
    startStr = startStr.replace(/ [AP]M.*/, '');
    start += timeInMin(startStr.replace(/:.*/, ''), startStr.replace(/.*:/, ''));

    var duration = getDuration(tableParent.attr('rowspan'));
    var tablePos = getPos(tableParent);
    this.entries.push({start: start, duration: duration, tablePos: tablePos});
  },
  logEntries: function() {
    this.entries.forEach(function(item) {
      console.log('start:', minToTime(item.start, true), ', duration:', item.duration, 'x', item.tablePos);
    });
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
    calModel.logDays();

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
