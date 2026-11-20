import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {writeFileSync} from 'node:fs';
import {entries,save} from './leaderboard.mjs';
const root=process.cwd();
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json'};
const exportIndex=process.argv.indexOf('--export-leaderboard');
if(exportIndex>=0){const path=process.argv[exportIndex+1];if(!path)throw new Error('Missing export filename');writeFileSync(path,JSON.stringify({entries:entries()},null,2)+'\n');process.exit(0);}
createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/api/leaderboard'){
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET'){res.end(JSON.stringify({entries:entries()}));return;}
    if(req.method==='POST'){try{let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw new Error('Entry too large');}res.end(JSON.stringify({entries:save(JSON.parse(body))}));}catch(e){res.writeHead(400).end(JSON.stringify({error:e.message}));}return;}
    res.writeHead(405).end();return;
  }
  const file=resolve(root, pathname==='/'?'public/index.html':'.'+pathname);
  if(!file.startsWith(root)) {res.writeHead(403).end();return;}
  try {const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}).end(data);}
  catch {res.writeHead(404).end('Not found');}
}).listen(Number(process.argv[process.argv.indexOf('--port')+1])||8080,()=>console.log('Open game server'));
