import {defineConfig} from 'vite';
export default defineConfig({base:'/medipulsi/',build:{outDir:'../server/public/medipulsi',emptyOutDir:true},server:{host:'0.0.0.0',port:5174,proxy:{'/api':'http://127.0.0.1:4318'}}});
