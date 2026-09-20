const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');
module.exports=function loader(mocks={}) {
  const cache=new Map();
  function load(file) {
    const full=path.resolve(root,file);if(cache.has(full))return cache.get(full);
    if(full.endsWith('.json'))return JSON.parse(fs.readFileSync(full,'utf8'));
    const exports={};cache.set(full,exports);
    const source=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(source,{exports,require:name=>{
      if(name in mocks)return mocks[name];
      const base=name.startsWith('@/')?path.join(root,'src',name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(full),name):null;
      if(base){const found=[base,base+'.ts',base+'.js'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());if(found)return load(found);}
      throw Error('Unmocked dependency: '+name);
    },console,Date,Promise,Map,Set,setTimeout,clearTimeout},{filename:full});return exports;
  }
  return load;
};
