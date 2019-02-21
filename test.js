'use strict';

var cron = require('./');
var Cron = cron.Cron;

module.exports = {
    setUp: function(done) {
        cron.cancelCall('_all');
        done();
    },

    'should throw if missing required params': function(t) {
        t.throws(function() { cron.scheduleCall() }, /not a function/);
        t.throws(function() { cron.scheduleCall({}) }, /not a function/);
        t.throws(function() { cron.scheduleCall(noop) }, /not a number/);
        t.throws(function() { cron.scheduleCall(noop, "three") }, /not a number/);
        t.throws(function() { cron.scheduleCall(noop, 3, "four") }, /not a number/);
        t.throws(function() { cron.scheduleCall({ func: noop, at: 0, args: 123 }) }, /not an array/);

        cron.scheduleCall(noop, offsetNow(2), 0);
        cron.scheduleCall({ func: function() { t.done() }, at: offsetNow(4) });
    },

    'should pass args': function(t) {
        t.expect(2);
        cron.scheduleCall({ at: offsetNow(2), args: [123], func: function(a, b, c) { t.deepEqual(a, 123); }});
        cron.scheduleCall({ at: offsetNow(2), args: [1, 2, 3], func: function(a, b, c) { t.deepEqual([a, b, c], [1, 2, 3]); }});
        setTimeout(function() { t.done() }, 10);
    },

    'should invoke with this set to self': function(t) {
        var self = {};
        cron.scheduleCall({ at: offsetNow(10), self: self, func: function() {
            t.equal(this, self);
            t.done();
        }})
    },

    'should invoke one-shot without repeat': function(t) {
        var info = cron.scheduleCall(noop, offsetNow(10));
        t.ok(info._start > Date.now());
        t.done();
    },

    'should cancel a call': function(t) {
        var called = false;
        var info = cron.scheduleCall(function() { called = true }, 0, 10);
        cron.cancelCall(info);
        setTimeout(function() {
            t.ok(!called);
            t.done();
        }, 20);
    },

    'cancelCall should return the canceled calls': function(t) {
        t.deepEqual(cron.cancelCall(noop), []);

        var job1 = cron.scheduleCall(noop, offsetNow(10));
        t.deepEqual(cron.cancelCall(job1), [job1]);

        var job1 = cron.scheduleCall(noop, offsetNow(10));
        var job2 = cron.scheduleCall(noop, offsetNow(20));
        t.deepEqual(cron.cancelCall(noop), [job1, job2]);

        t.done();
    },

    'should run a call at the specified time and interval': function(t) {
        var callCount = 0;
        var info = cron.scheduleCall(function testCall() {
            t.equal(info.func, testCall);
            t.deepEqual(info.args, []);
            var now = Date.now();
            // allow for a possible off-by-one with nodejs setTimeout
            now += 1;
            t.ok(info._start <= now);
            t.ok(now % 30 < 3);
            if (++callCount >= 5) {
                process.nextTick(function() { cron.cancelCall(info) });
                t.done();
            }
        }, 0, 30);
        // _start is set to the call scheduled time
        t.ok(info._start > Date.now());
    },

    'should run a call only once': function(t) {
        var callCount = 0;
        var info = cron.scheduleCall(function() { callCount += 1 }, offsetNow(5));
        setTimeout(function() {
            t.equal(callCount, 1);
            t.deepEqual(cron.cancelCall(info), []);
            t.done();
        }, 17);
    },

    'should schedule a call for two days out': function(t) {
        var info = cron.scheduleCall(noop, 3 * 24 * 3600 * 1000 + 3600000, 100);
        t.ok(info._start > Date.now() + 48 * 3600 * 1000);
        t.equal(info._repeat, 100);
        t.done();
    },

    'should schedule a one-shot call for tomorrow if hour already passed': function(t) {
        var now = Date.now();
        var info = cron.scheduleCall(noop, offsetNow(-10));
        t.ok(info._start < Date.now() + Cron.msPerDay);
        t.ok(Date.now() + Cron.msPerDay < info._start + 20);
        t.done();
    },

    'setTimeout should invoke scheduleCall': function(t) {
        t.throws(function(){ cron.setTimeout() }, /not a function/);
        t.throws(function(){ cron.setTimeout(noop, "three") }, /not a number/);
        t.throws(function(){ cron.setTimeout(noop, 3, "four") }, /not a number/);
        cron.setTimeout(noop, 10, -1);

        var spy = t.spyOnce(cron, 'scheduleCall');
        cron.setTimeout(noop);
        t.ok(spy.called);
        var offset = Date.now() % Cron.msPerDay;
        t.contains(spy.args[0][0], { func: noop, repeat: 0 });
        t.ok(spy.args[0][0].at >= offset - 1);
        t.ok(spy.args[0][0].at < offset + 10);

        var spy = t.spyOnce(cron, 'scheduleCall');
        cron.setTimeout(noop, 10, -1);
        t.ok(spy.called);
        t.ok(spy.args[0][0].at > Date.now() % Cron.msPerDay);
        t.ok(spy.args[0][0].at < Date.now() % Cron.msPerDay + 20);
        t.equal(spy.args[0][0].func, noop);
        
        var spy = t.spyOnce(cron, 'scheduleCall');
        cron.setTimeout({ func: noop, at: 10, repeat: -1 });
        t.ok(spy.args[0][0].at > Date.now() % Cron.msPerDay);
        t.ok(spy.args[0][0].at < Date.now() % Cron.msPerDay + 20);
        t.equal(spy.args[0][0].func, noop);

        t.done();
    },
}

function offsetNow( offset ) {
    return Date.now() % Cron.msPerDay + (offset || 0);
}

function noop() {}