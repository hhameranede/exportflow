const registry = new Map();
export function registerAdapter(adapter) {
 if (!adapter || typeof adapter.id!=="string" || !adapter.id.trim()) throw new TypeError("Adapter requires a non-empty id");
 if (typeof adapter.execute!=="function") throw new TypeError("Adapter requires execute()");
 if (registry.has(adapter.id)) throw new Error("Adapter already registered: "+adapter.id);
 const item=Object.freeze({id:adapter.id,family:adapter.family||"unknown",capabilities:Object.freeze([...(adapter.capabilities||[])]),authMode:adapter.authMode||"none",limits:Object.freeze({...adapter.limits}),restrictions:Object.freeze([...(adapter.restrictions||[])]),execute:adapter.execute});
 registry.set(adapter.id,item);return item;
}
export function getAdapterCatalog(){return [...registry.values()].map(({id,family,capabilities,authMode,limits,restrictions})=>({id,family,capabilities,authMode,limits,restrictions}));}
