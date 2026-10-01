// MEDIRUN painted territory: shapes from GET /api/medipulsi/territory and the formatting the share card uses.
/** Minimal city map: `grid` rows of '0' outside, '1' inside, '2'-'9' painted (brighter = more); outline in grid units. */
export type TerritoryMap={cols:number;rows:number;cellM:number;grid:string[];outline:[number,number][][]};
export type TerritoryArea={id:string;name:string;countryCode:string|null;areaKm2:number;paintedKm2:number;percent:number;map?:TerritoryMap|null};
export type Territory={paintedKm2:number;world:{percent:number};cities:TerritoryArea[];countries:TerritoryArea[];pending:boolean};

/** Never rounds a real walk down to 0 — small shares keep two significant digits (0.00072 %). */
export function formatPercent(p:number):string{
 if(!Number.isFinite(p)||p<=0)return '0';
 if(p>=10)return p.toFixed(1);
 if(p>=1)return p.toFixed(2);
 return p.toFixed(Math.min(12,Math.ceil(-Math.log10(p))+1));
}
/** Painted area: m² while small, km² once it is a real share of a district. */
export function formatArea(km2:number,lang:'ka'|'en'='ka'):string{
 if(!(km2>0))return lang==='en'?'0 m²':'0 მ²';
 if(km2>=1)return `${km2.toFixed(2)} ${lang==='en'?'km²':'კმ²'}`;
 const m2=Math.round(km2*1e6/100)*100;
 return `${m2.toLocaleString('en-US').replace(/,/g,' ')} ${lang==='en'?'m²':'მ²'}`;
}
