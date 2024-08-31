import { polyfill } from "./polyfill";

export type EventListener = (...args: any[]) => void;
/**
 * @see {@link https://nodejs.org/api/events.html#emitteremiteventname-args}
 */
export type EventEmitMethod = (event: string, ...args: any[]) => boolean;

/**
 * A simple polyfill for the EventEmitter class from Node.js
 * - see: https://nodejs.org/api/events.html#class-eventemitter
 */
class _EventEmitter {
    private events?: { [key: string]: EventListener[] } = {}; // set as optional for the EventEmitter interface type

    on(event: string, listener: EventListener): this {
        if (!this.events![event]) {
            this.events![event] = [];
        }
        this.events![event].push(listener);
        return this;
    }

    off(event: string, listener: EventListener): this {
        if (!this.events![event]) return this;
        this.events![event] = this.events![event].filter(l => l !== listener);
        return this;
    }

    readonly emit: EventEmitMethod = (event: string, ...args: any[]) => {
        if (!this.events![event]) return false;
        this.events![event].forEach(listener => listener.apply(this, args));
        return true;
    }

    once(event: string, listener: EventListener): this {
        const onceListener: EventListener = (...args: any[]) => {
            this.off(event, onceListener);
            listener.apply(this, args);
        };
        this.on(event, onceListener);
        return this;
    }
}

let polyfills: any[] = [
    { EventEmitter: _EventEmitter }
]

if( polyfill.isNode )
    polyfills.push("node:events")

export const { EventEmitter } = polyfill(
    ...polyfills
) as {
    EventEmitter: typeof _EventEmitter
} as typeof import("node:events");

/**
 * see: https://nodejs.org/api/events.html#events_class_eventemitter
 */
export type EventEmitter = _EventEmitter;
export type IEventEmitter = _EventEmitter;

type EmitterOptions = {
    emit: EventEmitMethod,
    events: {
        resolve: string,
        reject: string,
    }
}

/**
 * A Promise that emits events when resolved or rejected using a provided {@link EventEmitMethod} (EventEmitter.emit)
 */
export class EventedPromise<T> extends Promise<T> {
    /**
     * @param executor The executor function to be passed to the Promise constructor 
     * @param emit An {@link EventEmitMethod} or an object with an emit method and events object or a set of options for emitting:
     * - emit: The method to emit events. @see {@link EventEmitMethod}
     * - events: An object with the keys `resolve` and `reject` that specify the event names to emit when resolving and rejecting. 
     */
    constructor(
        executor: (
            resolve: (value: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void
        ) => void,
        emit: EventEmitMethod | EmitterOptions = {
            emit: (event: string, ...args: any[]) => false,
            events: { resolve: "resolve", reject: "reject" }
        }
    ){
        const options = typeof emit === "function" ?
            { emit, events: { resolve: "resolve", reject: "reject" } } : emit;

        function wrapped_executor (
            engine_provided_resolve: (value: T | PromiseLike<T>) => void,
            engine_provided_reject: (reason?: any) => void
        ){
            function emitting_resolve(value: T | PromiseLike<T>){
                engine_provided_resolve(value);
                options.emit(options.events.resolve, value);
            };
            function emitting_reject(reason?: any){
                engine_provided_reject(reason);
                options.emit(options.events.reject, reason);
            };
            try {
                const wrapped_out = executor(emitting_resolve, emitting_reject);
            } catch (e) {
                emitting_reject(e);
            }
        }

        super(wrapped_executor);
    }
}