/**
 * Canvas agent protocol — the bridge between the assistant and the sandboxed
 * canvas DOM.
 *
 * The iframe is sandboxed without `allow-same-origin`, so the parent cannot
 * touch its DOM directly. Instead we inject CANVAS_RUNTIME into the iframe; it
 * listens for `postMessage` ops and performs the DOM mutations *inside* the
 * sandbox (full DOM access there), then snapshots the document back so the
 * parent can persist it. This gives the agent CDP-style power to inject/modify
 * components, styles and scripts — incrementally, via tools — without breaking
 * the host app.
 */

export type CanvasOp =
    | { kind: "replace"; html: string }
    | { kind: "append"; selector?: string; html: string }
    | { kind: "prepend"; selector?: string; html: string }
    | { kind: "insert"; selector: string; position: "beforebegin" | "afterbegin" | "beforeend" | "afterend"; html: string }
    | { kind: "setStyle"; selector: string; styles: Record<string, string> }
    | { kind: "setText"; selector: string; text: string }
    | { kind: "setAttr"; selector: string; attrs: Record<string, string> }
    | { kind: "remove"; selector: string }
    | { kind: "addStyle"; css: string }
    | { kind: "runJs"; code: string }
    | { kind: "query"; selector: string };

export interface CanvasOpResult {
    ok: boolean;
    result?: unknown;
    error?: string;
}

/** Human-readable tool catalog injected into the agent's system prompt. */
export const CANVAS_TOOLS_DOC = [
    "replace { html }                       — set the <body> innerHTML (use to start fresh)",
    "append { selector?, html }             — insert HTML at the end of selector (default body)",
    "prepend { selector?, html }            — insert HTML at the start of selector",
    "insert { selector, position, html }    — position: beforebegin|afterbegin|beforeend|afterend",
    "setStyle { selector, styles }          — styles is a CSS object, e.g. {\"color\":\"red\",\"padding\":\"8px\"}",
    "setText { selector, text }             — set textContent",
    "setAttr { selector, attrs }            — set attributes, e.g. {\"src\":\"…\"}",
    "remove { selector }                    — remove matching elements",
    "addStyle { css }                       — append a <style> rule block",
    "runJs { code }                         — run JS inside the canvas (full DOM access)",
    "query { selector }                     — read back {count, html, text} of the first match (inspect before acting)",
].join("\n");

/** The bootstrap script injected into every canvas document. */
export const CANVAS_RUNTIME = `
(function(){
  function send(m){ try { parent.postMessage(Object.assign({__mipCanvas:true}, m), "*"); } catch(e){} }
  function snapshot(){ send({ type:"snapshot", html: "<!doctype html>" + document.documentElement.outerHTML }); }
  function one(sel){ return sel ? document.querySelector(sel) : document.body; }
  function all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function apply(op){
    switch(op.kind){
      case "replace": document.body.innerHTML = op.html || ""; return { done:true };
      case "append": { var t=one(op.selector)||document.body; t.insertAdjacentHTML("beforeend", op.html||""); return { done:true }; }
      case "prepend": { var t2=one(op.selector)||document.body; t2.insertAdjacentHTML("afterbegin", op.html||""); return { done:true }; }
      case "insert": { var el=one(op.selector); if(!el) throw new Error("No element for "+op.selector); el.insertAdjacentHTML(op.position||"beforeend", op.html||""); return { done:true }; }
      case "setStyle": { var n=0; all(op.selector).forEach(function(e){ Object.assign(e.style, op.styles||{}); n++; }); return { matched:n }; }
      case "setText": { var n2=0; all(op.selector).forEach(function(e){ e.textContent = op.text==null?"":op.text; n2++; }); return { matched:n2 }; }
      case "setAttr": { var n3=0; all(op.selector).forEach(function(e){ var a=op.attrs||{}; for(var k in a) e.setAttribute(k, a[k]); n3++; }); return { matched:n3 }; }
      case "remove": { var n4=0; all(op.selector).forEach(function(e){ e.remove(); n4++; }); return { removed:n4 }; }
      case "addStyle": { var s=document.createElement("style"); s.textContent=op.css||""; document.head.appendChild(s); return { done:true }; }
      case "runJs": { var r=(0,eval)(op.code||""); return { value: (typeof r==="string"||typeof r==="number"||typeof r==="boolean") ? r : undefined }; }
      case "query": { var els=all(op.selector||"*"); return { count: els.length, html: els[0] ? String(els[0].outerHTML).slice(0,2000) : null, text: els[0] ? String(els[0].textContent||"").slice(0,2000) : null }; }
      default: throw new Error("Unknown op: "+op.kind);
    }
  }
  window.addEventListener("message", function(ev){
    var msg = ev.data; if(!msg || !msg.__mipCanvas || msg.type!=="op") return;
    var res;
    try { res = apply(msg.op); }
    catch(err){ send({ type:"result", id: msg.id, ok:false, error: String((err&&err.message)||err) }); return; }
    if(msg.op.kind !== "query") snapshot();
    send({ type:"result", id: msg.id, ok:true, result: res });
  });
  snapshot();
})();
`;
