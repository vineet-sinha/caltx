#!/usr/bin/env node
var program = require('commander');
var request = require('request');
var cheerio = require('cheerio');

function finder(url) {
  request(url, function(error, response, html) {
    if (error) {
      console.log(error, error.stack);
      return;
    }
    var $ = cheerio.load(html);
    $('td.ZhCalDaySEP').filter(function() {
      var data = $(this);
      var title = data.children().first().text();
      title = title.replace(/\r?\n|\r/g, ' ');
      title = title.replace(/\s+/g, ' ');
      if (title == '') return;
      if (title == ' ') return;
      console.log('x', title, 'x');
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
