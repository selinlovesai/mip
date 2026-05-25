/**
 * Process-wide bridge to the currently-mounted canvas. CanvasSurface registers a
 * `send` function (a postMessage round-trip to its iframe); the chat agent calls
 * `canvasBridge.send(op)` to drive the canvas DOM. Only the active canvas is
 * mounted, so a singleton is sufficient.
 */

import type { CanvasOp, CanvasOpResult } from "./canvas-runtime";

type Sender = (op: CanvasOp) => Promise<CanvasOpResult>;

let sender: Sender | null = null;

export const canvasBridge = {
    set(fn: Sender) {
        sender = fn;
    },
    unset(fn: Sender) {
        if (sender === fn) sender = null;
    },
    get available() {
        return sender !== null;
    },
    send(op: CanvasOp): Promise<CanvasOpResult> {
        return sender ? sender(op) : Promise.resolve({ ok: false, error: "No canvas is open." });
    },
};
