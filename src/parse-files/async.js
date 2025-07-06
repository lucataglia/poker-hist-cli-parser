const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { allInParser } = require('../all-in-parser');
const { frameString, parseDateAndTime, extractTimeFromFilename } = require('../helpers');

const streamed = {};

function parseFileAsync(filePath, filename, argvName) {
  const fileStream = fs.createReadStream(filePath, {
    encoding: 'utf8',
    start: streamed[filename] || 0,
  });

  fileStream.on('data', (chunk) => {
    console.log(`${frameString(`${filename} - ${parseDateAndTime(filename)} - ${argvName}`)}\n\n`);
    streamed[filename] = (streamed[filename] || 0) + chunk.length;
    allInParser(chunk); // Elabora i dati letti dal file
  });
}

function parseAllOldFiles(directoryArgv, timeFilterArgv, argvName) {
  fs.readdir(directoryArgv, (err, files) => {
    if (err) {
      console.error(chalk.red('Errore nella lettura della directory:'), err);
      return;
    }

    const hhFiles = files
      .filter((file) => file.startsWith('HH'))
      .filter((file) => {
        const time = extractTimeFromFilename(file);
        return time >= timeFilterArgv;
      })
      .sort((a, b) => a.localeCompare(b));

    hhFiles.forEach((filename) => {
      const fullPath = path.join(directoryArgv, filename);

      streamed[filename] = 0;

      parseFileAsync(fullPath, filename, argvName);
    });
  });
}

module.exports = {
  parseAllOldFiles,
};
