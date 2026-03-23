/**
 * EventEmitter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { events, EventNames } from '../events/EventEmitter';

describe('EventEmitter', () => {
    beforeEach(() => {
        events.clear();
    });

    describe('subscribe and emit', () => {
        it('should call callback when event is emitted', () => {
            const spy = vi.fn();
            events.subscribe('test', spy);
            events.emit('test', { data: 'hello' });
            expect(spy).toHaveBeenCalledWith({ data: 'hello' });
        });

        it('should call multiple callbacks for the same event', () => {
            const spy1 = vi.fn();
            const spy2 = vi.fn();
            events.subscribe('test', spy1);
            events.subscribe('test', spy2);
            events.emit('test', 'data');
            expect(spy1).toHaveBeenCalled();
            expect(spy2).toHaveBeenCalled();
        });

        it('should not call callback for different events', () => {
            const spy = vi.fn();
            events.subscribe('event1', spy);
            events.emit('event2', 'data');
            expect(spy).not.toHaveBeenCalled();
        });

        it('should call wildcard listeners for any event', () => {
            const spy = vi.fn();
            events.subscribe('*', spy);
            events.emit('test', 'data');
            expect(spy).toHaveBeenCalledWith({ event: 'test', data: 'data' });
        });
    });

    describe('unsubscribe', () => {
        it('should return unsubscribe function', () => {
            const spy = vi.fn();
            const unsubscribe = events.subscribe('test', spy);
            unsubscribe();
            events.emit('test', 'data');
            expect(spy).not.toHaveBeenCalled();
        });

        it('should only remove the specific callback', () => {
            const spy1 = vi.fn();
            const spy2 = vi.fn();
            events.subscribe('test', spy1);
            const unsubscribe = events.subscribe('test', spy2);
            unsubscribe();
            events.emit('test', 'data');
            expect(spy1).toHaveBeenCalled();
            expect(spy2).not.toHaveBeenCalled();
        });
    });

    describe('once', () => {
        it('should only call callback once', () => {
            const spy = vi.fn();
            events.once('test', spy);
            events.emit('test', 'data1');
            events.emit('test', 'data2');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith('data1');
        });
    });

    describe('listenerCount', () => {
        it('should return correct count', () => {
            expect(events.listenerCount('test')).toBe(0);
            events.subscribe('test', vi.fn());
            expect(events.listenerCount('test')).toBe(1);
            events.subscribe('test', vi.fn());
            expect(events.listenerCount('test')).toBe(2);
        });

        it('should return 0 for non-existent event', () => {
            expect(events.listenerCount('nonexistent')).toBe(0);
        });
    });

    describe('clear', () => {
        it('should clear specific event listeners', () => {
            events.subscribe('event1', vi.fn());
            events.subscribe('event2', vi.fn());
            events.clear('event1');
            events.emit('event1', 'data');
            events.emit('event2', 'data');
            expect(events.listenerCount('event1')).toBe(0);
            expect(events.listenerCount('event2')).toBe(1);
        });

        it('should clear all listeners when no event specified', () => {
            events.subscribe('event1', vi.fn());
            events.subscribe('event2', vi.fn());
            events.subscribe('*', vi.fn());
            events.clear();
            expect(events.listenerCount('event1')).toBe(0);
            expect(events.listenerCount('event2')).toBe(0);
            expect(events.listenerCount('*')).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should continue calling other listeners if one throws', () => {
            const errorSpy = vi.fn(() => { throw new Error('test error'); });
            const successSpy = vi.fn();
            events.subscribe('test', errorSpy);
            events.subscribe('test', successSpy);
            events.emit('test', 'data');
            expect(errorSpy).toHaveBeenCalled();
            expect(successSpy).toHaveBeenCalled();
        });
    });
});
