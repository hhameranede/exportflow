export function normalizeResult({data,sources=[],warnings=[],status="succeeded"}) {
 if (!["succeeded","partial","failed"].includes(status)) throw new TypeError("Invalid result status");
 const normalizedSources=sources.map(source=>{
  if(!source||typeof source.url!=="string"||!URL.canParse(source.url)||!["http:","https:"].includes(new URL(source.url).protocol))throw new TypeError("Each source must include a valid HTTP(S) URL");
  return {url:source.url,retrievedAt:source.retrievedAt||new Date().toISOString(),title:source.title||null,evidence:source.evidence||[]};
 });
 return {status,data:data??null,sources:normalizedSources,warnings:[...warnings],generatedAt:new Date().toISOString()};
}
