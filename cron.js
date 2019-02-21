/**
 * qcron -- very simple js call scheduler
 * Calls the handler once at a predetermined time, or repeatedly on a schedule,
 *
 * 2019-02-20 - AR.
 */

'use strict';

var singleton = new Cron();
module.exports = singleton;
module.exports.Cron = Cron;

var invoke;
// invoke the fastest way available.  Double-eval for 100% coverage, but test with old node too.
eval("invoke = function(fn, I, av) { fn.apply(I, av) }");
try { eval("invoke = function(fn, I, av) { I ? fn.apply(I, av) : fn(...av) }") } catch(e) {}

function Cron( options ) {
    options = options || {};
    this.scheduled = new Array();
}
Cron.msPerDay = 24 * 60 * 60 * 1000;

Cron.prototype.scheduleCall = function scheduleCall( func, at, repeat ) {
    var options = gatherCallArgs({ func: null, args: [], repeat: 0 }, func, at, repeat);

    if (typeof options.func !== 'function') throw new Error('func not a function');
    if (typeof options.at !== 'number') throw new Error('at not a number');
    if (typeof options.repeat !== 'number') throw new Error('repeat not a number');
    if (!Array.isArray(options.args)) throw new Error('args not an array');

    var info = { func: options.func, args: options.args, _at: options.at, _repeat: options.repeat,
                 _cron: this, _self: options.self || null, _timer: null, _start: null };

    startTimer(info);
    this.scheduled.push(info);
    return info;

    function startTimer(info) {
        // use setTimeout not setInterval to explicitly control the schedule
        var now = new Date();
        info._start = info._cron._findNextRuntime(now, info._at, info._repeat);
        info._timer = setTimeout(runCall, info._start - +now, info);
        info._timer.unref && info._timer.unref();
    }

    function runCall(info) {
        // run func first to not overlap with next scheduled run
        invoke(info.func, info._self, info.args);
        if (info._repeat > 0) startTimer(info); else info._cron.cancelCall(info);
    }
}

// note: cancel is O(n)
Cron.prototype.cancelCall = function cancelCall( funcOrInfo ) {
    var jobs = this.scheduled;
    this.scheduled = new Array();
    var removed = new Array();
    for (var i = 0; i < jobs.length; i++) {
        var info = jobs[i];
        if (info.func === funcOrInfo || info === funcOrInfo || funcOrInfo === '_all') {
            info._timer = (clearTimeout(info._timer), null);
            removed.push(info);
        } else {
            this.scheduled.push(info);
        }
    }
    return removed;
}

Cron.prototype.setTimeout = function setTimeout( func, ms, repeat ) {
    var options = gatherCallArgs({ at: 0, repeat: 0 }, func, ms, repeat);
    if (typeof options.at === 'number') options.at += new Date().getTime() % Cron.msPerDay;
    return this.scheduleCall(options);
}

// given ms after midnight and ms between runs, find the next scheduled runtime in GMT
// schedule one-shot calls as if repeating daily; large offset starts days from now
Cron.prototype._findNextRuntime = function _findNextRuntime( nowDate, offset, interval ) {
    var midnight = nowDate - nowDate % Cron.msPerDay;
    var next = midnight + offset;
    if (!(interval > 0)) interval = Cron.msPerDay;
    if (next < +nowDate) next += interval * Math.ceil((nowDate - next) / interval);
    if (next <= +nowDate) next += interval;
    return next;
}

function gatherCallArgs( options, func, at, interval ) {
    var src = (typeof func === 'object' && at === undefined && interval === undefined) ? func : { func: func, at: at, repeat: interval };
    for (var k in src) if (src[k] !== undefined) options[k] = src[k];
    return options;
}

Cron.prototype = toStruct(Cron.prototype);
function toStruct(hash) { return toStruct.prototype = hash }