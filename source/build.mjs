import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {build} from 'esbuild';
const result=await build({entryPoints:['source/frontend/entry.tsx'],bundle:true,write:false,minify:true,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const css=readFileSync('source/frontend/styles.css','utf8');
const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FlexiAutomations</title><meta name="description" content="Sarthak’s marketing automation workspace. Run approved GitHub workflows and follow live progress."><style>'+css+'</style></head><body><div id="root"></div><script>'+result.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>';
writeFileSync('public/index.html',html);copyFileSync('public/index.html','public/FlexiAutomations.html');
console.log('Built complete HTML with embedded styles, fonts and JavaScript.');
