import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = new URL('./',import.meta.url);
const out = new URL('../server/src/lib/medipulsi/core/',root);
const mobileOut = new URL('../mobile/src/lib/medipulsi/core/',root);
mkdirSync(new URL('data/',out),{recursive:true});
mkdirSync(new URL('data/',mobileOut),{recursive:true});
for (const name of ['engine','journey','trail','missions','session']) {
  const source=readFileSync(new URL(`src/${name}.ts`,root),'utf8');
  writeFileSync(new URL(`${name}.ts`,mobileOut),'// Generated from medipulsi/src by build-core.mjs.\n'+source.replace(/from '(\.\/[^']+)\.ts'/g,"from '$1'").replace(" with {type:'json'}",''));
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  writeFileSync(new URL(`${name}.js`,out),'// Generated from medipulsi/src by build-core.mjs.\n'+result.outputText.replace(/from '(\.\/[^']+)\.ts'/g,"from '$1.js'"));
}
copyFileSync(new URL('src/data/vake-network.json',root),new URL('data/vake-network.json',out));
copyFileSync(new URL('src/data/vake-network.json',root),new URL('data/vake-network.json',mobileOut));
console.log('MEDIPULSI shared walking engine built.');
