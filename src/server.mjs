import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
const root=process.cwd();
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json'};
createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root, pathname==='/'?'public/index.html':'.'+pathname);
  if(!file.startsWith(root)) {res.writeHead(403).end();return;}
  try {const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}).end(data);}
  catch {res.writeHead(404).end('Not found');}
}).listen(8080,()=>console.log('Open http://localhost:8080'));
