import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

const dir=process.env.DAO_LANTERN_DATA_DIR??join(homedir(),'.dao-den-long');
const file=join(dir,'leaderboard.json');
export function entries(){try{const data=JSON.parse(readFileSync(file,'utf8'));return Array.isArray(data.entries)?data.entries:[];}catch{return [];}}
export function save(entry){
  if(!/^[A-Za-z0-9_]{3,12}$/.test(entry.name))throw new Error('Name must be 3-12 letters, digits or underscores');
  if(!Number.isInteger(entry.score)||entry.score<0||!Number.isInteger(entry.nights_won)||entry.nights_won<0||entry.nights_won>3||!Number.isInteger(entry.seed))throw new Error('Invalid score entry');
  const record={name:entry.name,score:entry.score,nights_won:entry.nights_won,achieved_at:new Date().toISOString(),seed:entry.seed};
  const all=[...entries(),record].sort((a,b)=>b.score-a.score||a.achieved_at.localeCompare(b.achieved_at)).slice(0,10);
  mkdirSync(dir,{recursive:true});writeFileSync(file,JSON.stringify({entries:all},null,2)+'\n');return all;
}
