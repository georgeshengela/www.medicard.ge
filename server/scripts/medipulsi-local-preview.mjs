// Disposable local preview only. No production users or credentials are used.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const url=process.env.MEDIPULSI_TEST_DATABASE_URL;
if(!url||new URL(url).hostname!=='127.0.0.1'||!new URL(url).pathname.endsWith('_test'))throw new Error('A local disposable *_test DB is required.');
process.env.DATABASE_URL=url;process.env.NODE_ENV='test';process.env.JWT_SECRET='medipulsi-disposable-test-secret-only';process.env.EVIDENCEMD_API_KEY='unused-test';
const [{default:express},{default:helmet},{default:bcrypt},{prisma},{authRouter},{adminRouter},{medipulsiRouter},{adminMedipulsiRouter},{errorHandler}]=await Promise.all([import('express'),import('helmet'),import('bcryptjs'),import('../src/lib/prisma.js'),import('../src/routes/auth.routes.js'),import('../src/routes/admin.routes.js'),import('../src/routes/medipulsi.routes.js'),import('../src/routes/adminMedipulsi.routes.js'),import('../src/middleware/error.js')]);
const passwordHash=await bcrypt.hash('Medipulsi-local-only-2026',10);
await prisma.user.upsert({where:{email:'walker@medipulsi.test'},create:{email:'walker@medipulsi.test',fullName:'MEDIPULSI Local QA',passwordHash},update:{}});
await prisma.admin.upsert({where:{email:'admin@medipulsi.test'},create:{email:'admin@medipulsi.test',fullName:'MEDIPULSI Local QA',passwordHash,capabilities:['MEDIPULSI_VIEW','MEDIPULSI_MANAGE','MEDIPULSI_REVIEW']},update:{}});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),app=express();
app.use(express.json());app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'","'unsafe-eval'",'https://api.mapbox.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com','https://api.mapbox.com'],imgSrc:["'self'",'data:','blob:','https:'],connectSrc:["'self'",'https:','ws:','wss:'],fontSrc:["'self'",'data:','https://fonts.gstatic.com'],mediaSrc:["'self'",'blob:'],workerSrc:["'self'",'blob:'],childSrc:["'self'",'blob:'],frameAncestors:["'self'"]}}}));
app.get('/health',(_req,res)=>res.json({status:'ok'}));
app.use('/api/medipulsi',medipulsiRouter);app.use('/api/admin/medipulsi',adminMedipulsiRouter);app.use('/api/auth',authRouter);app.use('/api/admin',adminRouter);
const nativeWeb=process.env.MEDIPULSI_NATIVE_WEB;
if(nativeWeb){app.use('/_expo',express.static(path.join(nativeWeb,'_expo')));app.use('/assets',express.static(path.join(nativeWeb,'assets')));app.use('/run',(_req,res)=>res.sendFile(path.join(nativeWeb,'index.html')));}
app.use('/admin',express.static(path.join(root,'admin')));app.use(express.static(path.join(root,'public')));app.use(errorHandler);
app.listen(4318,'127.0.0.1',()=>console.log('Disposable MEDIPULSI preview: http://localhost:4318/medipulsi/ and /admin/#/medipulsi'));
