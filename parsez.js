#!/usr/bin/env node
var program = require('commander');
var request = require('request');
var cheerio = require('cheerio');

// utils
function strip(str) {
  return str.replace(/\s+/g, ' ');      // strip spaces
}
function logEl(el) {
  console.log(el['0'].name, ': ', strip(el.html()));
}


function finder(url) {
  request(url, function(error, response, html) {
    if (error) {
      console.log(error, error.stack);
      return;
    }
    var $ = cheerio.load(html, {xmlMode: true});
    $('.ZhCalDaySEP.ZhCalDayHeader').each(function(ndx, data) {
      console.log(ndx + ': ' + strip($(data).text()));
    });

    // var data = $('td.OrangeLight').last();
    $('td.OrangeLight').each(function(ndx, data) {

      var start = strip($(data).text());
      start = start.replace(/([AP]M).*/, '$1');


      /*
      selection is busy start time
      first parent is the row
      second parent is the table-body (children are start time, gap, end time)
      third parent is table
      fourth parent is containing cell (rowspan tells duration)
      */
      var getDuration = function(rs) {
        if (rs == undefined) {
          return '0:15';
        }
        var totalMin = parseInt(rs) * 15;
        var hr = Math.trunc(totalMin / 60);
        var min = totalMin % 60;
        if (min == 0) min = '00'
        return '' + hr + ':' + min;
      };
      var getPos = function(el) {
        if (!el['0']) return 0;
        // if (el.prev() == null) return 0;
        // if (el.prev().html() == null) return 0;
        return 1 + getPos(el.prev());
      };

      // var end = $(data).parent().siblings().last().text();
      // end = strip(end);

      var table = $(data).parent().parent().parent();
      var duration = getDuration(table.attr('rowspan'));

      console.log('start:', start, ', duration:', duration, 'x', getPos(table));
    });
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
