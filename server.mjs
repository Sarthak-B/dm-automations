import http from 'node:http';
import {readFile} from 'node:fs/promises';
import handler from './api/bridge.js';
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/'))return handler(req,res);
 const path=new URL(req.url,'http://localhost').pathname;
 if(!['/','/index.html','/FlexiAutomations.html'].includes(path)){res.writeHead(404);return res.end('Not found');}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
 res.end(await readFile(new URL('./public/index.html',import.meta.url)));
});
server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('FlexiAutomations is available at http://localhost:'+(process.env.PORT||3000)));
