'use strict';

var self = handoffAndPoll;
module.exports = self;

var fs = require('fs-extra');
var path = require('path');

function handoffAndPoll(externalBag, callback) {
  var bag = {
    statusDir: externalBag.statusDir,
    stepConsoleAdapter: externalBag.stepConsoleAdapter
  };
  bag.who = util.format('%s|execute|step|%s', msName, self.name);
  logger.info(bag.who, 'Inside');

  async.series([
      _checkInputParams.bind(null, bag),
      _setExecutorAsReqKick.bind(null, bag),
      _pollExecutorForReqProc.bind(null, bag)
    ],
    function (err) {
      if (err)
        logger.error(bag.who, util.format('Failed to handoff and poll'));
      else
        logger.info(bag.who, util.format('Successfully received handoff from '+
        'reqKick'));

      return callback(err);
    }
  );
}

function _checkInputParams(bag, next) {
  var who = bag.who + '|' + _checkInputParams.name;
  logger.verbose(who, 'Inside');

  var expectedParams = [
    'statusDir',
    'stepConsoleAdapter'
  ];

  var paramErrors = [];
  _.each(expectedParams,
    function (expectedParam) {
      if (_.isNull(bag[expectedParam]) || _.isUndefined(bag[expectedParam]))
        paramErrors.push(
          util.format('%s: missing param :%s', who, expectedParam)
        );
    }
  );

  var hasErrors = !_.isEmpty(paramErrors);
  if (hasErrors) {
    logger.error(paramErrors.join('\n'));
    bag.stepConsoleAdapter.publishMsg(paramErrors.join('\n'));
  }

  return next(hasErrors);
}

function _setExecutorAsReqKick(bag, next) {
  var who = bag.who + '|' + _setExecutorAsReqKick.name;
  logger.verbose(who, 'Inside');

  bag.stepConsoleAdapter.openCmd('Setting executor as reqKick');
  var whoPath = path.join(bag.statusDir, 'step.who');
  fs.writeFile(whoPath, 'reqKick\n',
    function (err) {
      if (err) {
        var msg = util.format('%s, Failed to write file: %s ' +
          'with err: %s', who, whoPath, err);
        bag.stepConsoleAdapter.publishMsg(msg);
        bag.stepConsoleAdapter.closeCmd(false);
        return next(err);
      }

      bag.stepConsoleAdapter.publishMsg(
        util.format('Updated %s', whoPath)
      );
      bag.stepConsoleAdapter.closeCmd(true);
      return next();
    }
  );
}

function _pollExecutorForReqProc(bag, next) {
  var who = bag.who + '|' + _pollExecutorForReqProc.name;
  logger.verbose(who, 'Inside');

  function checkForReqProc(bag, callback) {
    var whoPath = path.join(bag.statusDir, 'step.who');
    var isReqProc = false;

    try {
      var executor = fs.readFileSync(whoPath, {encoding: 'utf8'});
      isReqProc = executor.trim() === 'reqProc';
    } catch (err) {
      isReqProc = false;
    }

    if (isReqProc)
      return callback();

    setTimeout(function () {
      checkForReqProc(bag, callback);
    }, 5000);
  }

  checkForReqProc(bag, next);
}
