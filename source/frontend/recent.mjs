export function remember(previous,values){
 const next={};for(const [key,value] of Object.entries(values||{})){
  if(typeof value==='string'&&value.trim())next[key]=[value,...(Array.isArray(previous?.[key])?previous[key].filter(x=>typeof x==='string'&&x!==value):[])].slice(0,5);
 }return next;
}
