const accessories=/\b(adaptador|suporte|cabo|capa|pelicula|carcaca|waterblock|backplate|cooler|ventoinha|dissipador|fan|carregador|estojo|almofadas?|espumas?|earpads?|bolsa|protetor|parafuso|bracket|riser|extensor|teclado|mouse|refil|recarga|pecas?|reposicao|reparo|conector|bateria|fonte|placa\s+logica|kit\s+(?:de\s+)?upgrade)\b/
const main=/placa\s+(?:de\s+video|mae)|processador|memoria(?:\s+ram)?|notebook|computador|pc\s+gamer|ssd|cartucho|toner|impressora|monitor|mouse|teclado|headset|celular|smartphone|fonte|rtx\s*\d|gtx\s*\d|radeon|ryzen|geforce|\brx\s*\d|\bb\d{3}/
const stop=new Set(['de','do','da','para','com','e','um','uma','o','a','os','as','em','no','na','novo','nova','original','gamer','gaming','placa','video','memoria','ram','processador','computador','pc','desktop'])
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(rtx|gtx|rx|ddr)(?=\d)/g,'$1 ').replace(/\b((?:rtx|gtx|rx)\s*\d{3,4})\s*(ti|super|xtx|xt|gre)\b/g,'$1 $2').replace(/(\d)\s*(gb|tb|mhz|ghz)\b/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim()
function kind(text){const a=accessories.exec(text),m=main.exec(text);return a&&(!m||a.index<=m.index)?a[1]:null}
function category(text){
 const patterns={NOTEBOOK:/\b(?:notebook|laptop)\b/,PC:/\b(?:pc|computador|desktop)\b/,GPU:/placa de video|geforce|radeon|\b(?:rtx|gtx|rx)\s*\d/,CPU:/processador|\bryzen\b|\bcore\b/,RAM:/memoria ram|\bddr\s*[345]\b/,BOARD:/placa mae|motherboard|\b[abxz]\d{3}m?\b/,MOUSE:/\bmouse\b/,KEYBOARD:/\bteclado\b/,MONITOR:/\bmonitor\b/}
 return Object.entries(patterns).map(([key,re])=>({key,index:re.exec(text)?.index})).filter(x=>x.index!==undefined).sort((a,b)=>a.index-b.index)[0]?.key
}
export function matchesOfferSearch(query,title){
 const q=normalized(query),t=normalized(title);if(!q||!t)return false
 const qc=category(q),tc=category(t);if(qc&&tc&&qc!==tc)return false
 const a=kind(q),b=kind(t);if((b&&b!==a)||(a&&a!==b))return false
 const words=new Set(t.split(' '));if(!q.split(' ').filter(w=>!stop.has(w)).every(w=>words.has(w)))return false
 for(const [,family,model,suffix] of q.matchAll(/\b(rtx|gtx|rx)\s*(\d{3,4})\s*((?:(?:ti|super|xtx|xt|gre)\b\s*)*)/g)){
  const candidate=new RegExp('\\b'+family+'\\s*'+model+'\\s*((?:(?:ti|super|xtx|xt|gre)\\b\\s*)*)').exec(t)
  if(!candidate||candidate[1].trim()!==suffix.trim())return false
 }
 return true
}
export const OFFER_STORES={SHOPEE:'Shopee',MERCADO_LIVRE:'Mercado Livre',MAGALU:'Magazine Luiza'}
export function offerStore(item){return item?.marketplace||'SHOPEE'}
export function affiliateUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}}
