import type {Data} from './types'; import {initialData} from './data';
const KEY='natsumanabi-v1';
export function load():Data{try{const raw=localStorage.getItem(KEY);if(!raw)return initialData();const x=JSON.parse(raw);if(!x.settings||!Array.isArray(x.tasks))throw Error();return x}catch{localStorage.setItem(`${KEY}-broken-${Date.now()}`,localStorage.getItem(KEY)||'');return initialData()}}
export const save=(d:Data)=>localStorage.setItem(KEY,JSON.stringify(d));
export const reset=()=>localStorage.removeItem(KEY);
export const phase=(d:string)=>d<'2026-07-21'?'開始前':d<='2026-07-31'?'夏休み宿題集中':d<='2026-08-15'?'英検集中':d<='2026-09-17'?'定期テスト対策':d<='2026-09-24'?'英検直前':'試験当日';
export const pct=(a:number,b:number)=>b?Math.round(a/b*100):0;
