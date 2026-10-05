var MedirunGlow=(()=>{var vu=Object.defineProperty;var lx=Object.getOwnPropertyDescriptor;var cx=Object.getOwnPropertyNames;var hx=Object.prototype.hasOwnProperty;var Yp=(s,e)=>{for(var t in e)vu(s,t,{get:e[t],enumerable:!0})},ux=(s,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of cx(e))!hx.call(s,i)&&i!==t&&vu(s,i,{get:()=>e[i],enumerable:!(n=lx(e,i))||n.enumerable});return s};var fx=s=>ux(vu({},"__esModule",{value:!0}),s);var hw={};Yp(hw,{createGlow:()=>cw,glowStyle:()=>ZS});var Yd={};Yp(Yd,{ACESFilmicToneMapping:()=>eg,AddEquation:()=>Vs,AddOperation:()=>K0,AdditiveAnimationBlendMode:()=>Od,AdditiveBlending:()=>ba,AgXToneMapping:()=>ng,AlphaFormat:()=>Id,AlwaysCompare:()=>xg,AlwaysDepth:()=>xc,AlwaysStencilFunc:()=>uf,AmbientLight:()=>Uh,AnimationAction:()=>Wh,AnimationClip:()=>Is,AnimationLoader:()=>kf,AnimationMixer:()=>nl,AnimationObjectGroup:()=>ed,AnimationUtils:()=>qb,ArcCurve:()=>oh,ArrayCamera:()=>jc,ArrowHelper:()=>bd,AttachedBindMode:()=>hf,Audio:()=>Vh,AudioAnalyser:()=>jf,AudioContext:()=>tl,AudioListener:()=>Kf,AudioLoader:()=>Zf,AxesHelper:()=>Sd,BackSide:()=>ei,BasicDepthPacking:()=>lg,BasicShadowMap:()=>gx,BatchedMesh:()=>ih,Bone:()=>zr,BooleanKeyframeTrack:()=>Cs,Box2:()=>cd,Box3:()=>wn,Box3Helper:()=>yd,BoxGeometry:()=>Nr,BoxHelper:()=>_d,BufferAttribute:()=>ht,BufferGeometry:()=>tt,BufferGeometryLoader:()=>kh,ByteType:()=>Rd,Cache:()=>_s,Camera:()=>qs,CameraHelper:()=>vd,CanvasTexture:()=>Nf,CapsuleGeometry:()=>fh,CatmullRomCurve3:()=>ah,CineonToneMapping:()=>Q0,CircleGeometry:()=>Lo,ClampToEdgeWrapping:()=>ci,Clock:()=>Hh,Color:()=>Be,ColorKeyframeTrack:()=>Ka,ColorManagement:()=>zt,CompressedArrayTexture:()=>Df,CompressedCubeTexture:()=>Uf,CompressedTexture:()=>Po,CompressedTextureLoader:()=>Hf,ConeGeometry:()=>Do,ConstantAlphaFactor:()=>Y0,ConstantColorFactor:()=>X0,Controls:()=>Ed,CubeCamera:()=>Kc,CubeReflectionMapping:()=>Ss,CubeRefractionMapping:()=>Ws,CubeTexture:()=>Fr,CubeTextureLoader:()=>Vf,CubeUVReflectionMapping:()=>Oo,CubicBezierCurve:()=>za,CubicBezierCurve3:()=>lh,CubicInterpolant:()=>Ih,CullFaceBack:()=>af,CullFaceFront:()=>C0,CullFaceFrontBack:()=>mx,CullFaceNone:()=>R0,Curve:()=>Si,CurvePath:()=>uh,CustomBlending:()=>I0,CustomToneMapping:()=>tg,CylinderGeometry:()=>ni,Cylindrical:()=>ad,Data3DTexture:()=>Ca,DataArrayTexture:()=>Eo,DataTexture:()=>Ri,DataTextureLoader:()=>Gf,DataUtils:()=>Sv,DecrementStencilOp:()=>Tx,DecrementWrapStencilOp:()=>Cx,DefaultLoadingManager:()=>Ng,DepthFormat:()=>Ar,DepthStencilFormat:()=>Lr,DepthTexture:()=>Da,DetachedBindMode:()=>sg,DirectionalLight:()=>Ls,DirectionalLightHelper:()=>xd,DiscreteInterpolant:()=>Lh,DodecahedronGeometry:()=>dh,DoubleSide:()=>Bn,DstAlphaFactor:()=>k0,DstColorFactor:()=>V0,DynamicCopyUsage:()=>Gx,DynamicDrawUsage:()=>si,DynamicReadUsage:()=>kx,EdgesGeometry:()=>ph,EllipseCurve:()=>Io,EqualCompare:()=>dg,EqualDepth:()=>_c,EqualStencilFunc:()=>Dx,EquirectangularReflectionMapping:()=>Sa,EquirectangularRefractionMapping:()=>wa,Euler:()=>bi,EventDispatcher:()=>Pi,ExtrudeGeometry:()=>mh,FileLoader:()=>fi,Float16BufferAttribute:()=>yf,Float32BufferAttribute:()=>Me,FloatType:()=>hi,Fog:()=>eh,FogExp2:()=>Qc,FramebufferTexture:()=>Ba,FrontSide:()=>Gi,Frustum:()=>Or,GLBufferAttribute:()=>sd,GLSL1:()=>Xx,GLSL3:()=>ff,GreaterCompare:()=>pg,GreaterDepth:()=>Cr,GreaterEqualCompare:()=>gg,GreaterEqualDepth:()=>yc,GreaterEqualStencilFunc:()=>Ox,GreaterStencilFunc:()=>Nx,GridHelper:()=>md,Group:()=>bn,HalfFloatType:()=>Bo,HemisphereLight:()=>No,HemisphereLightHelper:()=>pd,IcosahedronGeometry:()=>Uo,ImageBitmapLoader:()=>el,ImageLoader:()=>Wr,ImageUtils:()=>Zc,IncrementStencilOp:()=>Ax,IncrementWrapStencilOp:()=>Rx,InstancedBufferAttribute:()=>kn,InstancedBufferGeometry:()=>zh,InstancedInterleavedBuffer:()=>id,InstancedMesh:()=>Wi,Int16BufferAttribute:()=>vf,Int32BufferAttribute:()=>_f,Int8BufferAttribute:()=>mf,IntType:()=>Yh,InterleavedBuffer:()=>Ts,InterleavedBufferAttribute:()=>es,Interpolant:()=>Rs,InterpolateDiscrete:()=>Dr,InterpolateLinear:()=>Ur,InterpolateSmooth:()=>dc,InvertStencilOp:()=>Px,KeepStencilOp:()=>vr,KeyframeTrack:()=>wi,LOD:()=>nh,LatheGeometry:()=>Wa,Layers:()=>Ao,LessCompare:()=>fg,LessDepth:()=>vc,LessEqualCompare:()=>zd,LessEqualDepth:()=>Rr,LessEqualStencilFunc:()=>Ux,LessStencilFunc:()=>Lx,Light:()=>ss,LightProbe:()=>Oh,Line:()=>Ii,Line3:()=>hd,LineBasicMaterial:()=>Dn,LineCurve:()=>ka,LineCurve3:()=>ch,LineDashedMaterial:()=>Ph,LineLoop:()=>Co,LineSegments:()=>ui,LinearFilter:()=>cn,LinearInterpolant:()=>$a,LinearMipMapLinearFilter:()=>yx,LinearMipMapNearestFilter:()=>_x,LinearMipmapLinearFilter:()=>yi,LinearMipmapNearestFilter:()=>Er,LinearSRGBColorSpace:()=>Gn,LinearToneMapping:()=>J0,LinearTransfer:()=>ll,Loader:()=>Vn,LoaderUtils:()=>Xi,LoadingManager:()=>Ja,LoopOnce:()=>rg,LoopPingPong:()=>ag,LoopRepeat:()=>og,LuminanceAlphaFormat:()=>Ud,LuminanceFormat:()=>Dd,MOUSE:()=>dx,Material:()=>xn,MaterialLoader:()=>Bh,MathUtils:()=>Hd,Matrix2:()=>ld,Matrix3:()=>wt,Matrix4:()=>ct,MaxEquation:()=>N0,Mesh:()=>Ft,MeshBasicMaterial:()=>zn,MeshDepthMaterial:()=>Ua,MeshDistanceMaterial:()=>Na,MeshLambertMaterial:()=>Rh,MeshMatcapMaterial:()=>Ch,MeshNormalMaterial:()=>Th,MeshPhongMaterial:()=>Eh,MeshPhysicalMaterial:()=>ii,MeshStandardMaterial:()=>$s,MeshToonMaterial:()=>Ah,MinEquation:()=>U0,MirroredRepeatWrapping:()=>Pr,MixOperation:()=>$0,MultiplyBlending:()=>cf,MultiplyOperation:()=>sl,NearestFilter:()=>Tn,NearestMipMapLinearFilter:()=>vx,NearestMipMapNearestFilter:()=>xx,NearestMipmapLinearFilter:()=>Gs,NearestMipmapNearestFilter:()=>rl,NeutralToneMapping:()=>ig,NeverCompare:()=>ug,NeverDepth:()=>gc,NeverStencilFunc:()=>Ix,NoBlending:()=>Vi,NoColorSpace:()=>gs,NoToneMapping:()=>ys,NormalAnimationBlendMode:()=>Qh,NormalBlending:()=>wr,NotEqualCompare:()=>mg,NotEqualDepth:()=>Mc,NotEqualStencilFunc:()=>Fx,NumberKeyframeTrack:()=>ts,Object3D:()=>Kt,ObjectLoader:()=>Yf,ObjectSpaceNormalMap:()=>hg,OctahedronGeometry:()=>Za,OneFactor:()=>O0,OneMinusConstantAlphaFactor:()=>Z0,OneMinusConstantColorFactor:()=>q0,OneMinusDstAlphaFactor:()=>H0,OneMinusDstColorFactor:()=>G0,OneMinusSrcAlphaFactor:()=>mc,OneMinusSrcColorFactor:()=>z0,OrthographicCamera:()=>Qi,PCFShadowMap:()=>Td,PCFSoftShadowMap:()=>P0,PMREMGenerator:()=>La,Path:()=>Hr,PerspectiveCamera:()=>Mn,Plane:()=>$i,PlaneGeometry:()=>As,PlaneHelper:()=>Md,PointLight:()=>Ks,PointLightHelper:()=>dd,Points:()=>Hn,PointsMaterial:()=>kr,PolarGridHelper:()=>gd,PolyhedronGeometry:()=>Zs,PositionalAudio:()=>Jf,PropertyBinding:()=>tn,PropertyMixer:()=>Gh,QuadraticBezierCurve:()=>Ha,QuadraticBezierCurve3:()=>Va,Quaternion:()=>Sn,QuaternionKeyframeTrack:()=>ns,QuaternionLinearInterpolant:()=>Dh,RED_GREEN_RGTC2_Format:()=>qc,RED_RGTC1_Format:()=>Fd,REVISION:()=>Xh,RGBADepthPacking:()=>cg,RGBAFormat:()=>Qn,RGBAIntegerFormat:()=>jh,RGBA_ASTC_10x10_Format:()=>kc,RGBA_ASTC_10x5_Format:()=>Oc,RGBA_ASTC_10x6_Format:()=>Bc,RGBA_ASTC_10x8_Format:()=>zc,RGBA_ASTC_12x10_Format:()=>Hc,RGBA_ASTC_12x12_Format:()=>Vc,RGBA_ASTC_4x4_Format:()=>Cc,RGBA_ASTC_5x4_Format:()=>Pc,RGBA_ASTC_5x5_Format:()=>Ic,RGBA_ASTC_6x5_Format:()=>Lc,RGBA_ASTC_6x6_Format:()=>Dc,RGBA_ASTC_8x5_Format:()=>Uc,RGBA_ASTC_8x6_Format:()=>Nc,RGBA_ASTC_8x8_Format:()=>Fc,RGBA_BPTC_Format:()=>xa,RGBA_ETC2_EAC_Format:()=>Rc,RGBA_PVRTC_2BPPV1_Format:()=>Ec,RGBA_PVRTC_4BPPV1_Format:()=>wc,RGBA_S3TC_DXT1_Format:()=>pa,RGBA_S3TC_DXT3_Format:()=>ma,RGBA_S3TC_DXT5_Format:()=>ga,RGBDepthPacking:()=>bx,RGBFormat:()=>Ld,RGBIntegerFormat:()=>Mx,RGB_BPTC_SIGNED_Format:()=>Gc,RGB_BPTC_UNSIGNED_Format:()=>Wc,RGB_ETC1_Format:()=>Ac,RGB_ETC2_Format:()=>Tc,RGB_PVRTC_2BPPV1_Format:()=>Sc,RGB_PVRTC_4BPPV1_Format:()=>bc,RGB_S3TC_DXT1_Format:()=>da,RGDepthPacking:()=>Sx,RGFormat:()=>Nd,RGIntegerFormat:()=>Jh,RawShaderMaterial:()=>wh,Ray:()=>Xs,Raycaster:()=>il,RectAreaLight:()=>Nh,RedFormat:()=>Kh,RedIntegerFormat:()=>ol,ReinhardToneMapping:()=>j0,RenderTarget:()=>$c,RepeatWrapping:()=>ws,ReplaceStencilOp:()=>Ex,ReverseSubtractEquation:()=>D0,RingGeometry:()=>gh,SIGNED_RED_GREEN_RGTC2_Format:()=>Yc,SIGNED_RED_RGTC1_Format:()=>Xc,SRGBColorSpace:()=>An,SRGBTransfer:()=>rn,Scene:()=>Br,ShaderChunk:()=>Dt,ShaderLib:()=>Hi,ShaderMaterial:()=>Ot,ShadowMaterial:()=>Sh,Shape:()=>bs,ShapeGeometry:()=>xh,ShapePath:()=>wd,ShapeUtils:()=>Ci,ShortType:()=>Cd,Skeleton:()=>Ro,SkeletonHelper:()=>fd,SkinnedMesh:()=>Ys,Source:()=>vs,Sphere:()=>Rn,SphereGeometry:()=>Gr,Spherical:()=>od,SphericalHarmonics3:()=>Fh,SplineCurve:()=>Ga,SpotLight:()=>Fo,SpotLightHelper:()=>ud,Sprite:()=>th,SpriteMaterial:()=>Oa,SrcAlphaFactor:()=>pc,SrcAlphaSaturateFactor:()=>W0,SrcColorFactor:()=>B0,StaticCopyUsage:()=>Vx,StaticDrawUsage:()=>Aa,StaticReadUsage:()=>zx,StereoCamera:()=>$f,StreamCopyUsage:()=>Wx,StreamDrawUsage:()=>Bx,StreamReadUsage:()=>Hx,StringKeyframeTrack:()=>Ps,SubtractEquation:()=>L0,SubtractiveBlending:()=>lf,TOUCH:()=>px,TangentSpaceNormalMap:()=>Js,TetrahedronGeometry:()=>vh,Texture:()=>dn,TextureLoader:()=>ja,TextureUtils:()=>tb,TorusGeometry:()=>_h,TorusKnotGeometry:()=>yh,Triangle:()=>Ki,TriangleFanDrawMode:()=>zo,TriangleStripDrawMode:()=>al,TrianglesDrawMode:()=>Bd,TubeGeometry:()=>Mh,UVMapping:()=>qh,Uint16BufferAttribute:()=>Pa,Uint32BufferAttribute:()=>Ia,Uint8BufferAttribute:()=>gf,Uint8ClampedBufferAttribute:()=>xf,Uniform:()=>td,UniformsGroup:()=>nd,UniformsLib:()=>He,UniformsUtils:()=>bg,UnsignedByteType:()=>ji,UnsignedInt248Type:()=>Ir,UnsignedInt5999Type:()=>Pd,UnsignedIntType:()=>Es,UnsignedShort4444Type:()=>Zh,UnsignedShort5551Type:()=>$h,UnsignedShortType:()=>So,VSMShadowMap:()=>Zi,Vector2:()=>_e,Vector3:()=>L,Vector4:()=>kt,VectorKeyframeTrack:()=>is,VideoTexture:()=>Lf,WebGL3DRenderTarget:()=>pf,WebGLArrayRenderTarget:()=>df,WebGLCoordinateSystem:()=>Ji,WebGLCubeRenderTarget:()=>Jc,WebGLMultipleRenderTargets:()=>Ad,WebGLRenderTarget:()=>ti,WebGLRenderer:()=>Fa,WebGLUtils:()=>Rg,WebGPUCoordinateSystem:()=>Ta,WireframeGeometry:()=>bh,WrapAroundEnding:()=>Ea,ZeroCurvatureEnding:()=>Mr,ZeroFactor:()=>F0,ZeroSlopeEnding:()=>br,ZeroStencilOp:()=>wx,createCanvasElement:()=>_g});var Xh="170",dx={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},px={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},R0=0,af=1,C0=2,mx=3,gx=0,Td=1,P0=2,Zi=3,Gi=0,ei=1,Bn=2,Vi=0,wr=1,ba=2,lf=3,cf=4,I0=5,Vs=100,L0=101,D0=102,U0=103,N0=104,F0=200,O0=201,B0=202,z0=203,pc=204,mc=205,k0=206,H0=207,V0=208,G0=209,W0=210,X0=211,q0=212,Y0=213,Z0=214,gc=0,xc=1,vc=2,Rr=3,_c=4,yc=5,Cr=6,Mc=7,sl=0,$0=1,K0=2,ys=0,J0=1,j0=2,Q0=3,eg=4,tg=5,ng=6,ig=7,hf="attached",sg="detached",qh=300,Ss=301,Ws=302,Sa=303,wa=304,Oo=306,ws=1e3,ci=1001,Pr=1002,Tn=1003,rl=1004,xx=1004,Gs=1005,vx=1005,cn=1006,Er=1007,_x=1007,yi=1008,yx=1008,ji=1009,Rd=1010,Cd=1011,So=1012,Yh=1013,Es=1014,hi=1015,Bo=1016,Zh=1017,$h=1018,Ir=1020,Pd=35902,Id=1021,Ld=1022,Qn=1023,Dd=1024,Ud=1025,Ar=1026,Lr=1027,Kh=1028,ol=1029,Nd=1030,Jh=1031,Mx=1032,jh=1033,da=33776,pa=33777,ma=33778,ga=33779,bc=35840,Sc=35841,wc=35842,Ec=35843,Ac=36196,Tc=37492,Rc=37496,Cc=37808,Pc=37809,Ic=37810,Lc=37811,Dc=37812,Uc=37813,Nc=37814,Fc=37815,Oc=37816,Bc=37817,zc=37818,kc=37819,Hc=37820,Vc=37821,xa=36492,Gc=36494,Wc=36495,Fd=36283,Xc=36284,qc=36285,Yc=36286,rg=2200,og=2201,ag=2202,Dr=2300,Ur=2301,dc=2302,Mr=2400,br=2401,Ea=2402,Qh=2500,Od=2501,Bd=0,al=1,zo=2,lg=3200,cg=3201,bx=3202,Sx=3203,Js=0,hg=1,gs="",An="srgb",Gn="srgb-linear",ll="linear",rn="srgb",wx=0,vr=7680,Ex=7681,Ax=7682,Tx=7683,Rx=34055,Cx=34056,Px=5386,Ix=512,Lx=513,Dx=514,Ux=515,Nx=516,Fx=517,Ox=518,uf=519,ug=512,fg=513,dg=514,zd=515,pg=516,mg=517,gg=518,xg=519,Aa=35044,si=35048,Bx=35040,zx=35045,kx=35049,Hx=35041,Vx=35046,Gx=35050,Wx=35042,Xx="100",ff="300 es",Ji=2e3,Ta=2001,Pi=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){if(this._listeners===void 0)return!1;let n=this._listeners;return n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){if(this._listeners===void 0)return;let i=this._listeners[e];if(i!==void 0){let r=i.indexOf(t);r!==-1&&i.splice(r,1)}}dispatchEvent(e){if(this._listeners===void 0)return;let n=this._listeners[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let r=0,o=i.length;r<o;r++)i[r].call(this,e);e.target=null}}},Xn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Zp=1234567,Tr=Math.PI/180,wo=180/Math.PI;function Mi(){let s=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Xn[s&255]+Xn[s>>8&255]+Xn[s>>16&255]+Xn[s>>24&255]+"-"+Xn[e&255]+Xn[e>>8&255]+"-"+Xn[e>>16&15|64]+Xn[e>>24&255]+"-"+Xn[t&63|128]+Xn[t>>8&255]+"-"+Xn[t>>16&255]+Xn[t>>24&255]+Xn[n&255]+Xn[n>>8&255]+Xn[n>>16&255]+Xn[n>>24&255]).toLowerCase()}function gn(s,e,t){return Math.max(e,Math.min(t,s))}function kd(s,e){return(s%e+e)%e}function qx(s,e,t,n,i){return n+(s-e)*(i-n)/(t-e)}function Yx(s,e,t){return s!==e?(t-s)/(e-s):0}function va(s,e,t){return(1-t)*s+t*e}function Zx(s,e,t,n){return va(s,e,1-Math.exp(-t*n))}function $x(s,e=1){return e-Math.abs(kd(s,e*2)-e)}function Kx(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*(3-2*s))}function Jx(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*s*(s*(s*6-15)+10))}function jx(s,e){return s+Math.floor(Math.random()*(e-s+1))}function Qx(s,e){return s+Math.random()*(e-s)}function ev(s){return s*(.5-Math.random())}function tv(s){s!==void 0&&(Zp=s);let e=Zp+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function nv(s){return s*Tr}function iv(s){return s*wo}function sv(s){return(s&s-1)===0&&s!==0}function rv(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function ov(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function av(s,e,t,n,i){let r=Math.cos,o=Math.sin,a=r(t/2),l=o(t/2),c=r((e+n)/2),h=o((e+n)/2),u=r((e-n)/2),f=o((e-n)/2),d=r((n-e)/2),p=o((n-e)/2);switch(i){case"XYX":s.set(a*h,l*u,l*f,a*c);break;case"YZY":s.set(l*f,a*h,l*u,a*c);break;case"ZXZ":s.set(l*u,l*f,a*h,a*c);break;case"XZX":s.set(a*h,l*p,l*d,a*c);break;case"YXY":s.set(l*d,a*h,l*p,a*c);break;case"ZYZ":s.set(l*p,l*d,a*h,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function jn(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("Invalid component type.")}}function Lt(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("Invalid component type.")}}var Hd={DEG2RAD:Tr,RAD2DEG:wo,generateUUID:Mi,clamp:gn,euclideanModulo:kd,mapLinear:qx,inverseLerp:Yx,lerp:va,damp:Zx,pingpong:$x,smoothstep:Kx,smootherstep:Jx,randInt:jx,randFloat:Qx,randFloatSpread:ev,seededRandom:tv,degToRad:nv,radToDeg:iv,isPowerOfTwo:sv,ceilPowerOfTwo:rv,floorPowerOfTwo:ov,setQuaternionFromProperEuler:av,normalize:Lt,denormalize:jn},_e=class s{constructor(e=0,t=0){s.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(gn(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*n-o*i+e.x,this.y=r*i+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},wt=class s{constructor(e,t,n,i,r,o,a,l,c){s.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,o,a,l,c)}set(e,t,n,i,r,o,a,l,c){let h=this.elements;return h[0]=e,h[1]=i,h[2]=a,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],u=n[7],f=n[2],d=n[5],p=n[8],x=i[0],g=i[3],m=i[6],y=i[1],_=i[4],v=i[7],F=i[2],T=i[5],U=i[8];return r[0]=o*x+a*y+l*F,r[3]=o*g+a*_+l*T,r[6]=o*m+a*v+l*U,r[1]=c*x+h*y+u*F,r[4]=c*g+h*_+u*T,r[7]=c*m+h*v+u*U,r[2]=f*x+d*y+p*F,r[5]=f*g+d*_+p*T,r[8]=f*m+d*v+p*U,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8];return t*o*h-t*a*c-n*r*h+n*a*l+i*r*c-i*o*l}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],u=h*o-a*c,f=a*l-h*r,d=c*r-o*l,p=t*u+n*f+i*d;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/p;return e[0]=u*x,e[1]=(i*c-h*n)*x,e[2]=(a*n-i*o)*x,e[3]=f*x,e[4]=(h*t-i*l)*x,e[5]=(i*r-a*t)*x,e[6]=d*x,e[7]=(n*l-c*t)*x,e[8]=(o*t-n*r)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+e,-i*c,i*l,-i*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(_u.makeScale(e,t)),this}rotate(e){return this.premultiply(_u.makeRotation(-e)),this}translate(e,t){return this.premultiply(_u.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},_u=new wt;function vg(s){for(let e=s.length-1;e>=0;--e)if(s[e]>=65535)return!0;return!1}var lv={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};function vo(s,e){return new lv[s](e)}function Ra(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function _g(){let s=Ra("canvas");return s.style.display="block",s}var $p={};function ha(s){s in $p||($p[s]=!0,console.warn(s))}function cv(s,e,t){return new Promise(function(n,i){function r(){switch(s.clientWaitSync(e,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:i();break;case s.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}function hv(s){let e=s.elements;e[2]=.5*e[2]+.5*e[3],e[6]=.5*e[6]+.5*e[7],e[10]=.5*e[10]+.5*e[11],e[14]=.5*e[14]+.5*e[15]}function uv(s){let e=s.elements;e[11]===-1?(e[10]=-e[10]-1,e[14]=-e[14]):(e[10]=-e[10],e[14]=-e[14]+1)}var zt={enabled:!0,workingColorSpace:Gn,spaces:{},convert:function(s,e,t){return this.enabled===!1||e===t||!e||!t||(this.spaces[e].transfer===rn&&(s.r=Ms(s.r),s.g=Ms(s.g),s.b=Ms(s.b)),this.spaces[e].primaries!==this.spaces[t].primaries&&(s.applyMatrix3(this.spaces[e].toXYZ),s.applyMatrix3(this.spaces[t].fromXYZ)),this.spaces[t].transfer===rn&&(s.r=Mo(s.r),s.g=Mo(s.g),s.b=Mo(s.b))),s},fromWorkingColorSpace:function(s,e){return this.convert(s,this.workingColorSpace,e)},toWorkingColorSpace:function(s,e){return this.convert(s,e,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===gs?ll:this.spaces[s].transfer},getLuminanceCoefficients:function(s,e=this.workingColorSpace){return s.fromArray(this.spaces[e].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,e,t){return s.copy(this.spaces[e].toXYZ).multiply(this.spaces[t].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace}};function Ms(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function Mo(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}var Kp=[.64,.33,.3,.6,.15,.06],Jp=[.2126,.7152,.0722],jp=[.3127,.329],Qp=new wt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),em=new wt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);zt.define({[Gn]:{primaries:Kp,whitePoint:jp,transfer:ll,toXYZ:Qp,fromXYZ:em,luminanceCoefficients:Jp,workingColorSpaceConfig:{unpackColorSpace:An},outputColorSpaceConfig:{drawingBufferColorSpace:An}},[An]:{primaries:Kp,whitePoint:jp,transfer:rn,toXYZ:Qp,fromXYZ:em,luminanceCoefficients:Jp,outputColorSpaceConfig:{drawingBufferColorSpace:An}}});var Qr,Zc=class{static getDataURL(e){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let t;if(e instanceof HTMLCanvasElement)t=e;else{Qr===void 0&&(Qr=Ra("canvas")),Qr.width=e.width,Qr.height=e.height;let n=Qr.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),t=Qr}return t.width>2048||t.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",e),t.toDataURL("image/jpeg",.6)):t.toDataURL("image/png")}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Ra("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let o=0;o<r.length;o++)r[o]=Ms(r[o]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Ms(t[n]/255)*255):t[n]=Ms(t[n]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},fv=0,vs=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:fv++}),this.uuid=Mi(),this.data=e,this.dataReady=!0,this.version=0}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let o=0,a=i.length;o<a;o++)i[o].isDataTexture?r.push(yu(i[o].image)):r.push(yu(i[o]))}else r=yu(i);n.url=r}return t||(e.images[this.uuid]=n),n}};function yu(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?Zc.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var dv=0,dn=class s extends Pi{constructor(e=s.DEFAULT_IMAGE,t=s.DEFAULT_MAPPING,n=ci,i=ci,r=cn,o=yi,a=Qn,l=ji,c=s.DEFAULT_ANISOTROPY,h=gs){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:dv++}),this.uuid=Mi(),this.name="",this.source=new vs(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new _e(0,0),this.repeat=new _e(1,1),this.center=new _e(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new wt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==qh)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ws:e.x=e.x-Math.floor(e.x);break;case ci:e.x=e.x<0?0:1;break;case Pr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ws:e.y=e.y-Math.floor(e.y);break;case ci:e.y=e.y<0?0:1;break;case Pr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};dn.DEFAULT_IMAGE=null;dn.DEFAULT_MAPPING=qh;dn.DEFAULT_ANISOTROPY=1;var kt=class s{constructor(e=0,t=0,n=0,i=1){s.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*i+o[12]*r,this.y=o[1]*t+o[5]*n+o[9]*i+o[13]*r,this.z=o[2]*t+o[6]*n+o[10]*i+o[14]*r,this.w=o[3]*t+o[7]*n+o[11]*i+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,r,l=e.elements,c=l[0],h=l[4],u=l[8],f=l[1],d=l[5],p=l[9],x=l[2],g=l[6],m=l[10];if(Math.abs(h-f)<.01&&Math.abs(u-x)<.01&&Math.abs(p-g)<.01){if(Math.abs(h+f)<.1&&Math.abs(u+x)<.1&&Math.abs(p+g)<.1&&Math.abs(c+d+m-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let _=(c+1)/2,v=(d+1)/2,F=(m+1)/2,T=(h+f)/4,U=(u+x)/4,C=(p+g)/4;return _>v&&_>F?_<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(_),i=T/n,r=U/n):v>F?v<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(v),n=T/i,r=C/i):F<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(F),n=U/r,i=C/r),this.set(n,i,r,t),this}let y=Math.sqrt((g-p)*(g-p)+(u-x)*(u-x)+(f-h)*(f-h));return Math.abs(y)<.001&&(y=1),this.x=(g-p)/y,this.y=(u-x)/y,this.z=(f-h)/y,this.w=Math.acos((c+d+m-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},$c=class extends Pi{constructor(e=1,t=1,n={}){super(),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=1,this.scissor=new kt(0,0,e,t),this.scissorTest=!1,this.viewport=new kt(0,0,e,t);let i={width:e,height:t,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:cn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);let r=new dn(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];let o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let n=0,i=e.textures.length;n<i;n++)this.textures[n]=e.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;let t=Object.assign({},e.texture.image);return this.texture.source=new vs(t),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},ti=class extends $c{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Eo=class extends dn{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=Tn,this.minFilter=Tn,this.wrapR=ci,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},df=class extends ti{constructor(e=1,t=1,n=1,i={}){super(e,t,i),this.isWebGLArrayRenderTarget=!0,this.depth=n,this.texture=new Eo(null,e,t,n),this.texture.isRenderTargetTexture=!0}},Ca=class extends dn{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=Tn,this.minFilter=Tn,this.wrapR=ci,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},pf=class extends ti{constructor(e=1,t=1,n=1,i={}){super(e,t,i),this.isWebGL3DRenderTarget=!0,this.depth=n,this.texture=new Ca(null,e,t,n),this.texture.isRenderTargetTexture=!0}},Sn=class{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,o,a){let l=n[i+0],c=n[i+1],h=n[i+2],u=n[i+3],f=r[o+0],d=r[o+1],p=r[o+2],x=r[o+3];if(a===0){e[t+0]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u;return}if(a===1){e[t+0]=f,e[t+1]=d,e[t+2]=p,e[t+3]=x;return}if(u!==x||l!==f||c!==d||h!==p){let g=1-a,m=l*f+c*d+h*p+u*x,y=m>=0?1:-1,_=1-m*m;if(_>Number.EPSILON){let F=Math.sqrt(_),T=Math.atan2(F,m*y);g=Math.sin(g*T)/F,a=Math.sin(a*T)/F}let v=a*y;if(l=l*g+f*v,c=c*g+d*v,h=h*g+p*v,u=u*g+x*v,g===1-a){let F=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=F,c*=F,h*=F,u*=F}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,i,r,o){let a=n[i],l=n[i+1],c=n[i+2],h=n[i+3],u=r[o],f=r[o+1],d=r[o+2],p=r[o+3];return e[t]=a*p+h*u+l*d-c*f,e[t+1]=l*p+h*f+c*u-a*d,e[t+2]=c*p+h*d+a*f-l*u,e[t+3]=h*p-a*u-l*f-c*d,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,i=e._y,r=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(i/2),u=a(r/2),f=l(n/2),d=l(i/2),p=l(r/2);switch(o){case"XYZ":this._x=f*h*u+c*d*p,this._y=c*d*u-f*h*p,this._z=c*h*p+f*d*u,this._w=c*h*u-f*d*p;break;case"YXZ":this._x=f*h*u+c*d*p,this._y=c*d*u-f*h*p,this._z=c*h*p-f*d*u,this._w=c*h*u+f*d*p;break;case"ZXY":this._x=f*h*u-c*d*p,this._y=c*d*u+f*h*p,this._z=c*h*p+f*d*u,this._w=c*h*u-f*d*p;break;case"ZYX":this._x=f*h*u-c*d*p,this._y=c*d*u+f*h*p,this._z=c*h*p-f*d*u,this._w=c*h*u+f*d*p;break;case"YZX":this._x=f*h*u+c*d*p,this._y=c*d*u+f*h*p,this._z=c*h*p-f*d*u,this._w=c*h*u-f*d*p;break;case"XZY":this._x=f*h*u-c*d*p,this._y=c*d*u-f*h*p,this._z=c*h*p+f*d*u,this._w=c*h*u+f*d*p;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],r=t[8],o=t[1],a=t[5],l=t[9],c=t[2],h=t[6],u=t[10],f=n+a+u;if(f>0){let d=.5/Math.sqrt(f+1);this._w=.25/d,this._x=(h-l)*d,this._y=(r-c)*d,this._z=(o-i)*d}else if(n>a&&n>u){let d=2*Math.sqrt(1+n-a-u);this._w=(h-l)/d,this._x=.25*d,this._y=(i+o)/d,this._z=(r+c)/d}else if(a>u){let d=2*Math.sqrt(1+a-n-u);this._w=(r-c)/d,this._x=(i+o)/d,this._y=.25*d,this._z=(l+h)/d}else{let d=2*Math.sqrt(1+u-n-a);this._w=(o-i)/d,this._x=(r+c)/d,this._y=(l+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<Number.EPSILON?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(gn(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,i=e._y,r=e._z,o=e._w,a=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+o*a+i*c-r*l,this._y=i*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-i*a,this._w=o*h-n*a-i*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let n=this._x,i=this._y,r=this._z,o=this._w,a=o*e._w+n*e._x+i*e._y+r*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=n,this._y=i,this._z=r,this;let l=1-a*a;if(l<=Number.EPSILON){let d=1-t;return this._w=d*o+t*this._w,this._x=d*n+t*this._x,this._y=d*i+t*this._y,this._z=d*r+t*this._z,this.normalize(),this}let c=Math.sqrt(l),h=Math.atan2(c,a),u=Math.sin((1-t)*h)/c,f=Math.sin(t*h)/c;return this._w=o*u+this._w*f,this._x=n*u+this._x*f,this._y=i*u+this._y*f,this._z=r*u+this._z*f,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},L=class s{constructor(e=0,t=0,n=0){s.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(tm.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(tm.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=e.elements,o=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*o,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*o,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*o,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,r=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*i-a*n),h=2*(a*t-r*i),u=2*(r*n-o*t);return this.x=t+l*c+o*u-a*h,this.y=n+l*h+a*c-r*u,this.z=i+l*u+r*h-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(e,Math.min(t,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,i=e.y,r=e.z,o=t.x,a=t.y,l=t.z;return this.x=i*l-r*a,this.y=r*o-n*l,this.z=n*a-i*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Mu.copy(this).projectOnVector(e),this.sub(Mu)}reflect(e){return this.sub(Mu.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(gn(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Mu=new L,tm=new Sn,wn=class{constructor(e=new L(1/0,1/0,1/0),t=new L(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Bi.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Bi.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Bi.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,Bi):Bi.fromBufferAttribute(r,o),Bi.applyMatrix4(e.matrixWorld),this.expandByPoint(Bi);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),bl.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),bl.copy(n.boundingBox)),bl.applyMatrix4(e.matrixWorld),this.union(bl)}let i=e.children;for(let r=0,o=i.length;r<o;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Bi),Bi.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(jo),Sl.subVectors(this.max,jo),eo.subVectors(e.a,jo),to.subVectors(e.b,jo),no.subVectors(e.c,jo),Ns.subVectors(to,eo),Fs.subVectors(no,to),rr.subVectors(eo,no);let t=[0,-Ns.z,Ns.y,0,-Fs.z,Fs.y,0,-rr.z,rr.y,Ns.z,0,-Ns.x,Fs.z,0,-Fs.x,rr.z,0,-rr.x,-Ns.y,Ns.x,0,-Fs.y,Fs.x,0,-rr.y,rr.x,0];return!bu(t,eo,to,no,Sl)||(t=[1,0,0,0,1,0,0,0,1],!bu(t,eo,to,no,Sl))?!1:(wl.crossVectors(Ns,Fs),t=[wl.x,wl.y,wl.z],bu(t,eo,to,no,Sl))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Bi).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Bi).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(hs[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),hs[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),hs[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),hs[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),hs[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),hs[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),hs[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),hs[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(hs),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}},hs=[new L,new L,new L,new L,new L,new L,new L,new L],Bi=new L,bl=new wn,eo=new L,to=new L,no=new L,Ns=new L,Fs=new L,rr=new L,jo=new L,Sl=new L,wl=new L,or=new L;function bu(s,e,t,n,i){for(let r=0,o=s.length-3;r<=o;r+=3){or.fromArray(s,r);let a=i.x*Math.abs(or.x)+i.y*Math.abs(or.y)+i.z*Math.abs(or.z),l=e.dot(or),c=t.dot(or),h=n.dot(or);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var pv=new wn,Qo=new L,Su=new L,Rn=class{constructor(e=new L,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):pv.setFromPoints(e).getCenter(n);let i=0;for(let r=0,o=e.length;r<o;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Qo.subVectors(e,this.center);let t=Qo.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(Qo,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Su.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Qo.copy(e.center).add(Su)),this.expandByPoint(Qo.copy(e.center).sub(Su))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}},us=new L,wu=new L,El=new L,Os=new L,Eu=new L,Al=new L,Au=new L,Xs=class{constructor(e=new L,t=new L(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,us)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=us.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(us.copy(this.origin).addScaledVector(this.direction,t),us.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){wu.copy(e).add(t).multiplyScalar(.5),El.copy(t).sub(e).normalize(),Os.copy(this.origin).sub(wu);let r=e.distanceTo(t)*.5,o=-this.direction.dot(El),a=Os.dot(this.direction),l=-Os.dot(El),c=Os.lengthSq(),h=Math.abs(1-o*o),u,f,d,p;if(h>0)if(u=o*l-a,f=o*a-l,p=r*h,u>=0)if(f>=-p)if(f<=p){let x=1/h;u*=x,f*=x,d=u*(u+o*f+2*a)+f*(o*u+f+2*l)+c}else f=r,u=Math.max(0,-(o*f+a)),d=-u*u+f*(f+2*l)+c;else f=-r,u=Math.max(0,-(o*f+a)),d=-u*u+f*(f+2*l)+c;else f<=-p?(u=Math.max(0,-(-o*r+a)),f=u>0?-r:Math.min(Math.max(-r,-l),r),d=-u*u+f*(f+2*l)+c):f<=p?(u=0,f=Math.min(Math.max(-r,-l),r),d=f*(f+2*l)+c):(u=Math.max(0,-(o*r+a)),f=u>0?r:Math.min(Math.max(-r,-l),r),d=-u*u+f*(f+2*l)+c);else f=o>0?-r:r,u=Math.max(0,-(o*f+a)),d=-u*u+f*(f+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(wu).addScaledVector(El,f),d}intersectSphere(e,t){us.subVectors(e.center,this.origin);let n=us.dot(this.direction),i=us.dot(us)-n*n,r=e.radius*e.radius;if(i>r)return null;let o=Math.sqrt(r-i),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,f=this.origin;return c>=0?(n=(e.min.x-f.x)*c,i=(e.max.x-f.x)*c):(n=(e.max.x-f.x)*c,i=(e.min.x-f.x)*c),h>=0?(r=(e.min.y-f.y)*h,o=(e.max.y-f.y)*h):(r=(e.max.y-f.y)*h,o=(e.min.y-f.y)*h),n>o||r>i||((r>n||isNaN(n))&&(n=r),(o<i||isNaN(i))&&(i=o),u>=0?(a=(e.min.z-f.z)*u,l=(e.max.z-f.z)*u):(a=(e.max.z-f.z)*u,l=(e.min.z-f.z)*u),n>l||a>i)||((a>n||n!==n)&&(n=a),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,us)!==null}intersectTriangle(e,t,n,i,r){Eu.subVectors(t,e),Al.subVectors(n,e),Au.crossVectors(Eu,Al);let o=this.direction.dot(Au),a;if(o>0){if(i)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Os.subVectors(this.origin,e);let l=a*this.direction.dot(Al.crossVectors(Os,Al));if(l<0)return null;let c=a*this.direction.dot(Eu.cross(Os));if(c<0||l+c>o)return null;let h=-a*Os.dot(Au);return h<0?null:this.at(h/o,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},ct=class s{constructor(e,t,n,i,r,o,a,l,c,h,u,f,d,p,x,g){s.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,o,a,l,c,h,u,f,d,p,x,g)}set(e,t,n,i,r,o,a,l,c,h,u,f,d,p,x,g){let m=this.elements;return m[0]=e,m[4]=t,m[8]=n,m[12]=i,m[1]=r,m[5]=o,m[9]=a,m[13]=l,m[2]=c,m[6]=h,m[10]=u,m[14]=f,m[3]=d,m[7]=p,m[11]=x,m[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new s().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,n=e.elements,i=1/io.setFromMatrixColumn(e,0).length(),r=1/io.setFromMatrixColumn(e,1).length(),o=1/io.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,i=e.y,r=e.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(r),u=Math.sin(r);if(e.order==="XYZ"){let f=o*h,d=o*u,p=a*h,x=a*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=d+p*c,t[5]=f-x*c,t[9]=-a*l,t[2]=x-f*c,t[6]=p+d*c,t[10]=o*l}else if(e.order==="YXZ"){let f=l*h,d=l*u,p=c*h,x=c*u;t[0]=f+x*a,t[4]=p*a-d,t[8]=o*c,t[1]=o*u,t[5]=o*h,t[9]=-a,t[2]=d*a-p,t[6]=x+f*a,t[10]=o*l}else if(e.order==="ZXY"){let f=l*h,d=l*u,p=c*h,x=c*u;t[0]=f-x*a,t[4]=-o*u,t[8]=p+d*a,t[1]=d+p*a,t[5]=o*h,t[9]=x-f*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let f=o*h,d=o*u,p=a*h,x=a*u;t[0]=l*h,t[4]=p*c-d,t[8]=f*c+x,t[1]=l*u,t[5]=x*c+f,t[9]=d*c-p,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let f=o*l,d=o*c,p=a*l,x=a*c;t[0]=l*h,t[4]=x-f*u,t[8]=p*u+d,t[1]=u,t[5]=o*h,t[9]=-a*h,t[2]=-c*h,t[6]=d*u+p,t[10]=f-x*u}else if(e.order==="XZY"){let f=o*l,d=o*c,p=a*l,x=a*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=f*u+x,t[5]=o*h,t[9]=d*u-p,t[2]=p*u-d,t[6]=a*h,t[10]=x*u+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(mv,e,gv)}lookAt(e,t,n){let i=this.elements;return vi.subVectors(e,t),vi.lengthSq()===0&&(vi.z=1),vi.normalize(),Bs.crossVectors(n,vi),Bs.lengthSq()===0&&(Math.abs(n.z)===1?vi.x+=1e-4:vi.z+=1e-4,vi.normalize(),Bs.crossVectors(n,vi)),Bs.normalize(),Tl.crossVectors(vi,Bs),i[0]=Bs.x,i[4]=Tl.x,i[8]=vi.x,i[1]=Bs.y,i[5]=Tl.y,i[9]=vi.y,i[2]=Bs.z,i[6]=Tl.z,i[10]=vi.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],u=n[5],f=n[9],d=n[13],p=n[2],x=n[6],g=n[10],m=n[14],y=n[3],_=n[7],v=n[11],F=n[15],T=i[0],U=i[4],C=i[8],S=i[12],M=i[1],N=i[5],J=i[9],$=i[13],ee=i[2],pe=i[6],ie=i[10],be=i[14],se=i[3],Te=i[7],Ue=i[11],Fe=i[15];return r[0]=o*T+a*M+l*ee+c*se,r[4]=o*U+a*N+l*pe+c*Te,r[8]=o*C+a*J+l*ie+c*Ue,r[12]=o*S+a*$+l*be+c*Fe,r[1]=h*T+u*M+f*ee+d*se,r[5]=h*U+u*N+f*pe+d*Te,r[9]=h*C+u*J+f*ie+d*Ue,r[13]=h*S+u*$+f*be+d*Fe,r[2]=p*T+x*M+g*ee+m*se,r[6]=p*U+x*N+g*pe+m*Te,r[10]=p*C+x*J+g*ie+m*Ue,r[14]=p*S+x*$+g*be+m*Fe,r[3]=y*T+_*M+v*ee+F*se,r[7]=y*U+_*N+v*pe+F*Te,r[11]=y*C+_*J+v*ie+F*Ue,r[15]=y*S+_*$+v*be+F*Fe,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],o=e[1],a=e[5],l=e[9],c=e[13],h=e[2],u=e[6],f=e[10],d=e[14],p=e[3],x=e[7],g=e[11],m=e[15];return p*(+r*l*u-i*c*u-r*a*f+n*c*f+i*a*d-n*l*d)+x*(+t*l*d-t*c*f+r*o*f-i*o*d+i*c*h-r*l*h)+g*(+t*c*u-t*a*d-r*o*u+n*o*d+r*a*h-n*c*h)+m*(-i*a*h-t*l*u+t*a*f+i*o*u-n*o*f+n*l*h)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],u=e[9],f=e[10],d=e[11],p=e[12],x=e[13],g=e[14],m=e[15],y=u*g*c-x*f*c+x*l*d-a*g*d-u*l*m+a*f*m,_=p*f*c-h*g*c-p*l*d+o*g*d+h*l*m-o*f*m,v=h*x*c-p*u*c+p*a*d-o*x*d-h*a*m+o*u*m,F=p*u*l-h*x*l-p*a*f+o*x*f+h*a*g-o*u*g,T=t*y+n*_+i*v+r*F;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let U=1/T;return e[0]=y*U,e[1]=(x*f*r-u*g*r-x*i*d+n*g*d+u*i*m-n*f*m)*U,e[2]=(a*g*r-x*l*r+x*i*c-n*g*c-a*i*m+n*l*m)*U,e[3]=(u*l*r-a*f*r-u*i*c+n*f*c+a*i*d-n*l*d)*U,e[4]=_*U,e[5]=(h*g*r-p*f*r+p*i*d-t*g*d-h*i*m+t*f*m)*U,e[6]=(p*l*r-o*g*r-p*i*c+t*g*c+o*i*m-t*l*m)*U,e[7]=(o*f*r-h*l*r+h*i*c-t*f*c-o*i*d+t*l*d)*U,e[8]=v*U,e[9]=(p*u*r-h*x*r-p*n*d+t*x*d+h*n*m-t*u*m)*U,e[10]=(o*x*r-p*a*r+p*n*c-t*x*c-o*n*m+t*a*m)*U,e[11]=(h*a*r-o*u*r-h*n*c+t*u*c+o*n*d-t*a*d)*U,e[12]=F*U,e[13]=(h*x*i-p*u*i+p*n*f-t*x*f-h*n*g+t*u*g)*U,e[14]=(p*a*i-o*x*i-p*n*l+t*x*l+o*n*g-t*a*g)*U,e[15]=(o*u*i-h*a*i+h*n*l-t*u*l-o*n*f+t*a*f)*U,this}scale(e){let t=this.elements,n=e.x,i=e.y,r=e.z;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),r=1-n,o=e.x,a=e.y,l=e.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-i*l,c*l+i*a,0,c*a+i*l,h*a+n,h*l-i*o,0,c*l-i*a,h*l+i*o,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,o){return this.set(1,n,r,0,e,1,o,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,r=t._x,o=t._y,a=t._z,l=t._w,c=r+r,h=o+o,u=a+a,f=r*c,d=r*h,p=r*u,x=o*h,g=o*u,m=a*u,y=l*c,_=l*h,v=l*u,F=n.x,T=n.y,U=n.z;return i[0]=(1-(x+m))*F,i[1]=(d+v)*F,i[2]=(p-_)*F,i[3]=0,i[4]=(d-v)*T,i[5]=(1-(f+m))*T,i[6]=(g+y)*T,i[7]=0,i[8]=(p+_)*U,i[9]=(g-y)*U,i[10]=(1-(f+x))*U,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements,r=io.set(i[0],i[1],i[2]).length(),o=io.set(i[4],i[5],i[6]).length(),a=io.set(i[8],i[9],i[10]).length();this.determinant()<0&&(r=-r),e.x=i[12],e.y=i[13],e.z=i[14],zi.copy(this);let c=1/r,h=1/o,u=1/a;return zi.elements[0]*=c,zi.elements[1]*=c,zi.elements[2]*=c,zi.elements[4]*=h,zi.elements[5]*=h,zi.elements[6]*=h,zi.elements[8]*=u,zi.elements[9]*=u,zi.elements[10]*=u,t.setFromRotationMatrix(zi),n.x=r,n.y=o,n.z=a,this}makePerspective(e,t,n,i,r,o,a=Ji){let l=this.elements,c=2*r/(t-e),h=2*r/(n-i),u=(t+e)/(t-e),f=(n+i)/(n-i),d,p;if(a===Ji)d=-(o+r)/(o-r),p=-2*o*r/(o-r);else if(a===Ta)d=-o/(o-r),p=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=f,l[13]=0,l[2]=0,l[6]=0,l[10]=d,l[14]=p,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,i,r,o,a=Ji){let l=this.elements,c=1/(t-e),h=1/(n-i),u=1/(o-r),f=(t+e)*c,d=(n+i)*h,p,x;if(a===Ji)p=(o+r)*u,x=-2*u;else if(a===Ta)p=r*u,x=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-f,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-d,l[2]=0,l[6]=0,l[10]=x,l[14]=-p,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},io=new L,zi=new ct,mv=new L(0,0,0),gv=new L(1,1,1),Bs=new L,Tl=new L,vi=new L,nm=new ct,im=new Sn,bi=class s{constructor(e=0,t=0,n=0,i=s.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,r=i[0],o=i[4],a=i[8],l=i[1],c=i[5],h=i[9],u=i[2],f=i[6],d=i[10];switch(t){case"XYZ":this._y=Math.asin(gn(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-gn(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(gn(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-u,d),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-gn(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(f,d),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(gn(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(a,d));break;case"XZY":this._z=Math.asin(-gn(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,d),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return nm.makeRotationFromQuaternion(e),this.setFromRotationMatrix(nm,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return im.setFromEuler(this),this.setFromQuaternion(im,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};bi.DEFAULT_ORDER="XYZ";var Ao=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},xv=0,sm=new L,so=new Sn,fs=new ct,Rl=new L,ea=new L,vv=new L,_v=new Sn,rm=new L(1,0,0),om=new L(0,1,0),am=new L(0,0,1),lm={type:"added"},yv={type:"removed"},ro={type:"childadded",child:null},Tu={type:"childremoved",child:null},Kt=class s extends Pi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:xv++}),this.uuid=Mi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=s.DEFAULT_UP.clone();let e=new L,t=new bi,n=new Sn,i=new L(1,1,1);function r(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new ct},normalMatrix:{value:new wt}}),this.matrix=new ct,this.matrixWorld=new ct,this.matrixAutoUpdate=s.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=s.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ao,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return so.setFromAxisAngle(e,t),this.quaternion.multiply(so),this}rotateOnWorldAxis(e,t){return so.setFromAxisAngle(e,t),this.quaternion.premultiply(so),this}rotateX(e){return this.rotateOnAxis(rm,e)}rotateY(e){return this.rotateOnAxis(om,e)}rotateZ(e){return this.rotateOnAxis(am,e)}translateOnAxis(e,t){return sm.copy(e).applyQuaternion(this.quaternion),this.position.add(sm.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(rm,e)}translateY(e){return this.translateOnAxis(om,e)}translateZ(e){return this.translateOnAxis(am,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(fs.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Rl.copy(e):Rl.set(e,t,n);let i=this.parent;this.updateWorldMatrix(!0,!1),ea.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?fs.lookAt(ea,Rl,this.up):fs.lookAt(Rl,ea,this.up),this.quaternion.setFromRotationMatrix(fs),i&&(fs.extractRotation(i.matrixWorld),so.setFromRotationMatrix(fs),this.quaternion.premultiply(so.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(lm),ro.child=e,this.dispatchEvent(ro),ro.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(yv),Tu.child=e,this.dispatchEvent(Tu),Tu.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),fs.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),fs.multiply(e.parent.matrixWorld)),e.applyMatrix4(fs),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(lm),ro.child=e,this.dispatchEvent(ro),ro.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let i=this.children;for(let r=0,o=i.length;r<o;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ea,e,vv),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ea,_v,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){let i=this.children;for(let r=0,o=i.length;r<o;r++)i[r].updateWorldMatrix(!1,!0)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(e),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let u=l[c];r(e.shapes,u)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(e.materials,this.material[l]));i.material=a}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let a=0;a<this.children.length;a++)i.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];i.animations.push(r(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),h=o(e.images),u=o(e.shapes),f=o(e.skeletons),d=o(e.animations),p=o(e.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),f.length>0&&(n.skeletons=f),d.length>0&&(n.animations=d),p.length>0&&(n.nodes=p)}return n.object=i,n;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}};Kt.DEFAULT_UP=new L(0,1,0);Kt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Kt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var ki=new L,ds=new L,Ru=new L,ps=new L,oo=new L,ao=new L,cm=new L,Cu=new L,Pu=new L,Iu=new L,Lu=new kt,Du=new kt,Uu=new kt,Ki=class s{constructor(e=new L,t=new L,n=new L){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),ki.subVectors(e,t),i.cross(ki);let r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(e,t,n,i,r){ki.subVectors(i,t),ds.subVectors(n,t),Ru.subVectors(e,t);let o=ki.dot(ki),a=ki.dot(ds),l=ki.dot(Ru),c=ds.dot(ds),h=ds.dot(Ru),u=o*c-a*a;if(u===0)return r.set(0,0,0),null;let f=1/u,d=(c*l-a*h)*f,p=(o*h-a*l)*f;return r.set(1-d-p,p,d)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,ps)===null?!1:ps.x>=0&&ps.y>=0&&ps.x+ps.y<=1}static getInterpolation(e,t,n,i,r,o,a,l){return this.getBarycoord(e,t,n,i,ps)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,ps.x),l.addScaledVector(o,ps.y),l.addScaledVector(a,ps.z),l)}static getInterpolatedAttribute(e,t,n,i,r,o){return Lu.setScalar(0),Du.setScalar(0),Uu.setScalar(0),Lu.fromBufferAttribute(e,t),Du.fromBufferAttribute(e,n),Uu.fromBufferAttribute(e,i),o.setScalar(0),o.addScaledVector(Lu,r.x),o.addScaledVector(Du,r.y),o.addScaledVector(Uu,r.z),o}static isFrontFacing(e,t,n,i){return ki.subVectors(n,t),ds.subVectors(e,t),ki.cross(ds).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return ki.subVectors(this.c,this.b),ds.subVectors(this.a,this.b),ki.cross(ds).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return s.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return s.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,r){return s.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return s.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return s.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,r=this.c,o,a;oo.subVectors(i,n),ao.subVectors(r,n),Cu.subVectors(e,n);let l=oo.dot(Cu),c=ao.dot(Cu);if(l<=0&&c<=0)return t.copy(n);Pu.subVectors(e,i);let h=oo.dot(Pu),u=ao.dot(Pu);if(h>=0&&u<=h)return t.copy(i);let f=l*u-h*c;if(f<=0&&l>=0&&h<=0)return o=l/(l-h),t.copy(n).addScaledVector(oo,o);Iu.subVectors(e,r);let d=oo.dot(Iu),p=ao.dot(Iu);if(p>=0&&d<=p)return t.copy(r);let x=d*c-l*p;if(x<=0&&c>=0&&p<=0)return a=c/(c-p),t.copy(n).addScaledVector(ao,a);let g=h*p-d*u;if(g<=0&&u-h>=0&&d-p>=0)return cm.subVectors(r,i),a=(u-h)/(u-h+(d-p)),t.copy(i).addScaledVector(cm,a);let m=1/(g+x+f);return o=x*m,a=f*m,t.copy(n).addScaledVector(oo,o).addScaledVector(ao,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},yg={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},zs={h:0,s:0,l:0},Cl={h:0,s:0,l:0};function Nu(s,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?s+(e-s)*6*t:t<1/2?e:t<2/3?s+(e-s)*6*(2/3-t):s}var Be=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=An){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,zt.toWorkingColorSpace(this,t),this}setRGB(e,t,n,i=zt.workingColorSpace){return this.r=e,this.g=t,this.b=n,zt.toWorkingColorSpace(this,i),this}setHSL(e,t,n,i=zt.workingColorSpace){if(e=kd(e,1),t=gn(t,0,1),n=gn(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,o=2*n-r;this.r=Nu(o,r,e+1/3),this.g=Nu(o,r,e),this.b=Nu(o,r,e-1/3)}return zt.toWorkingColorSpace(this,i),this}setStyle(e,t=An){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,o=i[1],a=i[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=i[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=An){let n=yg[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Ms(e.r),this.g=Ms(e.g),this.b=Ms(e.b),this}copyLinearToSRGB(e){return this.r=Mo(e.r),this.g=Mo(e.g),this.b=Mo(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=An){return zt.fromWorkingColorSpace(qn.copy(this),e),Math.round(gn(qn.r*255,0,255))*65536+Math.round(gn(qn.g*255,0,255))*256+Math.round(gn(qn.b*255,0,255))}getHexString(e=An){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=zt.workingColorSpace){zt.fromWorkingColorSpace(qn.copy(this),t);let n=qn.r,i=qn.g,r=qn.b,o=Math.max(n,i,r),a=Math.min(n,i,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let u=o-a;switch(c=h<=.5?u/(o+a):u/(2-o-a),o){case n:l=(i-r)/u+(i<r?6:0);break;case i:l=(r-n)/u+2;break;case r:l=(n-i)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=zt.workingColorSpace){return zt.fromWorkingColorSpace(qn.copy(this),t),e.r=qn.r,e.g=qn.g,e.b=qn.b,e}getStyle(e=An){zt.fromWorkingColorSpace(qn.copy(this),e);let t=qn.r,n=qn.g,i=qn.b;return e!==An?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(zs),this.setHSL(zs.h+e,zs.s+t,zs.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(zs),e.getHSL(Cl);let n=va(zs.h,Cl.h,t),i=va(zs.s,Cl.s,t),r=va(zs.l,Cl.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},qn=new Be;Be.NAMES=yg;var Mv=0,xn=class extends Pi{static get type(){return"Material"}get type(){return this.constructor.type}set type(e){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Mv++}),this.uuid=Mi(),this.name="",this.blending=wr,this.side=Gi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=pc,this.blendDst=mc,this.blendEquation=Vs,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Be(0,0,0),this.blendAlpha=0,this.depthFunc=Rr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=uf,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=vr,this.stencilZFail=vr,this.stencilZPass=vr,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==wr&&(n.blending=this.blending),this.side!==Gi&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==pc&&(n.blendSrc=this.blendSrc),this.blendDst!==mc&&(n.blendDst=this.blendDst),this.blendEquation!==Vs&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Rr&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==uf&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==vr&&(n.stencilFail=this.stencilFail),this.stencilZFail!==vr&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==vr&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(t){let r=i(e.textures),o=i(e.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}},zn=class extends xn{static get type(){return"MeshBasicMaterial"}constructor(e){super(),this.isMeshBasicMaterial=!0,this.color=new Be(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new bi,this.combine=sl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},xs=bv();function bv(){let s=new ArrayBuffer(4),e=new Float32Array(s),t=new Uint32Array(s),n=new Uint32Array(512),i=new Uint32Array(512);for(let l=0;l<256;++l){let c=l-127;c<-27?(n[l]=0,n[l|256]=32768,i[l]=24,i[l|256]=24):c<-14?(n[l]=1024>>-c-14,n[l|256]=1024>>-c-14|32768,i[l]=-c-1,i[l|256]=-c-1):c<=15?(n[l]=c+15<<10,n[l|256]=c+15<<10|32768,i[l]=13,i[l|256]=13):c<128?(n[l]=31744,n[l|256]=64512,i[l]=24,i[l|256]=24):(n[l]=31744,n[l|256]=64512,i[l]=13,i[l|256]=13)}let r=new Uint32Array(2048),o=new Uint32Array(64),a=new Uint32Array(64);for(let l=1;l<1024;++l){let c=l<<13,h=0;for(;!(c&8388608);)c<<=1,h-=8388608;c&=-8388609,h+=947912704,r[l]=c|h}for(let l=1024;l<2048;++l)r[l]=939524096+(l-1024<<13);for(let l=1;l<31;++l)o[l]=l<<23;o[31]=1199570944,o[32]=2147483648;for(let l=33;l<63;++l)o[l]=2147483648+(l-32<<23);o[63]=3347054592;for(let l=1;l<64;++l)l!==32&&(a[l]=1024);return{floatView:e,uint32View:t,baseTable:n,shiftTable:i,mantissaTable:r,exponentTable:o,offsetTable:a}}function li(s){Math.abs(s)>65504&&console.warn("THREE.DataUtils.toHalfFloat(): Value out of range."),s=gn(s,-65504,65504),xs.floatView[0]=s;let e=xs.uint32View[0],t=e>>23&511;return xs.baseTable[t]+((e&8388607)>>xs.shiftTable[t])}function ua(s){let e=s>>10;return xs.uint32View[0]=xs.mantissaTable[xs.offsetTable[e]+(s&1023)]+xs.exponentTable[e],xs.floatView[0]}var Sv={toHalfFloat:li,fromHalfFloat:ua},En=new L,Pl=new _e,ht=class{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Aa,this.updateRanges=[],this.gpuType=hi,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Pl.fromBufferAttribute(this,t),Pl.applyMatrix3(e),this.setXY(t,Pl.x,Pl.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)En.fromBufferAttribute(this,t),En.applyMatrix3(e),this.setXYZ(t,En.x,En.y,En.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)En.fromBufferAttribute(this,t),En.applyMatrix4(e),this.setXYZ(t,En.x,En.y,En.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)En.fromBufferAttribute(this,t),En.applyNormalMatrix(e),this.setXYZ(t,En.x,En.y,En.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)En.fromBufferAttribute(this,t),En.transformDirection(e),this.setXYZ(t,En.x,En.y,En.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=jn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Lt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=jn(t,this.array)),t}setX(e,t){return this.normalized&&(t=Lt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=jn(t,this.array)),t}setY(e,t){return this.normalized&&(t=Lt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=jn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Lt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=jn(t,this.array)),t}setW(e,t){return this.normalized&&(t=Lt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array),i=Lt(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e*=this.itemSize,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array),i=Lt(i,this.array),r=Lt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Aa&&(e.usage=this.usage),e}},mf=class extends ht{constructor(e,t,n){super(new Int8Array(e),t,n)}},gf=class extends ht{constructor(e,t,n){super(new Uint8Array(e),t,n)}},xf=class extends ht{constructor(e,t,n){super(new Uint8ClampedArray(e),t,n)}},vf=class extends ht{constructor(e,t,n){super(new Int16Array(e),t,n)}},Pa=class extends ht{constructor(e,t,n){super(new Uint16Array(e),t,n)}},_f=class extends ht{constructor(e,t,n){super(new Int32Array(e),t,n)}},Ia=class extends ht{constructor(e,t,n){super(new Uint32Array(e),t,n)}},yf=class extends ht{constructor(e,t,n){super(new Uint16Array(e),t,n),this.isFloat16BufferAttribute=!0}getX(e){let t=ua(this.array[e*this.itemSize]);return this.normalized&&(t=jn(t,this.array)),t}setX(e,t){return this.normalized&&(t=Lt(t,this.array)),this.array[e*this.itemSize]=li(t),this}getY(e){let t=ua(this.array[e*this.itemSize+1]);return this.normalized&&(t=jn(t,this.array)),t}setY(e,t){return this.normalized&&(t=Lt(t,this.array)),this.array[e*this.itemSize+1]=li(t),this}getZ(e){let t=ua(this.array[e*this.itemSize+2]);return this.normalized&&(t=jn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Lt(t,this.array)),this.array[e*this.itemSize+2]=li(t),this}getW(e){let t=ua(this.array[e*this.itemSize+3]);return this.normalized&&(t=jn(t,this.array)),t}setW(e,t){return this.normalized&&(t=Lt(t,this.array)),this.array[e*this.itemSize+3]=li(t),this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array)),this.array[e+0]=li(t),this.array[e+1]=li(n),this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array),i=Lt(i,this.array)),this.array[e+0]=li(t),this.array[e+1]=li(n),this.array[e+2]=li(i),this}setXYZW(e,t,n,i,r){return e*=this.itemSize,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array),i=Lt(i,this.array),r=Lt(r,this.array)),this.array[e+0]=li(t),this.array[e+1]=li(n),this.array[e+2]=li(i),this.array[e+3]=li(r),this}},Me=class extends ht{constructor(e,t,n){super(new Float32Array(e),t,n)}},wv=0,Ti=new ct,Fu=new Kt,lo=new L,_i=new wn,ta=new wn,On=new L,tt=class s extends Pi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:wv++}),this.uuid=Mi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(vg(e)?Ia:Pa)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new wt().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Ti.makeRotationFromQuaternion(e),this.applyMatrix4(Ti),this}rotateX(e){return Ti.makeRotationX(e),this.applyMatrix4(Ti),this}rotateY(e){return Ti.makeRotationY(e),this.applyMatrix4(Ti),this}rotateZ(e){return Ti.makeRotationZ(e),this.applyMatrix4(Ti),this}translate(e,t,n){return Ti.makeTranslation(e,t,n),this.applyMatrix4(Ti),this}scale(e,t,n){return Ti.makeScale(e,t,n),this.applyMatrix4(Ti),this}lookAt(e){return Fu.lookAt(e),Fu.updateMatrix(),this.applyMatrix4(Fu.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(lo).negate(),this.translate(lo.x,lo.y,lo.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,r=e.length;i<r;i++){let o=e[i];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new Me(n,3))}else{for(let n=0,i=t.count;n<i;n++){let r=e[n];t.setXYZ(n,r.x,r.y,r.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new wn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new L(-1/0,-1/0,-1/0),new L(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let r=t[n];_i.setFromBufferAttribute(r),this.morphTargetsRelative?(On.addVectors(this.boundingBox.min,_i.min),this.boundingBox.expandByPoint(On),On.addVectors(this.boundingBox.max,_i.max),this.boundingBox.expandByPoint(On)):(this.boundingBox.expandByPoint(_i.min),this.boundingBox.expandByPoint(_i.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Rn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new L,1/0);return}if(e){let n=this.boundingSphere.center;if(_i.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){let a=t[r];ta.setFromBufferAttribute(a),this.morphTargetsRelative?(On.addVectors(_i.min,ta.min),_i.expandByPoint(On),On.addVectors(_i.max,ta.max),_i.expandByPoint(On)):(_i.expandByPoint(ta.min),_i.expandByPoint(ta.max))}_i.getCenter(n);let i=0;for(let r=0,o=e.count;r<o;r++)On.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(On));if(t)for(let r=0,o=t.length;r<o;r++){let a=t[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)On.fromBufferAttribute(a,c),l&&(lo.fromBufferAttribute(e,c),On.add(lo)),i=Math.max(i,n.distanceToSquared(On))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,i=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new ht(new Float32Array(4*n.count),4));let o=this.getAttribute("tangent"),a=[],l=[];for(let C=0;C<n.count;C++)a[C]=new L,l[C]=new L;let c=new L,h=new L,u=new L,f=new _e,d=new _e,p=new _e,x=new L,g=new L;function m(C,S,M){c.fromBufferAttribute(n,C),h.fromBufferAttribute(n,S),u.fromBufferAttribute(n,M),f.fromBufferAttribute(r,C),d.fromBufferAttribute(r,S),p.fromBufferAttribute(r,M),h.sub(c),u.sub(c),d.sub(f),p.sub(f);let N=1/(d.x*p.y-p.x*d.y);isFinite(N)&&(x.copy(h).multiplyScalar(p.y).addScaledVector(u,-d.y).multiplyScalar(N),g.copy(u).multiplyScalar(d.x).addScaledVector(h,-p.x).multiplyScalar(N),a[C].add(x),a[S].add(x),a[M].add(x),l[C].add(g),l[S].add(g),l[M].add(g))}let y=this.groups;y.length===0&&(y=[{start:0,count:e.count}]);for(let C=0,S=y.length;C<S;++C){let M=y[C],N=M.start,J=M.count;for(let $=N,ee=N+J;$<ee;$+=3)m(e.getX($+0),e.getX($+1),e.getX($+2))}let _=new L,v=new L,F=new L,T=new L;function U(C){F.fromBufferAttribute(i,C),T.copy(F);let S=a[C];_.copy(S),_.sub(F.multiplyScalar(F.dot(S))).normalize(),v.crossVectors(T,S);let N=v.dot(l[C])<0?-1:1;o.setXYZW(C,_.x,_.y,_.z,N)}for(let C=0,S=y.length;C<S;++C){let M=y[C],N=M.start,J=M.count;for(let $=N,ee=N+J;$<ee;$+=3)U(e.getX($+0)),U(e.getX($+1)),U(e.getX($+2))}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new ht(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let f=0,d=n.count;f<d;f++)n.setXYZ(f,0,0,0);let i=new L,r=new L,o=new L,a=new L,l=new L,c=new L,h=new L,u=new L;if(e)for(let f=0,d=e.count;f<d;f+=3){let p=e.getX(f+0),x=e.getX(f+1),g=e.getX(f+2);i.fromBufferAttribute(t,p),r.fromBufferAttribute(t,x),o.fromBufferAttribute(t,g),h.subVectors(o,r),u.subVectors(i,r),h.cross(u),a.fromBufferAttribute(n,p),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,g),a.add(h),l.add(h),c.add(h),n.setXYZ(p,a.x,a.y,a.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(g,c.x,c.y,c.z)}else for(let f=0,d=t.count;f<d;f+=3)i.fromBufferAttribute(t,f+0),r.fromBufferAttribute(t,f+1),o.fromBufferAttribute(t,f+2),h.subVectors(o,r),u.subVectors(i,r),h.cross(u),n.setXYZ(f+0,h.x,h.y,h.z),n.setXYZ(f+1,h.x,h.y,h.z),n.setXYZ(f+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)On.fromBufferAttribute(e,t),On.normalize(),e.setXYZ(t,On.x,On.y,On.z)}toNonIndexed(){function e(a,l){let c=a.array,h=a.itemSize,u=a.normalized,f=new c.constructor(l.length*h),d=0,p=0;for(let x=0,g=l.length;x<g;x++){a.isInterleavedBufferAttribute?d=l[x]*a.data.stride+a.offset:d=l[x]*h;for(let m=0;m<h;m++)f[p++]=c[d++]}return new ht(f,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new s,n=this.index.array,i=this.attributes;for(let a in i){let l=i[a],c=e(l,n);t.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,u=c.length;h<u;h++){let f=c[h],d=e(f,n);l.push(d)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let i={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let u=0,f=c.length;u<f;u++){let d=c[u];h.push(d.toJSON(e.data))}h.length>0&&(i[l]=h,r=!0)}r&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone(t));let i=e.attributes;for(let c in i){let h=i[c];this.setAttribute(c,h.clone(t))}let r=e.morphAttributes;for(let c in r){let h=[],u=r[c];for(let f=0,d=u.length;f<d;f++)h.push(u[f].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,h=o.length;c<h;c++){let u=o[c];this.addGroup(u.start,u.count,u.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},hm=new ct,ar=new Xs,Il=new Rn,um=new L,Ll=new L,Dl=new L,Ul=new L,Ou=new L,Nl=new L,fm=new L,Fl=new L,Ft=class extends Kt{constructor(e=new tt,t=new zn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let a=this.morphTargetInfluences;if(r&&a){Nl.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],u=r[l];h!==0&&(Ou.fromBufferAttribute(u,e),o?Nl.addScaledVector(Ou,h):Nl.addScaledVector(Ou.sub(t),h))}t.add(Nl)}return t}raycast(e,t){let n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Il.copy(n.boundingSphere),Il.applyMatrix4(r),ar.copy(e.ray).recast(e.near),!(Il.containsPoint(ar.origin)===!1&&(ar.intersectSphere(Il,um)===null||ar.origin.distanceToSquared(um)>(e.far-e.near)**2))&&(hm.copy(r).invert(),ar.copy(e.ray).applyMatrix4(hm),!(n.boundingBox!==null&&ar.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,ar)))}_computeIntersections(e,t,n){let i,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,f=r.groups,d=r.drawRange;if(a!==null)if(Array.isArray(o))for(let p=0,x=f.length;p<x;p++){let g=f[p],m=o[g.materialIndex],y=Math.max(g.start,d.start),_=Math.min(a.count,Math.min(g.start+g.count,d.start+d.count));for(let v=y,F=_;v<F;v+=3){let T=a.getX(v),U=a.getX(v+1),C=a.getX(v+2);i=Ol(this,m,e,n,c,h,u,T,U,C),i&&(i.faceIndex=Math.floor(v/3),i.face.materialIndex=g.materialIndex,t.push(i))}}else{let p=Math.max(0,d.start),x=Math.min(a.count,d.start+d.count);for(let g=p,m=x;g<m;g+=3){let y=a.getX(g),_=a.getX(g+1),v=a.getX(g+2);i=Ol(this,o,e,n,c,h,u,y,_,v),i&&(i.faceIndex=Math.floor(g/3),t.push(i))}}else if(l!==void 0)if(Array.isArray(o))for(let p=0,x=f.length;p<x;p++){let g=f[p],m=o[g.materialIndex],y=Math.max(g.start,d.start),_=Math.min(l.count,Math.min(g.start+g.count,d.start+d.count));for(let v=y,F=_;v<F;v+=3){let T=v,U=v+1,C=v+2;i=Ol(this,m,e,n,c,h,u,T,U,C),i&&(i.faceIndex=Math.floor(v/3),i.face.materialIndex=g.materialIndex,t.push(i))}}else{let p=Math.max(0,d.start),x=Math.min(l.count,d.start+d.count);for(let g=p,m=x;g<m;g+=3){let y=g,_=g+1,v=g+2;i=Ol(this,o,e,n,c,h,u,y,_,v),i&&(i.faceIndex=Math.floor(g/3),t.push(i))}}}};function Ev(s,e,t,n,i,r,o,a){let l;if(e.side===ei?l=n.intersectTriangle(o,r,i,!0,a):l=n.intersectTriangle(i,r,o,e.side===Gi,a),l===null)return null;Fl.copy(a),Fl.applyMatrix4(s.matrixWorld);let c=t.ray.origin.distanceTo(Fl);return c<t.near||c>t.far?null:{distance:c,point:Fl.clone(),object:s}}function Ol(s,e,t,n,i,r,o,a,l,c){s.getVertexPosition(a,Ll),s.getVertexPosition(l,Dl),s.getVertexPosition(c,Ul);let h=Ev(s,e,t,n,Ll,Dl,Ul,fm);if(h){let u=new L;Ki.getBarycoord(fm,Ll,Dl,Ul,u),i&&(h.uv=Ki.getInterpolatedAttribute(i,a,l,c,u,new _e)),r&&(h.uv1=Ki.getInterpolatedAttribute(r,a,l,c,u,new _e)),o&&(h.normal=Ki.getInterpolatedAttribute(o,a,l,c,u,new L),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let f={a,b:l,c,normal:new L,materialIndex:0};Ki.getNormal(Ll,Dl,Ul,f.normal),h.face=f,h.barycoord=u}return h}var Nr=class s extends tt{constructor(e=1,t=1,n=1,i=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:o};let a=this;i=Math.floor(i),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],u=[],f=0,d=0;p("z","y","x",-1,-1,n,t,e,o,r,0),p("z","y","x",1,-1,n,t,-e,o,r,1),p("x","z","y",1,1,e,n,t,i,o,2),p("x","z","y",1,-1,e,n,-t,i,o,3),p("x","y","z",1,-1,e,t,n,i,r,4),p("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(l),this.setAttribute("position",new Me(c,3)),this.setAttribute("normal",new Me(h,3)),this.setAttribute("uv",new Me(u,2));function p(x,g,m,y,_,v,F,T,U,C,S){let M=v/U,N=F/C,J=v/2,$=F/2,ee=T/2,pe=U+1,ie=C+1,be=0,se=0,Te=new L;for(let Ue=0;Ue<ie;Ue++){let Fe=Ue*N-$;for(let dt=0;dt<pe;dt++){let Gt=dt*M-J;Te[x]=Gt*y,Te[g]=Fe*_,Te[m]=ee,c.push(Te.x,Te.y,Te.z),Te[x]=0,Te[g]=0,Te[m]=T>0?1:-1,h.push(Te.x,Te.y,Te.z),u.push(dt/U),u.push(1-Ue/C),be+=1}}for(let Ue=0;Ue<C;Ue++)for(let Fe=0;Fe<U;Fe++){let dt=f+Fe+pe*Ue,Gt=f+Fe+pe*(Ue+1),me=f+(Fe+1)+pe*(Ue+1),Le=f+(Fe+1)+pe*Ue;l.push(dt,Gt,Le),l.push(Gt,me,Le),se+=6}a.addGroup(d,se,S),d+=se,f+=be}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};function To(s){let e={};for(let t in s){e[t]={};for(let n in s[t]){let i=s[t][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone():Array.isArray(i)?e[t][n]=i.slice():e[t][n]=i}}return e}function Jn(s){let e={};for(let t=0;t<s.length;t++){let n=To(s[t]);for(let i in n)e[i]=n[i]}return e}function Av(s){let e=[];for(let t=0;t<s.length;t++)e.push(s[t].clone());return e}function Mg(s){let e=s.getRenderTarget();return e===null?s.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:zt.workingColorSpace}var bg={clone:To,merge:Jn},Tv=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Rv=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Ot=class extends xn{static get type(){return"ShaderMaterial"}constructor(e){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Tv,this.fragmentShader=Rv,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=To(e.uniforms),this.uniformsGroups=Av(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let o=this.uniforms[i].value;o&&o.isTexture?t.uniforms[i]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[i]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[i]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[i]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[i]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[i]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[i]={type:"m4",value:o.toArray()}:t.uniforms[i]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}},qs=class extends Kt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ct,this.projectionMatrix=new ct,this.projectionMatrixInverse=new ct,this.coordinateSystem=Ji}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},ks=new L,dm=new _e,pm=new _e,Mn=class extends qs{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=wo*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Tr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return wo*2*Math.atan(Math.tan(Tr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){ks.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(ks.x,ks.y).multiplyScalar(-e/ks.z),ks.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(ks.x,ks.y).multiplyScalar(-e/ks.z)}getViewSize(e,t){return this.getViewBounds(e,dm,pm),t.subVectors(pm,dm)}setViewOffset(e,t,n,i,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Tr*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-.5*i,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*i/l,t-=o.offsetY*n/c,i*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},co=-90,ho=1,Kc=class extends Kt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new Mn(co,ho,e,t);i.layers=this.layers,this.add(i);let r=new Mn(co,ho,e,t);r.layers=this.layers,this.add(r);let o=new Mn(co,ho,e,t);o.layers=this.layers,this.add(o);let a=new Mn(co,ho,e,t);a.layers=this.layers,this.add(a);let l=new Mn(co,ho,e,t);l.layers=this.layers,this.add(l);let c=new Mn(co,ho,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,r,o,a,l]=t;for(let c of t)this.remove(c);if(e===Ji)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Ta)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,u=e.getRenderTarget(),f=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,i),e.render(t,r),e.setRenderTarget(n,1,i),e.render(t,o),e.setRenderTarget(n,2,i),e.render(t,a),e.setRenderTarget(n,3,i),e.render(t,l),e.setRenderTarget(n,4,i),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,i),e.render(t,h),e.setRenderTarget(u,f,d),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},Fr=class extends dn{constructor(e,t,n,i,r,o,a,l,c,h){e=e!==void 0?e:[],t=t!==void 0?t:Ss,super(e,t,n,i,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Jc=class extends ti{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new Fr(i,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:cn}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Nr(5,5,5),r=new Ot({name:"CubemapFromEquirect",uniforms:To(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:ei,blending:Vi});r.uniforms.tEquirect.value=t;let o=new Ft(i,r),a=t.minFilter;return t.minFilter===yi&&(t.minFilter=cn),new Kc(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t,n,i){let r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,i);e.setRenderTarget(r)}},Bu=new L,Cv=new L,Pv=new wt,$i=class{constructor(e=new L(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=Bu.subVectors(n,t).cross(Cv.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){let n=e.delta(Bu),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let r=-(e.start.dot(this.normal)+this.constant)/i;return r<0||r>1?null:t.copy(e.start).addScaledVector(n,r)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Pv.getNormalMatrix(e),i=this.coplanarPoint(Bu).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},lr=new Rn,Bl=new L,Or=class{constructor(e=new $i,t=new $i,n=new $i,i=new $i,r=new $i,o=new $i){this.planes=[e,t,n,i,r,o]}set(e,t,n,i,r,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(i),a[4].copy(r),a[5].copy(o),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Ji){let n=this.planes,i=e.elements,r=i[0],o=i[1],a=i[2],l=i[3],c=i[4],h=i[5],u=i[6],f=i[7],d=i[8],p=i[9],x=i[10],g=i[11],m=i[12],y=i[13],_=i[14],v=i[15];if(n[0].setComponents(l-r,f-c,g-d,v-m).normalize(),n[1].setComponents(l+r,f+c,g+d,v+m).normalize(),n[2].setComponents(l+o,f+h,g+p,v+y).normalize(),n[3].setComponents(l-o,f-h,g-p,v-y).normalize(),n[4].setComponents(l-a,f-u,g-x,v-_).normalize(),t===Ji)n[5].setComponents(l+a,f+u,g+x,v+_).normalize();else if(t===Ta)n[5].setComponents(a,u,x,_).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),lr.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),lr.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(lr)}intersectsSprite(e){return lr.center.set(0,0,0),lr.radius=.7071067811865476,lr.applyMatrix4(e.matrixWorld),this.intersectsSphere(lr)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Bl.x=i.normal.x>0?e.max.x:e.min.x,Bl.y=i.normal.y>0?e.max.y:e.min.y,Bl.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Bl)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};function Sg(){let s=null,e=!1,t=null,n=null;function i(r,o){t(r,o),n=s.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&(n=s.requestAnimationFrame(i),e=!0)},stop:function(){s.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){s=r}}}function Iv(s){let e=new WeakMap;function t(a,l){let c=a.array,h=a.usage,u=c.byteLength,f=s.createBuffer();s.bindBuffer(l,f),s.bufferData(l,c,h),a.onUploadCallback();let d;if(c instanceof Float32Array)d=s.FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?d=s.HALF_FLOAT:d=s.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=s.SHORT;else if(c instanceof Uint32Array)d=s.UNSIGNED_INT;else if(c instanceof Int32Array)d=s.INT;else if(c instanceof Int8Array)d=s.BYTE;else if(c instanceof Uint8Array)d=s.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:f,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:u}}function n(a,l,c){let h=l.array,u=l.updateRanges;if(s.bindBuffer(c,a),u.length===0)s.bufferSubData(c,0,h);else{u.sort((d,p)=>d.start-p.start);let f=0;for(let d=1;d<u.length;d++){let p=u[f],x=u[d];x.start<=p.start+p.count+1?p.count=Math.max(p.count,x.start+x.count-p.start):(++f,u[f]=x)}u.length=f+1;for(let d=0,p=u.length;d<p;d++){let x=u[d];s.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function i(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(s.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:i,remove:r,update:o}}var As=class s extends tt{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let r=e/2,o=t/2,a=Math.floor(n),l=Math.floor(i),c=a+1,h=l+1,u=e/a,f=t/l,d=[],p=[],x=[],g=[];for(let m=0;m<h;m++){let y=m*f-o;for(let _=0;_<c;_++){let v=_*u-r;p.push(v,-y,0),x.push(0,0,1),g.push(_/a),g.push(1-m/l)}}for(let m=0;m<l;m++)for(let y=0;y<a;y++){let _=y+c*m,v=y+c*(m+1),F=y+1+c*(m+1),T=y+1+c*m;d.push(_,v,T),d.push(v,F,T)}this.setIndex(d),this.setAttribute("position",new Me(p,3)),this.setAttribute("normal",new Me(x,3)),this.setAttribute("uv",new Me(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.widthSegments,e.heightSegments)}},Lv=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Dv=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Uv=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Nv=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Fv=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Ov=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Bv=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,zv=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,kv=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Hv=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Vv=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Gv=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Wv=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Xv=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,qv=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Yv=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Zv=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,$v=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Kv=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Jv=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,jv=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Qv=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,e_=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,t_=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,n_=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,i_=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,s_=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,r_=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,o_=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,a_=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,l_="gl_FragColor = linearToOutputTexel( gl_FragColor );",c_=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,h_=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,u_=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,f_=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,d_=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,p_=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,m_=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,g_=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,x_=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,v_=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,__=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,y_=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,M_=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,b_=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,S_=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,w_=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,E_=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,A_=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,T_=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,R_=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,C_=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,P_=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,I_=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,L_=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,D_=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,U_=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,N_=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,F_=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,O_=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,B_=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,z_=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,k_=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,H_=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,V_=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,G_=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,W_=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,X_=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,q_=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Y_=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Z_=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,$_=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,K_=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,J_=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,j_=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Q_=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,ey=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,ty=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,ny=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,iy=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,sy=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,ry=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,oy=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,ay=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,ly=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,cy=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,hy=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,uy=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,fy=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,dy=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,py=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,my=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,gy=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,xy=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,vy=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,_y=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,yy=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,My=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,by=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Sy=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,wy=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Ey=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Ay=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Ty=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Ry=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Cy=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Py=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Iy=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Ly=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Dy=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Uy=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ny=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Fy=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Oy=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,By=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,zy=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,ky=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Hy=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Vy=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Gy=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Wy=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Xy=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,qy=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Yy=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Zy=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$y=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Ky=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Jy=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,jy=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Qy=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,eM=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,tM=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,nM=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,iM=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,sM=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,rM=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,oM=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,aM=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,lM=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,cM=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,hM=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Dt={alphahash_fragment:Lv,alphahash_pars_fragment:Dv,alphamap_fragment:Uv,alphamap_pars_fragment:Nv,alphatest_fragment:Fv,alphatest_pars_fragment:Ov,aomap_fragment:Bv,aomap_pars_fragment:zv,batching_pars_vertex:kv,batching_vertex:Hv,begin_vertex:Vv,beginnormal_vertex:Gv,bsdfs:Wv,iridescence_fragment:Xv,bumpmap_pars_fragment:qv,clipping_planes_fragment:Yv,clipping_planes_pars_fragment:Zv,clipping_planes_pars_vertex:$v,clipping_planes_vertex:Kv,color_fragment:Jv,color_pars_fragment:jv,color_pars_vertex:Qv,color_vertex:e_,common:t_,cube_uv_reflection_fragment:n_,defaultnormal_vertex:i_,displacementmap_pars_vertex:s_,displacementmap_vertex:r_,emissivemap_fragment:o_,emissivemap_pars_fragment:a_,colorspace_fragment:l_,colorspace_pars_fragment:c_,envmap_fragment:h_,envmap_common_pars_fragment:u_,envmap_pars_fragment:f_,envmap_pars_vertex:d_,envmap_physical_pars_fragment:w_,envmap_vertex:p_,fog_vertex:m_,fog_pars_vertex:g_,fog_fragment:x_,fog_pars_fragment:v_,gradientmap_pars_fragment:__,lightmap_pars_fragment:y_,lights_lambert_fragment:M_,lights_lambert_pars_fragment:b_,lights_pars_begin:S_,lights_toon_fragment:E_,lights_toon_pars_fragment:A_,lights_phong_fragment:T_,lights_phong_pars_fragment:R_,lights_physical_fragment:C_,lights_physical_pars_fragment:P_,lights_fragment_begin:I_,lights_fragment_maps:L_,lights_fragment_end:D_,logdepthbuf_fragment:U_,logdepthbuf_pars_fragment:N_,logdepthbuf_pars_vertex:F_,logdepthbuf_vertex:O_,map_fragment:B_,map_pars_fragment:z_,map_particle_fragment:k_,map_particle_pars_fragment:H_,metalnessmap_fragment:V_,metalnessmap_pars_fragment:G_,morphinstance_vertex:W_,morphcolor_vertex:X_,morphnormal_vertex:q_,morphtarget_pars_vertex:Y_,morphtarget_vertex:Z_,normal_fragment_begin:$_,normal_fragment_maps:K_,normal_pars_fragment:J_,normal_pars_vertex:j_,normal_vertex:Q_,normalmap_pars_fragment:ey,clearcoat_normal_fragment_begin:ty,clearcoat_normal_fragment_maps:ny,clearcoat_pars_fragment:iy,iridescence_pars_fragment:sy,opaque_fragment:ry,packing:oy,premultiplied_alpha_fragment:ay,project_vertex:ly,dithering_fragment:cy,dithering_pars_fragment:hy,roughnessmap_fragment:uy,roughnessmap_pars_fragment:fy,shadowmap_pars_fragment:dy,shadowmap_pars_vertex:py,shadowmap_vertex:my,shadowmask_pars_fragment:gy,skinbase_vertex:xy,skinning_pars_vertex:vy,skinning_vertex:_y,skinnormal_vertex:yy,specularmap_fragment:My,specularmap_pars_fragment:by,tonemapping_fragment:Sy,tonemapping_pars_fragment:wy,transmission_fragment:Ey,transmission_pars_fragment:Ay,uv_pars_fragment:Ty,uv_pars_vertex:Ry,uv_vertex:Cy,worldpos_vertex:Py,background_vert:Iy,background_frag:Ly,backgroundCube_vert:Dy,backgroundCube_frag:Uy,cube_vert:Ny,cube_frag:Fy,depth_vert:Oy,depth_frag:By,distanceRGBA_vert:zy,distanceRGBA_frag:ky,equirect_vert:Hy,equirect_frag:Vy,linedashed_vert:Gy,linedashed_frag:Wy,meshbasic_vert:Xy,meshbasic_frag:qy,meshlambert_vert:Yy,meshlambert_frag:Zy,meshmatcap_vert:$y,meshmatcap_frag:Ky,meshnormal_vert:Jy,meshnormal_frag:jy,meshphong_vert:Qy,meshphong_frag:eM,meshphysical_vert:tM,meshphysical_frag:nM,meshtoon_vert:iM,meshtoon_frag:sM,points_vert:rM,points_frag:oM,shadow_vert:aM,shadow_frag:lM,sprite_vert:cM,sprite_frag:hM},He={common:{diffuse:{value:new Be(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new wt},alphaMap:{value:null},alphaMapTransform:{value:new wt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new wt}},envmap:{envMap:{value:null},envMapRotation:{value:new wt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new wt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new wt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new wt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new wt},normalScale:{value:new _e(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new wt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new wt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new wt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new wt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Be(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Be(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new wt},alphaTest:{value:0},uvTransform:{value:new wt}},sprite:{diffuse:{value:new Be(16777215)},opacity:{value:1},center:{value:new _e(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new wt},alphaMap:{value:null},alphaMapTransform:{value:new wt},alphaTest:{value:0}}},Hi={basic:{uniforms:Jn([He.common,He.specularmap,He.envmap,He.aomap,He.lightmap,He.fog]),vertexShader:Dt.meshbasic_vert,fragmentShader:Dt.meshbasic_frag},lambert:{uniforms:Jn([He.common,He.specularmap,He.envmap,He.aomap,He.lightmap,He.emissivemap,He.bumpmap,He.normalmap,He.displacementmap,He.fog,He.lights,{emissive:{value:new Be(0)}}]),vertexShader:Dt.meshlambert_vert,fragmentShader:Dt.meshlambert_frag},phong:{uniforms:Jn([He.common,He.specularmap,He.envmap,He.aomap,He.lightmap,He.emissivemap,He.bumpmap,He.normalmap,He.displacementmap,He.fog,He.lights,{emissive:{value:new Be(0)},specular:{value:new Be(1118481)},shininess:{value:30}}]),vertexShader:Dt.meshphong_vert,fragmentShader:Dt.meshphong_frag},standard:{uniforms:Jn([He.common,He.envmap,He.aomap,He.lightmap,He.emissivemap,He.bumpmap,He.normalmap,He.displacementmap,He.roughnessmap,He.metalnessmap,He.fog,He.lights,{emissive:{value:new Be(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Dt.meshphysical_vert,fragmentShader:Dt.meshphysical_frag},toon:{uniforms:Jn([He.common,He.aomap,He.lightmap,He.emissivemap,He.bumpmap,He.normalmap,He.displacementmap,He.gradientmap,He.fog,He.lights,{emissive:{value:new Be(0)}}]),vertexShader:Dt.meshtoon_vert,fragmentShader:Dt.meshtoon_frag},matcap:{uniforms:Jn([He.common,He.bumpmap,He.normalmap,He.displacementmap,He.fog,{matcap:{value:null}}]),vertexShader:Dt.meshmatcap_vert,fragmentShader:Dt.meshmatcap_frag},points:{uniforms:Jn([He.points,He.fog]),vertexShader:Dt.points_vert,fragmentShader:Dt.points_frag},dashed:{uniforms:Jn([He.common,He.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Dt.linedashed_vert,fragmentShader:Dt.linedashed_frag},depth:{uniforms:Jn([He.common,He.displacementmap]),vertexShader:Dt.depth_vert,fragmentShader:Dt.depth_frag},normal:{uniforms:Jn([He.common,He.bumpmap,He.normalmap,He.displacementmap,{opacity:{value:1}}]),vertexShader:Dt.meshnormal_vert,fragmentShader:Dt.meshnormal_frag},sprite:{uniforms:Jn([He.sprite,He.fog]),vertexShader:Dt.sprite_vert,fragmentShader:Dt.sprite_frag},background:{uniforms:{uvTransform:{value:new wt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Dt.background_vert,fragmentShader:Dt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new wt}},vertexShader:Dt.backgroundCube_vert,fragmentShader:Dt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Dt.cube_vert,fragmentShader:Dt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Dt.equirect_vert,fragmentShader:Dt.equirect_frag},distanceRGBA:{uniforms:Jn([He.common,He.displacementmap,{referencePosition:{value:new L},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Dt.distanceRGBA_vert,fragmentShader:Dt.distanceRGBA_frag},shadow:{uniforms:Jn([He.lights,He.fog,{color:{value:new Be(0)},opacity:{value:1}}]),vertexShader:Dt.shadow_vert,fragmentShader:Dt.shadow_frag}};Hi.physical={uniforms:Jn([Hi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new wt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new wt},clearcoatNormalScale:{value:new _e(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new wt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new wt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new wt},sheen:{value:0},sheenColor:{value:new Be(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new wt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new wt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new wt},transmissionSamplerSize:{value:new _e},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new wt},attenuationDistance:{value:0},attenuationColor:{value:new Be(0)},specularColor:{value:new Be(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new wt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new wt},anisotropyVector:{value:new _e},anisotropyMap:{value:null},anisotropyMapTransform:{value:new wt}}]),vertexShader:Dt.meshphysical_vert,fragmentShader:Dt.meshphysical_frag};var zl={r:0,b:0,g:0},cr=new bi,uM=new ct;function fM(s,e,t,n,i,r,o){let a=new Be(0),l=r===!0?0:1,c,h,u=null,f=0,d=null;function p(y){let _=y.isScene===!0?y.background:null;return _&&_.isTexture&&(_=(y.backgroundBlurriness>0?t:e).get(_)),_}function x(y){let _=!1,v=p(y);v===null?m(a,l):v&&v.isColor&&(m(v,1),_=!0);let F=s.xr.getEnvironmentBlendMode();F==="additive"?n.buffers.color.setClear(0,0,0,1,o):F==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(s.autoClear||_)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function g(y,_){let v=p(_);v&&(v.isCubeTexture||v.mapping===Oo)?(h===void 0&&(h=new Ft(new Nr(1,1,1),new Ot({name:"BackgroundCubeMaterial",uniforms:To(Hi.backgroundCube.uniforms),vertexShader:Hi.backgroundCube.vertexShader,fragmentShader:Hi.backgroundCube.fragmentShader,side:ei,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(F,T,U){this.matrixWorld.copyPosition(U.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),cr.copy(_.backgroundRotation),cr.x*=-1,cr.y*=-1,cr.z*=-1,v.isCubeTexture&&v.isRenderTargetTexture===!1&&(cr.y*=-1,cr.z*=-1),h.material.uniforms.envMap.value=v,h.material.uniforms.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=_.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(uM.makeRotationFromEuler(cr)),h.material.toneMapped=zt.getTransfer(v.colorSpace)!==rn,(u!==v||f!==v.version||d!==s.toneMapping)&&(h.material.needsUpdate=!0,u=v,f=v.version,d=s.toneMapping),h.layers.enableAll(),y.unshift(h,h.geometry,h.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new Ft(new As(2,2),new Ot({name:"BackgroundMaterial",uniforms:To(Hi.background.uniforms),vertexShader:Hi.background.vertexShader,fragmentShader:Hi.background.fragmentShader,side:Gi,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,c.material.toneMapped=zt.getTransfer(v.colorSpace)!==rn,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||f!==v.version||d!==s.toneMapping)&&(c.material.needsUpdate=!0,u=v,f=v.version,d=s.toneMapping),c.layers.enableAll(),y.unshift(c,c.geometry,c.material,0,0,null))}function m(y,_){y.getRGB(zl,Mg(s)),n.buffers.color.setClear(zl.r,zl.g,zl.b,_,o)}return{getClearColor:function(){return a},setClearColor:function(y,_=1){a.set(y),l=_,m(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(y){l=y,m(a,l)},render:x,addToRenderList:g}}function dM(s,e){let t=s.getParameter(s.MAX_VERTEX_ATTRIBS),n={},i=f(null),r=i,o=!1;function a(M,N,J,$,ee){let pe=!1,ie=u($,J,N);r!==ie&&(r=ie,c(r.object)),pe=d(M,$,J,ee),pe&&p(M,$,J,ee),ee!==null&&e.update(ee,s.ELEMENT_ARRAY_BUFFER),(pe||o)&&(o=!1,v(M,N,J,$),ee!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(ee).buffer))}function l(){return s.createVertexArray()}function c(M){return s.bindVertexArray(M)}function h(M){return s.deleteVertexArray(M)}function u(M,N,J){let $=J.wireframe===!0,ee=n[M.id];ee===void 0&&(ee={},n[M.id]=ee);let pe=ee[N.id];pe===void 0&&(pe={},ee[N.id]=pe);let ie=pe[$];return ie===void 0&&(ie=f(l()),pe[$]=ie),ie}function f(M){let N=[],J=[],$=[];for(let ee=0;ee<t;ee++)N[ee]=0,J[ee]=0,$[ee]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:N,enabledAttributes:J,attributeDivisors:$,object:M,attributes:{},index:null}}function d(M,N,J,$){let ee=r.attributes,pe=N.attributes,ie=0,be=J.getAttributes();for(let se in be)if(be[se].location>=0){let Ue=ee[se],Fe=pe[se];if(Fe===void 0&&(se==="instanceMatrix"&&M.instanceMatrix&&(Fe=M.instanceMatrix),se==="instanceColor"&&M.instanceColor&&(Fe=M.instanceColor)),Ue===void 0||Ue.attribute!==Fe||Fe&&Ue.data!==Fe.data)return!0;ie++}return r.attributesNum!==ie||r.index!==$}function p(M,N,J,$){let ee={},pe=N.attributes,ie=0,be=J.getAttributes();for(let se in be)if(be[se].location>=0){let Ue=pe[se];Ue===void 0&&(se==="instanceMatrix"&&M.instanceMatrix&&(Ue=M.instanceMatrix),se==="instanceColor"&&M.instanceColor&&(Ue=M.instanceColor));let Fe={};Fe.attribute=Ue,Ue&&Ue.data&&(Fe.data=Ue.data),ee[se]=Fe,ie++}r.attributes=ee,r.attributesNum=ie,r.index=$}function x(){let M=r.newAttributes;for(let N=0,J=M.length;N<J;N++)M[N]=0}function g(M){m(M,0)}function m(M,N){let J=r.newAttributes,$=r.enabledAttributes,ee=r.attributeDivisors;J[M]=1,$[M]===0&&(s.enableVertexAttribArray(M),$[M]=1),ee[M]!==N&&(s.vertexAttribDivisor(M,N),ee[M]=N)}function y(){let M=r.newAttributes,N=r.enabledAttributes;for(let J=0,$=N.length;J<$;J++)N[J]!==M[J]&&(s.disableVertexAttribArray(J),N[J]=0)}function _(M,N,J,$,ee,pe,ie){ie===!0?s.vertexAttribIPointer(M,N,J,ee,pe):s.vertexAttribPointer(M,N,J,$,ee,pe)}function v(M,N,J,$){x();let ee=$.attributes,pe=J.getAttributes(),ie=N.defaultAttributeValues;for(let be in pe){let se=pe[be];if(se.location>=0){let Te=ee[be];if(Te===void 0&&(be==="instanceMatrix"&&M.instanceMatrix&&(Te=M.instanceMatrix),be==="instanceColor"&&M.instanceColor&&(Te=M.instanceColor)),Te!==void 0){let Ue=Te.normalized,Fe=Te.itemSize,dt=e.get(Te);if(dt===void 0)continue;let Gt=dt.buffer,me=dt.type,Le=dt.bytesPerElement,nt=me===s.INT||me===s.UNSIGNED_INT||Te.gpuType===Yh;if(Te.isInterleavedBufferAttribute){let Ne=Te.data,ft=Ne.stride,pt=Te.offset;if(Ne.isInstancedInterleavedBuffer){for(let _t=0;_t<se.locationSize;_t++)m(se.location+_t,Ne.meshPerAttribute);M.isInstancedMesh!==!0&&$._maxInstanceCount===void 0&&($._maxInstanceCount=Ne.meshPerAttribute*Ne.count)}else for(let _t=0;_t<se.locationSize;_t++)g(se.location+_t);s.bindBuffer(s.ARRAY_BUFFER,Gt);for(let _t=0;_t<se.locationSize;_t++)_(se.location+_t,Fe/se.locationSize,me,Ue,ft*Le,(pt+Fe/se.locationSize*_t)*Le,nt)}else{if(Te.isInstancedBufferAttribute){for(let Ne=0;Ne<se.locationSize;Ne++)m(se.location+Ne,Te.meshPerAttribute);M.isInstancedMesh!==!0&&$._maxInstanceCount===void 0&&($._maxInstanceCount=Te.meshPerAttribute*Te.count)}else for(let Ne=0;Ne<se.locationSize;Ne++)g(se.location+Ne);s.bindBuffer(s.ARRAY_BUFFER,Gt);for(let Ne=0;Ne<se.locationSize;Ne++)_(se.location+Ne,Fe/se.locationSize,me,Ue,Fe*Le,Fe/se.locationSize*Ne*Le,nt)}}else if(ie!==void 0){let Ue=ie[be];if(Ue!==void 0)switch(Ue.length){case 2:s.vertexAttrib2fv(se.location,Ue);break;case 3:s.vertexAttrib3fv(se.location,Ue);break;case 4:s.vertexAttrib4fv(se.location,Ue);break;default:s.vertexAttrib1fv(se.location,Ue)}}}}y()}function F(){C();for(let M in n){let N=n[M];for(let J in N){let $=N[J];for(let ee in $)h($[ee].object),delete $[ee];delete N[J]}delete n[M]}}function T(M){if(n[M.id]===void 0)return;let N=n[M.id];for(let J in N){let $=N[J];for(let ee in $)h($[ee].object),delete $[ee];delete N[J]}delete n[M.id]}function U(M){for(let N in n){let J=n[N];if(J[M.id]===void 0)continue;let $=J[M.id];for(let ee in $)h($[ee].object),delete $[ee];delete J[M.id]}}function C(){S(),o=!0,r!==i&&(r=i,c(r.object))}function S(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:a,reset:C,resetDefaultState:S,dispose:F,releaseStatesOfGeometry:T,releaseStatesOfProgram:U,initAttributes:x,enableAttribute:g,disableUnusedAttributes:y}}function pM(s,e,t){let n;function i(c){n=c}function r(c,h){s.drawArrays(n,c,h),t.update(h,n,1)}function o(c,h,u){u!==0&&(s.drawArraysInstanced(n,c,h,u),t.update(h,n,u))}function a(c,h,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let d=0;for(let p=0;p<u;p++)d+=h[p];t.update(d,n,1)}function l(c,h,u,f){if(u===0)return;let d=e.get("WEBGL_multi_draw");if(d===null)for(let p=0;p<c.length;p++)o(c[p],h[p],f[p]);else{d.multiDrawArraysInstancedWEBGL(n,c,0,h,0,f,0,u);let p=0;for(let x=0;x<u;x++)p+=h[x]*f[x];t.update(p,n,1)}}this.setMode=i,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function mM(s,e,t,n){let i;function r(){if(i!==void 0)return i;if(e.has("EXT_texture_filter_anisotropic")===!0){let U=e.get("EXT_texture_filter_anisotropic");i=s.getParameter(U.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(U){return!(U!==Qn&&n.convert(U)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(U){let C=U===Bo&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(U!==ji&&n.convert(U)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE)&&U!==hi&&!C)}function l(U){if(U==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";U="mediump"}return U==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let u=t.logarithmicDepthBuffer===!0,f=t.reverseDepthBuffer===!0&&e.has("EXT_clip_control"),d=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),p=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=s.getParameter(s.MAX_TEXTURE_SIZE),g=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),m=s.getParameter(s.MAX_VERTEX_ATTRIBS),y=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),_=s.getParameter(s.MAX_VARYING_VECTORS),v=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),F=p>0,T=s.getParameter(s.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:f,maxTextures:d,maxVertexTextures:p,maxTextureSize:x,maxCubemapSize:g,maxAttributes:m,maxVertexUniforms:y,maxVaryings:_,maxFragmentUniforms:v,vertexTextures:F,maxSamples:T}}function gM(s){let e=this,t=null,n=0,i=!1,r=!1,o=new $i,a=new wt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,f){let d=u.length!==0||f||n!==0||i;return i=f,n=u.length,d},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,f){t=h(u,f,0)},this.setState=function(u,f,d){let p=u.clippingPlanes,x=u.clipIntersection,g=u.clipShadows,m=s.get(u);if(!i||p===null||p.length===0||r&&!g)r?h(null):c();else{let y=r?0:n,_=y*4,v=m.clippingState||null;l.value=v,v=h(p,f,_,d);for(let F=0;F!==_;++F)v[F]=t[F];m.clippingState=v,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=y}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(u,f,d,p){let x=u!==null?u.length:0,g=null;if(x!==0){if(g=l.value,p!==!0||g===null){let m=d+x*4,y=f.matrixWorldInverse;a.getNormalMatrix(y),(g===null||g.length<m)&&(g=new Float32Array(m));for(let _=0,v=d;_!==x;++_,v+=4)o.copy(u[_]).applyMatrix4(y,a),o.normal.toArray(g,v),g[v+3]=o.constant}l.value=g,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,g}}function xM(s){let e=new WeakMap;function t(o,a){return a===Sa?o.mapping=Ss:a===wa&&(o.mapping=Ws),o}function n(o){if(o&&o.isTexture){let a=o.mapping;if(a===Sa||a===wa)if(e.has(o)){let l=e.get(o).texture;return t(l,o.mapping)}else{let l=o.image;if(l&&l.height>0){let c=new Jc(l.height);return c.fromEquirectangularTexture(s,o),e.set(o,c),o.addEventListener("dispose",i),t(c.texture,o.mapping)}else return null}}return o}function i(o){let a=o.target;a.removeEventListener("dispose",i);let l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function r(){e=new WeakMap}return{get:n,dispose:r}}var Qi=class extends qs{constructor(e=-1,t=1,n=1,i=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-e,o=n+e,a=i+t,l=i-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},_o=4,mm=[.125,.215,.35,.446,.526,.582],yr=20,zu=new Qi,gm=new Be,ku=null,Hu=0,Vu=0,Gu=!1,_r=(1+Math.sqrt(5))/2,uo=1/_r,xm=[new L(-_r,uo,0),new L(_r,uo,0),new L(-uo,0,_r),new L(uo,0,_r),new L(0,_r,-uo),new L(0,_r,uo),new L(-1,1,-1),new L(1,1,-1),new L(-1,1,1),new L(1,1,1)],La=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,i=100){ku=this._renderer.getRenderTarget(),Hu=this._renderer.getActiveCubeFace(),Vu=this._renderer.getActiveMipmapLevel(),Gu=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);let r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(e,n,i,r),t>0&&this._blur(r,0,0,t),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ym(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=_m(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(ku,Hu,Vu),this._renderer.xr.enabled=Gu,e.scissorTest=!1,kl(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Ss||e.mapping===Ws?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ku=this._renderer.getRenderTarget(),Hu=this._renderer.getActiveCubeFace(),Vu=this._renderer.getActiveMipmapLevel(),Gu=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:cn,minFilter:cn,generateMipmaps:!1,type:Bo,format:Qn,colorSpace:Gn,depthBuffer:!1},i=vm(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=vm(e,t,n);let{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=vM(r)),this._blurMaterial=_M(r,e,t)}return i}_compileMaterial(e){let t=new Ft(this._lodPlanes[0],e);this._renderer.compile(t,zu)}_sceneToCubeUV(e,t,n,i){let a=new Mn(90,1,t,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,f=h.toneMapping;h.getClearColor(gm),h.toneMapping=ys,h.autoClear=!1;let d=new zn({name:"PMREM.Background",side:ei,depthWrite:!1,depthTest:!1}),p=new Ft(new Nr,d),x=!1,g=e.background;g?g.isColor&&(d.color.copy(g),e.background=null,x=!0):(d.color.copy(gm),x=!0);for(let m=0;m<6;m++){let y=m%3;y===0?(a.up.set(0,l[m],0),a.lookAt(c[m],0,0)):y===1?(a.up.set(0,0,l[m]),a.lookAt(0,c[m],0)):(a.up.set(0,l[m],0),a.lookAt(0,0,c[m]));let _=this._cubeSize;kl(i,y*_,m>2?_:0,_,_),h.setRenderTarget(i),x&&h.render(p,a),h.render(e,a)}p.geometry.dispose(),p.material.dispose(),h.toneMapping=f,h.autoClear=u,e.background=g}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===Ss||e.mapping===Ws;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=ym()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=_m());let r=i?this._cubemapMaterial:this._equirectMaterial,o=new Ft(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=e;let l=this._cubeSize;kl(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(o,zu)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodPlanes.length;for(let r=1;r<i;r++){let o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=xm[(i-r-1)%xm.length];this._blur(e,r-1,r,o,a)}t.autoClear=n}_blur(e,t,n,i,r){let o=this._pingPongRenderTarget;this._halfBlur(e,o,t,n,i,"latitudinal",r),this._halfBlur(o,e,n,n,i,"longitudinal",r)}_halfBlur(e,t,n,i,r,o,a){let l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let h=3,u=new Ft(this._lodPlanes[i],c),f=c.uniforms,d=this._sizeLods[n]-1,p=isFinite(r)?Math.PI/(2*d):2*Math.PI/(2*yr-1),x=r/p,g=isFinite(r)?1+Math.floor(h*x):yr;g>yr&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${yr}`);let m=[],y=0;for(let U=0;U<yr;++U){let C=U/x,S=Math.exp(-C*C/2);m.push(S),U===0?y+=S:U<g&&(y+=2*S)}for(let U=0;U<m.length;U++)m[U]=m[U]/y;f.envMap.value=e.texture,f.samples.value=g,f.weights.value=m,f.latitudinal.value=o==="latitudinal",a&&(f.poleAxis.value=a);let{_lodMax:_}=this;f.dTheta.value=p,f.mipInt.value=_-n;let v=this._sizeLods[i],F=3*v*(i>_-_o?i-_+_o:0),T=4*(this._cubeSize-v);kl(t,F,T,3*v,2*v),l.setRenderTarget(t),l.render(u,zu)}};function vM(s){let e=[],t=[],n=[],i=s,r=s-_o+1+mm.length;for(let o=0;o<r;o++){let a=Math.pow(2,i);t.push(a);let l=1/a;o>s-_o?l=mm[o-s+_o-1]:o===0&&(l=0),n.push(l);let c=1/(a-2),h=-c,u=1+c,f=[h,h,u,h,u,u,h,h,u,u,h,u],d=6,p=6,x=3,g=2,m=1,y=new Float32Array(x*p*d),_=new Float32Array(g*p*d),v=new Float32Array(m*p*d);for(let T=0;T<d;T++){let U=T%3*2/3-1,C=T>2?0:-1,S=[U,C,0,U+2/3,C,0,U+2/3,C+1,0,U,C,0,U+2/3,C+1,0,U,C+1,0];y.set(S,x*p*T),_.set(f,g*p*T);let M=[T,T,T,T,T,T];v.set(M,m*p*T)}let F=new tt;F.setAttribute("position",new ht(y,x)),F.setAttribute("uv",new ht(_,g)),F.setAttribute("faceIndex",new ht(v,m)),e.push(F),i>_o&&i--}return{lodPlanes:e,sizeLods:t,sigmas:n}}function vm(s,e,t){let n=new ti(s,e,t);return n.texture.mapping=Oo,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function kl(s,e,t,n,i){s.viewport.set(e,t,n,i),s.scissor.set(e,t,n,i)}function _M(s,e,t){let n=new Float32Array(yr),i=new L(0,1,0);return new Ot({name:"SphericalGaussianBlur",defines:{n:yr,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:Vd(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Vi,depthTest:!1,depthWrite:!1})}function _m(){return new Ot({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Vd(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Vi,depthTest:!1,depthWrite:!1})}function ym(){return new Ot({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Vd(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Vi,depthTest:!1,depthWrite:!1})}function Vd(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function yM(s){let e=new WeakMap,t=null;function n(a){if(a&&a.isTexture){let l=a.mapping,c=l===Sa||l===wa,h=l===Ss||l===Ws;if(c||h){let u=e.get(a),f=u!==void 0?u.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==f)return t===null&&(t=new La(s)),u=c?t.fromEquirectangular(a,u):t.fromCubemap(a,u),u.texture.pmremVersion=a.pmremVersion,e.set(a,u),u.texture;if(u!==void 0)return u.texture;{let d=a.image;return c&&d&&d.height>0||h&&d&&i(d)?(t===null&&(t=new La(s)),u=c?t.fromEquirectangular(a):t.fromCubemap(a),u.texture.pmremVersion=a.pmremVersion,e.set(a,u),a.addEventListener("dispose",r),u.texture):null}}}return a}function i(a){let l=0,c=6;for(let h=0;h<c;h++)a[h]!==void 0&&l++;return l===c}function r(a){let l=a.target;l.removeEventListener("dispose",r);let c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function o(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:n,dispose:o}}function MM(s){let e={};function t(n){if(e[n]!==void 0)return e[n];let i;switch(n){case"WEBGL_depth_texture":i=s.getExtension("WEBGL_depth_texture")||s.getExtension("MOZ_WEBGL_depth_texture")||s.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=s.getExtension("EXT_texture_filter_anisotropic")||s.getExtension("MOZ_EXT_texture_filter_anisotropic")||s.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=s.getExtension("WEBGL_compressed_texture_s3tc")||s.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=s.getExtension("WEBGL_compressed_texture_pvrtc")||s.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=s.getExtension(n)}return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let i=t(n);return i===null&&ha("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function bM(s,e,t,n){let i={},r=new WeakMap;function o(u){let f=u.target;f.index!==null&&e.remove(f.index);for(let p in f.attributes)e.remove(f.attributes[p]);for(let p in f.morphAttributes){let x=f.morphAttributes[p];for(let g=0,m=x.length;g<m;g++)e.remove(x[g])}f.removeEventListener("dispose",o),delete i[f.id];let d=r.get(f);d&&(e.remove(d),r.delete(f)),n.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,t.memory.geometries--}function a(u,f){return i[f.id]===!0||(f.addEventListener("dispose",o),i[f.id]=!0,t.memory.geometries++),f}function l(u){let f=u.attributes;for(let p in f)e.update(f[p],s.ARRAY_BUFFER);let d=u.morphAttributes;for(let p in d){let x=d[p];for(let g=0,m=x.length;g<m;g++)e.update(x[g],s.ARRAY_BUFFER)}}function c(u){let f=[],d=u.index,p=u.attributes.position,x=0;if(d!==null){let y=d.array;x=d.version;for(let _=0,v=y.length;_<v;_+=3){let F=y[_+0],T=y[_+1],U=y[_+2];f.push(F,T,T,U,U,F)}}else if(p!==void 0){let y=p.array;x=p.version;for(let _=0,v=y.length/3-1;_<v;_+=3){let F=_+0,T=_+1,U=_+2;f.push(F,T,T,U,U,F)}}else return;let g=new(vg(f)?Ia:Pa)(f,1);g.version=x;let m=r.get(u);m&&e.remove(m),r.set(u,g)}function h(u){let f=r.get(u);if(f){let d=u.index;d!==null&&f.version<d.version&&c(u)}else c(u);return r.get(u)}return{get:a,update:l,getWireframeAttribute:h}}function SM(s,e,t){let n;function i(f){n=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,d){s.drawElements(n,d,r,f*o),t.update(d,n,1)}function c(f,d,p){p!==0&&(s.drawElementsInstanced(n,d,r,f*o,p),t.update(d,n,p))}function h(f,d,p){if(p===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,r,f,0,p);let g=0;for(let m=0;m<p;m++)g+=d[m];t.update(g,n,1)}function u(f,d,p,x){if(p===0)return;let g=e.get("WEBGL_multi_draw");if(g===null)for(let m=0;m<f.length;m++)c(f[m]/o,d[m],x[m]);else{g.multiDrawElementsInstancedWEBGL(n,d,0,r,f,0,x,0,p);let m=0;for(let y=0;y<p;y++)m+=d[y]*x[y];t.update(m,n,1)}}this.setMode=i,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function wM(s){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(t.calls++,o){case s.TRIANGLES:t.triangles+=a*(r/3);break;case s.LINES:t.lines+=a*(r/2);break;case s.LINE_STRIP:t.lines+=a*(r-1);break;case s.LINE_LOOP:t.lines+=a*r;break;case s.POINTS:t.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function i(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function EM(s,e,t){let n=new WeakMap,i=new kt;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,u=h!==void 0?h.length:0,f=n.get(a);if(f===void 0||f.count!==u){let S=function(){U.dispose(),n.delete(a),a.removeEventListener("dispose",S)};f!==void 0&&f.texture.dispose();let d=a.morphAttributes.position!==void 0,p=a.morphAttributes.normal!==void 0,x=a.morphAttributes.color!==void 0,g=a.morphAttributes.position||[],m=a.morphAttributes.normal||[],y=a.morphAttributes.color||[],_=0;d===!0&&(_=1),p===!0&&(_=2),x===!0&&(_=3);let v=a.attributes.position.count*_,F=1;v>e.maxTextureSize&&(F=Math.ceil(v/e.maxTextureSize),v=e.maxTextureSize);let T=new Float32Array(v*F*4*u),U=new Eo(T,v,F,u);U.type=hi,U.needsUpdate=!0;let C=_*4;for(let M=0;M<u;M++){let N=g[M],J=m[M],$=y[M],ee=v*F*4*M;for(let pe=0;pe<N.count;pe++){let ie=pe*C;d===!0&&(i.fromBufferAttribute(N,pe),T[ee+ie+0]=i.x,T[ee+ie+1]=i.y,T[ee+ie+2]=i.z,T[ee+ie+3]=0),p===!0&&(i.fromBufferAttribute(J,pe),T[ee+ie+4]=i.x,T[ee+ie+5]=i.y,T[ee+ie+6]=i.z,T[ee+ie+7]=0),x===!0&&(i.fromBufferAttribute($,pe),T[ee+ie+8]=i.x,T[ee+ie+9]=i.y,T[ee+ie+10]=i.z,T[ee+ie+11]=$.itemSize===4?i.w:1)}}f={count:u,texture:U,size:new _e(v,F)},n.set(a,f),a.addEventListener("dispose",S)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(s,"morphTexture",o.morphTexture,t);else{let d=0;for(let x=0;x<c.length;x++)d+=c[x];let p=a.morphTargetsRelative?1:1-d;l.getUniforms().setValue(s,"morphTargetBaseInfluence",p),l.getUniforms().setValue(s,"morphTargetInfluences",c)}l.getUniforms().setValue(s,"morphTargetsTexture",f.texture,t),l.getUniforms().setValue(s,"morphTargetsTextureSize",f.size)}return{update:r}}function AM(s,e,t,n){let i=new WeakMap;function r(l){let c=n.render.frame,h=l.geometry,u=e.get(l,h);if(i.get(u)!==c&&(e.update(u),i.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),i.get(l)!==c&&(t.update(l.instanceMatrix,s.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,s.ARRAY_BUFFER),i.set(l,c))),l.isSkinnedMesh){let f=l.skeleton;i.get(f)!==c&&(f.update(),i.set(f,c))}return u}function o(){i=new WeakMap}function a(l){let c=l.target;c.removeEventListener("dispose",a),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:o}}var Da=class extends dn{constructor(e,t,n,i,r,o,a,l,c,h=Ar){if(h!==Ar&&h!==Lr)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Ar&&(n=Es),n===void 0&&h===Lr&&(n=Ir),super(null,i,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.image={width:e,height:t},this.magFilter=a!==void 0?a:Tn,this.minFilter=l!==void 0?l:Tn,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},wg=new dn,Mm=new Da(1,1),Eg=new Eo,Ag=new Ca,Tg=new Fr,bm=[],Sm=[],wm=new Float32Array(16),Em=new Float32Array(9),Am=new Float32Array(4);function ko(s,e,t){let n=s[0];if(n<=0||n>0)return s;let i=e*t,r=bm[i];if(r===void 0&&(r=new Float32Array(i),bm[i]=r),e!==0){n.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,s[o].toArray(r,a)}return r}function In(s,e){if(s.length!==e.length)return!1;for(let t=0,n=s.length;t<n;t++)if(s[t]!==e[t])return!1;return!0}function Ln(s,e){for(let t=0,n=e.length;t<n;t++)s[t]=e[t]}function eu(s,e){let t=Sm[e];t===void 0&&(t=new Int32Array(e),Sm[e]=t);for(let n=0;n!==e;++n)t[n]=s.allocateTextureUnit();return t}function TM(s,e){let t=this.cache;t[0]!==e&&(s.uniform1f(this.addr,e),t[0]=e)}function RM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(In(t,e))return;s.uniform2fv(this.addr,e),Ln(t,e)}}function CM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(s.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(In(t,e))return;s.uniform3fv(this.addr,e),Ln(t,e)}}function PM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(In(t,e))return;s.uniform4fv(this.addr,e),Ln(t,e)}}function IM(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(In(t,e))return;s.uniformMatrix2fv(this.addr,!1,e),Ln(t,e)}else{if(In(t,n))return;Am.set(n),s.uniformMatrix2fv(this.addr,!1,Am),Ln(t,n)}}function LM(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(In(t,e))return;s.uniformMatrix3fv(this.addr,!1,e),Ln(t,e)}else{if(In(t,n))return;Em.set(n),s.uniformMatrix3fv(this.addr,!1,Em),Ln(t,n)}}function DM(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(In(t,e))return;s.uniformMatrix4fv(this.addr,!1,e),Ln(t,e)}else{if(In(t,n))return;wm.set(n),s.uniformMatrix4fv(this.addr,!1,wm),Ln(t,n)}}function UM(s,e){let t=this.cache;t[0]!==e&&(s.uniform1i(this.addr,e),t[0]=e)}function NM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(In(t,e))return;s.uniform2iv(this.addr,e),Ln(t,e)}}function FM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(In(t,e))return;s.uniform3iv(this.addr,e),Ln(t,e)}}function OM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(In(t,e))return;s.uniform4iv(this.addr,e),Ln(t,e)}}function BM(s,e){let t=this.cache;t[0]!==e&&(s.uniform1ui(this.addr,e),t[0]=e)}function zM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(In(t,e))return;s.uniform2uiv(this.addr,e),Ln(t,e)}}function kM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(In(t,e))return;s.uniform3uiv(this.addr,e),Ln(t,e)}}function HM(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(In(t,e))return;s.uniform4uiv(this.addr,e),Ln(t,e)}}function VM(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);let r;this.type===s.SAMPLER_2D_SHADOW?(Mm.compareFunction=zd,r=Mm):r=wg,t.setTexture2D(e||r,i)}function GM(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||Ag,i)}function WM(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||Tg,i)}function XM(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||Eg,i)}function qM(s){switch(s){case 5126:return TM;case 35664:return RM;case 35665:return CM;case 35666:return PM;case 35674:return IM;case 35675:return LM;case 35676:return DM;case 5124:case 35670:return UM;case 35667:case 35671:return NM;case 35668:case 35672:return FM;case 35669:case 35673:return OM;case 5125:return BM;case 36294:return zM;case 36295:return kM;case 36296:return HM;case 35678:case 36198:case 36298:case 36306:case 35682:return VM;case 35679:case 36299:case 36307:return GM;case 35680:case 36300:case 36308:case 36293:return WM;case 36289:case 36303:case 36311:case 36292:return XM}}function YM(s,e){s.uniform1fv(this.addr,e)}function ZM(s,e){let t=ko(e,this.size,2);s.uniform2fv(this.addr,t)}function $M(s,e){let t=ko(e,this.size,3);s.uniform3fv(this.addr,t)}function KM(s,e){let t=ko(e,this.size,4);s.uniform4fv(this.addr,t)}function JM(s,e){let t=ko(e,this.size,4);s.uniformMatrix2fv(this.addr,!1,t)}function jM(s,e){let t=ko(e,this.size,9);s.uniformMatrix3fv(this.addr,!1,t)}function QM(s,e){let t=ko(e,this.size,16);s.uniformMatrix4fv(this.addr,!1,t)}function e1(s,e){s.uniform1iv(this.addr,e)}function t1(s,e){s.uniform2iv(this.addr,e)}function n1(s,e){s.uniform3iv(this.addr,e)}function i1(s,e){s.uniform4iv(this.addr,e)}function s1(s,e){s.uniform1uiv(this.addr,e)}function r1(s,e){s.uniform2uiv(this.addr,e)}function o1(s,e){s.uniform3uiv(this.addr,e)}function a1(s,e){s.uniform4uiv(this.addr,e)}function l1(s,e,t){let n=this.cache,i=e.length,r=eu(t,i);In(n,r)||(s.uniform1iv(this.addr,r),Ln(n,r));for(let o=0;o!==i;++o)t.setTexture2D(e[o]||wg,r[o])}function c1(s,e,t){let n=this.cache,i=e.length,r=eu(t,i);In(n,r)||(s.uniform1iv(this.addr,r),Ln(n,r));for(let o=0;o!==i;++o)t.setTexture3D(e[o]||Ag,r[o])}function h1(s,e,t){let n=this.cache,i=e.length,r=eu(t,i);In(n,r)||(s.uniform1iv(this.addr,r),Ln(n,r));for(let o=0;o!==i;++o)t.setTextureCube(e[o]||Tg,r[o])}function u1(s,e,t){let n=this.cache,i=e.length,r=eu(t,i);In(n,r)||(s.uniform1iv(this.addr,r),Ln(n,r));for(let o=0;o!==i;++o)t.setTexture2DArray(e[o]||Eg,r[o])}function f1(s){switch(s){case 5126:return YM;case 35664:return ZM;case 35665:return $M;case 35666:return KM;case 35674:return JM;case 35675:return jM;case 35676:return QM;case 5124:case 35670:return e1;case 35667:case 35671:return t1;case 35668:case 35672:return n1;case 35669:case 35673:return i1;case 5125:return s1;case 36294:return r1;case 36295:return o1;case 36296:return a1;case 35678:case 36198:case 36298:case 36306:case 35682:return l1;case 35679:case 36299:case 36307:return c1;case 35680:case 36300:case 36308:case 36293:return h1;case 36289:case 36303:case 36311:case 36292:return u1}}var Mf=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=qM(t.type)}},bf=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=f1(t.type)}},Sf=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let r=0,o=i.length;r!==o;++r){let a=i[r];a.setValue(e,t[a.id],n)}}},Wu=/(\w+)(\])?(\[|\.)?/g;function Tm(s,e){s.seq.push(e),s.map[e.id]=e}function d1(s,e,t){let n=s.name,i=n.length;for(Wu.lastIndex=0;;){let r=Wu.exec(n),o=Wu.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===i){Tm(t,c===void 0?new Mf(a,s,e):new bf(a,s,e));break}else{let u=t.map[a];u===void 0&&(u=new Sf(a),Tm(t,u)),t=u}}}var bo=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){let r=e.getActiveUniform(t,i),o=e.getUniformLocation(t,r.name);d1(r,o,this)}}setValue(e,t,n,i){let r=this.map[t];r!==void 0&&r.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,o=t.length;r!==o;++r){let a=t[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,r=e.length;i!==r;++i){let o=e[i];o.id in t&&n.push(o)}return n}};function Rm(s,e,t){let n=s.createShader(e);return s.shaderSource(n,t),s.compileShader(n),n}var p1=37297,m1=0;function g1(s,e){let t=s.split(`
`),n=[],i=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=i;o<r;o++){let a=o+1;n.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return n.join(`
`)}var Cm=new wt;function x1(s){zt._getMatrix(Cm,zt.workingColorSpace,s);let e=`mat3( ${Cm.elements.map(t=>t.toFixed(4))} )`;switch(zt.getTransfer(s)){case ll:return[e,"LinearTransferOETF"];case rn:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",s),[e,"LinearTransferOETF"]}}function Pm(s,e,t){let n=s.getShaderParameter(e,s.COMPILE_STATUS),i=s.getShaderInfoLog(e).trim();if(n&&i==="")return"";let r=/ERROR: 0:(\d+)/.exec(i);if(r){let o=parseInt(r[1]);return t.toUpperCase()+`

`+i+`

`+g1(s.getShaderSource(e),o)}else return i}function v1(s,e){let t=x1(e);return[`vec4 ${s}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function _1(s,e){let t;switch(e){case J0:t="Linear";break;case j0:t="Reinhard";break;case Q0:t="Cineon";break;case eg:t="ACESFilmic";break;case ng:t="AgX";break;case ig:t="Neutral";break;case tg:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+s+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var Hl=new L;function y1(){zt.getLuminanceCoefficients(Hl);let s=Hl.x.toFixed(4),e=Hl.y.toFixed(4),t=Hl.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function M1(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(fa).join(`
`)}function b1(s){let e=[];for(let t in s){let n=s[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function S1(s,e){let t={},n=s.getProgramParameter(e,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){let r=s.getActiveAttrib(e,i),o=r.name,a=1;r.type===s.FLOAT_MAT2&&(a=2),r.type===s.FLOAT_MAT3&&(a=3),r.type===s.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:s.getAttribLocation(e,o),locationSize:a}}return t}function fa(s){return s!==""}function Im(s,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return s.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Lm(s,e){return s.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var w1=/^[ \t]*#include +<([\w\d./]+)>/gm;function wf(s){return s.replace(w1,A1)}var E1=new Map;function A1(s,e){let t=Dt[e];if(t===void 0){let n=E1.get(e);if(n!==void 0)t=Dt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("Can not resolve #include <"+e+">")}return wf(t)}var T1=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Dm(s){return s.replace(T1,R1)}function R1(s,e,t,n){let i="";for(let r=parseInt(e);r<parseInt(t);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function Um(s){let e=`precision ${s.precision} float;
	precision ${s.precision} int;
	precision ${s.precision} sampler2D;
	precision ${s.precision} samplerCube;
	precision ${s.precision} sampler3D;
	precision ${s.precision} sampler2DArray;
	precision ${s.precision} sampler2DShadow;
	precision ${s.precision} samplerCubeShadow;
	precision ${s.precision} sampler2DArrayShadow;
	precision ${s.precision} isampler2D;
	precision ${s.precision} isampler3D;
	precision ${s.precision} isamplerCube;
	precision ${s.precision} isampler2DArray;
	precision ${s.precision} usampler2D;
	precision ${s.precision} usampler3D;
	precision ${s.precision} usamplerCube;
	precision ${s.precision} usampler2DArray;
	`;return s.precision==="highp"?e+=`
#define HIGH_PRECISION`:s.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function C1(s){let e="SHADOWMAP_TYPE_BASIC";return s.shadowMapType===Td?e="SHADOWMAP_TYPE_PCF":s.shadowMapType===P0?e="SHADOWMAP_TYPE_PCF_SOFT":s.shadowMapType===Zi&&(e="SHADOWMAP_TYPE_VSM"),e}function P1(s){let e="ENVMAP_TYPE_CUBE";if(s.envMap)switch(s.envMapMode){case Ss:case Ws:e="ENVMAP_TYPE_CUBE";break;case Oo:e="ENVMAP_TYPE_CUBE_UV";break}return e}function I1(s){let e="ENVMAP_MODE_REFLECTION";if(s.envMap)switch(s.envMapMode){case Ws:e="ENVMAP_MODE_REFRACTION";break}return e}function L1(s){let e="ENVMAP_BLENDING_NONE";if(s.envMap)switch(s.combine){case sl:e="ENVMAP_BLENDING_MULTIPLY";break;case $0:e="ENVMAP_BLENDING_MIX";break;case K0:e="ENVMAP_BLENDING_ADD";break}return e}function D1(s){let e=s.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),7*16)),texelHeight:n,maxMip:t}}function U1(s,e,t,n){let i=s.getContext(),r=t.defines,o=t.vertexShader,a=t.fragmentShader,l=C1(t),c=P1(t),h=I1(t),u=L1(t),f=D1(t),d=M1(t),p=b1(r),x=i.createProgram(),g,m,y=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p].filter(fa).join(`
`),g.length>0&&(g+=`
`),m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p].filter(fa).join(`
`),m.length>0&&(m+=`
`)):(g=[Um(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(fa).join(`
`),m=[Um(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==ys?"#define TONE_MAPPING":"",t.toneMapping!==ys?Dt.tonemapping_pars_fragment:"",t.toneMapping!==ys?_1("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Dt.colorspace_pars_fragment,v1("linearToOutputTexel",t.outputColorSpace),y1(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(fa).join(`
`)),o=wf(o),o=Im(o,t),o=Lm(o,t),a=wf(a),a=Im(a,t),a=Lm(a,t),o=Dm(o),a=Dm(a),t.isRawShaderMaterial!==!0&&(y=`#version 300 es
`,g=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,m=["#define varying in",t.glslVersion===ff?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===ff?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+m);let _=y+g+o,v=y+m+a,F=Rm(i,i.VERTEX_SHADER,_),T=Rm(i,i.FRAGMENT_SHADER,v);i.attachShader(x,F),i.attachShader(x,T),t.index0AttributeName!==void 0?i.bindAttribLocation(x,0,t.index0AttributeName):t.morphTargets===!0&&i.bindAttribLocation(x,0,"position"),i.linkProgram(x);function U(N){if(s.debug.checkShaderErrors){let J=i.getProgramInfoLog(x).trim(),$=i.getShaderInfoLog(F).trim(),ee=i.getShaderInfoLog(T).trim(),pe=!0,ie=!0;if(i.getProgramParameter(x,i.LINK_STATUS)===!1)if(pe=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,x,F,T);else{let be=Pm(i,F,"vertex"),se=Pm(i,T,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(x,i.VALIDATE_STATUS)+`

Material Name: `+N.name+`
Material Type: `+N.type+`

Program Info Log: `+J+`
`+be+`
`+se)}else J!==""?console.warn("THREE.WebGLProgram: Program Info Log:",J):($===""||ee==="")&&(ie=!1);ie&&(N.diagnostics={runnable:pe,programLog:J,vertexShader:{log:$,prefix:g},fragmentShader:{log:ee,prefix:m}})}i.deleteShader(F),i.deleteShader(T),C=new bo(i,x),S=S1(i,x)}let C;this.getUniforms=function(){return C===void 0&&U(this),C};let S;this.getAttributes=function(){return S===void 0&&U(this),S};let M=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return M===!1&&(M=i.getProgramParameter(x,p1)),M},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=m1++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=F,this.fragmentShader=T,this}var N1=0,Ef=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,n=e.fragmentShader,i=this._getShaderStage(t),r=this._getShaderStage(n),o=this._getShaderCacheForMaterial(e);return o.has(i)===!1&&(o.add(i),i.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Af(e),t.set(e,n)),n}},Af=class{constructor(e){this.id=N1++,this.code=e,this.usedTimes=0}};function F1(s,e,t,n,i,r,o){let a=new Ao,l=new Ef,c=new Set,h=[],u=i.logarithmicDepthBuffer,f=i.vertexTextures,d=i.precision,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function x(S){return c.add(S),S===0?"uv":`uv${S}`}function g(S,M,N,J,$){let ee=J.fog,pe=$.geometry,ie=S.isMeshStandardMaterial?J.environment:null,be=(S.isMeshStandardMaterial?t:e).get(S.envMap||ie),se=be&&be.mapping===Oo?be.image.height:null,Te=p[S.type];S.precision!==null&&(d=i.getMaxPrecision(S.precision),d!==S.precision&&console.warn("THREE.WebGLProgram.getParameters:",S.precision,"not supported, using",d,"instead."));let Ue=pe.morphAttributes.position||pe.morphAttributes.normal||pe.morphAttributes.color,Fe=Ue!==void 0?Ue.length:0,dt=0;pe.morphAttributes.position!==void 0&&(dt=1),pe.morphAttributes.normal!==void 0&&(dt=2),pe.morphAttributes.color!==void 0&&(dt=3);let Gt,me,Le,nt;if(Te){let en=Hi[Te];Gt=en.vertexShader,me=en.fragmentShader}else Gt=S.vertexShader,me=S.fragmentShader,l.update(S),Le=l.getVertexShaderID(S),nt=l.getFragmentShaderID(S);let Ne=s.getRenderTarget(),ft=s.state.buffers.depth.getReversed(),pt=$.isInstancedMesh===!0,_t=$.isBatchedMesh===!0,Nt=!!S.map,ye=!!S.matcap,Ce=!!be,B=!!S.aoMap,at=!!S.lightMap,Ee=!!S.bumpMap,Ke=!!S.normalMap,Ie=!!S.displacementMap,mt=!!S.emissiveMap,Ze=!!S.metalnessMap,D=!!S.roughnessMap,w=S.anisotropy>0,Q=S.clearcoat>0,ge=S.dispersion>0,we=S.iridescence>0,xe=S.sheen>0,Je=S.transmission>0,ze=w&&!!S.anisotropyMap,$e=Q&&!!S.clearcoatMap,Bt=Q&&!!S.clearcoatNormalMap,Pe=Q&&!!S.clearcoatRoughnessMap,Qe=we&&!!S.iridescenceMap,gt=we&&!!S.iridescenceThicknessMap,yt=xe&&!!S.sheenColorMap,qe=xe&&!!S.sheenRoughnessMap,Wt=!!S.specularMap,It=!!S.specularColorMap,on=!!S.specularIntensityMap,q=Je&&!!S.transmissionMap,ke=Je&&!!S.thicknessMap,fe=!!S.gradientMap,ve=!!S.alphaMap,Ve=S.alphaTest>0,Oe=!!S.alphaHash,Tt=!!S.extensions,hn=ys;S.toneMapped&&(Ne===null||Ne.isXRRenderTarget===!0)&&(hn=s.toneMapping);let Un={shaderID:Te,shaderType:S.type,shaderName:S.name,vertexShader:Gt,fragmentShader:me,defines:S.defines,customVertexShaderID:Le,customFragmentShaderID:nt,isRawShaderMaterial:S.isRawShaderMaterial===!0,glslVersion:S.glslVersion,precision:d,batching:_t,batchingColor:_t&&$._colorsTexture!==null,instancing:pt,instancingColor:pt&&$.instanceColor!==null,instancingMorph:pt&&$.morphTexture!==null,supportsVertexTextures:f,outputColorSpace:Ne===null?s.outputColorSpace:Ne.isXRRenderTarget===!0?Ne.texture.colorSpace:Gn,alphaToCoverage:!!S.alphaToCoverage,map:Nt,matcap:ye,envMap:Ce,envMapMode:Ce&&be.mapping,envMapCubeUVHeight:se,aoMap:B,lightMap:at,bumpMap:Ee,normalMap:Ke,displacementMap:f&&Ie,emissiveMap:mt,normalMapObjectSpace:Ke&&S.normalMapType===hg,normalMapTangentSpace:Ke&&S.normalMapType===Js,metalnessMap:Ze,roughnessMap:D,anisotropy:w,anisotropyMap:ze,clearcoat:Q,clearcoatMap:$e,clearcoatNormalMap:Bt,clearcoatRoughnessMap:Pe,dispersion:ge,iridescence:we,iridescenceMap:Qe,iridescenceThicknessMap:gt,sheen:xe,sheenColorMap:yt,sheenRoughnessMap:qe,specularMap:Wt,specularColorMap:It,specularIntensityMap:on,transmission:Je,transmissionMap:q,thicknessMap:ke,gradientMap:fe,opaque:S.transparent===!1&&S.blending===wr&&S.alphaToCoverage===!1,alphaMap:ve,alphaTest:Ve,alphaHash:Oe,combine:S.combine,mapUv:Nt&&x(S.map.channel),aoMapUv:B&&x(S.aoMap.channel),lightMapUv:at&&x(S.lightMap.channel),bumpMapUv:Ee&&x(S.bumpMap.channel),normalMapUv:Ke&&x(S.normalMap.channel),displacementMapUv:Ie&&x(S.displacementMap.channel),emissiveMapUv:mt&&x(S.emissiveMap.channel),metalnessMapUv:Ze&&x(S.metalnessMap.channel),roughnessMapUv:D&&x(S.roughnessMap.channel),anisotropyMapUv:ze&&x(S.anisotropyMap.channel),clearcoatMapUv:$e&&x(S.clearcoatMap.channel),clearcoatNormalMapUv:Bt&&x(S.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Pe&&x(S.clearcoatRoughnessMap.channel),iridescenceMapUv:Qe&&x(S.iridescenceMap.channel),iridescenceThicknessMapUv:gt&&x(S.iridescenceThicknessMap.channel),sheenColorMapUv:yt&&x(S.sheenColorMap.channel),sheenRoughnessMapUv:qe&&x(S.sheenRoughnessMap.channel),specularMapUv:Wt&&x(S.specularMap.channel),specularColorMapUv:It&&x(S.specularColorMap.channel),specularIntensityMapUv:on&&x(S.specularIntensityMap.channel),transmissionMapUv:q&&x(S.transmissionMap.channel),thicknessMapUv:ke&&x(S.thicknessMap.channel),alphaMapUv:ve&&x(S.alphaMap.channel),vertexTangents:!!pe.attributes.tangent&&(Ke||w),vertexColors:S.vertexColors,vertexAlphas:S.vertexColors===!0&&!!pe.attributes.color&&pe.attributes.color.itemSize===4,pointsUvs:$.isPoints===!0&&!!pe.attributes.uv&&(Nt||ve),fog:!!ee,useFog:S.fog===!0,fogExp2:!!ee&&ee.isFogExp2,flatShading:S.flatShading===!0,sizeAttenuation:S.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:ft,skinning:$.isSkinnedMesh===!0,morphTargets:pe.morphAttributes.position!==void 0,morphNormals:pe.morphAttributes.normal!==void 0,morphColors:pe.morphAttributes.color!==void 0,morphTargetsCount:Fe,morphTextureStride:dt,numDirLights:M.directional.length,numPointLights:M.point.length,numSpotLights:M.spot.length,numSpotLightMaps:M.spotLightMap.length,numRectAreaLights:M.rectArea.length,numHemiLights:M.hemi.length,numDirLightShadows:M.directionalShadowMap.length,numPointLightShadows:M.pointShadowMap.length,numSpotLightShadows:M.spotShadowMap.length,numSpotLightShadowsWithMaps:M.numSpotLightShadowsWithMaps,numLightProbes:M.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:S.dithering,shadowMapEnabled:s.shadowMap.enabled&&N.length>0,shadowMapType:s.shadowMap.type,toneMapping:hn,decodeVideoTexture:Nt&&S.map.isVideoTexture===!0&&zt.getTransfer(S.map.colorSpace)===rn,decodeVideoTextureEmissive:mt&&S.emissiveMap.isVideoTexture===!0&&zt.getTransfer(S.emissiveMap.colorSpace)===rn,premultipliedAlpha:S.premultipliedAlpha,doubleSided:S.side===Bn,flipSided:S.side===ei,useDepthPacking:S.depthPacking>=0,depthPacking:S.depthPacking||0,index0AttributeName:S.index0AttributeName,extensionClipCullDistance:Tt&&S.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Tt&&S.extensions.multiDraw===!0||_t)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:S.customProgramCacheKey()};return Un.vertexUv1s=c.has(1),Un.vertexUv2s=c.has(2),Un.vertexUv3s=c.has(3),c.clear(),Un}function m(S){let M=[];if(S.shaderID?M.push(S.shaderID):(M.push(S.customVertexShaderID),M.push(S.customFragmentShaderID)),S.defines!==void 0)for(let N in S.defines)M.push(N),M.push(S.defines[N]);return S.isRawShaderMaterial===!1&&(y(M,S),_(M,S),M.push(s.outputColorSpace)),M.push(S.customProgramCacheKey),M.join()}function y(S,M){S.push(M.precision),S.push(M.outputColorSpace),S.push(M.envMapMode),S.push(M.envMapCubeUVHeight),S.push(M.mapUv),S.push(M.alphaMapUv),S.push(M.lightMapUv),S.push(M.aoMapUv),S.push(M.bumpMapUv),S.push(M.normalMapUv),S.push(M.displacementMapUv),S.push(M.emissiveMapUv),S.push(M.metalnessMapUv),S.push(M.roughnessMapUv),S.push(M.anisotropyMapUv),S.push(M.clearcoatMapUv),S.push(M.clearcoatNormalMapUv),S.push(M.clearcoatRoughnessMapUv),S.push(M.iridescenceMapUv),S.push(M.iridescenceThicknessMapUv),S.push(M.sheenColorMapUv),S.push(M.sheenRoughnessMapUv),S.push(M.specularMapUv),S.push(M.specularColorMapUv),S.push(M.specularIntensityMapUv),S.push(M.transmissionMapUv),S.push(M.thicknessMapUv),S.push(M.combine),S.push(M.fogExp2),S.push(M.sizeAttenuation),S.push(M.morphTargetsCount),S.push(M.morphAttributeCount),S.push(M.numDirLights),S.push(M.numPointLights),S.push(M.numSpotLights),S.push(M.numSpotLightMaps),S.push(M.numHemiLights),S.push(M.numRectAreaLights),S.push(M.numDirLightShadows),S.push(M.numPointLightShadows),S.push(M.numSpotLightShadows),S.push(M.numSpotLightShadowsWithMaps),S.push(M.numLightProbes),S.push(M.shadowMapType),S.push(M.toneMapping),S.push(M.numClippingPlanes),S.push(M.numClipIntersection),S.push(M.depthPacking)}function _(S,M){a.disableAll(),M.supportsVertexTextures&&a.enable(0),M.instancing&&a.enable(1),M.instancingColor&&a.enable(2),M.instancingMorph&&a.enable(3),M.matcap&&a.enable(4),M.envMap&&a.enable(5),M.normalMapObjectSpace&&a.enable(6),M.normalMapTangentSpace&&a.enable(7),M.clearcoat&&a.enable(8),M.iridescence&&a.enable(9),M.alphaTest&&a.enable(10),M.vertexColors&&a.enable(11),M.vertexAlphas&&a.enable(12),M.vertexUv1s&&a.enable(13),M.vertexUv2s&&a.enable(14),M.vertexUv3s&&a.enable(15),M.vertexTangents&&a.enable(16),M.anisotropy&&a.enable(17),M.alphaHash&&a.enable(18),M.batching&&a.enable(19),M.dispersion&&a.enable(20),M.batchingColor&&a.enable(21),S.push(a.mask),a.disableAll(),M.fog&&a.enable(0),M.useFog&&a.enable(1),M.flatShading&&a.enable(2),M.logarithmicDepthBuffer&&a.enable(3),M.reverseDepthBuffer&&a.enable(4),M.skinning&&a.enable(5),M.morphTargets&&a.enable(6),M.morphNormals&&a.enable(7),M.morphColors&&a.enable(8),M.premultipliedAlpha&&a.enable(9),M.shadowMapEnabled&&a.enable(10),M.doubleSided&&a.enable(11),M.flipSided&&a.enable(12),M.useDepthPacking&&a.enable(13),M.dithering&&a.enable(14),M.transmission&&a.enable(15),M.sheen&&a.enable(16),M.opaque&&a.enable(17),M.pointsUvs&&a.enable(18),M.decodeVideoTexture&&a.enable(19),M.decodeVideoTextureEmissive&&a.enable(20),M.alphaToCoverage&&a.enable(21),S.push(a.mask)}function v(S){let M=p[S.type],N;if(M){let J=Hi[M];N=bg.clone(J.uniforms)}else N=S.uniforms;return N}function F(S,M){let N;for(let J=0,$=h.length;J<$;J++){let ee=h[J];if(ee.cacheKey===M){N=ee,++N.usedTimes;break}}return N===void 0&&(N=new U1(s,M,S,r),h.push(N)),N}function T(S){if(--S.usedTimes===0){let M=h.indexOf(S);h[M]=h[h.length-1],h.pop(),S.destroy()}}function U(S){l.remove(S)}function C(){l.dispose()}return{getParameters:g,getProgramCacheKey:m,getUniforms:v,acquireProgram:F,releaseProgram:T,releaseShaderCache:U,programs:h,dispose:C}}function O1(){let s=new WeakMap;function e(o){return s.has(o)}function t(o){let a=s.get(o);return a===void 0&&(a={},s.set(o,a)),a}function n(o){s.delete(o)}function i(o,a,l){s.get(o)[a]=l}function r(){s=new WeakMap}return{has:e,get:t,remove:n,update:i,dispose:r}}function B1(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.material.id!==e.material.id?s.material.id-e.material.id:s.z!==e.z?s.z-e.z:s.id-e.id}function Nm(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.z!==e.z?e.z-s.z:s.id-e.id}function Fm(){let s=[],e=0,t=[],n=[],i=[];function r(){e=0,t.length=0,n.length=0,i.length=0}function o(u,f,d,p,x,g){let m=s[e];return m===void 0?(m={id:u.id,object:u,geometry:f,material:d,groupOrder:p,renderOrder:u.renderOrder,z:x,group:g},s[e]=m):(m.id=u.id,m.object=u,m.geometry=f,m.material=d,m.groupOrder=p,m.renderOrder=u.renderOrder,m.z=x,m.group=g),e++,m}function a(u,f,d,p,x,g){let m=o(u,f,d,p,x,g);d.transmission>0?n.push(m):d.transparent===!0?i.push(m):t.push(m)}function l(u,f,d,p,x,g){let m=o(u,f,d,p,x,g);d.transmission>0?n.unshift(m):d.transparent===!0?i.unshift(m):t.unshift(m)}function c(u,f){t.length>1&&t.sort(u||B1),n.length>1&&n.sort(f||Nm),i.length>1&&i.sort(f||Nm)}function h(){for(let u=e,f=s.length;u<f;u++){let d=s[u];if(d.id===null)break;d.id=null,d.object=null,d.geometry=null,d.material=null,d.group=null}}return{opaque:t,transmissive:n,transparent:i,init:r,push:a,unshift:l,finish:h,sort:c}}function z1(){let s=new WeakMap;function e(n,i){let r=s.get(n),o;return r===void 0?(o=new Fm,s.set(n,[o])):i>=r.length?(o=new Fm,r.push(o)):o=r[i],o}function t(){s=new WeakMap}return{get:e,dispose:t}}function k1(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new L,color:new Be};break;case"SpotLight":t={position:new L,direction:new L,color:new Be,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new L,color:new Be,distance:0,decay:0};break;case"HemisphereLight":t={direction:new L,skyColor:new Be,groundColor:new Be};break;case"RectAreaLight":t={color:new Be,position:new L,halfWidth:new L,halfHeight:new L};break}return s[e.id]=t,t}}}function H1(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _e};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _e};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new _e,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[e.id]=t,t}}}var V1=0;function G1(s,e){return(e.castShadow?2:0)-(s.castShadow?2:0)+(e.map?1:0)-(s.map?1:0)}function W1(s){let e=new k1,t=H1(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new L);let i=new L,r=new ct,o=new ct;function a(c){let h=0,u=0,f=0;for(let S=0;S<9;S++)n.probe[S].set(0,0,0);let d=0,p=0,x=0,g=0,m=0,y=0,_=0,v=0,F=0,T=0,U=0;c.sort(G1);for(let S=0,M=c.length;S<M;S++){let N=c[S],J=N.color,$=N.intensity,ee=N.distance,pe=N.shadow&&N.shadow.map?N.shadow.map.texture:null;if(N.isAmbientLight)h+=J.r*$,u+=J.g*$,f+=J.b*$;else if(N.isLightProbe){for(let ie=0;ie<9;ie++)n.probe[ie].addScaledVector(N.sh.coefficients[ie],$);U++}else if(N.isDirectionalLight){let ie=e.get(N);if(ie.color.copy(N.color).multiplyScalar(N.intensity),N.castShadow){let be=N.shadow,se=t.get(N);se.shadowIntensity=be.intensity,se.shadowBias=be.bias,se.shadowNormalBias=be.normalBias,se.shadowRadius=be.radius,se.shadowMapSize=be.mapSize,n.directionalShadow[d]=se,n.directionalShadowMap[d]=pe,n.directionalShadowMatrix[d]=N.shadow.matrix,y++}n.directional[d]=ie,d++}else if(N.isSpotLight){let ie=e.get(N);ie.position.setFromMatrixPosition(N.matrixWorld),ie.color.copy(J).multiplyScalar($),ie.distance=ee,ie.coneCos=Math.cos(N.angle),ie.penumbraCos=Math.cos(N.angle*(1-N.penumbra)),ie.decay=N.decay,n.spot[x]=ie;let be=N.shadow;if(N.map&&(n.spotLightMap[F]=N.map,F++,be.updateMatrices(N),N.castShadow&&T++),n.spotLightMatrix[x]=be.matrix,N.castShadow){let se=t.get(N);se.shadowIntensity=be.intensity,se.shadowBias=be.bias,se.shadowNormalBias=be.normalBias,se.shadowRadius=be.radius,se.shadowMapSize=be.mapSize,n.spotShadow[x]=se,n.spotShadowMap[x]=pe,v++}x++}else if(N.isRectAreaLight){let ie=e.get(N);ie.color.copy(J).multiplyScalar($),ie.halfWidth.set(N.width*.5,0,0),ie.halfHeight.set(0,N.height*.5,0),n.rectArea[g]=ie,g++}else if(N.isPointLight){let ie=e.get(N);if(ie.color.copy(N.color).multiplyScalar(N.intensity),ie.distance=N.distance,ie.decay=N.decay,N.castShadow){let be=N.shadow,se=t.get(N);se.shadowIntensity=be.intensity,se.shadowBias=be.bias,se.shadowNormalBias=be.normalBias,se.shadowRadius=be.radius,se.shadowMapSize=be.mapSize,se.shadowCameraNear=be.camera.near,se.shadowCameraFar=be.camera.far,n.pointShadow[p]=se,n.pointShadowMap[p]=pe,n.pointShadowMatrix[p]=N.shadow.matrix,_++}n.point[p]=ie,p++}else if(N.isHemisphereLight){let ie=e.get(N);ie.skyColor.copy(N.color).multiplyScalar($),ie.groundColor.copy(N.groundColor).multiplyScalar($),n.hemi[m]=ie,m++}}g>0&&(s.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=He.LTC_FLOAT_1,n.rectAreaLTC2=He.LTC_FLOAT_2):(n.rectAreaLTC1=He.LTC_HALF_1,n.rectAreaLTC2=He.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=f;let C=n.hash;(C.directionalLength!==d||C.pointLength!==p||C.spotLength!==x||C.rectAreaLength!==g||C.hemiLength!==m||C.numDirectionalShadows!==y||C.numPointShadows!==_||C.numSpotShadows!==v||C.numSpotMaps!==F||C.numLightProbes!==U)&&(n.directional.length=d,n.spot.length=x,n.rectArea.length=g,n.point.length=p,n.hemi.length=m,n.directionalShadow.length=y,n.directionalShadowMap.length=y,n.pointShadow.length=_,n.pointShadowMap.length=_,n.spotShadow.length=v,n.spotShadowMap.length=v,n.directionalShadowMatrix.length=y,n.pointShadowMatrix.length=_,n.spotLightMatrix.length=v+F-T,n.spotLightMap.length=F,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=U,C.directionalLength=d,C.pointLength=p,C.spotLength=x,C.rectAreaLength=g,C.hemiLength=m,C.numDirectionalShadows=y,C.numPointShadows=_,C.numSpotShadows=v,C.numSpotMaps=F,C.numLightProbes=U,n.version=V1++)}function l(c,h){let u=0,f=0,d=0,p=0,x=0,g=h.matrixWorldInverse;for(let m=0,y=c.length;m<y;m++){let _=c[m];if(_.isDirectionalLight){let v=n.directional[u];v.direction.setFromMatrixPosition(_.matrixWorld),i.setFromMatrixPosition(_.target.matrixWorld),v.direction.sub(i),v.direction.transformDirection(g),u++}else if(_.isSpotLight){let v=n.spot[d];v.position.setFromMatrixPosition(_.matrixWorld),v.position.applyMatrix4(g),v.direction.setFromMatrixPosition(_.matrixWorld),i.setFromMatrixPosition(_.target.matrixWorld),v.direction.sub(i),v.direction.transformDirection(g),d++}else if(_.isRectAreaLight){let v=n.rectArea[p];v.position.setFromMatrixPosition(_.matrixWorld),v.position.applyMatrix4(g),o.identity(),r.copy(_.matrixWorld),r.premultiply(g),o.extractRotation(r),v.halfWidth.set(_.width*.5,0,0),v.halfHeight.set(0,_.height*.5,0),v.halfWidth.applyMatrix4(o),v.halfHeight.applyMatrix4(o),p++}else if(_.isPointLight){let v=n.point[f];v.position.setFromMatrixPosition(_.matrixWorld),v.position.applyMatrix4(g),f++}else if(_.isHemisphereLight){let v=n.hemi[x];v.direction.setFromMatrixPosition(_.matrixWorld),v.direction.transformDirection(g),x++}}}return{setup:a,setupView:l,state:n}}function Om(s){let e=new W1(s),t=[],n=[];function i(h){c.camera=h,t.length=0,n.length=0}function r(h){t.push(h)}function o(h){n.push(h)}function a(){e.setup(t)}function l(h){e.setupView(t,h)}let c={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:i,state:c,setupLights:a,setupLightsView:l,pushLight:r,pushShadow:o}}function X1(s){let e=new WeakMap;function t(i,r=0){let o=e.get(i),a;return o===void 0?(a=new Om(s),e.set(i,[a])):r>=o.length?(a=new Om(s),o.push(a)):a=o[r],a}function n(){e=new WeakMap}return{get:t,dispose:n}}var Ua=class extends xn{static get type(){return"MeshDepthMaterial"}constructor(e){super(),this.isMeshDepthMaterial=!0,this.depthPacking=lg,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Na=class extends xn{static get type(){return"MeshDistanceMaterial"}constructor(e){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}},q1=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Y1=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function Z1(s,e,t){let n=new Or,i=new _e,r=new _e,o=new kt,a=new Ua({depthPacking:cg}),l=new Na,c={},h=t.maxTextureSize,u={[Gi]:ei,[ei]:Gi,[Bn]:Bn},f=new Ot({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new _e},radius:{value:4}},vertexShader:q1,fragmentShader:Y1}),d=f.clone();d.defines.HORIZONTAL_PASS=1;let p=new tt;p.setAttribute("position",new ht(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new Ft(p,f),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Td;let m=this.type;this.render=function(T,U,C){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||T.length===0)return;let S=s.getRenderTarget(),M=s.getActiveCubeFace(),N=s.getActiveMipmapLevel(),J=s.state;J.setBlending(Vi),J.buffers.color.setClear(1,1,1,1),J.buffers.depth.setTest(!0),J.setScissorTest(!1);let $=m!==Zi&&this.type===Zi,ee=m===Zi&&this.type!==Zi;for(let pe=0,ie=T.length;pe<ie;pe++){let be=T[pe],se=be.shadow;if(se===void 0){console.warn("THREE.WebGLShadowMap:",be,"has no shadow.");continue}if(se.autoUpdate===!1&&se.needsUpdate===!1)continue;i.copy(se.mapSize);let Te=se.getFrameExtents();if(i.multiply(Te),r.copy(se.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/Te.x),i.x=r.x*Te.x,se.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/Te.y),i.y=r.y*Te.y,se.mapSize.y=r.y)),se.map===null||$===!0||ee===!0){let Fe=this.type!==Zi?{minFilter:Tn,magFilter:Tn}:{};se.map!==null&&se.map.dispose(),se.map=new ti(i.x,i.y,Fe),se.map.texture.name=be.name+".shadowMap",se.camera.updateProjectionMatrix()}s.setRenderTarget(se.map),s.clear();let Ue=se.getViewportCount();for(let Fe=0;Fe<Ue;Fe++){let dt=se.getViewport(Fe);o.set(r.x*dt.x,r.y*dt.y,r.x*dt.z,r.y*dt.w),J.viewport(o),se.updateMatrices(be,Fe),n=se.getFrustum(),v(U,C,se.camera,be,this.type)}se.isPointLightShadow!==!0&&this.type===Zi&&y(se,C),se.needsUpdate=!1}m=this.type,g.needsUpdate=!1,s.setRenderTarget(S,M,N)};function y(T,U){let C=e.update(x);f.defines.VSM_SAMPLES!==T.blurSamples&&(f.defines.VSM_SAMPLES=T.blurSamples,d.defines.VSM_SAMPLES=T.blurSamples,f.needsUpdate=!0,d.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new ti(i.x,i.y)),f.uniforms.shadow_pass.value=T.map.texture,f.uniforms.resolution.value=T.mapSize,f.uniforms.radius.value=T.radius,s.setRenderTarget(T.mapPass),s.clear(),s.renderBufferDirect(U,null,C,f,x,null),d.uniforms.shadow_pass.value=T.mapPass.texture,d.uniforms.resolution.value=T.mapSize,d.uniforms.radius.value=T.radius,s.setRenderTarget(T.map),s.clear(),s.renderBufferDirect(U,null,C,d,x,null)}function _(T,U,C,S){let M=null,N=C.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(N!==void 0)M=N;else if(M=C.isPointLight===!0?l:a,s.localClippingEnabled&&U.clipShadows===!0&&Array.isArray(U.clippingPlanes)&&U.clippingPlanes.length!==0||U.displacementMap&&U.displacementScale!==0||U.alphaMap&&U.alphaTest>0||U.map&&U.alphaTest>0){let J=M.uuid,$=U.uuid,ee=c[J];ee===void 0&&(ee={},c[J]=ee);let pe=ee[$];pe===void 0&&(pe=M.clone(),ee[$]=pe,U.addEventListener("dispose",F)),M=pe}if(M.visible=U.visible,M.wireframe=U.wireframe,S===Zi?M.side=U.shadowSide!==null?U.shadowSide:U.side:M.side=U.shadowSide!==null?U.shadowSide:u[U.side],M.alphaMap=U.alphaMap,M.alphaTest=U.alphaTest,M.map=U.map,M.clipShadows=U.clipShadows,M.clippingPlanes=U.clippingPlanes,M.clipIntersection=U.clipIntersection,M.displacementMap=U.displacementMap,M.displacementScale=U.displacementScale,M.displacementBias=U.displacementBias,M.wireframeLinewidth=U.wireframeLinewidth,M.linewidth=U.linewidth,C.isPointLight===!0&&M.isMeshDistanceMaterial===!0){let J=s.properties.get(M);J.light=C}return M}function v(T,U,C,S,M){if(T.visible===!1)return;if(T.layers.test(U.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&M===Zi)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(C.matrixWorldInverse,T.matrixWorld);let $=e.update(T),ee=T.material;if(Array.isArray(ee)){let pe=$.groups;for(let ie=0,be=pe.length;ie<be;ie++){let se=pe[ie],Te=ee[se.materialIndex];if(Te&&Te.visible){let Ue=_(T,Te,S,M);T.onBeforeShadow(s,T,U,C,$,Ue,se),s.renderBufferDirect(C,null,$,Ue,T,se),T.onAfterShadow(s,T,U,C,$,Ue,se)}}}else if(ee.visible){let pe=_(T,ee,S,M);T.onBeforeShadow(s,T,U,C,$,pe,null),s.renderBufferDirect(C,null,$,pe,T,null),T.onAfterShadow(s,T,U,C,$,pe,null)}}let J=T.children;for(let $=0,ee=J.length;$<ee;$++)v(J[$],U,C,S,M)}function F(T){T.target.removeEventListener("dispose",F);for(let C in c){let S=c[C],M=T.target.uuid;M in S&&(S[M].dispose(),delete S[M])}}}var $1={[gc]:xc,[vc]:Cr,[_c]:Mc,[Rr]:yc,[xc]:gc,[Cr]:vc,[Mc]:_c,[yc]:Rr};function K1(s,e){function t(){let q=!1,ke=new kt,fe=null,ve=new kt(0,0,0,0);return{setMask:function(Ve){fe!==Ve&&!q&&(s.colorMask(Ve,Ve,Ve,Ve),fe=Ve)},setLocked:function(Ve){q=Ve},setClear:function(Ve,Oe,Tt,hn,Un){Un===!0&&(Ve*=hn,Oe*=hn,Tt*=hn),ke.set(Ve,Oe,Tt,hn),ve.equals(ke)===!1&&(s.clearColor(Ve,Oe,Tt,hn),ve.copy(ke))},reset:function(){q=!1,fe=null,ve.set(-1,0,0,0)}}}function n(){let q=!1,ke=!1,fe=null,ve=null,Ve=null;return{setReversed:function(Oe){if(ke!==Oe){let Tt=e.get("EXT_clip_control");ke?Tt.clipControlEXT(Tt.LOWER_LEFT_EXT,Tt.ZERO_TO_ONE_EXT):Tt.clipControlEXT(Tt.LOWER_LEFT_EXT,Tt.NEGATIVE_ONE_TO_ONE_EXT);let hn=Ve;Ve=null,this.setClear(hn)}ke=Oe},getReversed:function(){return ke},setTest:function(Oe){Oe?Ne(s.DEPTH_TEST):ft(s.DEPTH_TEST)},setMask:function(Oe){fe!==Oe&&!q&&(s.depthMask(Oe),fe=Oe)},setFunc:function(Oe){if(ke&&(Oe=$1[Oe]),ve!==Oe){switch(Oe){case gc:s.depthFunc(s.NEVER);break;case xc:s.depthFunc(s.ALWAYS);break;case vc:s.depthFunc(s.LESS);break;case Rr:s.depthFunc(s.LEQUAL);break;case _c:s.depthFunc(s.EQUAL);break;case yc:s.depthFunc(s.GEQUAL);break;case Cr:s.depthFunc(s.GREATER);break;case Mc:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}ve=Oe}},setLocked:function(Oe){q=Oe},setClear:function(Oe){Ve!==Oe&&(ke&&(Oe=1-Oe),s.clearDepth(Oe),Ve=Oe)},reset:function(){q=!1,fe=null,ve=null,Ve=null,ke=!1}}}function i(){let q=!1,ke=null,fe=null,ve=null,Ve=null,Oe=null,Tt=null,hn=null,Un=null;return{setTest:function(en){q||(en?Ne(s.STENCIL_TEST):ft(s.STENCIL_TEST))},setMask:function(en){ke!==en&&!q&&(s.stencilMask(en),ke=en)},setFunc:function(en,di,Di){(fe!==en||ve!==di||Ve!==Di)&&(s.stencilFunc(en,di,Di),fe=en,ve=di,Ve=Di)},setOp:function(en,di,Di){(Oe!==en||Tt!==di||hn!==Di)&&(s.stencilOp(en,di,Di),Oe=en,Tt=di,hn=Di)},setLocked:function(en){q=en},setClear:function(en){Un!==en&&(s.clearStencil(en),Un=en)},reset:function(){q=!1,ke=null,fe=null,ve=null,Ve=null,Oe=null,Tt=null,hn=null,Un=null}}}let r=new t,o=new n,a=new i,l=new WeakMap,c=new WeakMap,h={},u={},f=new WeakMap,d=[],p=null,x=!1,g=null,m=null,y=null,_=null,v=null,F=null,T=null,U=new Be(0,0,0),C=0,S=!1,M=null,N=null,J=null,$=null,ee=null,pe=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS),ie=!1,be=0,se=s.getParameter(s.VERSION);se.indexOf("WebGL")!==-1?(be=parseFloat(/^WebGL (\d)/.exec(se)[1]),ie=be>=1):se.indexOf("OpenGL ES")!==-1&&(be=parseFloat(/^OpenGL ES (\d)/.exec(se)[1]),ie=be>=2);let Te=null,Ue={},Fe=s.getParameter(s.SCISSOR_BOX),dt=s.getParameter(s.VIEWPORT),Gt=new kt().fromArray(Fe),me=new kt().fromArray(dt);function Le(q,ke,fe,ve){let Ve=new Uint8Array(4),Oe=s.createTexture();s.bindTexture(q,Oe),s.texParameteri(q,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(q,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Tt=0;Tt<fe;Tt++)q===s.TEXTURE_3D||q===s.TEXTURE_2D_ARRAY?s.texImage3D(ke,0,s.RGBA,1,1,ve,0,s.RGBA,s.UNSIGNED_BYTE,Ve):s.texImage2D(ke+Tt,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,Ve);return Oe}let nt={};nt[s.TEXTURE_2D]=Le(s.TEXTURE_2D,s.TEXTURE_2D,1),nt[s.TEXTURE_CUBE_MAP]=Le(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),nt[s.TEXTURE_2D_ARRAY]=Le(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),nt[s.TEXTURE_3D]=Le(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),Ne(s.DEPTH_TEST),o.setFunc(Rr),Ee(!1),Ke(af),Ne(s.CULL_FACE),B(Vi);function Ne(q){h[q]!==!0&&(s.enable(q),h[q]=!0)}function ft(q){h[q]!==!1&&(s.disable(q),h[q]=!1)}function pt(q,ke){return u[q]!==ke?(s.bindFramebuffer(q,ke),u[q]=ke,q===s.DRAW_FRAMEBUFFER&&(u[s.FRAMEBUFFER]=ke),q===s.FRAMEBUFFER&&(u[s.DRAW_FRAMEBUFFER]=ke),!0):!1}function _t(q,ke){let fe=d,ve=!1;if(q){fe=f.get(ke),fe===void 0&&(fe=[],f.set(ke,fe));let Ve=q.textures;if(fe.length!==Ve.length||fe[0]!==s.COLOR_ATTACHMENT0){for(let Oe=0,Tt=Ve.length;Oe<Tt;Oe++)fe[Oe]=s.COLOR_ATTACHMENT0+Oe;fe.length=Ve.length,ve=!0}}else fe[0]!==s.BACK&&(fe[0]=s.BACK,ve=!0);ve&&s.drawBuffers(fe)}function Nt(q){return p!==q?(s.useProgram(q),p=q,!0):!1}let ye={[Vs]:s.FUNC_ADD,[L0]:s.FUNC_SUBTRACT,[D0]:s.FUNC_REVERSE_SUBTRACT};ye[U0]=s.MIN,ye[N0]=s.MAX;let Ce={[F0]:s.ZERO,[O0]:s.ONE,[B0]:s.SRC_COLOR,[pc]:s.SRC_ALPHA,[W0]:s.SRC_ALPHA_SATURATE,[V0]:s.DST_COLOR,[k0]:s.DST_ALPHA,[z0]:s.ONE_MINUS_SRC_COLOR,[mc]:s.ONE_MINUS_SRC_ALPHA,[G0]:s.ONE_MINUS_DST_COLOR,[H0]:s.ONE_MINUS_DST_ALPHA,[X0]:s.CONSTANT_COLOR,[q0]:s.ONE_MINUS_CONSTANT_COLOR,[Y0]:s.CONSTANT_ALPHA,[Z0]:s.ONE_MINUS_CONSTANT_ALPHA};function B(q,ke,fe,ve,Ve,Oe,Tt,hn,Un,en){if(q===Vi){x===!0&&(ft(s.BLEND),x=!1);return}if(x===!1&&(Ne(s.BLEND),x=!0),q!==I0){if(q!==g||en!==S){if((m!==Vs||v!==Vs)&&(s.blendEquation(s.FUNC_ADD),m=Vs,v=Vs),en)switch(q){case wr:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case ba:s.blendFunc(s.ONE,s.ONE);break;case lf:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case cf:s.blendFuncSeparate(s.ZERO,s.SRC_COLOR,s.ZERO,s.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",q);break}else switch(q){case wr:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case ba:s.blendFunc(s.SRC_ALPHA,s.ONE);break;case lf:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case cf:s.blendFunc(s.ZERO,s.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",q);break}y=null,_=null,F=null,T=null,U.set(0,0,0),C=0,g=q,S=en}return}Ve=Ve||ke,Oe=Oe||fe,Tt=Tt||ve,(ke!==m||Ve!==v)&&(s.blendEquationSeparate(ye[ke],ye[Ve]),m=ke,v=Ve),(fe!==y||ve!==_||Oe!==F||Tt!==T)&&(s.blendFuncSeparate(Ce[fe],Ce[ve],Ce[Oe],Ce[Tt]),y=fe,_=ve,F=Oe,T=Tt),(hn.equals(U)===!1||Un!==C)&&(s.blendColor(hn.r,hn.g,hn.b,Un),U.copy(hn),C=Un),g=q,S=!1}function at(q,ke){q.side===Bn?ft(s.CULL_FACE):Ne(s.CULL_FACE);let fe=q.side===ei;ke&&(fe=!fe),Ee(fe),q.blending===wr&&q.transparent===!1?B(Vi):B(q.blending,q.blendEquation,q.blendSrc,q.blendDst,q.blendEquationAlpha,q.blendSrcAlpha,q.blendDstAlpha,q.blendColor,q.blendAlpha,q.premultipliedAlpha),o.setFunc(q.depthFunc),o.setTest(q.depthTest),o.setMask(q.depthWrite),r.setMask(q.colorWrite);let ve=q.stencilWrite;a.setTest(ve),ve&&(a.setMask(q.stencilWriteMask),a.setFunc(q.stencilFunc,q.stencilRef,q.stencilFuncMask),a.setOp(q.stencilFail,q.stencilZFail,q.stencilZPass)),mt(q.polygonOffset,q.polygonOffsetFactor,q.polygonOffsetUnits),q.alphaToCoverage===!0?Ne(s.SAMPLE_ALPHA_TO_COVERAGE):ft(s.SAMPLE_ALPHA_TO_COVERAGE)}function Ee(q){M!==q&&(q?s.frontFace(s.CW):s.frontFace(s.CCW),M=q)}function Ke(q){q!==R0?(Ne(s.CULL_FACE),q!==N&&(q===af?s.cullFace(s.BACK):q===C0?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):ft(s.CULL_FACE),N=q}function Ie(q){q!==J&&(ie&&s.lineWidth(q),J=q)}function mt(q,ke,fe){q?(Ne(s.POLYGON_OFFSET_FILL),($!==ke||ee!==fe)&&(s.polygonOffset(ke,fe),$=ke,ee=fe)):ft(s.POLYGON_OFFSET_FILL)}function Ze(q){q?Ne(s.SCISSOR_TEST):ft(s.SCISSOR_TEST)}function D(q){q===void 0&&(q=s.TEXTURE0+pe-1),Te!==q&&(s.activeTexture(q),Te=q)}function w(q,ke,fe){fe===void 0&&(Te===null?fe=s.TEXTURE0+pe-1:fe=Te);let ve=Ue[fe];ve===void 0&&(ve={type:void 0,texture:void 0},Ue[fe]=ve),(ve.type!==q||ve.texture!==ke)&&(Te!==fe&&(s.activeTexture(fe),Te=fe),s.bindTexture(q,ke||nt[q]),ve.type=q,ve.texture=ke)}function Q(){let q=Ue[Te];q!==void 0&&q.type!==void 0&&(s.bindTexture(q.type,null),q.type=void 0,q.texture=void 0)}function ge(){try{s.compressedTexImage2D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function we(){try{s.compressedTexImage3D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function xe(){try{s.texSubImage2D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function Je(){try{s.texSubImage3D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function ze(){try{s.compressedTexSubImage2D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function $e(){try{s.compressedTexSubImage3D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function Bt(){try{s.texStorage2D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function Pe(){try{s.texStorage3D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function Qe(){try{s.texImage2D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function gt(){try{s.texImage3D.apply(s,arguments)}catch(q){console.error("THREE.WebGLState:",q)}}function yt(q){Gt.equals(q)===!1&&(s.scissor(q.x,q.y,q.z,q.w),Gt.copy(q))}function qe(q){me.equals(q)===!1&&(s.viewport(q.x,q.y,q.z,q.w),me.copy(q))}function Wt(q,ke){let fe=c.get(ke);fe===void 0&&(fe=new WeakMap,c.set(ke,fe));let ve=fe.get(q);ve===void 0&&(ve=s.getUniformBlockIndex(ke,q.name),fe.set(q,ve))}function It(q,ke){let ve=c.get(ke).get(q);l.get(ke)!==ve&&(s.uniformBlockBinding(ke,ve,q.__bindingPointIndex),l.set(ke,ve))}function on(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),o.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),h={},Te=null,Ue={},u={},f=new WeakMap,d=[],p=null,x=!1,g=null,m=null,y=null,_=null,v=null,F=null,T=null,U=new Be(0,0,0),C=0,S=!1,M=null,N=null,J=null,$=null,ee=null,Gt.set(0,0,s.canvas.width,s.canvas.height),me.set(0,0,s.canvas.width,s.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:Ne,disable:ft,bindFramebuffer:pt,drawBuffers:_t,useProgram:Nt,setBlending:B,setMaterial:at,setFlipSided:Ee,setCullFace:Ke,setLineWidth:Ie,setPolygonOffset:mt,setScissorTest:Ze,activeTexture:D,bindTexture:w,unbindTexture:Q,compressedTexImage2D:ge,compressedTexImage3D:we,texImage2D:Qe,texImage3D:gt,updateUBOMapping:Wt,uniformBlockBinding:It,texStorage2D:Bt,texStorage3D:Pe,texSubImage2D:xe,texSubImage3D:Je,compressedTexSubImage2D:ze,compressedTexSubImage3D:$e,scissor:yt,viewport:qe,reset:on}}function J1(s,e){let t=s.image&&s.image.width?s.image.width/s.image.height:1;return t>e?(s.repeat.x=1,s.repeat.y=t/e,s.offset.x=0,s.offset.y=(1-s.repeat.y)/2):(s.repeat.x=e/t,s.repeat.y=1,s.offset.x=(1-s.repeat.x)/2,s.offset.y=0),s}function j1(s,e){let t=s.image&&s.image.width?s.image.width/s.image.height:1;return t>e?(s.repeat.x=e/t,s.repeat.y=1,s.offset.x=(1-s.repeat.x)/2,s.offset.y=0):(s.repeat.x=1,s.repeat.y=t/e,s.offset.x=0,s.offset.y=(1-s.repeat.y)/2),s}function Q1(s){return s.repeat.x=1,s.repeat.y=1,s.offset.x=0,s.offset.y=0,s}function Tf(s,e,t,n){let i=eb(n);switch(t){case Id:return s*e;case Dd:return s*e;case Ud:return s*e*2;case Kh:return s*e/i.components*i.byteLength;case ol:return s*e/i.components*i.byteLength;case Nd:return s*e*2/i.components*i.byteLength;case Jh:return s*e*2/i.components*i.byteLength;case Ld:return s*e*3/i.components*i.byteLength;case Qn:return s*e*4/i.components*i.byteLength;case jh:return s*e*4/i.components*i.byteLength;case da:case pa:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case ma:case ga:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Sc:case Ec:return Math.max(s,16)*Math.max(e,8)/4;case bc:case wc:return Math.max(s,8)*Math.max(e,8)/2;case Ac:case Tc:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case Rc:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Cc:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Pc:return Math.floor((s+4)/5)*Math.floor((e+3)/4)*16;case Ic:return Math.floor((s+4)/5)*Math.floor((e+4)/5)*16;case Lc:return Math.floor((s+5)/6)*Math.floor((e+4)/5)*16;case Dc:return Math.floor((s+5)/6)*Math.floor((e+5)/6)*16;case Uc:return Math.floor((s+7)/8)*Math.floor((e+4)/5)*16;case Nc:return Math.floor((s+7)/8)*Math.floor((e+5)/6)*16;case Fc:return Math.floor((s+7)/8)*Math.floor((e+7)/8)*16;case Oc:return Math.floor((s+9)/10)*Math.floor((e+4)/5)*16;case Bc:return Math.floor((s+9)/10)*Math.floor((e+5)/6)*16;case zc:return Math.floor((s+9)/10)*Math.floor((e+7)/8)*16;case kc:return Math.floor((s+9)/10)*Math.floor((e+9)/10)*16;case Hc:return Math.floor((s+11)/12)*Math.floor((e+9)/10)*16;case Vc:return Math.floor((s+11)/12)*Math.floor((e+11)/12)*16;case xa:case Gc:case Wc:return Math.ceil(s/4)*Math.ceil(e/4)*16;case Fd:case Xc:return Math.ceil(s/4)*Math.ceil(e/4)*8;case qc:case Yc:return Math.ceil(s/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function eb(s){switch(s){case ji:case Rd:return{byteLength:1,components:1};case So:case Cd:case Bo:return{byteLength:2,components:1};case Zh:case $h:return{byteLength:2,components:4};case Es:case Yh:case hi:return{byteLength:4,components:1};case Pd:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${s}.`)}var tb={contain:J1,cover:j1,fill:Q1,getByteLength:Tf};function nb(s,e,t,n,i,r,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new _e,h=new WeakMap,u,f=new WeakMap,d=!1;try{d=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function p(D,w){return d?new OffscreenCanvas(D,w):Ra("canvas")}function x(D,w,Q){let ge=1,we=Ze(D);if((we.width>Q||we.height>Q)&&(ge=Q/Math.max(we.width,we.height)),ge<1)if(typeof HTMLImageElement<"u"&&D instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&D instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&D instanceof ImageBitmap||typeof VideoFrame<"u"&&D instanceof VideoFrame){let xe=Math.floor(ge*we.width),Je=Math.floor(ge*we.height);u===void 0&&(u=p(xe,Je));let ze=w?p(xe,Je):u;return ze.width=xe,ze.height=Je,ze.getContext("2d").drawImage(D,0,0,xe,Je),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+we.width+"x"+we.height+") to ("+xe+"x"+Je+")."),ze}else return"data"in D&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+we.width+"x"+we.height+")."),D;return D}function g(D){return D.generateMipmaps}function m(D){s.generateMipmap(D)}function y(D){return D.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:D.isWebGL3DRenderTarget?s.TEXTURE_3D:D.isWebGLArrayRenderTarget||D.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function _(D,w,Q,ge,we=!1){if(D!==null){if(s[D]!==void 0)return s[D];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+D+"'")}let xe=w;if(w===s.RED&&(Q===s.FLOAT&&(xe=s.R32F),Q===s.HALF_FLOAT&&(xe=s.R16F),Q===s.UNSIGNED_BYTE&&(xe=s.R8)),w===s.RED_INTEGER&&(Q===s.UNSIGNED_BYTE&&(xe=s.R8UI),Q===s.UNSIGNED_SHORT&&(xe=s.R16UI),Q===s.UNSIGNED_INT&&(xe=s.R32UI),Q===s.BYTE&&(xe=s.R8I),Q===s.SHORT&&(xe=s.R16I),Q===s.INT&&(xe=s.R32I)),w===s.RG&&(Q===s.FLOAT&&(xe=s.RG32F),Q===s.HALF_FLOAT&&(xe=s.RG16F),Q===s.UNSIGNED_BYTE&&(xe=s.RG8)),w===s.RG_INTEGER&&(Q===s.UNSIGNED_BYTE&&(xe=s.RG8UI),Q===s.UNSIGNED_SHORT&&(xe=s.RG16UI),Q===s.UNSIGNED_INT&&(xe=s.RG32UI),Q===s.BYTE&&(xe=s.RG8I),Q===s.SHORT&&(xe=s.RG16I),Q===s.INT&&(xe=s.RG32I)),w===s.RGB_INTEGER&&(Q===s.UNSIGNED_BYTE&&(xe=s.RGB8UI),Q===s.UNSIGNED_SHORT&&(xe=s.RGB16UI),Q===s.UNSIGNED_INT&&(xe=s.RGB32UI),Q===s.BYTE&&(xe=s.RGB8I),Q===s.SHORT&&(xe=s.RGB16I),Q===s.INT&&(xe=s.RGB32I)),w===s.RGBA_INTEGER&&(Q===s.UNSIGNED_BYTE&&(xe=s.RGBA8UI),Q===s.UNSIGNED_SHORT&&(xe=s.RGBA16UI),Q===s.UNSIGNED_INT&&(xe=s.RGBA32UI),Q===s.BYTE&&(xe=s.RGBA8I),Q===s.SHORT&&(xe=s.RGBA16I),Q===s.INT&&(xe=s.RGBA32I)),w===s.RGB&&Q===s.UNSIGNED_INT_5_9_9_9_REV&&(xe=s.RGB9_E5),w===s.RGBA){let Je=we?ll:zt.getTransfer(ge);Q===s.FLOAT&&(xe=s.RGBA32F),Q===s.HALF_FLOAT&&(xe=s.RGBA16F),Q===s.UNSIGNED_BYTE&&(xe=Je===rn?s.SRGB8_ALPHA8:s.RGBA8),Q===s.UNSIGNED_SHORT_4_4_4_4&&(xe=s.RGBA4),Q===s.UNSIGNED_SHORT_5_5_5_1&&(xe=s.RGB5_A1)}return(xe===s.R16F||xe===s.R32F||xe===s.RG16F||xe===s.RG32F||xe===s.RGBA16F||xe===s.RGBA32F)&&e.get("EXT_color_buffer_float"),xe}function v(D,w){let Q;return D?w===null||w===Es||w===Ir?Q=s.DEPTH24_STENCIL8:w===hi?Q=s.DEPTH32F_STENCIL8:w===So&&(Q=s.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):w===null||w===Es||w===Ir?Q=s.DEPTH_COMPONENT24:w===hi?Q=s.DEPTH_COMPONENT32F:w===So&&(Q=s.DEPTH_COMPONENT16),Q}function F(D,w){return g(D)===!0||D.isFramebufferTexture&&D.minFilter!==Tn&&D.minFilter!==cn?Math.log2(Math.max(w.width,w.height))+1:D.mipmaps!==void 0&&D.mipmaps.length>0?D.mipmaps.length:D.isCompressedTexture&&Array.isArray(D.image)?w.mipmaps.length:1}function T(D){let w=D.target;w.removeEventListener("dispose",T),C(w),w.isVideoTexture&&h.delete(w)}function U(D){let w=D.target;w.removeEventListener("dispose",U),M(w)}function C(D){let w=n.get(D);if(w.__webglInit===void 0)return;let Q=D.source,ge=f.get(Q);if(ge){let we=ge[w.__cacheKey];we.usedTimes--,we.usedTimes===0&&S(D),Object.keys(ge).length===0&&f.delete(Q)}n.remove(D)}function S(D){let w=n.get(D);s.deleteTexture(w.__webglTexture);let Q=D.source,ge=f.get(Q);delete ge[w.__cacheKey],o.memory.textures--}function M(D){let w=n.get(D);if(D.depthTexture&&(D.depthTexture.dispose(),n.remove(D.depthTexture)),D.isWebGLCubeRenderTarget)for(let ge=0;ge<6;ge++){if(Array.isArray(w.__webglFramebuffer[ge]))for(let we=0;we<w.__webglFramebuffer[ge].length;we++)s.deleteFramebuffer(w.__webglFramebuffer[ge][we]);else s.deleteFramebuffer(w.__webglFramebuffer[ge]);w.__webglDepthbuffer&&s.deleteRenderbuffer(w.__webglDepthbuffer[ge])}else{if(Array.isArray(w.__webglFramebuffer))for(let ge=0;ge<w.__webglFramebuffer.length;ge++)s.deleteFramebuffer(w.__webglFramebuffer[ge]);else s.deleteFramebuffer(w.__webglFramebuffer);if(w.__webglDepthbuffer&&s.deleteRenderbuffer(w.__webglDepthbuffer),w.__webglMultisampledFramebuffer&&s.deleteFramebuffer(w.__webglMultisampledFramebuffer),w.__webglColorRenderbuffer)for(let ge=0;ge<w.__webglColorRenderbuffer.length;ge++)w.__webglColorRenderbuffer[ge]&&s.deleteRenderbuffer(w.__webglColorRenderbuffer[ge]);w.__webglDepthRenderbuffer&&s.deleteRenderbuffer(w.__webglDepthRenderbuffer)}let Q=D.textures;for(let ge=0,we=Q.length;ge<we;ge++){let xe=n.get(Q[ge]);xe.__webglTexture&&(s.deleteTexture(xe.__webglTexture),o.memory.textures--),n.remove(Q[ge])}n.remove(D)}let N=0;function J(){N=0}function $(){let D=N;return D>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+D+" texture units while this GPU supports only "+i.maxTextures),N+=1,D}function ee(D){let w=[];return w.push(D.wrapS),w.push(D.wrapT),w.push(D.wrapR||0),w.push(D.magFilter),w.push(D.minFilter),w.push(D.anisotropy),w.push(D.internalFormat),w.push(D.format),w.push(D.type),w.push(D.generateMipmaps),w.push(D.premultiplyAlpha),w.push(D.flipY),w.push(D.unpackAlignment),w.push(D.colorSpace),w.join()}function pe(D,w){let Q=n.get(D);if(D.isVideoTexture&&Ie(D),D.isRenderTargetTexture===!1&&D.version>0&&Q.__version!==D.version){let ge=D.image;if(ge===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(ge.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{me(Q,D,w);return}}t.bindTexture(s.TEXTURE_2D,Q.__webglTexture,s.TEXTURE0+w)}function ie(D,w){let Q=n.get(D);if(D.version>0&&Q.__version!==D.version){me(Q,D,w);return}t.bindTexture(s.TEXTURE_2D_ARRAY,Q.__webglTexture,s.TEXTURE0+w)}function be(D,w){let Q=n.get(D);if(D.version>0&&Q.__version!==D.version){me(Q,D,w);return}t.bindTexture(s.TEXTURE_3D,Q.__webglTexture,s.TEXTURE0+w)}function se(D,w){let Q=n.get(D);if(D.version>0&&Q.__version!==D.version){Le(Q,D,w);return}t.bindTexture(s.TEXTURE_CUBE_MAP,Q.__webglTexture,s.TEXTURE0+w)}let Te={[ws]:s.REPEAT,[ci]:s.CLAMP_TO_EDGE,[Pr]:s.MIRRORED_REPEAT},Ue={[Tn]:s.NEAREST,[rl]:s.NEAREST_MIPMAP_NEAREST,[Gs]:s.NEAREST_MIPMAP_LINEAR,[cn]:s.LINEAR,[Er]:s.LINEAR_MIPMAP_NEAREST,[yi]:s.LINEAR_MIPMAP_LINEAR},Fe={[ug]:s.NEVER,[xg]:s.ALWAYS,[fg]:s.LESS,[zd]:s.LEQUAL,[dg]:s.EQUAL,[gg]:s.GEQUAL,[pg]:s.GREATER,[mg]:s.NOTEQUAL};function dt(D,w){if(w.type===hi&&e.has("OES_texture_float_linear")===!1&&(w.magFilter===cn||w.magFilter===Er||w.magFilter===Gs||w.magFilter===yi||w.minFilter===cn||w.minFilter===Er||w.minFilter===Gs||w.minFilter===yi)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(D,s.TEXTURE_WRAP_S,Te[w.wrapS]),s.texParameteri(D,s.TEXTURE_WRAP_T,Te[w.wrapT]),(D===s.TEXTURE_3D||D===s.TEXTURE_2D_ARRAY)&&s.texParameteri(D,s.TEXTURE_WRAP_R,Te[w.wrapR]),s.texParameteri(D,s.TEXTURE_MAG_FILTER,Ue[w.magFilter]),s.texParameteri(D,s.TEXTURE_MIN_FILTER,Ue[w.minFilter]),w.compareFunction&&(s.texParameteri(D,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(D,s.TEXTURE_COMPARE_FUNC,Fe[w.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(w.magFilter===Tn||w.minFilter!==Gs&&w.minFilter!==yi||w.type===hi&&e.has("OES_texture_float_linear")===!1)return;if(w.anisotropy>1||n.get(w).__currentAnisotropy){let Q=e.get("EXT_texture_filter_anisotropic");s.texParameterf(D,Q.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(w.anisotropy,i.getMaxAnisotropy())),n.get(w).__currentAnisotropy=w.anisotropy}}}function Gt(D,w){let Q=!1;D.__webglInit===void 0&&(D.__webglInit=!0,w.addEventListener("dispose",T));let ge=w.source,we=f.get(ge);we===void 0&&(we={},f.set(ge,we));let xe=ee(w);if(xe!==D.__cacheKey){we[xe]===void 0&&(we[xe]={texture:s.createTexture(),usedTimes:0},o.memory.textures++,Q=!0),we[xe].usedTimes++;let Je=we[D.__cacheKey];Je!==void 0&&(we[D.__cacheKey].usedTimes--,Je.usedTimes===0&&S(w)),D.__cacheKey=xe,D.__webglTexture=we[xe].texture}return Q}function me(D,w,Q){let ge=s.TEXTURE_2D;(w.isDataArrayTexture||w.isCompressedArrayTexture)&&(ge=s.TEXTURE_2D_ARRAY),w.isData3DTexture&&(ge=s.TEXTURE_3D);let we=Gt(D,w),xe=w.source;t.bindTexture(ge,D.__webglTexture,s.TEXTURE0+Q);let Je=n.get(xe);if(xe.version!==Je.__version||we===!0){t.activeTexture(s.TEXTURE0+Q);let ze=zt.getPrimaries(zt.workingColorSpace),$e=w.colorSpace===gs?null:zt.getPrimaries(w.colorSpace),Bt=w.colorSpace===gs||ze===$e?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,w.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,w.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,Bt);let Pe=x(w.image,!1,i.maxTextureSize);Pe=mt(w,Pe);let Qe=r.convert(w.format,w.colorSpace),gt=r.convert(w.type),yt=_(w.internalFormat,Qe,gt,w.colorSpace,w.isVideoTexture);dt(ge,w);let qe,Wt=w.mipmaps,It=w.isVideoTexture!==!0,on=Je.__version===void 0||we===!0,q=xe.dataReady,ke=F(w,Pe);if(w.isDepthTexture)yt=v(w.format===Lr,w.type),on&&(It?t.texStorage2D(s.TEXTURE_2D,1,yt,Pe.width,Pe.height):t.texImage2D(s.TEXTURE_2D,0,yt,Pe.width,Pe.height,0,Qe,gt,null));else if(w.isDataTexture)if(Wt.length>0){It&&on&&t.texStorage2D(s.TEXTURE_2D,ke,yt,Wt[0].width,Wt[0].height);for(let fe=0,ve=Wt.length;fe<ve;fe++)qe=Wt[fe],It?q&&t.texSubImage2D(s.TEXTURE_2D,fe,0,0,qe.width,qe.height,Qe,gt,qe.data):t.texImage2D(s.TEXTURE_2D,fe,yt,qe.width,qe.height,0,Qe,gt,qe.data);w.generateMipmaps=!1}else It?(on&&t.texStorage2D(s.TEXTURE_2D,ke,yt,Pe.width,Pe.height),q&&t.texSubImage2D(s.TEXTURE_2D,0,0,0,Pe.width,Pe.height,Qe,gt,Pe.data)):t.texImage2D(s.TEXTURE_2D,0,yt,Pe.width,Pe.height,0,Qe,gt,Pe.data);else if(w.isCompressedTexture)if(w.isCompressedArrayTexture){It&&on&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ke,yt,Wt[0].width,Wt[0].height,Pe.depth);for(let fe=0,ve=Wt.length;fe<ve;fe++)if(qe=Wt[fe],w.format!==Qn)if(Qe!==null)if(It){if(q)if(w.layerUpdates.size>0){let Ve=Tf(qe.width,qe.height,w.format,w.type);for(let Oe of w.layerUpdates){let Tt=qe.data.subarray(Oe*Ve/qe.data.BYTES_PER_ELEMENT,(Oe+1)*Ve/qe.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,fe,0,0,Oe,qe.width,qe.height,1,Qe,Tt)}w.clearLayerUpdates()}else t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,fe,0,0,0,qe.width,qe.height,Pe.depth,Qe,qe.data)}else t.compressedTexImage3D(s.TEXTURE_2D_ARRAY,fe,yt,qe.width,qe.height,Pe.depth,0,qe.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else It?q&&t.texSubImage3D(s.TEXTURE_2D_ARRAY,fe,0,0,0,qe.width,qe.height,Pe.depth,Qe,gt,qe.data):t.texImage3D(s.TEXTURE_2D_ARRAY,fe,yt,qe.width,qe.height,Pe.depth,0,Qe,gt,qe.data)}else{It&&on&&t.texStorage2D(s.TEXTURE_2D,ke,yt,Wt[0].width,Wt[0].height);for(let fe=0,ve=Wt.length;fe<ve;fe++)qe=Wt[fe],w.format!==Qn?Qe!==null?It?q&&t.compressedTexSubImage2D(s.TEXTURE_2D,fe,0,0,qe.width,qe.height,Qe,qe.data):t.compressedTexImage2D(s.TEXTURE_2D,fe,yt,qe.width,qe.height,0,qe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):It?q&&t.texSubImage2D(s.TEXTURE_2D,fe,0,0,qe.width,qe.height,Qe,gt,qe.data):t.texImage2D(s.TEXTURE_2D,fe,yt,qe.width,qe.height,0,Qe,gt,qe.data)}else if(w.isDataArrayTexture)if(It){if(on&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ke,yt,Pe.width,Pe.height,Pe.depth),q)if(w.layerUpdates.size>0){let fe=Tf(Pe.width,Pe.height,w.format,w.type);for(let ve of w.layerUpdates){let Ve=Pe.data.subarray(ve*fe/Pe.data.BYTES_PER_ELEMENT,(ve+1)*fe/Pe.data.BYTES_PER_ELEMENT);t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,ve,Pe.width,Pe.height,1,Qe,gt,Ve)}w.clearLayerUpdates()}else t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,Pe.width,Pe.height,Pe.depth,Qe,gt,Pe.data)}else t.texImage3D(s.TEXTURE_2D_ARRAY,0,yt,Pe.width,Pe.height,Pe.depth,0,Qe,gt,Pe.data);else if(w.isData3DTexture)It?(on&&t.texStorage3D(s.TEXTURE_3D,ke,yt,Pe.width,Pe.height,Pe.depth),q&&t.texSubImage3D(s.TEXTURE_3D,0,0,0,0,Pe.width,Pe.height,Pe.depth,Qe,gt,Pe.data)):t.texImage3D(s.TEXTURE_3D,0,yt,Pe.width,Pe.height,Pe.depth,0,Qe,gt,Pe.data);else if(w.isFramebufferTexture){if(on)if(It)t.texStorage2D(s.TEXTURE_2D,ke,yt,Pe.width,Pe.height);else{let fe=Pe.width,ve=Pe.height;for(let Ve=0;Ve<ke;Ve++)t.texImage2D(s.TEXTURE_2D,Ve,yt,fe,ve,0,Qe,gt,null),fe>>=1,ve>>=1}}else if(Wt.length>0){if(It&&on){let fe=Ze(Wt[0]);t.texStorage2D(s.TEXTURE_2D,ke,yt,fe.width,fe.height)}for(let fe=0,ve=Wt.length;fe<ve;fe++)qe=Wt[fe],It?q&&t.texSubImage2D(s.TEXTURE_2D,fe,0,0,Qe,gt,qe):t.texImage2D(s.TEXTURE_2D,fe,yt,Qe,gt,qe);w.generateMipmaps=!1}else if(It){if(on){let fe=Ze(Pe);t.texStorage2D(s.TEXTURE_2D,ke,yt,fe.width,fe.height)}q&&t.texSubImage2D(s.TEXTURE_2D,0,0,0,Qe,gt,Pe)}else t.texImage2D(s.TEXTURE_2D,0,yt,Qe,gt,Pe);g(w)&&m(ge),Je.__version=xe.version,w.onUpdate&&w.onUpdate(w)}D.__version=w.version}function Le(D,w,Q){if(w.image.length!==6)return;let ge=Gt(D,w),we=w.source;t.bindTexture(s.TEXTURE_CUBE_MAP,D.__webglTexture,s.TEXTURE0+Q);let xe=n.get(we);if(we.version!==xe.__version||ge===!0){t.activeTexture(s.TEXTURE0+Q);let Je=zt.getPrimaries(zt.workingColorSpace),ze=w.colorSpace===gs?null:zt.getPrimaries(w.colorSpace),$e=w.colorSpace===gs||Je===ze?s.NONE:s.BROWSER_DEFAULT_WEBGL;s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,w.flipY),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,w.premultiplyAlpha),s.pixelStorei(s.UNPACK_ALIGNMENT,w.unpackAlignment),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,$e);let Bt=w.isCompressedTexture||w.image[0].isCompressedTexture,Pe=w.image[0]&&w.image[0].isDataTexture,Qe=[];for(let ve=0;ve<6;ve++)!Bt&&!Pe?Qe[ve]=x(w.image[ve],!0,i.maxCubemapSize):Qe[ve]=Pe?w.image[ve].image:w.image[ve],Qe[ve]=mt(w,Qe[ve]);let gt=Qe[0],yt=r.convert(w.format,w.colorSpace),qe=r.convert(w.type),Wt=_(w.internalFormat,yt,qe,w.colorSpace),It=w.isVideoTexture!==!0,on=xe.__version===void 0||ge===!0,q=we.dataReady,ke=F(w,gt);dt(s.TEXTURE_CUBE_MAP,w);let fe;if(Bt){It&&on&&t.texStorage2D(s.TEXTURE_CUBE_MAP,ke,Wt,gt.width,gt.height);for(let ve=0;ve<6;ve++){fe=Qe[ve].mipmaps;for(let Ve=0;Ve<fe.length;Ve++){let Oe=fe[Ve];w.format!==Qn?yt!==null?It?q&&t.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,Ve,0,0,Oe.width,Oe.height,yt,Oe.data):t.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,Ve,Wt,Oe.width,Oe.height,0,Oe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):It?q&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,Ve,0,0,Oe.width,Oe.height,yt,qe,Oe.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,Ve,Wt,Oe.width,Oe.height,0,yt,qe,Oe.data)}}}else{if(fe=w.mipmaps,It&&on){fe.length>0&&ke++;let ve=Ze(Qe[0]);t.texStorage2D(s.TEXTURE_CUBE_MAP,ke,Wt,ve.width,ve.height)}for(let ve=0;ve<6;ve++)if(Pe){It?q&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,0,0,0,Qe[ve].width,Qe[ve].height,yt,qe,Qe[ve].data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,0,Wt,Qe[ve].width,Qe[ve].height,0,yt,qe,Qe[ve].data);for(let Ve=0;Ve<fe.length;Ve++){let Tt=fe[Ve].image[ve].image;It?q&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,Ve+1,0,0,Tt.width,Tt.height,yt,qe,Tt.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,Ve+1,Wt,Tt.width,Tt.height,0,yt,qe,Tt.data)}}else{It?q&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,0,0,0,yt,qe,Qe[ve]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,0,Wt,yt,qe,Qe[ve]);for(let Ve=0;Ve<fe.length;Ve++){let Oe=fe[Ve];It?q&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,Ve+1,0,0,yt,qe,Oe.image[ve]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ve,Ve+1,Wt,yt,qe,Oe.image[ve])}}}g(w)&&m(s.TEXTURE_CUBE_MAP),xe.__version=we.version,w.onUpdate&&w.onUpdate(w)}D.__version=w.version}function nt(D,w,Q,ge,we,xe){let Je=r.convert(Q.format,Q.colorSpace),ze=r.convert(Q.type),$e=_(Q.internalFormat,Je,ze,Q.colorSpace),Bt=n.get(w),Pe=n.get(Q);if(Pe.__renderTarget=w,!Bt.__hasExternalTextures){let Qe=Math.max(1,w.width>>xe),gt=Math.max(1,w.height>>xe);we===s.TEXTURE_3D||we===s.TEXTURE_2D_ARRAY?t.texImage3D(we,xe,$e,Qe,gt,w.depth,0,Je,ze,null):t.texImage2D(we,xe,$e,Qe,gt,0,Je,ze,null)}t.bindFramebuffer(s.FRAMEBUFFER,D),Ke(w)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,ge,we,Pe.__webglTexture,0,Ee(w)):(we===s.TEXTURE_2D||we>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&we<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,ge,we,Pe.__webglTexture,xe),t.bindFramebuffer(s.FRAMEBUFFER,null)}function Ne(D,w,Q){if(s.bindRenderbuffer(s.RENDERBUFFER,D),w.depthBuffer){let ge=w.depthTexture,we=ge&&ge.isDepthTexture?ge.type:null,xe=v(w.stencilBuffer,we),Je=w.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ze=Ee(w);Ke(w)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,ze,xe,w.width,w.height):Q?s.renderbufferStorageMultisample(s.RENDERBUFFER,ze,xe,w.width,w.height):s.renderbufferStorage(s.RENDERBUFFER,xe,w.width,w.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,Je,s.RENDERBUFFER,D)}else{let ge=w.textures;for(let we=0;we<ge.length;we++){let xe=ge[we],Je=r.convert(xe.format,xe.colorSpace),ze=r.convert(xe.type),$e=_(xe.internalFormat,Je,ze,xe.colorSpace),Bt=Ee(w);Q&&Ke(w)===!1?s.renderbufferStorageMultisample(s.RENDERBUFFER,Bt,$e,w.width,w.height):Ke(w)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Bt,$e,w.width,w.height):s.renderbufferStorage(s.RENDERBUFFER,$e,w.width,w.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function ft(D,w){if(w&&w.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(s.FRAMEBUFFER,D),!(w.depthTexture&&w.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let ge=n.get(w.depthTexture);ge.__renderTarget=w,(!ge.__webglTexture||w.depthTexture.image.width!==w.width||w.depthTexture.image.height!==w.height)&&(w.depthTexture.image.width=w.width,w.depthTexture.image.height=w.height,w.depthTexture.needsUpdate=!0),pe(w.depthTexture,0);let we=ge.__webglTexture,xe=Ee(w);if(w.depthTexture.format===Ar)Ke(w)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,we,0,xe):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_ATTACHMENT,s.TEXTURE_2D,we,0);else if(w.depthTexture.format===Lr)Ke(w)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,we,0,xe):s.framebufferTexture2D(s.FRAMEBUFFER,s.DEPTH_STENCIL_ATTACHMENT,s.TEXTURE_2D,we,0);else throw new Error("Unknown depthTexture format")}function pt(D){let w=n.get(D),Q=D.isWebGLCubeRenderTarget===!0;if(w.__boundDepthTexture!==D.depthTexture){let ge=D.depthTexture;if(w.__depthDisposeCallback&&w.__depthDisposeCallback(),ge){let we=()=>{delete w.__boundDepthTexture,delete w.__depthDisposeCallback,ge.removeEventListener("dispose",we)};ge.addEventListener("dispose",we),w.__depthDisposeCallback=we}w.__boundDepthTexture=ge}if(D.depthTexture&&!w.__autoAllocateDepthBuffer){if(Q)throw new Error("target.depthTexture not supported in Cube render targets");ft(w.__webglFramebuffer,D)}else if(Q){w.__webglDepthbuffer=[];for(let ge=0;ge<6;ge++)if(t.bindFramebuffer(s.FRAMEBUFFER,w.__webglFramebuffer[ge]),w.__webglDepthbuffer[ge]===void 0)w.__webglDepthbuffer[ge]=s.createRenderbuffer(),Ne(w.__webglDepthbuffer[ge],D,!1);else{let we=D.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,xe=w.__webglDepthbuffer[ge];s.bindRenderbuffer(s.RENDERBUFFER,xe),s.framebufferRenderbuffer(s.FRAMEBUFFER,we,s.RENDERBUFFER,xe)}}else if(t.bindFramebuffer(s.FRAMEBUFFER,w.__webglFramebuffer),w.__webglDepthbuffer===void 0)w.__webglDepthbuffer=s.createRenderbuffer(),Ne(w.__webglDepthbuffer,D,!1);else{let ge=D.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,we=w.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,we),s.framebufferRenderbuffer(s.FRAMEBUFFER,ge,s.RENDERBUFFER,we)}t.bindFramebuffer(s.FRAMEBUFFER,null)}function _t(D,w,Q){let ge=n.get(D);w!==void 0&&nt(ge.__webglFramebuffer,D,D.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),Q!==void 0&&pt(D)}function Nt(D){let w=D.texture,Q=n.get(D),ge=n.get(w);D.addEventListener("dispose",U);let we=D.textures,xe=D.isWebGLCubeRenderTarget===!0,Je=we.length>1;if(Je||(ge.__webglTexture===void 0&&(ge.__webglTexture=s.createTexture()),ge.__version=w.version,o.memory.textures++),xe){Q.__webglFramebuffer=[];for(let ze=0;ze<6;ze++)if(w.mipmaps&&w.mipmaps.length>0){Q.__webglFramebuffer[ze]=[];for(let $e=0;$e<w.mipmaps.length;$e++)Q.__webglFramebuffer[ze][$e]=s.createFramebuffer()}else Q.__webglFramebuffer[ze]=s.createFramebuffer()}else{if(w.mipmaps&&w.mipmaps.length>0){Q.__webglFramebuffer=[];for(let ze=0;ze<w.mipmaps.length;ze++)Q.__webglFramebuffer[ze]=s.createFramebuffer()}else Q.__webglFramebuffer=s.createFramebuffer();if(Je)for(let ze=0,$e=we.length;ze<$e;ze++){let Bt=n.get(we[ze]);Bt.__webglTexture===void 0&&(Bt.__webglTexture=s.createTexture(),o.memory.textures++)}if(D.samples>0&&Ke(D)===!1){Q.__webglMultisampledFramebuffer=s.createFramebuffer(),Q.__webglColorRenderbuffer=[],t.bindFramebuffer(s.FRAMEBUFFER,Q.__webglMultisampledFramebuffer);for(let ze=0;ze<we.length;ze++){let $e=we[ze];Q.__webglColorRenderbuffer[ze]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,Q.__webglColorRenderbuffer[ze]);let Bt=r.convert($e.format,$e.colorSpace),Pe=r.convert($e.type),Qe=_($e.internalFormat,Bt,Pe,$e.colorSpace,D.isXRRenderTarget===!0),gt=Ee(D);s.renderbufferStorageMultisample(s.RENDERBUFFER,gt,Qe,D.width,D.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+ze,s.RENDERBUFFER,Q.__webglColorRenderbuffer[ze])}s.bindRenderbuffer(s.RENDERBUFFER,null),D.depthBuffer&&(Q.__webglDepthRenderbuffer=s.createRenderbuffer(),Ne(Q.__webglDepthRenderbuffer,D,!0)),t.bindFramebuffer(s.FRAMEBUFFER,null)}}if(xe){t.bindTexture(s.TEXTURE_CUBE_MAP,ge.__webglTexture),dt(s.TEXTURE_CUBE_MAP,w);for(let ze=0;ze<6;ze++)if(w.mipmaps&&w.mipmaps.length>0)for(let $e=0;$e<w.mipmaps.length;$e++)nt(Q.__webglFramebuffer[ze][$e],D,w,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ze,$e);else nt(Q.__webglFramebuffer[ze],D,w,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+ze,0);g(w)&&m(s.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(Je){for(let ze=0,$e=we.length;ze<$e;ze++){let Bt=we[ze],Pe=n.get(Bt);t.bindTexture(s.TEXTURE_2D,Pe.__webglTexture),dt(s.TEXTURE_2D,Bt),nt(Q.__webglFramebuffer,D,Bt,s.COLOR_ATTACHMENT0+ze,s.TEXTURE_2D,0),g(Bt)&&m(s.TEXTURE_2D)}t.unbindTexture()}else{let ze=s.TEXTURE_2D;if((D.isWebGL3DRenderTarget||D.isWebGLArrayRenderTarget)&&(ze=D.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture(ze,ge.__webglTexture),dt(ze,w),w.mipmaps&&w.mipmaps.length>0)for(let $e=0;$e<w.mipmaps.length;$e++)nt(Q.__webglFramebuffer[$e],D,w,s.COLOR_ATTACHMENT0,ze,$e);else nt(Q.__webglFramebuffer,D,w,s.COLOR_ATTACHMENT0,ze,0);g(w)&&m(ze),t.unbindTexture()}D.depthBuffer&&pt(D)}function ye(D){let w=D.textures;for(let Q=0,ge=w.length;Q<ge;Q++){let we=w[Q];if(g(we)){let xe=y(D),Je=n.get(we).__webglTexture;t.bindTexture(xe,Je),m(xe),t.unbindTexture()}}}let Ce=[],B=[];function at(D){if(D.samples>0){if(Ke(D)===!1){let w=D.textures,Q=D.width,ge=D.height,we=s.COLOR_BUFFER_BIT,xe=D.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,Je=n.get(D),ze=w.length>1;if(ze)for(let $e=0;$e<w.length;$e++)t.bindFramebuffer(s.FRAMEBUFFER,Je.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+$e,s.RENDERBUFFER,null),t.bindFramebuffer(s.FRAMEBUFFER,Je.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+$e,s.TEXTURE_2D,null,0);t.bindFramebuffer(s.READ_FRAMEBUFFER,Je.__webglMultisampledFramebuffer),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,Je.__webglFramebuffer);for(let $e=0;$e<w.length;$e++){if(D.resolveDepthBuffer&&(D.depthBuffer&&(we|=s.DEPTH_BUFFER_BIT),D.stencilBuffer&&D.resolveStencilBuffer&&(we|=s.STENCIL_BUFFER_BIT)),ze){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,Je.__webglColorRenderbuffer[$e]);let Bt=n.get(w[$e]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,Bt,0)}s.blitFramebuffer(0,0,Q,ge,0,0,Q,ge,we,s.NEAREST),l===!0&&(Ce.length=0,B.length=0,Ce.push(s.COLOR_ATTACHMENT0+$e),D.depthBuffer&&D.resolveDepthBuffer===!1&&(Ce.push(xe),B.push(xe),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,B)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,Ce))}if(t.bindFramebuffer(s.READ_FRAMEBUFFER,null),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),ze)for(let $e=0;$e<w.length;$e++){t.bindFramebuffer(s.FRAMEBUFFER,Je.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+$e,s.RENDERBUFFER,Je.__webglColorRenderbuffer[$e]);let Bt=n.get(w[$e]).__webglTexture;t.bindFramebuffer(s.FRAMEBUFFER,Je.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+$e,s.TEXTURE_2D,Bt,0)}t.bindFramebuffer(s.DRAW_FRAMEBUFFER,Je.__webglMultisampledFramebuffer)}else if(D.depthBuffer&&D.resolveDepthBuffer===!1&&l){let w=D.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[w])}}}function Ee(D){return Math.min(i.maxSamples,D.samples)}function Ke(D){let w=n.get(D);return D.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&w.__useRenderToTexture!==!1}function Ie(D){let w=o.render.frame;h.get(D)!==w&&(h.set(D,w),D.update())}function mt(D,w){let Q=D.colorSpace,ge=D.format,we=D.type;return D.isCompressedTexture===!0||D.isVideoTexture===!0||Q!==Gn&&Q!==gs&&(zt.getTransfer(Q)===rn?(ge!==Qn||we!==ji)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",Q)),w}function Ze(D){return typeof HTMLImageElement<"u"&&D instanceof HTMLImageElement?(c.width=D.naturalWidth||D.width,c.height=D.naturalHeight||D.height):typeof VideoFrame<"u"&&D instanceof VideoFrame?(c.width=D.displayWidth,c.height=D.displayHeight):(c.width=D.width,c.height=D.height),c}this.allocateTextureUnit=$,this.resetTextureUnits=J,this.setTexture2D=pe,this.setTexture2DArray=ie,this.setTexture3D=be,this.setTextureCube=se,this.rebindTextures=_t,this.setupRenderTarget=Nt,this.updateRenderTargetMipmap=ye,this.updateMultisampleRenderTarget=at,this.setupDepthRenderbuffer=pt,this.setupFrameBufferTexture=nt,this.useMultisampledRTT=Ke}function Rg(s,e){function t(n,i=gs){let r,o=zt.getTransfer(i);if(n===ji)return s.UNSIGNED_BYTE;if(n===Zh)return s.UNSIGNED_SHORT_4_4_4_4;if(n===$h)return s.UNSIGNED_SHORT_5_5_5_1;if(n===Pd)return s.UNSIGNED_INT_5_9_9_9_REV;if(n===Rd)return s.BYTE;if(n===Cd)return s.SHORT;if(n===So)return s.UNSIGNED_SHORT;if(n===Yh)return s.INT;if(n===Es)return s.UNSIGNED_INT;if(n===hi)return s.FLOAT;if(n===Bo)return s.HALF_FLOAT;if(n===Id)return s.ALPHA;if(n===Ld)return s.RGB;if(n===Qn)return s.RGBA;if(n===Dd)return s.LUMINANCE;if(n===Ud)return s.LUMINANCE_ALPHA;if(n===Ar)return s.DEPTH_COMPONENT;if(n===Lr)return s.DEPTH_STENCIL;if(n===Kh)return s.RED;if(n===ol)return s.RED_INTEGER;if(n===Nd)return s.RG;if(n===Jh)return s.RG_INTEGER;if(n===jh)return s.RGBA_INTEGER;if(n===da||n===pa||n===ma||n===ga)if(o===rn)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===da)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===pa)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===ma)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===ga)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===da)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===pa)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===ma)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===ga)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===bc||n===Sc||n===wc||n===Ec)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===bc)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Sc)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===wc)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Ec)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Ac||n===Tc||n===Rc)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Ac||n===Tc)return o===rn?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Rc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Cc||n===Pc||n===Ic||n===Lc||n===Dc||n===Uc||n===Nc||n===Fc||n===Oc||n===Bc||n===zc||n===kc||n===Hc||n===Vc)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Cc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Pc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Ic)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Lc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Dc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Uc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Nc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Fc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Oc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Bc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===zc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===kc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Hc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Vc)return o===rn?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===xa||n===Gc||n===Wc)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===xa)return o===rn?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Gc)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Wc)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Fd||n===Xc||n===qc||n===Yc)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===xa)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Xc)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===qc)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Yc)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ir?s.UNSIGNED_INT_24_8:s[n]!==void 0?s[n]:null}return{convert:t}}var jc=class extends Mn{constructor(e=[]){super(),this.isArrayCamera=!0,this.cameras=e}},bn=class extends Kt{constructor(){super(),this.isGroup=!0,this.type="Group"}},ib={type:"move"},_a=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new bn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new bn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new L,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new L),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new bn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new L,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new L),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(let x of e.hand.values()){let g=t.getJointPose(x,n),m=this._getHandJoint(c,x);g!==null&&(m.matrix.fromArray(g.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,m.jointRadius=g.radius),m.visible=g!==null}let h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],f=h.position.distanceTo(u.position),d=.02,p=.005;c.inputState.pinching&&f>d+p?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&f<=d-p&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(a.matrix.fromArray(i.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,i.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(i.linearVelocity)):a.hasLinearVelocity=!1,i.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(i.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(ib)))}return a!==null&&(a.visible=i!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new bn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},sb=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,rb=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Rf=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t,n){if(this.texture===null){let i=new dn,r=e.properties.get(i);r.__webglTexture=t.texture,(t.depthNear!=n.depthNear||t.depthFar!=n.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Ot({vertexShader:sb,fragmentShader:rb,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Ft(new As(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Cf=class extends Pi{constructor(e,t){super();let n=this,i=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,u=null,f=null,d=null,p=null,x=new Rf,g=t.getContextAttributes(),m=null,y=null,_=[],v=[],F=new _e,T=null,U=new Mn;U.viewport=new kt;let C=new Mn;C.viewport=new kt;let S=[U,C],M=new jc,N=null,J=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(me){let Le=_[me];return Le===void 0&&(Le=new _a,_[me]=Le),Le.getTargetRaySpace()},this.getControllerGrip=function(me){let Le=_[me];return Le===void 0&&(Le=new _a,_[me]=Le),Le.getGripSpace()},this.getHand=function(me){let Le=_[me];return Le===void 0&&(Le=new _a,_[me]=Le),Le.getHandSpace()};function $(me){let Le=v.indexOf(me.inputSource);if(Le===-1)return;let nt=_[Le];nt!==void 0&&(nt.update(me.inputSource,me.frame,c||o),nt.dispatchEvent({type:me.type,data:me.inputSource}))}function ee(){i.removeEventListener("select",$),i.removeEventListener("selectstart",$),i.removeEventListener("selectend",$),i.removeEventListener("squeeze",$),i.removeEventListener("squeezestart",$),i.removeEventListener("squeezeend",$),i.removeEventListener("end",ee),i.removeEventListener("inputsourceschange",pe);for(let me=0;me<_.length;me++){let Le=v[me];Le!==null&&(v[me]=null,_[me].disconnect(Le))}N=null,J=null,x.reset(),e.setRenderTarget(m),d=null,f=null,u=null,i=null,y=null,Gt.stop(),n.isPresenting=!1,e.setPixelRatio(T),e.setSize(F.width,F.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(me){r=me,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(me){a=me,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(me){c=me},this.getBaseLayer=function(){return f!==null?f:d},this.getBinding=function(){return u},this.getFrame=function(){return p},this.getSession=function(){return i},this.setSession=async function(me){if(i=me,i!==null){if(m=e.getRenderTarget(),i.addEventListener("select",$),i.addEventListener("selectstart",$),i.addEventListener("selectend",$),i.addEventListener("squeeze",$),i.addEventListener("squeezestart",$),i.addEventListener("squeezeend",$),i.addEventListener("end",ee),i.addEventListener("inputsourceschange",pe),g.xrCompatible!==!0&&await t.makeXRCompatible(),T=e.getPixelRatio(),e.getSize(F),i.renderState.layers===void 0){let Le={antialias:g.antialias,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:r};d=new XRWebGLLayer(i,t,Le),i.updateRenderState({baseLayer:d}),e.setPixelRatio(1),e.setSize(d.framebufferWidth,d.framebufferHeight,!1),y=new ti(d.framebufferWidth,d.framebufferHeight,{format:Qn,type:ji,colorSpace:e.outputColorSpace,stencilBuffer:g.stencil})}else{let Le=null,nt=null,Ne=null;g.depth&&(Ne=g.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,Le=g.stencil?Lr:Ar,nt=g.stencil?Ir:Es);let ft={colorFormat:t.RGBA8,depthFormat:Ne,scaleFactor:r};u=new XRWebGLBinding(i,t),f=u.createProjectionLayer(ft),i.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),y=new ti(f.textureWidth,f.textureHeight,{format:Qn,type:ji,depthTexture:new Da(f.textureWidth,f.textureHeight,nt,void 0,void 0,void 0,void 0,void 0,void 0,Le),stencilBuffer:g.stencil,colorSpace:e.outputColorSpace,samples:g.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await i.requestReferenceSpace(a),Gt.setContext(i),Gt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return x.getDepthTexture()};function pe(me){for(let Le=0;Le<me.removed.length;Le++){let nt=me.removed[Le],Ne=v.indexOf(nt);Ne>=0&&(v[Ne]=null,_[Ne].disconnect(nt))}for(let Le=0;Le<me.added.length;Le++){let nt=me.added[Le],Ne=v.indexOf(nt);if(Ne===-1){for(let pt=0;pt<_.length;pt++)if(pt>=v.length){v.push(nt),Ne=pt;break}else if(v[pt]===null){v[pt]=nt,Ne=pt;break}if(Ne===-1)break}let ft=_[Ne];ft&&ft.connect(nt)}}let ie=new L,be=new L;function se(me,Le,nt){ie.setFromMatrixPosition(Le.matrixWorld),be.setFromMatrixPosition(nt.matrixWorld);let Ne=ie.distanceTo(be),ft=Le.projectionMatrix.elements,pt=nt.projectionMatrix.elements,_t=ft[14]/(ft[10]-1),Nt=ft[14]/(ft[10]+1),ye=(ft[9]+1)/ft[5],Ce=(ft[9]-1)/ft[5],B=(ft[8]-1)/ft[0],at=(pt[8]+1)/pt[0],Ee=_t*B,Ke=_t*at,Ie=Ne/(-B+at),mt=Ie*-B;if(Le.matrixWorld.decompose(me.position,me.quaternion,me.scale),me.translateX(mt),me.translateZ(Ie),me.matrixWorld.compose(me.position,me.quaternion,me.scale),me.matrixWorldInverse.copy(me.matrixWorld).invert(),ft[10]===-1)me.projectionMatrix.copy(Le.projectionMatrix),me.projectionMatrixInverse.copy(Le.projectionMatrixInverse);else{let Ze=_t+Ie,D=Nt+Ie,w=Ee-mt,Q=Ke+(Ne-mt),ge=ye*Nt/D*Ze,we=Ce*Nt/D*Ze;me.projectionMatrix.makePerspective(w,Q,ge,we,Ze,D),me.projectionMatrixInverse.copy(me.projectionMatrix).invert()}}function Te(me,Le){Le===null?me.matrixWorld.copy(me.matrix):me.matrixWorld.multiplyMatrices(Le.matrixWorld,me.matrix),me.matrixWorldInverse.copy(me.matrixWorld).invert()}this.updateCamera=function(me){if(i===null)return;let Le=me.near,nt=me.far;x.texture!==null&&(x.depthNear>0&&(Le=x.depthNear),x.depthFar>0&&(nt=x.depthFar)),M.near=C.near=U.near=Le,M.far=C.far=U.far=nt,(N!==M.near||J!==M.far)&&(i.updateRenderState({depthNear:M.near,depthFar:M.far}),N=M.near,J=M.far),U.layers.mask=me.layers.mask|2,C.layers.mask=me.layers.mask|4,M.layers.mask=U.layers.mask|C.layers.mask;let Ne=me.parent,ft=M.cameras;Te(M,Ne);for(let pt=0;pt<ft.length;pt++)Te(ft[pt],Ne);ft.length===2?se(M,U,C):M.projectionMatrix.copy(U.projectionMatrix),Ue(me,M,Ne)};function Ue(me,Le,nt){nt===null?me.matrix.copy(Le.matrixWorld):(me.matrix.copy(nt.matrixWorld),me.matrix.invert(),me.matrix.multiply(Le.matrixWorld)),me.matrix.decompose(me.position,me.quaternion,me.scale),me.updateMatrixWorld(!0),me.projectionMatrix.copy(Le.projectionMatrix),me.projectionMatrixInverse.copy(Le.projectionMatrixInverse),me.isPerspectiveCamera&&(me.fov=wo*2*Math.atan(1/me.projectionMatrix.elements[5]),me.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(!(f===null&&d===null))return l},this.setFoveation=function(me){l=me,f!==null&&(f.fixedFoveation=me),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=me)},this.hasDepthSensing=function(){return x.texture!==null},this.getDepthSensingMesh=function(){return x.getMesh(M)};let Fe=null;function dt(me,Le){if(h=Le.getViewerPose(c||o),p=Le,h!==null){let nt=h.views;d!==null&&(e.setRenderTargetFramebuffer(y,d.framebuffer),e.setRenderTarget(y));let Ne=!1;nt.length!==M.cameras.length&&(M.cameras.length=0,Ne=!0);for(let pt=0;pt<nt.length;pt++){let _t=nt[pt],Nt=null;if(d!==null)Nt=d.getViewport(_t);else{let Ce=u.getViewSubImage(f,_t);Nt=Ce.viewport,pt===0&&(e.setRenderTargetTextures(y,Ce.colorTexture,f.ignoreDepthValues?void 0:Ce.depthStencilTexture),e.setRenderTarget(y))}let ye=S[pt];ye===void 0&&(ye=new Mn,ye.layers.enable(pt),ye.viewport=new kt,S[pt]=ye),ye.matrix.fromArray(_t.transform.matrix),ye.matrix.decompose(ye.position,ye.quaternion,ye.scale),ye.projectionMatrix.fromArray(_t.projectionMatrix),ye.projectionMatrixInverse.copy(ye.projectionMatrix).invert(),ye.viewport.set(Nt.x,Nt.y,Nt.width,Nt.height),pt===0&&(M.matrix.copy(ye.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),Ne===!0&&M.cameras.push(ye)}let ft=i.enabledFeatures;if(ft&&ft.includes("depth-sensing")){let pt=u.getDepthInformation(nt[0]);pt&&pt.isValid&&pt.texture&&x.init(e,pt,i.renderState)}}for(let nt=0;nt<_.length;nt++){let Ne=v[nt],ft=_[nt];Ne!==null&&ft!==void 0&&ft.update(Ne,Le,c||o)}Fe&&Fe(me,Le),Le.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Le}),p=null}let Gt=new Sg;Gt.setAnimationLoop(dt),this.setAnimationLoop=function(me){Fe=me},this.dispose=function(){}}},hr=new bi,ob=new ct;function ab(s,e){function t(g,m){g.matrixAutoUpdate===!0&&g.updateMatrix(),m.value.copy(g.matrix)}function n(g,m){m.color.getRGB(g.fogColor.value,Mg(s)),m.isFog?(g.fogNear.value=m.near,g.fogFar.value=m.far):m.isFogExp2&&(g.fogDensity.value=m.density)}function i(g,m,y,_,v){m.isMeshBasicMaterial||m.isMeshLambertMaterial?r(g,m):m.isMeshToonMaterial?(r(g,m),u(g,m)):m.isMeshPhongMaterial?(r(g,m),h(g,m)):m.isMeshStandardMaterial?(r(g,m),f(g,m),m.isMeshPhysicalMaterial&&d(g,m,v)):m.isMeshMatcapMaterial?(r(g,m),p(g,m)):m.isMeshDepthMaterial?r(g,m):m.isMeshDistanceMaterial?(r(g,m),x(g,m)):m.isMeshNormalMaterial?r(g,m):m.isLineBasicMaterial?(o(g,m),m.isLineDashedMaterial&&a(g,m)):m.isPointsMaterial?l(g,m,y,_):m.isSpriteMaterial?c(g,m):m.isShadowMaterial?(g.color.value.copy(m.color),g.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function r(g,m){g.opacity.value=m.opacity,m.color&&g.diffuse.value.copy(m.color),m.emissive&&g.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(g.map.value=m.map,t(m.map,g.mapTransform)),m.alphaMap&&(g.alphaMap.value=m.alphaMap,t(m.alphaMap,g.alphaMapTransform)),m.bumpMap&&(g.bumpMap.value=m.bumpMap,t(m.bumpMap,g.bumpMapTransform),g.bumpScale.value=m.bumpScale,m.side===ei&&(g.bumpScale.value*=-1)),m.normalMap&&(g.normalMap.value=m.normalMap,t(m.normalMap,g.normalMapTransform),g.normalScale.value.copy(m.normalScale),m.side===ei&&g.normalScale.value.negate()),m.displacementMap&&(g.displacementMap.value=m.displacementMap,t(m.displacementMap,g.displacementMapTransform),g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias),m.emissiveMap&&(g.emissiveMap.value=m.emissiveMap,t(m.emissiveMap,g.emissiveMapTransform)),m.specularMap&&(g.specularMap.value=m.specularMap,t(m.specularMap,g.specularMapTransform)),m.alphaTest>0&&(g.alphaTest.value=m.alphaTest);let y=e.get(m),_=y.envMap,v=y.envMapRotation;_&&(g.envMap.value=_,hr.copy(v),hr.x*=-1,hr.y*=-1,hr.z*=-1,_.isCubeTexture&&_.isRenderTargetTexture===!1&&(hr.y*=-1,hr.z*=-1),g.envMapRotation.value.setFromMatrix4(ob.makeRotationFromEuler(hr)),g.flipEnvMap.value=_.isCubeTexture&&_.isRenderTargetTexture===!1?-1:1,g.reflectivity.value=m.reflectivity,g.ior.value=m.ior,g.refractionRatio.value=m.refractionRatio),m.lightMap&&(g.lightMap.value=m.lightMap,g.lightMapIntensity.value=m.lightMapIntensity,t(m.lightMap,g.lightMapTransform)),m.aoMap&&(g.aoMap.value=m.aoMap,g.aoMapIntensity.value=m.aoMapIntensity,t(m.aoMap,g.aoMapTransform))}function o(g,m){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity,m.map&&(g.map.value=m.map,t(m.map,g.mapTransform))}function a(g,m){g.dashSize.value=m.dashSize,g.totalSize.value=m.dashSize+m.gapSize,g.scale.value=m.scale}function l(g,m,y,_){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity,g.size.value=m.size*y,g.scale.value=_*.5,m.map&&(g.map.value=m.map,t(m.map,g.uvTransform)),m.alphaMap&&(g.alphaMap.value=m.alphaMap,t(m.alphaMap,g.alphaMapTransform)),m.alphaTest>0&&(g.alphaTest.value=m.alphaTest)}function c(g,m){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity,g.rotation.value=m.rotation,m.map&&(g.map.value=m.map,t(m.map,g.mapTransform)),m.alphaMap&&(g.alphaMap.value=m.alphaMap,t(m.alphaMap,g.alphaMapTransform)),m.alphaTest>0&&(g.alphaTest.value=m.alphaTest)}function h(g,m){g.specular.value.copy(m.specular),g.shininess.value=Math.max(m.shininess,1e-4)}function u(g,m){m.gradientMap&&(g.gradientMap.value=m.gradientMap)}function f(g,m){g.metalness.value=m.metalness,m.metalnessMap&&(g.metalnessMap.value=m.metalnessMap,t(m.metalnessMap,g.metalnessMapTransform)),g.roughness.value=m.roughness,m.roughnessMap&&(g.roughnessMap.value=m.roughnessMap,t(m.roughnessMap,g.roughnessMapTransform)),m.envMap&&(g.envMapIntensity.value=m.envMapIntensity)}function d(g,m,y){g.ior.value=m.ior,m.sheen>0&&(g.sheenColor.value.copy(m.sheenColor).multiplyScalar(m.sheen),g.sheenRoughness.value=m.sheenRoughness,m.sheenColorMap&&(g.sheenColorMap.value=m.sheenColorMap,t(m.sheenColorMap,g.sheenColorMapTransform)),m.sheenRoughnessMap&&(g.sheenRoughnessMap.value=m.sheenRoughnessMap,t(m.sheenRoughnessMap,g.sheenRoughnessMapTransform))),m.clearcoat>0&&(g.clearcoat.value=m.clearcoat,g.clearcoatRoughness.value=m.clearcoatRoughness,m.clearcoatMap&&(g.clearcoatMap.value=m.clearcoatMap,t(m.clearcoatMap,g.clearcoatMapTransform)),m.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap,t(m.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),m.clearcoatNormalMap&&(g.clearcoatNormalMap.value=m.clearcoatNormalMap,t(m.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),m.side===ei&&g.clearcoatNormalScale.value.negate())),m.dispersion>0&&(g.dispersion.value=m.dispersion),m.iridescence>0&&(g.iridescence.value=m.iridescence,g.iridescenceIOR.value=m.iridescenceIOR,g.iridescenceThicknessMinimum.value=m.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=m.iridescenceThicknessRange[1],m.iridescenceMap&&(g.iridescenceMap.value=m.iridescenceMap,t(m.iridescenceMap,g.iridescenceMapTransform)),m.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=m.iridescenceThicknessMap,t(m.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),m.transmission>0&&(g.transmission.value=m.transmission,g.transmissionSamplerMap.value=y.texture,g.transmissionSamplerSize.value.set(y.width,y.height),m.transmissionMap&&(g.transmissionMap.value=m.transmissionMap,t(m.transmissionMap,g.transmissionMapTransform)),g.thickness.value=m.thickness,m.thicknessMap&&(g.thicknessMap.value=m.thicknessMap,t(m.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=m.attenuationDistance,g.attenuationColor.value.copy(m.attenuationColor)),m.anisotropy>0&&(g.anisotropyVector.value.set(m.anisotropy*Math.cos(m.anisotropyRotation),m.anisotropy*Math.sin(m.anisotropyRotation)),m.anisotropyMap&&(g.anisotropyMap.value=m.anisotropyMap,t(m.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=m.specularIntensity,g.specularColor.value.copy(m.specularColor),m.specularColorMap&&(g.specularColorMap.value=m.specularColorMap,t(m.specularColorMap,g.specularColorMapTransform)),m.specularIntensityMap&&(g.specularIntensityMap.value=m.specularIntensityMap,t(m.specularIntensityMap,g.specularIntensityMapTransform))}function p(g,m){m.matcap&&(g.matcap.value=m.matcap)}function x(g,m){let y=e.get(m).light;g.referencePosition.value.setFromMatrixPosition(y.matrixWorld),g.nearDistance.value=y.shadow.camera.near,g.farDistance.value=y.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function lb(s,e,t,n){let i={},r={},o=[],a=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,_){let v=_.program;n.uniformBlockBinding(y,v)}function c(y,_){let v=i[y.id];v===void 0&&(p(y),v=h(y),i[y.id]=v,y.addEventListener("dispose",g));let F=_.program;n.updateUBOMapping(y,F);let T=e.render.frame;r[y.id]!==T&&(f(y),r[y.id]=T)}function h(y){let _=u();y.__bindingPointIndex=_;let v=s.createBuffer(),F=y.__size,T=y.usage;return s.bindBuffer(s.UNIFORM_BUFFER,v),s.bufferData(s.UNIFORM_BUFFER,F,T),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,_,v),v}function u(){for(let y=0;y<a;y++)if(o.indexOf(y)===-1)return o.push(y),y;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(y){let _=i[y.id],v=y.uniforms,F=y.__cache;s.bindBuffer(s.UNIFORM_BUFFER,_);for(let T=0,U=v.length;T<U;T++){let C=Array.isArray(v[T])?v[T]:[v[T]];for(let S=0,M=C.length;S<M;S++){let N=C[S];if(d(N,T,S,F)===!0){let J=N.__offset,$=Array.isArray(N.value)?N.value:[N.value],ee=0;for(let pe=0;pe<$.length;pe++){let ie=$[pe],be=x(ie);typeof ie=="number"||typeof ie=="boolean"?(N.__data[0]=ie,s.bufferSubData(s.UNIFORM_BUFFER,J+ee,N.__data)):ie.isMatrix3?(N.__data[0]=ie.elements[0],N.__data[1]=ie.elements[1],N.__data[2]=ie.elements[2],N.__data[3]=0,N.__data[4]=ie.elements[3],N.__data[5]=ie.elements[4],N.__data[6]=ie.elements[5],N.__data[7]=0,N.__data[8]=ie.elements[6],N.__data[9]=ie.elements[7],N.__data[10]=ie.elements[8],N.__data[11]=0):(ie.toArray(N.__data,ee),ee+=be.storage/Float32Array.BYTES_PER_ELEMENT)}s.bufferSubData(s.UNIFORM_BUFFER,J,N.__data)}}}s.bindBuffer(s.UNIFORM_BUFFER,null)}function d(y,_,v,F){let T=y.value,U=_+"_"+v;if(F[U]===void 0)return typeof T=="number"||typeof T=="boolean"?F[U]=T:F[U]=T.clone(),!0;{let C=F[U];if(typeof T=="number"||typeof T=="boolean"){if(C!==T)return F[U]=T,!0}else if(C.equals(T)===!1)return C.copy(T),!0}return!1}function p(y){let _=y.uniforms,v=0,F=16;for(let U=0,C=_.length;U<C;U++){let S=Array.isArray(_[U])?_[U]:[_[U]];for(let M=0,N=S.length;M<N;M++){let J=S[M],$=Array.isArray(J.value)?J.value:[J.value];for(let ee=0,pe=$.length;ee<pe;ee++){let ie=$[ee],be=x(ie),se=v%F,Te=se%be.boundary,Ue=se+Te;v+=Te,Ue!==0&&F-Ue<be.storage&&(v+=F-Ue),J.__data=new Float32Array(be.storage/Float32Array.BYTES_PER_ELEMENT),J.__offset=v,v+=be.storage}}}let T=v%F;return T>0&&(v+=F-T),y.__size=v,y.__cache={},this}function x(y){let _={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(_.boundary=4,_.storage=4):y.isVector2?(_.boundary=8,_.storage=8):y.isVector3||y.isColor?(_.boundary=16,_.storage=12):y.isVector4?(_.boundary=16,_.storage=16):y.isMatrix3?(_.boundary=48,_.storage=48):y.isMatrix4?(_.boundary=64,_.storage=64):y.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",y),_}function g(y){let _=y.target;_.removeEventListener("dispose",g);let v=o.indexOf(_.__bindingPointIndex);o.splice(v,1),s.deleteBuffer(i[_.id]),delete i[_.id],delete r[_.id]}function m(){for(let y in i)s.deleteBuffer(i[y]);o=[],i={},r={}}return{bind:l,update:c,dispose:m}}var Fa=class{constructor(e={}){let{canvas:t=_g(),context:n=null,depth:i=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:f=!1}=e;this.isWebGLRenderer=!0;let d;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");d=n.getContextAttributes().alpha}else d=o;let p=new Uint32Array(4),x=new Int32Array(4),g=null,m=null,y=[],_=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=An,this.toneMapping=ys,this.toneMappingExposure=1;let v=this,F=!1,T=0,U=0,C=null,S=-1,M=null,N=new kt,J=new kt,$=null,ee=new Be(0),pe=0,ie=t.width,be=t.height,se=1,Te=null,Ue=null,Fe=new kt(0,0,ie,be),dt=new kt(0,0,ie,be),Gt=!1,me=new Or,Le=!1,nt=!1,Ne=new ct,ft=new ct,pt=new L,_t=new kt,Nt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ye=!1;function Ce(){return C===null?se:1}let B=n;function at(E,G){return t.getContext(E,G)}try{let E={alpha:!0,depth:i,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${Xh}`),t.addEventListener("webglcontextlost",ve,!1),t.addEventListener("webglcontextrestored",Ve,!1),t.addEventListener("webglcontextcreationerror",Oe,!1),B===null){let G="webgl2";if(B=at(G,E),B===null)throw at(G)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(E){throw console.error("THREE.WebGLRenderer: "+E.message),E}let Ee,Ke,Ie,mt,Ze,D,w,Q,ge,we,xe,Je,ze,$e,Bt,Pe,Qe,gt,yt,qe,Wt,It,on,q;function ke(){Ee=new MM(B),Ee.init(),It=new Rg(B,Ee),Ke=new mM(B,Ee,e,It),Ie=new K1(B,Ee),Ke.reverseDepthBuffer&&f&&Ie.buffers.depth.setReversed(!0),mt=new wM(B),Ze=new O1,D=new nb(B,Ee,Ie,Ze,Ke,It,mt),w=new xM(v),Q=new yM(v),ge=new Iv(B),on=new dM(B,ge),we=new bM(B,ge,mt,on),xe=new AM(B,we,ge,mt),yt=new EM(B,Ke,D),Pe=new gM(Ze),Je=new F1(v,w,Q,Ee,Ke,on,Pe),ze=new ab(v,Ze),$e=new z1,Bt=new X1(Ee),gt=new fM(v,w,Q,Ie,xe,d,l),Qe=new Z1(v,xe,Ke),q=new lb(B,mt,Ke,Ie),qe=new pM(B,Ee,mt),Wt=new SM(B,Ee,mt),mt.programs=Je.programs,v.capabilities=Ke,v.extensions=Ee,v.properties=Ze,v.renderLists=$e,v.shadowMap=Qe,v.state=Ie,v.info=mt}ke();let fe=new Cf(v,B);this.xr=fe,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let E=Ee.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){let E=Ee.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return se},this.setPixelRatio=function(E){E!==void 0&&(se=E,this.setSize(ie,be,!1))},this.getSize=function(E){return E.set(ie,be)},this.setSize=function(E,G,re=!0){if(fe.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}ie=E,be=G,t.width=Math.floor(E*se),t.height=Math.floor(G*se),re===!0&&(t.style.width=E+"px",t.style.height=G+"px"),this.setViewport(0,0,E,G)},this.getDrawingBufferSize=function(E){return E.set(ie*se,be*se).floor()},this.setDrawingBufferSize=function(E,G,re){ie=E,be=G,se=re,t.width=Math.floor(E*re),t.height=Math.floor(G*re),this.setViewport(0,0,E,G)},this.getCurrentViewport=function(E){return E.copy(N)},this.getViewport=function(E){return E.copy(Fe)},this.setViewport=function(E,G,re,oe){E.isVector4?Fe.set(E.x,E.y,E.z,E.w):Fe.set(E,G,re,oe),Ie.viewport(N.copy(Fe).multiplyScalar(se).round())},this.getScissor=function(E){return E.copy(dt)},this.setScissor=function(E,G,re,oe){E.isVector4?dt.set(E.x,E.y,E.z,E.w):dt.set(E,G,re,oe),Ie.scissor(J.copy(dt).multiplyScalar(se).round())},this.getScissorTest=function(){return Gt},this.setScissorTest=function(E){Ie.setScissorTest(Gt=E)},this.setOpaqueSort=function(E){Te=E},this.setTransparentSort=function(E){Ue=E},this.getClearColor=function(E){return E.copy(gt.getClearColor())},this.setClearColor=function(){gt.setClearColor.apply(gt,arguments)},this.getClearAlpha=function(){return gt.getClearAlpha()},this.setClearAlpha=function(){gt.setClearAlpha.apply(gt,arguments)},this.clear=function(E=!0,G=!0,re=!0){let oe=0;if(E){let Z=!1;if(C!==null){let De=C.texture.format;Z=De===jh||De===Jh||De===ol}if(Z){let De=C.texture.type,We=De===ji||De===Es||De===So||De===Ir||De===Zh||De===$h,rt=gt.getClearColor(),ot=gt.getClearAlpha(),bt=rt.r,St=rt.g,je=rt.b;We?(p[0]=bt,p[1]=St,p[2]=je,p[3]=ot,B.clearBufferuiv(B.COLOR,0,p)):(x[0]=bt,x[1]=St,x[2]=je,x[3]=ot,B.clearBufferiv(B.COLOR,0,x))}else oe|=B.COLOR_BUFFER_BIT}G&&(oe|=B.DEPTH_BUFFER_BIT),re&&(oe|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),B.clear(oe)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",ve,!1),t.removeEventListener("webglcontextrestored",Ve,!1),t.removeEventListener("webglcontextcreationerror",Oe,!1),$e.dispose(),Bt.dispose(),Ze.dispose(),w.dispose(),Q.dispose(),xe.dispose(),on.dispose(),q.dispose(),Je.dispose(),fe.dispose(),fe.removeEventListener("sessionstart",Jr),fe.removeEventListener("sessionend",ml),st.stop()};function ve(E){E.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),F=!0}function Ve(){console.log("THREE.WebGLRenderer: Context Restored."),F=!1;let E=mt.autoReset,G=Qe.enabled,re=Qe.autoUpdate,oe=Qe.needsUpdate,Z=Qe.type;ke(),mt.autoReset=E,Qe.enabled=G,Qe.autoUpdate=re,Qe.needsUpdate=oe,Qe.type=Z}function Oe(E){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function Tt(E){let G=E.target;G.removeEventListener("dispose",Tt),hn(G)}function hn(E){Un(E),Ze.remove(E)}function Un(E){let G=Ze.get(E).programs;G!==void 0&&(G.forEach(function(re){Je.releaseProgram(re)}),E.isShaderMaterial&&Je.releaseShaderCache(E))}this.renderBufferDirect=function(E,G,re,oe,Z,De){G===null&&(G=Nt);let We=Z.isMesh&&Z.matrixWorld.determinant()<0,rt=Yo(E,G,re,oe,Z);Ie.setMaterial(oe,We);let ot=re.index,bt=1;if(oe.wireframe===!0){if(ot=we.getWireframeAttribute(re),ot===void 0)return;bt=2}let St=re.drawRange,je=re.attributes.position,Xt=St.start*bt,nn=(St.start+St.count)*bt;De!==null&&(Xt=Math.max(Xt,De.start*bt),nn=Math.min(nn,(De.start+De.count)*bt)),ot!==null?(Xt=Math.max(Xt,0),nn=Math.min(nn,ot.count)):je!=null&&(Xt=Math.max(Xt,0),nn=Math.min(nn,je.count));let sn=nn-Xt;if(sn<0||sn===1/0)return;on.setup(Z,oe,rt,re,ot);let Wn,Et=qe;if(ot!==null&&(Wn=ge.get(ot),Et=Wt,Et.setIndex(Wn)),Z.isMesh)oe.wireframe===!0?(Ie.setLineWidth(oe.wireframeLinewidth*Ce()),Et.setMode(B.LINES)):Et.setMode(B.TRIANGLES);else if(Z.isLine){let lt=oe.linewidth;lt===void 0&&(lt=1),Ie.setLineWidth(lt*Ce()),Z.isLineSegments?Et.setMode(B.LINES):Z.isLineLoop?Et.setMode(B.LINE_LOOP):Et.setMode(B.LINE_STRIP)}else Z.isPoints?Et.setMode(B.POINTS):Z.isSprite&&Et.setMode(B.TRIANGLES);if(Z.isBatchedMesh)if(Z._multiDrawInstances!==null)Et.renderMultiDrawInstances(Z._multiDrawStarts,Z._multiDrawCounts,Z._multiDrawCount,Z._multiDrawInstances);else if(Ee.get("WEBGL_multi_draw"))Et.renderMultiDraw(Z._multiDrawStarts,Z._multiDrawCounts,Z._multiDrawCount);else{let lt=Z._multiDrawStarts,pi=Z._multiDrawCounts,Jt=Z._multiDrawCount,mi=ot?ge.get(ot).bytesPerElement:1,$n=Ze.get(oe).currentProgram.getUniforms();for(let le=0;le<Jt;le++)$n.setValue(B,"_gl_DrawID",le),Et.render(lt[le]/mi,pi[le])}else if(Z.isInstancedMesh)Et.renderInstances(Xt,sn,Z.count);else if(re.isInstancedBufferGeometry){let lt=re._maxInstanceCount!==void 0?re._maxInstanceCount:1/0,pi=Math.min(re.instanceCount,lt);Et.renderInstances(Xt,sn,pi)}else Et.render(Xt,sn)};function en(E,G,re){E.transparent===!0&&E.side===Bn&&E.forceSinglePass===!1?(E.side=ei,E.needsUpdate=!0,Nn(E,G,re),E.side=Gi,E.needsUpdate=!0,Nn(E,G,re),E.side=Bn):Nn(E,G,re)}this.compile=function(E,G,re=null){re===null&&(re=E),m=Bt.get(re),m.init(G),_.push(m),re.traverseVisible(function(Z){Z.isLight&&Z.layers.test(G.layers)&&(m.pushLight(Z),Z.castShadow&&m.pushShadow(Z))}),E!==re&&E.traverseVisible(function(Z){Z.isLight&&Z.layers.test(G.layers)&&(m.pushLight(Z),Z.castShadow&&m.pushShadow(Z))}),m.setupLights();let oe=new Set;return E.traverse(function(Z){if(!(Z.isMesh||Z.isPoints||Z.isLine||Z.isSprite))return;let De=Z.material;if(De)if(Array.isArray(De))for(let We=0;We<De.length;We++){let rt=De[We];en(rt,re,Z),oe.add(rt)}else en(De,re,Z),oe.add(De)}),_.pop(),m=null,oe},this.compileAsync=function(E,G,re=null){let oe=this.compile(E,G,re);return new Promise(Z=>{function De(){if(oe.forEach(function(We){Ze.get(We).currentProgram.isReady()&&oe.delete(We)}),oe.size===0){Z(E);return}setTimeout(De,10)}Ee.get("KHR_parallel_shader_compile")!==null?De():setTimeout(De,10)})};let di=null;function Di(E){di&&di(E)}function Jr(){st.stop()}function ml(){st.start()}let st=new Sg;st.setAnimationLoop(Di),typeof self<"u"&&st.setContext(self),this.setAnimationLoop=function(E){di=E,fe.setAnimationLoop(E),E===null?st.stop():st.start()},fe.addEventListener("sessionstart",Jr),fe.addEventListener("sessionend",ml),this.render=function(E,G){if(G!==void 0&&G.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(F===!0)return;if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),G.parent===null&&G.matrixWorldAutoUpdate===!0&&G.updateMatrixWorld(),fe.enabled===!0&&fe.isPresenting===!0&&(fe.cameraAutoUpdate===!0&&fe.updateCamera(G),G=fe.getCamera()),E.isScene===!0&&E.onBeforeRender(v,E,G,C),m=Bt.get(E,_.length),m.init(G),_.push(m),ft.multiplyMatrices(G.projectionMatrix,G.matrixWorldInverse),me.setFromProjectionMatrix(ft),nt=this.localClippingEnabled,Le=Pe.init(this.clippingPlanes,nt),g=$e.get(E,y.length),g.init(),y.push(g),fe.enabled===!0&&fe.isPresenting===!0){let De=v.xr.getDepthSensingMesh();De!==null&&Xo(De,G,-1/0,v.sortObjects)}Xo(E,G,0,v.sortObjects),g.finish(),v.sortObjects===!0&&g.sort(Te,Ue),ye=fe.enabled===!1||fe.isPresenting===!1||fe.hasDepthSensing()===!1,ye&&gt.addToRenderList(g,E),this.info.render.frame++,Le===!0&&Pe.beginShadows();let re=m.state.shadowsArray;Qe.render(re,E,G),Le===!0&&Pe.endShadows(),this.info.autoReset===!0&&this.info.reset();let oe=g.opaque,Z=g.transmissive;if(m.setupLights(),G.isArrayCamera){let De=G.cameras;if(Z.length>0)for(let We=0,rt=De.length;We<rt;We++){let ot=De[We];xl(oe,Z,E,ot)}ye&&gt.render(E);for(let We=0,rt=De.length;We<rt;We++){let ot=De[We];gl(g,E,ot,ot.viewport)}}else Z.length>0&&xl(oe,Z,E,G),ye&&gt.render(E),gl(g,E,G);C!==null&&(D.updateMultisampleRenderTarget(C),D.updateRenderTargetMipmap(C)),E.isScene===!0&&E.onAfterRender(v,E,G),on.resetDefaultState(),S=-1,M=null,_.pop(),_.length>0?(m=_[_.length-1],Le===!0&&Pe.setGlobalState(v.clippingPlanes,m.state.camera)):m=null,y.pop(),y.length>0?g=y[y.length-1]:g=null};function Xo(E,G,re,oe){if(E.visible===!1)return;if(E.layers.test(G.layers)){if(E.isGroup)re=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(G);else if(E.isLight)m.pushLight(E),E.castShadow&&m.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||me.intersectsSprite(E)){oe&&_t.setFromMatrixPosition(E.matrixWorld).applyMatrix4(ft);let We=xe.update(E),rt=E.material;rt.visible&&g.push(E,We,rt,re,_t.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||me.intersectsObject(E))){let We=xe.update(E),rt=E.material;if(oe&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),_t.copy(E.boundingSphere.center)):(We.boundingSphere===null&&We.computeBoundingSphere(),_t.copy(We.boundingSphere.center)),_t.applyMatrix4(E.matrixWorld).applyMatrix4(ft)),Array.isArray(rt)){let ot=We.groups;for(let bt=0,St=ot.length;bt<St;bt++){let je=ot[bt],Xt=rt[je.materialIndex];Xt&&Xt.visible&&g.push(E,We,Xt,re,_t.z,je)}}else rt.visible&&g.push(E,We,rt,re,_t.z,null)}}let De=E.children;for(let We=0,rt=De.length;We<rt;We++)Xo(De[We],G,re,oe)}function gl(E,G,re,oe){let Z=E.opaque,De=E.transmissive,We=E.transparent;m.setupLightsView(re),Le===!0&&Pe.setGlobalState(v.clippingPlanes,re),oe&&Ie.viewport(N.copy(oe)),Z.length>0&&as(Z,G,re),De.length>0&&as(De,G,re),We.length>0&&as(We,G,re),Ie.buffers.depth.setTest(!0),Ie.buffers.depth.setMask(!0),Ie.buffers.color.setMask(!0),Ie.setPolygonOffset(!1)}function xl(E,G,re,oe){if((re.isScene===!0?re.overrideMaterial:null)!==null)return;m.state.transmissionRenderTarget[oe.id]===void 0&&(m.state.transmissionRenderTarget[oe.id]=new ti(1,1,{generateMipmaps:!0,type:Ee.has("EXT_color_buffer_half_float")||Ee.has("EXT_color_buffer_float")?Bo:ji,minFilter:yi,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:zt.workingColorSpace}));let De=m.state.transmissionRenderTarget[oe.id],We=oe.viewport||N;De.setSize(We.z,We.w);let rt=v.getRenderTarget();v.setRenderTarget(De),v.getClearColor(ee),pe=v.getClearAlpha(),pe<1&&v.setClearColor(16777215,.5),v.clear(),ye&&gt.render(re);let ot=v.toneMapping;v.toneMapping=ys;let bt=oe.viewport;if(oe.viewport!==void 0&&(oe.viewport=void 0),m.setupLightsView(oe),Le===!0&&Pe.setGlobalState(v.clippingPlanes,oe),as(E,re,oe),D.updateMultisampleRenderTarget(De),D.updateRenderTargetMipmap(De),Ee.has("WEBGL_multisampled_render_to_texture")===!1){let St=!1;for(let je=0,Xt=G.length;je<Xt;je++){let nn=G[je],sn=nn.object,Wn=nn.geometry,Et=nn.material,lt=nn.group;if(Et.side===Bn&&sn.layers.test(oe.layers)){let pi=Et.side;Et.side=ei,Et.needsUpdate=!0,vl(sn,re,oe,Wn,Et,lt),Et.side=pi,Et.needsUpdate=!0,St=!0}}St===!0&&(D.updateMultisampleRenderTarget(De),D.updateRenderTargetMipmap(De))}v.setRenderTarget(rt),v.setClearColor(ee,pe),bt!==void 0&&(oe.viewport=bt),v.toneMapping=ot}function as(E,G,re){let oe=G.isScene===!0?G.overrideMaterial:null;for(let Z=0,De=E.length;Z<De;Z++){let We=E[Z],rt=We.object,ot=We.geometry,bt=oe===null?We.material:oe,St=We.group;rt.layers.test(re.layers)&&vl(rt,G,re,ot,bt,St)}}function vl(E,G,re,oe,Z,De){E.onBeforeRender(v,G,re,oe,Z,De),E.modelViewMatrix.multiplyMatrices(re.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),Z.onBeforeRender(v,G,re,oe,E,De),Z.transparent===!0&&Z.side===Bn&&Z.forceSinglePass===!1?(Z.side=ei,Z.needsUpdate=!0,v.renderBufferDirect(re,G,oe,Z,E,De),Z.side=Gi,Z.needsUpdate=!0,v.renderBufferDirect(re,G,oe,Z,E,De),Z.side=Bn):v.renderBufferDirect(re,G,oe,Z,E,De),E.onAfterRender(v,G,re,oe,Z,De)}function Nn(E,G,re){G.isScene!==!0&&(G=Nt);let oe=Ze.get(E),Z=m.state.lights,De=m.state.shadowsArray,We=Z.state.version,rt=Je.getParameters(E,Z.state,De,G,re),ot=Je.getProgramCacheKey(rt),bt=oe.programs;oe.environment=E.isMeshStandardMaterial?G.environment:null,oe.fog=G.fog,oe.envMap=(E.isMeshStandardMaterial?Q:w).get(E.envMap||oe.environment),oe.envMapRotation=oe.environment!==null&&E.envMap===null?G.environmentRotation:E.envMapRotation,bt===void 0&&(E.addEventListener("dispose",Tt),bt=new Map,oe.programs=bt);let St=bt.get(ot);if(St!==void 0){if(oe.currentProgram===St&&oe.lightsStateVersion===We)return qo(E,rt),St}else rt.uniforms=Je.getUniforms(E),E.onBeforeCompile(rt,v),St=Je.acquireProgram(rt,ot),bt.set(ot,St),oe.uniforms=rt.uniforms;let je=oe.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(je.clippingPlanes=Pe.uniform),qo(E,rt),oe.needsLights=qi(E),oe.lightsStateVersion=We,oe.needsLights&&(je.ambientLightColor.value=Z.state.ambient,je.lightProbe.value=Z.state.probe,je.directionalLights.value=Z.state.directional,je.directionalLightShadows.value=Z.state.directionalShadow,je.spotLights.value=Z.state.spot,je.spotLightShadows.value=Z.state.spotShadow,je.rectAreaLights.value=Z.state.rectArea,je.ltc_1.value=Z.state.rectAreaLTC1,je.ltc_2.value=Z.state.rectAreaLTC2,je.pointLights.value=Z.state.point,je.pointLightShadows.value=Z.state.pointShadow,je.hemisphereLights.value=Z.state.hemi,je.directionalShadowMap.value=Z.state.directionalShadowMap,je.directionalShadowMatrix.value=Z.state.directionalShadowMatrix,je.spotShadowMap.value=Z.state.spotShadowMap,je.spotLightMatrix.value=Z.state.spotLightMatrix,je.spotLightMap.value=Z.state.spotLightMap,je.pointShadowMap.value=Z.state.pointShadowMap,je.pointShadowMatrix.value=Z.state.pointShadowMatrix),oe.currentProgram=St,oe.uniformsList=null,St}function jr(E){if(E.uniformsList===null){let G=E.currentProgram.getUniforms();E.uniformsList=bo.seqWithValue(G.seq,E.uniforms)}return E.uniformsList}function qo(E,G){let re=Ze.get(E);re.outputColorSpace=G.outputColorSpace,re.batching=G.batching,re.batchingColor=G.batchingColor,re.instancing=G.instancing,re.instancingColor=G.instancingColor,re.instancingMorph=G.instancingMorph,re.skinning=G.skinning,re.morphTargets=G.morphTargets,re.morphNormals=G.morphNormals,re.morphColors=G.morphColors,re.morphTargetsCount=G.morphTargetsCount,re.numClippingPlanes=G.numClippingPlanes,re.numIntersection=G.numClipIntersection,re.vertexAlphas=G.vertexAlphas,re.vertexTangents=G.vertexTangents,re.toneMapping=G.toneMapping}function Yo(E,G,re,oe,Z){G.isScene!==!0&&(G=Nt),D.resetTextureUnits();let De=G.fog,We=oe.isMeshStandardMaterial?G.environment:null,rt=C===null?v.outputColorSpace:C.isXRRenderTarget===!0?C.texture.colorSpace:Gn,ot=(oe.isMeshStandardMaterial?Q:w).get(oe.envMap||We),bt=oe.vertexColors===!0&&!!re.attributes.color&&re.attributes.color.itemSize===4,St=!!re.attributes.tangent&&(!!oe.normalMap||oe.anisotropy>0),je=!!re.morphAttributes.position,Xt=!!re.morphAttributes.normal,nn=!!re.morphAttributes.color,sn=ys;oe.toneMapped&&(C===null||C.isXRRenderTarget===!0)&&(sn=v.toneMapping);let Wn=re.morphAttributes.position||re.morphAttributes.normal||re.morphAttributes.color,Et=Wn!==void 0?Wn.length:0,lt=Ze.get(oe),pi=m.state.lights;if(Le===!0&&(nt===!0||E!==M)){let oi=E===M&&oe.id===S;Pe.setState(oe,E,oi)}let Jt=!1;oe.version===lt.__version?(lt.needsLights&&lt.lightsStateVersion!==pi.state.version||lt.outputColorSpace!==rt||Z.isBatchedMesh&&lt.batching===!1||!Z.isBatchedMesh&&lt.batching===!0||Z.isBatchedMesh&&lt.batchingColor===!0&&Z.colorTexture===null||Z.isBatchedMesh&&lt.batchingColor===!1&&Z.colorTexture!==null||Z.isInstancedMesh&&lt.instancing===!1||!Z.isInstancedMesh&&lt.instancing===!0||Z.isSkinnedMesh&&lt.skinning===!1||!Z.isSkinnedMesh&&lt.skinning===!0||Z.isInstancedMesh&&lt.instancingColor===!0&&Z.instanceColor===null||Z.isInstancedMesh&&lt.instancingColor===!1&&Z.instanceColor!==null||Z.isInstancedMesh&&lt.instancingMorph===!0&&Z.morphTexture===null||Z.isInstancedMesh&&lt.instancingMorph===!1&&Z.morphTexture!==null||lt.envMap!==ot||oe.fog===!0&&lt.fog!==De||lt.numClippingPlanes!==void 0&&(lt.numClippingPlanes!==Pe.numPlanes||lt.numIntersection!==Pe.numIntersection)||lt.vertexAlphas!==bt||lt.vertexTangents!==St||lt.morphTargets!==je||lt.morphNormals!==Xt||lt.morphColors!==nn||lt.toneMapping!==sn||lt.morphTargetsCount!==Et)&&(Jt=!0):(Jt=!0,lt.__version=oe.version);let mi=lt.currentProgram;Jt===!0&&(mi=Nn(oe,G,Z));let $n=!1,le=!1,Yi=!1,qt=mi.getUniforms(),Fn=lt.uniforms;if(Ie.useProgram(mi.program)&&($n=!0,le=!0,Yi=!0),oe.id!==S&&(S=oe.id,le=!0),$n||M!==E){Ie.buffers.depth.getReversed()?(Ne.copy(E.projectionMatrix),hv(Ne),uv(Ne),qt.setValue(B,"projectionMatrix",Ne)):qt.setValue(B,"projectionMatrix",E.projectionMatrix),qt.setValue(B,"viewMatrix",E.matrixWorldInverse);let Ui=qt.map.cameraPosition;Ui!==void 0&&Ui.setValue(B,pt.setFromMatrixPosition(E.matrixWorld)),Ke.logarithmicDepthBuffer&&qt.setValue(B,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(oe.isMeshPhongMaterial||oe.isMeshToonMaterial||oe.isMeshLambertMaterial||oe.isMeshBasicMaterial||oe.isMeshStandardMaterial||oe.isShaderMaterial)&&qt.setValue(B,"isOrthographic",E.isOrthographicCamera===!0),M!==E&&(M=E,le=!0,Yi=!0)}if(Z.isSkinnedMesh){qt.setOptional(B,Z,"bindMatrix"),qt.setOptional(B,Z,"bindMatrixInverse");let oi=Z.skeleton;oi&&(oi.boneTexture===null&&oi.computeBoneTexture(),qt.setValue(B,"boneTexture",oi.boneTexture,D))}Z.isBatchedMesh&&(qt.setOptional(B,Z,"batchingTexture"),qt.setValue(B,"batchingTexture",Z._matricesTexture,D),qt.setOptional(B,Z,"batchingIdTexture"),qt.setValue(B,"batchingIdTexture",Z._indirectTexture,D),qt.setOptional(B,Z,"batchingColorTexture"),Z._colorsTexture!==null&&qt.setValue(B,"batchingColorTexture",Z._colorsTexture,D));let ls=re.morphAttributes;if((ls.position!==void 0||ls.normal!==void 0||ls.color!==void 0)&&yt.update(Z,re,mi),(le||lt.receiveShadow!==Z.receiveShadow)&&(lt.receiveShadow=Z.receiveShadow,qt.setValue(B,"receiveShadow",Z.receiveShadow)),oe.isMeshGouraudMaterial&&oe.envMap!==null&&(Fn.envMap.value=ot,Fn.flipEnvMap.value=ot.isCubeTexture&&ot.isRenderTargetTexture===!1?-1:1),oe.isMeshStandardMaterial&&oe.envMap===null&&G.environment!==null&&(Fn.envMapIntensity.value=G.environmentIntensity),le&&(qt.setValue(B,"toneMappingExposure",v.toneMappingExposure),lt.needsLights&&Zo(Fn,Yi),De&&oe.fog===!0&&ze.refreshFogUniforms(Fn,De),ze.refreshMaterialUniforms(Fn,oe,se,be,m.state.transmissionRenderTarget[E.id]),bo.upload(B,jr(lt),Fn,D)),oe.isShaderMaterial&&oe.uniformsNeedUpdate===!0&&(bo.upload(B,jr(lt),Fn,D),oe.uniformsNeedUpdate=!1),oe.isSpriteMaterial&&qt.setValue(B,"center",Z.center),qt.setValue(B,"modelViewMatrix",Z.modelViewMatrix),qt.setValue(B,"normalMatrix",Z.normalMatrix),qt.setValue(B,"modelMatrix",Z.matrixWorld),oe.isShaderMaterial||oe.isRawShaderMaterial){let oi=oe.uniformsGroups;for(let Ui=0,gi=oi.length;Ui<gi;Ui++){let $o=oi[Ui];q.update($o,mi),q.bind($o,mi)}}return mi}function Zo(E,G){E.ambientLightColor.needsUpdate=G,E.lightProbe.needsUpdate=G,E.directionalLights.needsUpdate=G,E.directionalLightShadows.needsUpdate=G,E.pointLights.needsUpdate=G,E.pointLightShadows.needsUpdate=G,E.spotLights.needsUpdate=G,E.spotLightShadows.needsUpdate=G,E.rectAreaLights.needsUpdate=G,E.hemisphereLights.needsUpdate=G}function qi(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return T},this.getActiveMipmapLevel=function(){return U},this.getRenderTarget=function(){return C},this.setRenderTargetTextures=function(E,G,re){Ze.get(E.texture).__webglTexture=G,Ze.get(E.depthTexture).__webglTexture=re;let oe=Ze.get(E);oe.__hasExternalTextures=!0,oe.__autoAllocateDepthBuffer=re===void 0,oe.__autoAllocateDepthBuffer||Ee.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),oe.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(E,G){let re=Ze.get(E);re.__webglFramebuffer=G,re.__useDefaultFramebuffer=G===void 0},this.setRenderTarget=function(E,G=0,re=0){C=E,T=G,U=re;let oe=!0,Z=null,De=!1,We=!1;if(E){let ot=Ze.get(E);if(ot.__useDefaultFramebuffer!==void 0)Ie.bindFramebuffer(B.FRAMEBUFFER,null),oe=!1;else if(ot.__webglFramebuffer===void 0)D.setupRenderTarget(E);else if(ot.__hasExternalTextures)D.rebindTextures(E,Ze.get(E.texture).__webglTexture,Ze.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){let je=E.depthTexture;if(ot.__boundDepthTexture!==je){if(je!==null&&Ze.has(je)&&(E.width!==je.image.width||E.height!==je.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");D.setupDepthRenderbuffer(E)}}let bt=E.texture;(bt.isData3DTexture||bt.isDataArrayTexture||bt.isCompressedArrayTexture)&&(We=!0);let St=Ze.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(St[G])?Z=St[G][re]:Z=St[G],De=!0):E.samples>0&&D.useMultisampledRTT(E)===!1?Z=Ze.get(E).__webglMultisampledFramebuffer:Array.isArray(St)?Z=St[re]:Z=St,N.copy(E.viewport),J.copy(E.scissor),$=E.scissorTest}else N.copy(Fe).multiplyScalar(se).floor(),J.copy(dt).multiplyScalar(se).floor(),$=Gt;if(Ie.bindFramebuffer(B.FRAMEBUFFER,Z)&&oe&&Ie.drawBuffers(E,Z),Ie.viewport(N),Ie.scissor(J),Ie.setScissorTest($),De){let ot=Ze.get(E.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+G,ot.__webglTexture,re)}else if(We){let ot=Ze.get(E.texture),bt=G||0;B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,ot.__webglTexture,re||0,bt)}S=-1},this.readRenderTargetPixels=function(E,G,re,oe,Z,De,We){if(!(E&&E.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let rt=Ze.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&We!==void 0&&(rt=rt[We]),rt){Ie.bindFramebuffer(B.FRAMEBUFFER,rt);try{let ot=E.texture,bt=ot.format,St=ot.type;if(!Ke.textureFormatReadable(bt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Ke.textureTypeReadable(St)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}G>=0&&G<=E.width-oe&&re>=0&&re<=E.height-Z&&B.readPixels(G,re,oe,Z,It.convert(bt),It.convert(St),De)}finally{let ot=C!==null?Ze.get(C).__webglFramebuffer:null;Ie.bindFramebuffer(B.FRAMEBUFFER,ot)}}},this.readRenderTargetPixelsAsync=async function(E,G,re,oe,Z,De,We){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let rt=Ze.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&We!==void 0&&(rt=rt[We]),rt){let ot=E.texture,bt=ot.format,St=ot.type;if(!Ke.textureFormatReadable(bt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Ke.textureTypeReadable(St))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(G>=0&&G<=E.width-oe&&re>=0&&re<=E.height-Z){Ie.bindFramebuffer(B.FRAMEBUFFER,rt);let je=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,je),B.bufferData(B.PIXEL_PACK_BUFFER,De.byteLength,B.STREAM_READ),B.readPixels(G,re,oe,Z,It.convert(bt),It.convert(St),0);let Xt=C!==null?Ze.get(C).__webglFramebuffer:null;Ie.bindFramebuffer(B.FRAMEBUFFER,Xt);let nn=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await cv(B,nn,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,je),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,De),B.deleteBuffer(je),B.deleteSync(nn),De}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(E,G=null,re=0){E.isTexture!==!0&&(ha("WebGLRenderer: copyFramebufferToTexture function signature has changed."),G=arguments[0]||null,E=arguments[1]);let oe=Math.pow(2,-re),Z=Math.floor(E.image.width*oe),De=Math.floor(E.image.height*oe),We=G!==null?G.x:0,rt=G!==null?G.y:0;D.setTexture2D(E,0),B.copyTexSubImage2D(B.TEXTURE_2D,re,0,0,We,rt,Z,De),Ie.unbindTexture()},this.copyTextureToTexture=function(E,G,re=null,oe=null,Z=0){E.isTexture!==!0&&(ha("WebGLRenderer: copyTextureToTexture function signature has changed."),oe=arguments[0]||null,E=arguments[1],G=arguments[2],Z=arguments[3]||0,re=null);let De,We,rt,ot,bt,St,je,Xt,nn,sn=E.isCompressedTexture?E.mipmaps[Z]:E.image;re!==null?(De=re.max.x-re.min.x,We=re.max.y-re.min.y,rt=re.isBox3?re.max.z-re.min.z:1,ot=re.min.x,bt=re.min.y,St=re.isBox3?re.min.z:0):(De=sn.width,We=sn.height,rt=sn.depth||1,ot=0,bt=0,St=0),oe!==null?(je=oe.x,Xt=oe.y,nn=oe.z):(je=0,Xt=0,nn=0);let Wn=It.convert(G.format),Et=It.convert(G.type),lt;G.isData3DTexture?(D.setTexture3D(G,0),lt=B.TEXTURE_3D):G.isDataArrayTexture||G.isCompressedArrayTexture?(D.setTexture2DArray(G,0),lt=B.TEXTURE_2D_ARRAY):(D.setTexture2D(G,0),lt=B.TEXTURE_2D),B.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,G.flipY),B.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,G.premultiplyAlpha),B.pixelStorei(B.UNPACK_ALIGNMENT,G.unpackAlignment);let pi=B.getParameter(B.UNPACK_ROW_LENGTH),Jt=B.getParameter(B.UNPACK_IMAGE_HEIGHT),mi=B.getParameter(B.UNPACK_SKIP_PIXELS),$n=B.getParameter(B.UNPACK_SKIP_ROWS),le=B.getParameter(B.UNPACK_SKIP_IMAGES);B.pixelStorei(B.UNPACK_ROW_LENGTH,sn.width),B.pixelStorei(B.UNPACK_IMAGE_HEIGHT,sn.height),B.pixelStorei(B.UNPACK_SKIP_PIXELS,ot),B.pixelStorei(B.UNPACK_SKIP_ROWS,bt),B.pixelStorei(B.UNPACK_SKIP_IMAGES,St);let Yi=E.isDataArrayTexture||E.isData3DTexture,qt=G.isDataArrayTexture||G.isData3DTexture;if(E.isRenderTargetTexture||E.isDepthTexture){let Fn=Ze.get(E),ls=Ze.get(G),oi=Ze.get(Fn.__renderTarget),Ui=Ze.get(ls.__renderTarget);Ie.bindFramebuffer(B.READ_FRAMEBUFFER,oi.__webglFramebuffer),Ie.bindFramebuffer(B.DRAW_FRAMEBUFFER,Ui.__webglFramebuffer);for(let gi=0;gi<rt;gi++)Yi&&B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Ze.get(E).__webglTexture,Z,St+gi),E.isDepthTexture?(qt&&B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Ze.get(G).__webglTexture,Z,nn+gi),B.blitFramebuffer(ot,bt,De,We,je,Xt,De,We,B.DEPTH_BUFFER_BIT,B.NEAREST)):qt?B.copyTexSubImage3D(lt,Z,je,Xt,nn+gi,ot,bt,De,We):B.copyTexSubImage2D(lt,Z,je,Xt,nn+gi,ot,bt,De,We);Ie.bindFramebuffer(B.READ_FRAMEBUFFER,null),Ie.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else qt?E.isDataTexture||E.isData3DTexture?B.texSubImage3D(lt,Z,je,Xt,nn,De,We,rt,Wn,Et,sn.data):G.isCompressedArrayTexture?B.compressedTexSubImage3D(lt,Z,je,Xt,nn,De,We,rt,Wn,sn.data):B.texSubImage3D(lt,Z,je,Xt,nn,De,We,rt,Wn,Et,sn):E.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,Z,je,Xt,De,We,Wn,Et,sn.data):E.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,Z,je,Xt,sn.width,sn.height,Wn,sn.data):B.texSubImage2D(B.TEXTURE_2D,Z,je,Xt,De,We,Wn,Et,sn);B.pixelStorei(B.UNPACK_ROW_LENGTH,pi),B.pixelStorei(B.UNPACK_IMAGE_HEIGHT,Jt),B.pixelStorei(B.UNPACK_SKIP_PIXELS,mi),B.pixelStorei(B.UNPACK_SKIP_ROWS,$n),B.pixelStorei(B.UNPACK_SKIP_IMAGES,le),Z===0&&G.generateMipmaps&&B.generateMipmap(lt),Ie.unbindTexture()},this.copyTextureToTexture3D=function(E,G,re=null,oe=null,Z=0){return E.isTexture!==!0&&(ha("WebGLRenderer: copyTextureToTexture3D function signature has changed."),re=arguments[0]||null,oe=arguments[1]||null,E=arguments[2],G=arguments[3],Z=arguments[4]||0),ha('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(E,G,re,oe,Z)},this.initRenderTarget=function(E){Ze.get(E).__webglFramebuffer===void 0&&D.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?D.setTextureCube(E,0):E.isData3DTexture?D.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?D.setTexture2DArray(E,0):D.setTexture2D(E,0),Ie.unbindTexture()},this.resetState=function(){T=0,U=0,C=null,Ie.reset(),on.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Ji}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorspace=zt._getDrawingBufferColorSpace(e),t.unpackColorSpace=zt._getUnpackColorSpace()}},Qc=class s{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new Be(e),this.density=t}clone(){return new s(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}},eh=class s{constructor(e,t=1,n=1e3){this.isFog=!0,this.name="",this.color=new Be(e),this.near=t,this.far=n}clone(){return new s(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}},Br=class extends Kt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new bi,this.environmentIntensity=1,this.environmentRotation=new bi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},Ts=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Aa,this.updateRanges=[],this.version=0,this.uuid=Mi()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Mi()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Mi()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}},Kn=new L,es=class s{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Kn.fromBufferAttribute(this,t),Kn.applyMatrix4(e),this.setXYZ(t,Kn.x,Kn.y,Kn.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Kn.fromBufferAttribute(this,t),Kn.applyNormalMatrix(e),this.setXYZ(t,Kn.x,Kn.y,Kn.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Kn.fromBufferAttribute(this,t),Kn.transformDirection(e),this.setXYZ(t,Kn.x,Kn.y,Kn.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=jn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Lt(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=Lt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=Lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=Lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=Lt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=jn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=jn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=jn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=jn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array),i=Lt(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=Lt(t,this.array),n=Lt(n,this.array),i=Lt(i,this.array),r=Lt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=r,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new ht(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new s(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},Oa=class extends xn{static get type(){return"SpriteMaterial"}constructor(e){super(),this.isSpriteMaterial=!0,this.color=new Be(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},fo,na=new L,po=new L,mo=new L,go=new _e,ia=new _e,Cg=new ct,Vl=new L,sa=new L,Gl=new L,Bm=new _e,Xu=new _e,zm=new _e,th=class extends Kt{constructor(e=new Oa){if(super(),this.isSprite=!0,this.type="Sprite",fo===void 0){fo=new tt;let t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new Ts(t,5);fo.setIndex([0,1,2,0,2,3]),fo.setAttribute("position",new es(n,3,0,!1)),fo.setAttribute("uv",new es(n,2,3,!1))}this.geometry=fo,this.material=e,this.center=new _e(.5,.5)}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),po.setFromMatrixScale(this.matrixWorld),Cg.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),mo.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&po.multiplyScalar(-mo.z);let n=this.material.rotation,i,r;n!==0&&(r=Math.cos(n),i=Math.sin(n));let o=this.center;Wl(Vl.set(-.5,-.5,0),mo,o,po,i,r),Wl(sa.set(.5,-.5,0),mo,o,po,i,r),Wl(Gl.set(.5,.5,0),mo,o,po,i,r),Bm.set(0,0),Xu.set(1,0),zm.set(1,1);let a=e.ray.intersectTriangle(Vl,sa,Gl,!1,na);if(a===null&&(Wl(sa.set(-.5,.5,0),mo,o,po,i,r),Xu.set(0,1),a=e.ray.intersectTriangle(Vl,Gl,sa,!1,na),a===null))return;let l=e.ray.origin.distanceTo(na);l<e.near||l>e.far||t.push({distance:l,point:na.clone(),uv:Ki.getInterpolation(na,Vl,sa,Gl,Bm,Xu,zm,new _e),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}};function Wl(s,e,t,n,i,r){go.subVectors(s,t).addScalar(.5).multiply(n),i!==void 0?(ia.x=r*go.x-i*go.y,ia.y=i*go.x+r*go.y):ia.copy(go),s.copy(e),s.x+=ia.x,s.y+=ia.y,s.applyMatrix4(Cg)}var Xl=new L,km=new L,nh=class extends Kt{constructor(){super(),this._currentLevel=0,this.type="LOD",Object.defineProperties(this,{levels:{enumerable:!0,value:[]},isLOD:{value:!0}}),this.autoUpdate=!0}copy(e){super.copy(e,!1);let t=e.levels;for(let n=0,i=t.length;n<i;n++){let r=t[n];this.addLevel(r.object.clone(),r.distance,r.hysteresis)}return this.autoUpdate=e.autoUpdate,this}addLevel(e,t=0,n=0){t=Math.abs(t);let i=this.levels,r;for(r=0;r<i.length&&!(t<i[r].distance);r++);return i.splice(r,0,{distance:t,hysteresis:n,object:e}),this.add(e),this}removeLevel(e){let t=this.levels;for(let n=0;n<t.length;n++)if(t[n].distance===e){let i=t.splice(n,1);return this.remove(i[0].object),!0}return!1}getCurrentLevel(){return this._currentLevel}getObjectForDistance(e){let t=this.levels;if(t.length>0){let n,i;for(n=1,i=t.length;n<i;n++){let r=t[n].distance;if(t[n].object.visible&&(r-=r*t[n].hysteresis),e<r)break}return t[n-1].object}return null}raycast(e,t){if(this.levels.length>0){Xl.setFromMatrixPosition(this.matrixWorld);let i=e.ray.origin.distanceTo(Xl);this.getObjectForDistance(i).raycast(e,t)}}update(e){let t=this.levels;if(t.length>1){Xl.setFromMatrixPosition(e.matrixWorld),km.setFromMatrixPosition(this.matrixWorld);let n=Xl.distanceTo(km)/e.zoom;t[0].object.visible=!0;let i,r;for(i=1,r=t.length;i<r;i++){let o=t[i].distance;if(t[i].object.visible&&(o-=o*t[i].hysteresis),n>=o)t[i-1].object.visible=!1,t[i].object.visible=!0;else break}for(this._currentLevel=i-1;i<r;i++)t[i].object.visible=!1}}toJSON(e){let t=super.toJSON(e);this.autoUpdate===!1&&(t.object.autoUpdate=!1),t.object.levels=[];let n=this.levels;for(let i=0,r=n.length;i<r;i++){let o=n[i];t.object.levels.push({object:o.object.uuid,distance:o.distance,hysteresis:o.hysteresis})}return t}},Hm=new L,Vm=new kt,Gm=new kt,cb=new L,Wm=new ct,ql=new L,qu=new Rn,Xm=new ct,Yu=new Xs,Ys=class extends Ft{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=hf,this.bindMatrix=new ct,this.bindMatrixInverse=new ct,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new wn),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,ql),this.boundingBox.expandByPoint(ql)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Rn),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,ql),this.boundingSphere.expandByPoint(ql)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),qu.copy(this.boundingSphere),qu.applyMatrix4(i),e.ray.intersectsSphere(qu)!==!1&&(Xm.copy(i).invert(),Yu.copy(e.ray).applyMatrix4(Xm),!(this.boundingBox!==null&&Yu.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,Yu)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new kt,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);let r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===hf?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===sg?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let n=this.skeleton,i=this.geometry;Vm.fromBufferAttribute(i.attributes.skinIndex,e),Gm.fromBufferAttribute(i.attributes.skinWeight,e),Hm.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let r=0;r<4;r++){let o=Gm.getComponent(r);if(o!==0){let a=Vm.getComponent(r);Wm.multiplyMatrices(n.bones[a].matrixWorld,n.boneInverses[a]),t.addScaledVector(cb.copy(Hm).applyMatrix4(Wm),o)}}return t.applyMatrix4(this.bindMatrixInverse)}},zr=class extends Kt{constructor(){super(),this.isBone=!0,this.type="Bone"}},Ri=class extends dn{constructor(e=null,t=1,n=1,i,r,o,a,l,c=Tn,h=Tn,u,f){super(null,o,a,l,c,h,i,r,u,f),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},qm=new ct,hb=new ct,Ro=class s{constructor(e=[],t=[]){this.uuid=Mi(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new ct)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let n=new ct;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){let e=this.bones,t=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let r=0,o=e.length;r<o;r++){let a=e[r]?e[r].matrixWorld:hb;qm.multiplyMatrices(a,t[r]),qm.toArray(n,r*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new s(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let n=new Ri(t,e,e,Qn,hi);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){let i=this.bones[t];if(i.name===e)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,i=e.bones.length;n<i;n++){let r=e.bones[n],o=t[r];o===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",r),o=new zr),this.bones.push(o),this.boneInverses.push(new ct().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){let e={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,n=this.boneInverses;for(let i=0,r=t.length;i<r;i++){let o=t[i];e.bones.push(o.uuid);let a=n[i];e.boneInverses.push(a.toArray())}return e}},kn=class extends ht{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},xo=new ct,Ym=new ct,Yl=[],Zm=new wn,ub=new ct,ra=new Ft,oa=new Rn,Wi=class extends Ft{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new kn(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,ub)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new wn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,xo),Zm.copy(e.boundingBox).applyMatrix4(xo),this.boundingBox.union(Zm)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Rn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,xo),oa.copy(e.boundingSphere).applyMatrix4(xo),this.boundingSphere.union(oa)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,r=n.length+1,o=e*r+1;for(let a=0;a<n.length;a++)n[a]=i[o+a]}raycast(e,t){let n=this.matrixWorld,i=this.count;if(ra.geometry=this.geometry,ra.material=this.material,ra.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),oa.copy(this.boundingSphere),oa.applyMatrix4(n),e.ray.intersectsSphere(oa)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,xo),Ym.multiplyMatrices(n,xo),ra.matrixWorld=Ym,ra.raycast(e,Yl);for(let o=0,a=Yl.length;o<a;o++){let l=Yl[o];l.instanceId=r,l.object=this,t.push(l)}Yl.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new kn(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){let n=t.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new Ri(new Float32Array(i*this.count),i,this.count,Kh,hi));let r=this.morphTexture.source.data.data,o=0;for(let c=0;c<n.length;c++)o+=n[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=i*e;r[l]=a,r.set(n,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}};function Zu(s,e){return s-e}function fb(s,e){return s.z-e.z}function db(s,e){return e.z-s.z}var Pf=class{constructor(){this.index=0,this.pool=[],this.list=[]}push(e,t,n,i){let r=this.pool,o=this.list;this.index>=r.length&&r.push({start:-1,count:-1,z:-1,index:-1});let a=r[this.index];o.push(a),this.index++,a.start=e,a.count=t,a.z=n,a.index=i}reset(){this.list.length=0,this.index=0}},ai=new ct,pb=new Be(1,1,1),$u=new Or,Zl=new wn,ur=new Rn,aa=new L,$m=new L,mb=new L,Ku=new Pf,Yn=new Ft,$l=[];function gb(s,e,t=0){let n=e.itemSize;if(s.isInterleavedBufferAttribute||s.array.constructor!==e.array.constructor){let i=s.count;for(let r=0;r<i;r++)for(let o=0;o<n;o++)e.setComponent(r+t,o,s.getComponent(r,o))}else e.array.set(s.array,t*n);e.needsUpdate=!0}function fr(s,e){if(s.constructor!==e.constructor){let t=Math.min(s.length,e.length);for(let n=0;n<t;n++)e[n]=s[n]}else{let t=Math.min(s.length,e.length);e.set(new s.constructor(s.buffer,0,t))}}var ih=class extends Ft{get maxInstanceCount(){return this._maxInstanceCount}get instanceCount(){return this._instanceInfo.length-this._availableInstanceIds.length}get unusedVertexCount(){return this._maxVertexCount-this._nextVertexStart}get unusedIndexCount(){return this._maxIndexCount-this._nextIndexStart}constructor(e,t,n=t*2,i){super(new tt,i),this.isBatchedMesh=!0,this.perObjectFrustumCulled=!0,this.sortObjects=!0,this.boundingBox=null,this.boundingSphere=null,this.customSort=null,this._instanceInfo=[],this._geometryInfo=[],this._availableInstanceIds=[],this._availableGeometryIds=[],this._nextIndexStart=0,this._nextVertexStart=0,this._geometryCount=0,this._visibilityChanged=!0,this._geometryInitialized=!1,this._maxInstanceCount=e,this._maxVertexCount=t,this._maxIndexCount=n,this._multiDrawCounts=new Int32Array(e),this._multiDrawStarts=new Int32Array(e),this._multiDrawCount=0,this._multiDrawInstances=null,this._matricesTexture=null,this._indirectTexture=null,this._colorsTexture=null,this._initMatricesTexture(),this._initIndirectTexture()}_initMatricesTexture(){let e=Math.sqrt(this._maxInstanceCount*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4),n=new Ri(t,e,e,Qn,hi);this._matricesTexture=n}_initIndirectTexture(){let e=Math.sqrt(this._maxInstanceCount);e=Math.ceil(e);let t=new Uint32Array(e*e),n=new Ri(t,e,e,ol,Es);this._indirectTexture=n}_initColorsTexture(){let e=Math.sqrt(this._maxInstanceCount);e=Math.ceil(e);let t=new Float32Array(e*e*4).fill(1),n=new Ri(t,e,e,Qn,hi);n.colorSpace=zt.workingColorSpace,this._colorsTexture=n}_initializeGeometry(e){let t=this.geometry,n=this._maxVertexCount,i=this._maxIndexCount;if(this._geometryInitialized===!1){for(let r in e.attributes){let o=e.getAttribute(r),{array:a,itemSize:l,normalized:c}=o,h=new a.constructor(n*l),u=new ht(h,l,c);t.setAttribute(r,u)}if(e.getIndex()!==null){let r=n>65535?new Uint32Array(i):new Uint16Array(i);t.setIndex(new ht(r,1))}this._geometryInitialized=!0}}_validateGeometry(e){let t=this.geometry;if(!!e.getIndex()!=!!t.getIndex())throw new Error('BatchedMesh: All geometries must consistently have "index".');for(let n in t.attributes){if(!e.hasAttribute(n))throw new Error(`BatchedMesh: Added geometry missing "${n}". All geometries must have consistent attributes.`);let i=e.getAttribute(n),r=t.getAttribute(n);if(i.itemSize!==r.itemSize||i.normalized!==r.normalized)throw new Error("BatchedMesh: All attributes must have a consistent itemSize and normalized value.")}}setCustomSort(e){return this.customSort=e,this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new wn);let e=this.boundingBox,t=this._instanceInfo;e.makeEmpty();for(let n=0,i=t.length;n<i;n++){if(t[n].active===!1)continue;let r=t[n].geometryIndex;this.getMatrixAt(n,ai),this.getBoundingBoxAt(r,Zl).applyMatrix4(ai),e.union(Zl)}}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Rn);let e=this.boundingSphere,t=this._instanceInfo;e.makeEmpty();for(let n=0,i=t.length;n<i;n++){if(t[n].active===!1)continue;let r=t[n].geometryIndex;this.getMatrixAt(n,ai),this.getBoundingSphereAt(r,ur).applyMatrix4(ai),e.union(ur)}}addInstance(e){if(this._instanceInfo.length>=this.maxInstanceCount&&this._availableInstanceIds.length===0)throw new Error("BatchedMesh: Maximum item count reached.");let n={visible:!0,active:!0,geometryIndex:e},i=null;this._availableInstanceIds.length>0?(this._availableInstanceIds.sort(Zu),i=this._availableInstanceIds.shift(),this._instanceInfo[i]=n):(i=this._instanceInfo.length,this._instanceInfo.push(n));let r=this._matricesTexture;ai.identity().toArray(r.image.data,i*16),r.needsUpdate=!0;let o=this._colorsTexture;return o&&(pb.toArray(o.image.data,i*4),o.needsUpdate=!0),this._visibilityChanged=!0,i}addGeometry(e,t=-1,n=-1){this._initializeGeometry(e),this._validateGeometry(e);let i={vertexStart:-1,vertexCount:-1,reservedVertexCount:-1,indexStart:-1,indexCount:-1,reservedIndexCount:-1,start:-1,count:-1,boundingBox:null,boundingSphere:null,active:!0},r=this._geometryInfo;i.vertexStart=this._nextVertexStart,i.reservedVertexCount=t===-1?e.getAttribute("position").count:t;let o=e.getIndex();if(o!==null&&(i.indexStart=this._nextIndexStart,i.reservedIndexCount=n===-1?o.count:n),i.indexStart!==-1&&i.indexStart+i.reservedIndexCount>this._maxIndexCount||i.vertexStart+i.reservedVertexCount>this._maxVertexCount)throw new Error("BatchedMesh: Reserved space request exceeds the maximum buffer size.");let l;return this._availableGeometryIds.length>0?(this._availableGeometryIds.sort(Zu),l=this._availableGeometryIds.shift(),r[l]=i):(l=this._geometryCount,this._geometryCount++,r.push(i)),this.setGeometryAt(l,e),this._nextIndexStart=i.indexStart+i.reservedIndexCount,this._nextVertexStart=i.vertexStart+i.reservedVertexCount,l}setGeometryAt(e,t){if(e>=this._geometryCount)throw new Error("BatchedMesh: Maximum geometry count reached.");this._validateGeometry(t);let n=this.geometry,i=n.getIndex()!==null,r=n.getIndex(),o=t.getIndex(),a=this._geometryInfo[e];if(i&&o.count>a.reservedIndexCount||t.attributes.position.count>a.reservedVertexCount)throw new Error("BatchedMesh: Reserved space not large enough for provided geometry.");let l=a.vertexStart,c=a.reservedVertexCount;a.vertexCount=t.getAttribute("position").count;for(let h in n.attributes){let u=t.getAttribute(h),f=n.getAttribute(h);gb(u,f,l);let d=u.itemSize;for(let p=u.count,x=c;p<x;p++){let g=l+p;for(let m=0;m<d;m++)f.setComponent(g,m,0)}f.needsUpdate=!0,f.addUpdateRange(l*d,c*d)}if(i){let h=a.indexStart,u=a.reservedIndexCount;a.indexCount=t.getIndex().count;for(let f=0;f<o.count;f++)r.setX(h+f,l+o.getX(f));for(let f=o.count,d=u;f<d;f++)r.setX(h+f,l);r.needsUpdate=!0,r.addUpdateRange(h,a.reservedIndexCount)}return a.start=i?a.indexStart:a.vertexStart,a.count=i?a.indexCount:a.vertexCount,a.boundingBox=null,t.boundingBox!==null&&(a.boundingBox=t.boundingBox.clone()),a.boundingSphere=null,t.boundingSphere!==null&&(a.boundingSphere=t.boundingSphere.clone()),this._visibilityChanged=!0,e}deleteGeometry(e){let t=this._geometryInfo;if(e>=t.length||t[e].active===!1)return this;let n=this._instanceInfo;for(let i=0,r=n.length;i<r;i++)n[i].geometryIndex===e&&this.deleteInstance(i);return t[e].active=!1,this._availableGeometryIds.push(e),this._visibilityChanged=!0,this}deleteInstance(e){let t=this._instanceInfo;return e>=t.length||t[e].active===!1?this:(t[e].active=!1,this._availableInstanceIds.push(e),this._visibilityChanged=!0,this)}optimize(){let e=0,t=0,n=this._geometryInfo,i=n.map((o,a)=>a).sort((o,a)=>n[o].vertexStart-n[a].vertexStart),r=this.geometry;for(let o=0,a=n.length;o<a;o++){let l=i[o],c=n[l];if(c.active!==!1){if(r.index!==null){if(c.indexStart!==t){let{indexStart:h,vertexStart:u,reservedIndexCount:f}=c,d=r.index,p=d.array,x=e-u;for(let g=h;g<h+f;g++)p[g]=p[g]+x;d.array.copyWithin(t,h,h+f),d.addUpdateRange(t,f),c.indexStart=t}t+=c.reservedIndexCount}if(c.vertexStart!==e){let{vertexStart:h,reservedVertexCount:u}=c,f=r.attributes;for(let d in f){let p=f[d],{array:x,itemSize:g}=p;x.copyWithin(e*g,h*g,(h+u)*g),p.addUpdateRange(e*g,u*g)}c.vertexStart=e}e+=c.reservedVertexCount,c.start=r.index?c.indexStart:c.vertexStart,this._nextIndexStart=r.index?c.indexStart+c.reservedIndexCount:0,this._nextVertexStart=c.vertexStart+c.reservedVertexCount}}return this}getBoundingBoxAt(e,t){if(e>=this._geometryCount)return null;let n=this.geometry,i=this._geometryInfo[e];if(i.boundingBox===null){let r=new wn,o=n.index,a=n.attributes.position;for(let l=i.start,c=i.start+i.count;l<c;l++){let h=l;o&&(h=o.getX(h)),r.expandByPoint(aa.fromBufferAttribute(a,h))}i.boundingBox=r}return t.copy(i.boundingBox),t}getBoundingSphereAt(e,t){if(e>=this._geometryCount)return null;let n=this.geometry,i=this._geometryInfo[e];if(i.boundingSphere===null){let r=new Rn;this.getBoundingBoxAt(e,Zl),Zl.getCenter(r.center);let o=n.index,a=n.attributes.position,l=0;for(let c=i.start,h=i.start+i.count;c<h;c++){let u=c;o&&(u=o.getX(u)),aa.fromBufferAttribute(a,u),l=Math.max(l,r.center.distanceToSquared(aa))}r.radius=Math.sqrt(l),i.boundingSphere=r}return t.copy(i.boundingSphere),t}setMatrixAt(e,t){let n=this._instanceInfo,i=this._matricesTexture,r=this._matricesTexture.image.data;return e>=n.length||n[e].active===!1?this:(t.toArray(r,e*16),i.needsUpdate=!0,this)}getMatrixAt(e,t){let n=this._instanceInfo,i=this._matricesTexture.image.data;return e>=n.length||n[e].active===!1?null:t.fromArray(i,e*16)}setColorAt(e,t){this._colorsTexture===null&&this._initColorsTexture();let n=this._colorsTexture,i=this._colorsTexture.image.data,r=this._instanceInfo;return e>=r.length||r[e].active===!1?this:(t.toArray(i,e*4),n.needsUpdate=!0,this)}getColorAt(e,t){let n=this._colorsTexture.image.data,i=this._instanceInfo;return e>=i.length||i[e].active===!1?null:t.fromArray(n,e*4)}setVisibleAt(e,t){let n=this._instanceInfo;return e>=n.length||n[e].active===!1||n[e].visible===t?this:(n[e].visible=t,this._visibilityChanged=!0,this)}getVisibleAt(e){let t=this._instanceInfo;return e>=t.length||t[e].active===!1?!1:t[e].visible}setGeometryIdAt(e,t){let n=this._instanceInfo,i=this._geometryInfo;return e>=n.length||n[e].active===!1||t>=i.length||i[t].active===!1?null:(n[e].geometryIndex=t,this)}getGeometryIdAt(e){let t=this._instanceInfo;return e>=t.length||t[e].active===!1?-1:t[e].geometryIndex}getGeometryRangeAt(e,t={}){if(e<0||e>=this._geometryCount)return null;let n=this._geometryInfo[e];return t.vertexStart=n.vertexStart,t.vertexCount=n.vertexCount,t.reservedVertexCount=n.reservedVertexCount,t.indexStart=n.indexStart,t.indexCount=n.indexCount,t.reservedIndexCount=n.reservedIndexCount,t.start=n.start,t.count=n.count,t}setInstanceCount(e){let t=this._availableInstanceIds,n=this._instanceInfo;for(t.sort(Zu);t[t.length-1]===n.length;)n.pop(),t.pop();if(e<n.length)throw new Error(`BatchedMesh: Instance ids outside the range ${e} are being used. Cannot shrink instance count.`);let i=new Int32Array(e),r=new Int32Array(e);fr(this._multiDrawCounts,i),fr(this._multiDrawStarts,r),this._multiDrawCounts=i,this._multiDrawStarts=r,this._maxInstanceCount=e;let o=this._indirectTexture,a=this._matricesTexture,l=this._colorsTexture;o.dispose(),this._initIndirectTexture(),fr(o.image.data,this._indirectTexture.image.data),a.dispose(),this._initMatricesTexture(),fr(a.image.data,this._matricesTexture.image.data),l&&(l.dispose(),this._initColorsTexture(),fr(l.image.data,this._colorsTexture.image.data))}setGeometrySize(e,t){let n=[...this._geometryInfo].filter(a=>a.active);if(Math.max(...n.map(a=>a.vertexStart+a.reservedVertexCount))>e)throw new Error(`BatchedMesh: Geometry vertex values are being used outside the range ${t}. Cannot shrink further.`);if(this.geometry.index&&Math.max(...n.map(l=>l.indexStart+l.reservedIndexCount))>t)throw new Error(`BatchedMesh: Geometry index values are being used outside the range ${t}. Cannot shrink further.`);let r=this.geometry;r.dispose(),this._maxVertexCount=e,this._maxIndexCount=t,this._geometryInitialized&&(this._geometryInitialized=!1,this.geometry=new tt,this._initializeGeometry(r));let o=this.geometry;r.index&&fr(r.index.array,o.index.array);for(let a in r.attributes)fr(r.attributes[a].array,o.attributes[a].array)}raycast(e,t){let n=this._instanceInfo,i=this._geometryInfo,r=this.matrixWorld,o=this.geometry;Yn.material=this.material,Yn.geometry.index=o.index,Yn.geometry.attributes=o.attributes,Yn.geometry.boundingBox===null&&(Yn.geometry.boundingBox=new wn),Yn.geometry.boundingSphere===null&&(Yn.geometry.boundingSphere=new Rn);for(let a=0,l=n.length;a<l;a++){if(!n[a].visible||!n[a].active)continue;let c=n[a].geometryIndex,h=i[c];Yn.geometry.setDrawRange(h.start,h.count),this.getMatrixAt(a,Yn.matrixWorld).premultiply(r),this.getBoundingBoxAt(c,Yn.geometry.boundingBox),this.getBoundingSphereAt(c,Yn.geometry.boundingSphere),Yn.raycast(e,$l);for(let u=0,f=$l.length;u<f;u++){let d=$l[u];d.object=this,d.batchId=a,t.push(d)}$l.length=0}Yn.material=null,Yn.geometry.index=null,Yn.geometry.attributes={},Yn.geometry.setDrawRange(0,1/0)}copy(e){return super.copy(e),this.geometry=e.geometry.clone(),this.perObjectFrustumCulled=e.perObjectFrustumCulled,this.sortObjects=e.sortObjects,this.boundingBox=e.boundingBox!==null?e.boundingBox.clone():null,this.boundingSphere=e.boundingSphere!==null?e.boundingSphere.clone():null,this._geometryInfo=e._geometryInfo.map(t=>({...t,boundingBox:t.boundingBox!==null?t.boundingBox.clone():null,boundingSphere:t.boundingSphere!==null?t.boundingSphere.clone():null})),this._instanceInfo=e._instanceInfo.map(t=>({...t})),this._maxInstanceCount=e._maxInstanceCount,this._maxVertexCount=e._maxVertexCount,this._maxIndexCount=e._maxIndexCount,this._geometryInitialized=e._geometryInitialized,this._geometryCount=e._geometryCount,this._multiDrawCounts=e._multiDrawCounts.slice(),this._multiDrawStarts=e._multiDrawStarts.slice(),this._matricesTexture=e._matricesTexture.clone(),this._matricesTexture.image.data=this._matricesTexture.image.data.slice(),this._colorsTexture!==null&&(this._colorsTexture=e._colorsTexture.clone(),this._colorsTexture.image.data=this._colorsTexture.image.data.slice()),this}dispose(){return this.geometry.dispose(),this._matricesTexture.dispose(),this._matricesTexture=null,this._indirectTexture.dispose(),this._indirectTexture=null,this._colorsTexture!==null&&(this._colorsTexture.dispose(),this._colorsTexture=null),this}onBeforeRender(e,t,n,i,r){if(!this._visibilityChanged&&!this.perObjectFrustumCulled&&!this.sortObjects)return;let o=i.getIndex(),a=o===null?1:o.array.BYTES_PER_ELEMENT,l=this._instanceInfo,c=this._multiDrawStarts,h=this._multiDrawCounts,u=this._geometryInfo,f=this.perObjectFrustumCulled,d=this._indirectTexture,p=d.image.data;f&&(ai.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse).multiply(this.matrixWorld),$u.setFromProjectionMatrix(ai,e.coordinateSystem));let x=0;if(this.sortObjects){ai.copy(this.matrixWorld).invert(),aa.setFromMatrixPosition(n.matrixWorld).applyMatrix4(ai),$m.set(0,0,-1).transformDirection(n.matrixWorld).transformDirection(ai);for(let y=0,_=l.length;y<_;y++)if(l[y].visible&&l[y].active){let v=l[y].geometryIndex;this.getMatrixAt(y,ai),this.getBoundingSphereAt(v,ur).applyMatrix4(ai);let F=!1;if(f&&(F=!$u.intersectsSphere(ur)),!F){let T=u[v],U=mb.subVectors(ur.center,aa).dot($m);Ku.push(T.start,T.count,U,y)}}let g=Ku.list,m=this.customSort;m===null?g.sort(r.transparent?db:fb):m.call(this,g,n);for(let y=0,_=g.length;y<_;y++){let v=g[y];c[x]=v.start*a,h[x]=v.count,p[x]=v.index,x++}Ku.reset()}else for(let g=0,m=l.length;g<m;g++)if(l[g].visible&&l[g].active){let y=l[g].geometryIndex,_=!1;if(f&&(this.getMatrixAt(g,ai),this.getBoundingSphereAt(y,ur).applyMatrix4(ai),_=!$u.intersectsSphere(ur)),!_){let v=u[y];c[x]=v.start*a,h[x]=v.count,p[x]=g,x++}}d.needsUpdate=!0,this._multiDrawCount=x,this._visibilityChanged=!1}onBeforeShadow(e,t,n,i,r,o){this.onBeforeRender(e,null,i,r,o)}},Dn=class extends xn{static get type(){return"LineBasicMaterial"}constructor(e){super(),this.isLineBasicMaterial=!0,this.color=new Be(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},sh=new L,rh=new L,Km=new ct,la=new Xs,Kl=new Rn,Ju=new L,Jm=new L,Ii=class extends Kt{constructor(e=new tt,t=new Dn){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)sh.fromBufferAttribute(t,i-1),rh.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=sh.distanceTo(rh);e.setAttribute("lineDistance",new Me(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Kl.copy(n.boundingSphere),Kl.applyMatrix4(i),Kl.radius+=r,e.ray.intersectsSphere(Kl)===!1)return;Km.copy(i).invert(),la.copy(e.ray).applyMatrix4(Km);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=n.index,f=n.attributes.position;if(h!==null){let d=Math.max(0,o.start),p=Math.min(h.count,o.start+o.count);for(let x=d,g=p-1;x<g;x+=c){let m=h.getX(x),y=h.getX(x+1),_=Jl(this,e,la,l,m,y);_&&t.push(_)}if(this.isLineLoop){let x=h.getX(p-1),g=h.getX(d),m=Jl(this,e,la,l,x,g);m&&t.push(m)}}else{let d=Math.max(0,o.start),p=Math.min(f.count,o.start+o.count);for(let x=d,g=p-1;x<g;x+=c){let m=Jl(this,e,la,l,x,x+1);m&&t.push(m)}if(this.isLineLoop){let x=Jl(this,e,la,l,p-1,d);x&&t.push(x)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function Jl(s,e,t,n,i,r){let o=s.geometry.attributes.position;if(sh.fromBufferAttribute(o,i),rh.fromBufferAttribute(o,r),t.distanceSqToSegment(sh,rh,Ju,Jm)>n)return;Ju.applyMatrix4(s.matrixWorld);let l=e.ray.origin.distanceTo(Ju);if(!(l<e.near||l>e.far))return{distance:l,point:Jm.clone().applyMatrix4(s.matrixWorld),index:i,face:null,faceIndex:null,barycoord:null,object:s}}var jm=new L,Qm=new L,ui=class extends Ii{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,r=t.count;i<r;i+=2)jm.fromBufferAttribute(t,i),Qm.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+jm.distanceTo(Qm);e.setAttribute("lineDistance",new Me(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},Co=class extends Ii{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},kr=class extends xn{static get type(){return"PointsMaterial"}constructor(e){super(),this.isPointsMaterial=!0,this.color=new Be(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},e0=new ct,If=new Xs,jl=new Rn,Ql=new L,Hn=class extends Kt{constructor(e=new tt,t=new kr){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),jl.copy(n.boundingSphere),jl.applyMatrix4(i),jl.radius+=r,e.ray.intersectsSphere(jl)===!1)return;e0.copy(i).invert(),If.copy(e.ray).applyMatrix4(e0);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=n.index,u=n.attributes.position;if(c!==null){let f=Math.max(0,o.start),d=Math.min(c.count,o.start+o.count);for(let p=f,x=d;p<x;p++){let g=c.getX(p);Ql.fromBufferAttribute(u,g),t0(Ql,g,l,i,e,t,this)}}else{let f=Math.max(0,o.start),d=Math.min(u.count,o.start+o.count);for(let p=f,x=d;p<x;p++)Ql.fromBufferAttribute(u,p),t0(Ql,p,l,i,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function t0(s,e,t,n,i,r,o){let a=If.distanceSqToPoint(s);if(a<t){let l=new L;If.closestPointToPoint(s,l),l.applyMatrix4(n);let c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}var Lf=class extends dn{constructor(e,t,n,i,r,o,a,l,c){super(e,t,n,i,r,o,a,l,c),this.isVideoTexture=!0,this.minFilter=o!==void 0?o:cn,this.magFilter=r!==void 0?r:cn,this.generateMipmaps=!1;let h=this;function u(){h.needsUpdate=!0,e.requestVideoFrameCallback(u)}"requestVideoFrameCallback"in e&&e.requestVideoFrameCallback(u)}clone(){return new this.constructor(this.image).copy(this)}update(){let e=this.image;"requestVideoFrameCallback"in e===!1&&e.readyState>=e.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}},Ba=class extends dn{constructor(e,t){super({width:e,height:t}),this.isFramebufferTexture=!0,this.magFilter=Tn,this.minFilter=Tn,this.generateMipmaps=!1,this.needsUpdate=!0}},Po=class extends dn{constructor(e,t,n,i,r,o,a,l,c,h,u,f){super(null,o,a,l,c,h,i,r,u,f),this.isCompressedTexture=!0,this.image={width:t,height:n},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}},Df=class extends Po{constructor(e,t,n,i,r,o){super(e,t,n,r,o),this.isCompressedArrayTexture=!0,this.image.depth=i,this.wrapR=ci,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},Uf=class extends Po{constructor(e,t,n){super(void 0,e[0].width,e[0].height,t,n,Ss),this.isCompressedCubeTexture=!0,this.isCubeTexture=!0,this.image=e}},Nf=class extends dn{constructor(e,t,n,i,r,o,a,l,c){super(e,t,n,i,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},Si=class{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),r=0;t.push(0);for(let o=1;o<=e;o++)n=this.getPoint(o/e),r+=n.distanceTo(i),t.push(r),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t){let n=this.getLengths(),i=0,r=n.length,o;t?o=t:o=e*n[r-1];let a=0,l=r-1,c;for(;a<=l;)if(i=Math.floor(a+(l-a)/2),c=n[i]-o,c<0)a=i+1;else if(c>0)l=i-1;else{l=i;break}if(i=l,n[i]===o)return i/(r-1);let h=n[i],f=n[i+1]-h,d=(o-h)/f;return(i+d)/(r-1)}getTangent(e,t){let i=e-1e-4,r=e+1e-4;i<0&&(i=0),r>1&&(r=1);let o=this.getPoint(i),a=this.getPoint(r),l=t||(o.isVector2?new _e:new L);return l.copy(a).sub(o).normalize(),l}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t){let n=new L,i=[],r=[],o=[],a=new L,l=new ct;for(let d=0;d<=e;d++){let p=d/e;i[d]=this.getTangentAt(p,new L)}r[0]=new L,o[0]=new L;let c=Number.MAX_VALUE,h=Math.abs(i[0].x),u=Math.abs(i[0].y),f=Math.abs(i[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),f<=c&&n.set(0,0,1),a.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],a),o[0].crossVectors(i[0],r[0]);for(let d=1;d<=e;d++){if(r[d]=r[d-1].clone(),o[d]=o[d-1].clone(),a.crossVectors(i[d-1],i[d]),a.length()>Number.EPSILON){a.normalize();let p=Math.acos(gn(i[d-1].dot(i[d]),-1,1));r[d].applyMatrix4(l.makeRotationAxis(a,p))}o[d].crossVectors(i[d],r[d])}if(t===!0){let d=Math.acos(gn(r[0].dot(r[e]),-1,1));d/=e,i[0].dot(a.crossVectors(r[0],r[e]))>0&&(d=-d);for(let p=1;p<=e;p++)r[p].applyMatrix4(l.makeRotationAxis(i[p],d*p)),o[p].crossVectors(i[p],r[p])}return{tangents:i,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},Io=class extends Si{constructor(e=0,t=0,n=1,i=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(e,t=new _e){let n=t,i=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(o?r=0:r=i),this.aClockwise===!0&&!o&&(r===i?r=-i:r=r-i);let a=this.aStartAngle+e*r,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),f=l-this.aX,d=c-this.aY;l=f*h-d*u+this.aX,c=f*u+d*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},oh=class extends Io{constructor(e,t,n,i,r,o){super(e,t,n,n,i,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function Gd(){let s=0,e=0,t=0,n=0;function i(r,o,a,l){s=r,e=a,t=-3*r+3*o-2*a-l,n=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){i(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,u){let f=(o-r)/c-(a-r)/(c+h)+(a-o)/h,d=(a-o)/h-(l-o)/(h+u)+(l-a)/u;f*=h,d*=h,i(o,a,f,d)},calc:function(r){let o=r*r,a=o*r;return s+e*r+t*o+n*a}}}var ec=new L,ju=new Gd,Qu=new Gd,ef=new Gd,ah=class extends Si{constructor(e=[],t=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new L){let n=t,i=this.points,r=i.length,o=(r-(this.closed?0:1))*e,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=i[(a-1)%r]:(ec.subVectors(i[0],i[1]).add(i[0]),c=ec);let u=i[a%r],f=i[(a+1)%r];if(this.closed||a+2<r?h=i[(a+2)%r]:(ec.subVectors(i[r-1],i[r-2]).add(i[r-1]),h=ec),this.curveType==="centripetal"||this.curveType==="chordal"){let d=this.curveType==="chordal"?.5:.25,p=Math.pow(c.distanceToSquared(u),d),x=Math.pow(u.distanceToSquared(f),d),g=Math.pow(f.distanceToSquared(h),d);x<1e-4&&(x=1),p<1e-4&&(p=x),g<1e-4&&(g=x),ju.initNonuniformCatmullRom(c.x,u.x,f.x,h.x,p,x,g),Qu.initNonuniformCatmullRom(c.y,u.y,f.y,h.y,p,x,g),ef.initNonuniformCatmullRom(c.z,u.z,f.z,h.z,p,x,g)}else this.curveType==="catmullrom"&&(ju.initCatmullRom(c.x,u.x,f.x,h.x,this.tension),Qu.initCatmullRom(c.y,u.y,f.y,h.y,this.tension),ef.initCatmullRom(c.z,u.z,f.z,h.z,this.tension));return n.set(ju.calc(l),Qu.calc(l),ef.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new L().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function n0(s,e,t,n,i){let r=(n-e)*.5,o=(i-t)*.5,a=s*s,l=s*a;return(2*t-2*n+r+o)*l+(-3*t+3*n-2*r-o)*a+r*s+t}function xb(s,e){let t=1-s;return t*t*e}function vb(s,e){return 2*(1-s)*s*e}function _b(s,e){return s*s*e}function ya(s,e,t,n){return xb(s,e)+vb(s,t)+_b(s,n)}function yb(s,e){let t=1-s;return t*t*t*e}function Mb(s,e){let t=1-s;return 3*t*t*s*e}function bb(s,e){return 3*(1-s)*s*s*e}function Sb(s,e){return s*s*s*e}function Ma(s,e,t,n,i){return yb(s,e)+Mb(s,t)+bb(s,n)+Sb(s,i)}var za=class extends Si{constructor(e=new _e,t=new _e,n=new _e,i=new _e){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new _e){let n=t,i=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Ma(e,i.x,r.x,o.x,a.x),Ma(e,i.y,r.y,o.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},lh=class extends Si{constructor(e=new L,t=new L,n=new L,i=new L){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new L){let n=t,i=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Ma(e,i.x,r.x,o.x,a.x),Ma(e,i.y,r.y,o.y,a.y),Ma(e,i.z,r.z,o.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},ka=class extends Si{constructor(e=new _e,t=new _e){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new _e){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new _e){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},ch=class extends Si{constructor(e=new L,t=new L){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new L){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new L){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Ha=class extends Si{constructor(e=new _e,t=new _e,n=new _e){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new _e){let n=t,i=this.v0,r=this.v1,o=this.v2;return n.set(ya(e,i.x,r.x,o.x),ya(e,i.y,r.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Va=class extends Si{constructor(e=new L,t=new L,n=new L){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new L){let n=t,i=this.v0,r=this.v1,o=this.v2;return n.set(ya(e,i.x,r.x,o.x),ya(e,i.y,r.y,o.y),ya(e,i.z,r.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Ga=class extends Si{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new _e){let n=t,i=this.points,r=(i.length-1)*e,o=Math.floor(r),a=r-o,l=i[o===0?o:o-1],c=i[o],h=i[o>i.length-2?i.length-1:o+1],u=i[o>i.length-3?i.length-1:o+2];return n.set(n0(a,l.x,c.x,h.x,u.x),n0(a,l.y,c.y,h.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new _e().fromArray(i))}return this}},hh=Object.freeze({__proto__:null,ArcCurve:oh,CatmullRomCurve3:ah,CubicBezierCurve:za,CubicBezierCurve3:lh,EllipseCurve:Io,LineCurve:ka,LineCurve3:ch,QuadraticBezierCurve:Ha,QuadraticBezierCurve3:Va,SplineCurve:Ga}),uh=class extends Si{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new hh[n](t,e))}return this}getPoint(e,t){let n=e*this.getLength(),i=this.getCurveLengths(),r=0;for(;r<i.length;){if(i[r]>=n){let o=i[r]-n,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,t)}r++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,i=this.curves.length;n<i;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let i=0,r=this.curves;i<r.length;i++){let o=r[i],a=o.isEllipseCurve?e*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?e*o.points.length:e,l=o.getPoints(a);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let i=e.curves[t];this.curves.push(i.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let i=this.curves[t];e.curves.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let i=e.curves[t];this.curves.push(new hh[i.type]().fromJSON(i))}return this}},Hr=class extends uh{constructor(e){super(),this.type="Path",this.currentPoint=new _e,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new ka(this.currentPoint.clone(),new _e(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,i){let r=new Ha(this.currentPoint.clone(),new _e(e,t),new _e(n,i));return this.curves.push(r),this.currentPoint.set(n,i),this}bezierCurveTo(e,t,n,i,r,o){let a=new za(this.currentPoint.clone(),new _e(e,t),new _e(n,i),new _e(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),n=new Ga(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,i,r,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+a,t+l,n,i,r,o),this}absarc(e,t,n,i,r,o){return this.absellipse(e,t,n,n,i,r,o),this}ellipse(e,t,n,i,r,o,a,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+c,t+h,n,i,r,o,a,l),this}absellipse(e,t,n,i,r,o,a,l){let c=new Io(e,t,n,i,r,o,a,l);if(this.curves.length>0){let u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},Wa=class s extends tt{constructor(e=[new _e(0,-.5),new _e(.5,0),new _e(0,.5)],t=12,n=0,i=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:i},t=Math.floor(t),i=gn(i,0,Math.PI*2);let r=[],o=[],a=[],l=[],c=[],h=1/t,u=new L,f=new _e,d=new L,p=new L,x=new L,g=0,m=0;for(let y=0;y<=e.length-1;y++)switch(y){case 0:g=e[y+1].x-e[y].x,m=e[y+1].y-e[y].y,d.x=m*1,d.y=-g,d.z=m*0,x.copy(d),d.normalize(),l.push(d.x,d.y,d.z);break;case e.length-1:l.push(x.x,x.y,x.z);break;default:g=e[y+1].x-e[y].x,m=e[y+1].y-e[y].y,d.x=m*1,d.y=-g,d.z=m*0,p.copy(d),d.x+=x.x,d.y+=x.y,d.z+=x.z,d.normalize(),l.push(d.x,d.y,d.z),x.copy(p)}for(let y=0;y<=t;y++){let _=n+y*h*i,v=Math.sin(_),F=Math.cos(_);for(let T=0;T<=e.length-1;T++){u.x=e[T].x*v,u.y=e[T].y,u.z=e[T].x*F,o.push(u.x,u.y,u.z),f.x=y/t,f.y=T/(e.length-1),a.push(f.x,f.y);let U=l[3*T+0]*v,C=l[3*T+1],S=l[3*T+0]*F;c.push(U,C,S)}}for(let y=0;y<t;y++)for(let _=0;_<e.length-1;_++){let v=_+y*e.length,F=v,T=v+e.length,U=v+e.length+1,C=v+1;r.push(F,T,C),r.push(U,C,T)}this.setIndex(r),this.setAttribute("position",new Me(o,3)),this.setAttribute("uv",new Me(a,2)),this.setAttribute("normal",new Me(c,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.points,e.segments,e.phiStart,e.phiLength)}},fh=class s extends Wa{constructor(e=1,t=1,n=4,i=8){let r=new Hr;r.absarc(0,-t/2,e,Math.PI*1.5,0),r.absarc(0,t/2,e,0,Math.PI*.5),super(r.getPoints(n),i),this.type="CapsuleGeometry",this.parameters={radius:e,length:t,capSegments:n,radialSegments:i}}static fromJSON(e){return new s(e.radius,e.length,e.capSegments,e.radialSegments)}},Lo=class s extends tt{constructor(e=1,t=32,n=0,i=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:i},t=Math.max(3,t);let r=[],o=[],a=[],l=[],c=new L,h=new _e;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let u=0,f=3;u<=t;u++,f+=3){let d=n+u/t*i;c.x=e*Math.cos(d),c.y=e*Math.sin(d),o.push(c.x,c.y,c.z),a.push(0,0,1),h.x=(o[f]/e+1)/2,h.y=(o[f+1]/e+1)/2,l.push(h.x,h.y)}for(let u=1;u<=t;u++)r.push(u,u+1,0);this.setIndex(r),this.setAttribute("position",new Me(o,3)),this.setAttribute("normal",new Me(a,3)),this.setAttribute("uv",new Me(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.segments,e.thetaStart,e.thetaLength)}},ni=class s extends tt{constructor(e=1,t=1,n=1,i=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;i=Math.floor(i),r=Math.floor(r);let h=[],u=[],f=[],d=[],p=0,x=[],g=n/2,m=0;y(),o===!1&&(e>0&&_(!0),t>0&&_(!1)),this.setIndex(h),this.setAttribute("position",new Me(u,3)),this.setAttribute("normal",new Me(f,3)),this.setAttribute("uv",new Me(d,2));function y(){let v=new L,F=new L,T=0,U=(t-e)/n;for(let C=0;C<=r;C++){let S=[],M=C/r,N=M*(t-e)+e;for(let J=0;J<=i;J++){let $=J/i,ee=$*l+a,pe=Math.sin(ee),ie=Math.cos(ee);F.x=N*pe,F.y=-M*n+g,F.z=N*ie,u.push(F.x,F.y,F.z),v.set(pe,U,ie).normalize(),f.push(v.x,v.y,v.z),d.push($,1-M),S.push(p++)}x.push(S)}for(let C=0;C<i;C++)for(let S=0;S<r;S++){let M=x[S][C],N=x[S+1][C],J=x[S+1][C+1],$=x[S][C+1];(e>0||S!==0)&&(h.push(M,N,$),T+=3),(t>0||S!==r-1)&&(h.push(N,J,$),T+=3)}c.addGroup(m,T,0),m+=T}function _(v){let F=p,T=new _e,U=new L,C=0,S=v===!0?e:t,M=v===!0?1:-1;for(let J=1;J<=i;J++)u.push(0,g*M,0),f.push(0,M,0),d.push(.5,.5),p++;let N=p;for(let J=0;J<=i;J++){let ee=J/i*l+a,pe=Math.cos(ee),ie=Math.sin(ee);U.x=S*ie,U.y=g*M,U.z=S*pe,u.push(U.x,U.y,U.z),f.push(0,M,0),T.x=pe*.5+.5,T.y=ie*.5*M+.5,d.push(T.x,T.y),p++}for(let J=0;J<i;J++){let $=F+J,ee=N+J;v===!0?h.push(ee,ee+1,$):h.push(ee+1,ee,$),C+=3}c.addGroup(m,C,v===!0?1:2),m+=C}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Do=class s extends ni{constructor(e=1,t=1,n=32,i=1,r=!1,o=0,a=Math.PI*2){super(0,e,t,n,i,r,o,a),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:i,openEnded:r,thetaStart:o,thetaLength:a}}static fromJSON(e){return new s(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Zs=class s extends tt{constructor(e=[],t=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:i};let r=[],o=[];a(i),c(n),h(),this.setAttribute("position",new Me(r,3)),this.setAttribute("normal",new Me(r.slice(),3)),this.setAttribute("uv",new Me(o,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function a(y){let _=new L,v=new L,F=new L;for(let T=0;T<t.length;T+=3)d(t[T+0],_),d(t[T+1],v),d(t[T+2],F),l(_,v,F,y)}function l(y,_,v,F){let T=F+1,U=[];for(let C=0;C<=T;C++){U[C]=[];let S=y.clone().lerp(v,C/T),M=_.clone().lerp(v,C/T),N=T-C;for(let J=0;J<=N;J++)J===0&&C===T?U[C][J]=S:U[C][J]=S.clone().lerp(M,J/N)}for(let C=0;C<T;C++)for(let S=0;S<2*(T-C)-1;S++){let M=Math.floor(S/2);S%2===0?(f(U[C][M+1]),f(U[C+1][M]),f(U[C][M])):(f(U[C][M+1]),f(U[C+1][M+1]),f(U[C+1][M]))}}function c(y){let _=new L;for(let v=0;v<r.length;v+=3)_.x=r[v+0],_.y=r[v+1],_.z=r[v+2],_.normalize().multiplyScalar(y),r[v+0]=_.x,r[v+1]=_.y,r[v+2]=_.z}function h(){let y=new L;for(let _=0;_<r.length;_+=3){y.x=r[_+0],y.y=r[_+1],y.z=r[_+2];let v=g(y)/2/Math.PI+.5,F=m(y)/Math.PI+.5;o.push(v,1-F)}p(),u()}function u(){for(let y=0;y<o.length;y+=6){let _=o[y+0],v=o[y+2],F=o[y+4],T=Math.max(_,v,F),U=Math.min(_,v,F);T>.9&&U<.1&&(_<.2&&(o[y+0]+=1),v<.2&&(o[y+2]+=1),F<.2&&(o[y+4]+=1))}}function f(y){r.push(y.x,y.y,y.z)}function d(y,_){let v=y*3;_.x=e[v+0],_.y=e[v+1],_.z=e[v+2]}function p(){let y=new L,_=new L,v=new L,F=new L,T=new _e,U=new _e,C=new _e;for(let S=0,M=0;S<r.length;S+=9,M+=6){y.set(r[S+0],r[S+1],r[S+2]),_.set(r[S+3],r[S+4],r[S+5]),v.set(r[S+6],r[S+7],r[S+8]),T.set(o[M+0],o[M+1]),U.set(o[M+2],o[M+3]),C.set(o[M+4],o[M+5]),F.copy(y).add(_).add(v).divideScalar(3);let N=g(F);x(T,M+0,y,N),x(U,M+2,_,N),x(C,M+4,v,N)}}function x(y,_,v,F){F<0&&y.x===1&&(o[_]=y.x-1),v.x===0&&v.z===0&&(o[_]=F/2/Math.PI+.5)}function g(y){return Math.atan2(y.z,-y.x)}function m(y){return Math.atan2(-y.y,Math.sqrt(y.x*y.x+y.z*y.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.vertices,e.indices,e.radius,e.details)}},dh=class s extends Zs{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,i=1/n,r=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-i,-n,0,-i,n,0,i,-n,0,i,n,-i,-n,0,-i,n,0,i,-n,0,i,n,0,-n,0,-i,n,0,-i,-n,0,i,n,0,i],o=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(r,o,e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new s(e.radius,e.detail)}},tc=new L,nc=new L,tf=new L,ic=new Ki,ph=class extends tt{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){let i=Math.pow(10,4),r=Math.cos(Tr*t),o=e.getIndex(),a=e.getAttribute("position"),l=o?o.count:a.count,c=[0,0,0],h=["a","b","c"],u=new Array(3),f={},d=[];for(let p=0;p<l;p+=3){o?(c[0]=o.getX(p),c[1]=o.getX(p+1),c[2]=o.getX(p+2)):(c[0]=p,c[1]=p+1,c[2]=p+2);let{a:x,b:g,c:m}=ic;if(x.fromBufferAttribute(a,c[0]),g.fromBufferAttribute(a,c[1]),m.fromBufferAttribute(a,c[2]),ic.getNormal(tf),u[0]=`${Math.round(x.x*i)},${Math.round(x.y*i)},${Math.round(x.z*i)}`,u[1]=`${Math.round(g.x*i)},${Math.round(g.y*i)},${Math.round(g.z*i)}`,u[2]=`${Math.round(m.x*i)},${Math.round(m.y*i)},${Math.round(m.z*i)}`,!(u[0]===u[1]||u[1]===u[2]||u[2]===u[0]))for(let y=0;y<3;y++){let _=(y+1)%3,v=u[y],F=u[_],T=ic[h[y]],U=ic[h[_]],C=`${v}_${F}`,S=`${F}_${v}`;S in f&&f[S]?(tf.dot(f[S].normal)<=r&&(d.push(T.x,T.y,T.z),d.push(U.x,U.y,U.z)),f[S]=null):C in f||(f[C]={index0:c[y],index1:c[_],normal:tf.clone()})}}for(let p in f)if(f[p]){let{index0:x,index1:g}=f[p];tc.fromBufferAttribute(a,x),nc.fromBufferAttribute(a,g),d.push(tc.x,tc.y,tc.z),d.push(nc.x,nc.y,nc.z)}this.setAttribute("position",new Me(d,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}},bs=class extends Hr{constructor(e){super(e),this.uuid=Mi(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,i=this.holes.length;n<i;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let i=e.holes[t];this.holes.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let i=this.holes[t];e.holes.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let i=e.holes[t];this.holes.push(new Hr().fromJSON(i))}return this}},wb={triangulate:function(s,e,t=2){let n=e&&e.length,i=n?e[0]*t:s.length,r=Pg(s,0,i,t,!0),o=[];if(!r||r.next===r.prev)return o;let a,l,c,h,u,f,d;if(n&&(r=Cb(s,e,r,t)),s.length>80*t){a=c=s[0],l=h=s[1];for(let p=t;p<i;p+=t)u=s[p],f=s[p+1],u<a&&(a=u),f<l&&(l=f),u>c&&(c=u),f>h&&(h=f);d=Math.max(c-a,h-l),d=d!==0?32767/d:0}return Xa(r,o,t,a,l,d,0),o}};function Pg(s,e,t,n,i){let r,o;if(i===kb(s,e,t,n)>0)for(r=e;r<t;r+=n)o=i0(r,s[r],s[r+1],o);else for(r=t-n;r>=e;r-=n)o=i0(r,s[r],s[r+1],o);return o&&tu(o,o.next)&&(Ya(o),o=o.next),o}function Vr(s,e){if(!s)return s;e||(e=s);let t=s,n;do if(n=!1,!t.steiner&&(tu(t,t.next)||fn(t.prev,t,t.next)===0)){if(Ya(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function Xa(s,e,t,n,i,r,o){if(!s)return;!o&&r&&Ub(s,n,i,r);let a=s,l,c;for(;s.prev!==s.next;){if(l=s.prev,c=s.next,r?Ab(s,n,i,r):Eb(s)){e.push(l.i/t|0),e.push(s.i/t|0),e.push(c.i/t|0),Ya(s),s=c.next,a=c.next;continue}if(s=c,s===a){o?o===1?(s=Tb(Vr(s),e,t),Xa(s,e,t,n,i,r,2)):o===2&&Rb(s,e,t,n,i,r):Xa(Vr(s),e,t,n,i,r,1);break}}}function Eb(s){let e=s.prev,t=s,n=s.next;if(fn(e,t,n)>=0)return!1;let i=e.x,r=t.x,o=n.x,a=e.y,l=t.y,c=n.y,h=i<r?i<o?i:o:r<o?r:o,u=a<l?a<c?a:c:l<c?l:c,f=i>r?i>o?i:o:r>o?r:o,d=a>l?a>c?a:c:l>c?l:c,p=n.next;for(;p!==e;){if(p.x>=h&&p.x<=f&&p.y>=u&&p.y<=d&&yo(i,a,r,l,o,c,p.x,p.y)&&fn(p.prev,p,p.next)>=0)return!1;p=p.next}return!0}function Ab(s,e,t,n){let i=s.prev,r=s,o=s.next;if(fn(i,r,o)>=0)return!1;let a=i.x,l=r.x,c=o.x,h=i.y,u=r.y,f=o.y,d=a<l?a<c?a:c:l<c?l:c,p=h<u?h<f?h:f:u<f?u:f,x=a>l?a>c?a:c:l>c?l:c,g=h>u?h>f?h:f:u>f?u:f,m=Ff(d,p,e,t,n),y=Ff(x,g,e,t,n),_=s.prevZ,v=s.nextZ;for(;_&&_.z>=m&&v&&v.z<=y;){if(_.x>=d&&_.x<=x&&_.y>=p&&_.y<=g&&_!==i&&_!==o&&yo(a,h,l,u,c,f,_.x,_.y)&&fn(_.prev,_,_.next)>=0||(_=_.prevZ,v.x>=d&&v.x<=x&&v.y>=p&&v.y<=g&&v!==i&&v!==o&&yo(a,h,l,u,c,f,v.x,v.y)&&fn(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;_&&_.z>=m;){if(_.x>=d&&_.x<=x&&_.y>=p&&_.y<=g&&_!==i&&_!==o&&yo(a,h,l,u,c,f,_.x,_.y)&&fn(_.prev,_,_.next)>=0)return!1;_=_.prevZ}for(;v&&v.z<=y;){if(v.x>=d&&v.x<=x&&v.y>=p&&v.y<=g&&v!==i&&v!==o&&yo(a,h,l,u,c,f,v.x,v.y)&&fn(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Tb(s,e,t){let n=s;do{let i=n.prev,r=n.next.next;!tu(i,r)&&Ig(i,n,n.next,r)&&qa(i,r)&&qa(r,i)&&(e.push(i.i/t|0),e.push(n.i/t|0),e.push(r.i/t|0),Ya(n),Ya(n.next),n=s=r),n=n.next}while(n!==s);return Vr(n)}function Rb(s,e,t,n,i,r){let o=s;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&Ob(o,a)){let l=Lg(o,a);o=Vr(o,o.next),l=Vr(l,l.next),Xa(o,e,t,n,i,r,0),Xa(l,e,t,n,i,r,0);return}a=a.next}o=o.next}while(o!==s)}function Cb(s,e,t,n){let i=[],r,o,a,l,c;for(r=0,o=e.length;r<o;r++)a=e[r]*n,l=r<o-1?e[r+1]*n:s.length,c=Pg(s,a,l,n,!1),c===c.next&&(c.steiner=!0),i.push(Fb(c));for(i.sort(Pb),r=0;r<i.length;r++)t=Ib(i[r],t);return t}function Pb(s,e){return s.x-e.x}function Ib(s,e){let t=Lb(s,e);if(!t)return e;let n=Lg(t,s);return Vr(n,n.next),Vr(t,t.next)}function Lb(s,e){let t=e,n=-1/0,i,r=s.x,o=s.y;do{if(o<=t.y&&o>=t.next.y&&t.next.y!==t.y){let f=t.x+(o-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(f<=r&&f>n&&(n=f,i=t.x<t.next.x?t:t.next,f===r))return i}t=t.next}while(t!==e);if(!i)return null;let a=i,l=i.x,c=i.y,h=1/0,u;t=i;do r>=t.x&&t.x>=l&&r!==t.x&&yo(o<c?r:n,o,l,c,o<c?n:r,o,t.x,t.y)&&(u=Math.abs(o-t.y)/(r-t.x),qa(t,s)&&(u<h||u===h&&(t.x>i.x||t.x===i.x&&Db(i,t)))&&(i=t,h=u)),t=t.next;while(t!==a);return i}function Db(s,e){return fn(s.prev,s,e.prev)<0&&fn(e.next,s,s.next)<0}function Ub(s,e,t,n){let i=s;do i.z===0&&(i.z=Ff(i.x,i.y,e,t,n)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==s);i.prevZ.nextZ=null,i.prevZ=null,Nb(i)}function Nb(s){let e,t,n,i,r,o,a,l,c=1;do{for(t=s,s=null,r=null,o=0;t;){for(o++,n=t,a=0,e=0;e<c&&(a++,n=n.nextZ,!!n);e++);for(l=c;a>0||l>0&&n;)a!==0&&(l===0||!n||t.z<=n.z)?(i=t,t=t.nextZ,a--):(i=n,n=n.nextZ,l--),r?r.nextZ=i:s=i,i.prevZ=r,r=i;t=n}r.nextZ=null,c*=2}while(o>1);return s}function Ff(s,e,t,n,i){return s=(s-t)*i|0,e=(e-n)*i|0,s=(s|s<<8)&16711935,s=(s|s<<4)&252645135,s=(s|s<<2)&858993459,s=(s|s<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,s|e<<1}function Fb(s){let e=s,t=s;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==s);return t}function yo(s,e,t,n,i,r,o,a){return(i-o)*(e-a)>=(s-o)*(r-a)&&(s-o)*(n-a)>=(t-o)*(e-a)&&(t-o)*(r-a)>=(i-o)*(n-a)}function Ob(s,e){return s.next.i!==e.i&&s.prev.i!==e.i&&!Bb(s,e)&&(qa(s,e)&&qa(e,s)&&zb(s,e)&&(fn(s.prev,s,e.prev)||fn(s,e.prev,e))||tu(s,e)&&fn(s.prev,s,s.next)>0&&fn(e.prev,e,e.next)>0)}function fn(s,e,t){return(e.y-s.y)*(t.x-e.x)-(e.x-s.x)*(t.y-e.y)}function tu(s,e){return s.x===e.x&&s.y===e.y}function Ig(s,e,t,n){let i=rc(fn(s,e,t)),r=rc(fn(s,e,n)),o=rc(fn(t,n,s)),a=rc(fn(t,n,e));return!!(i!==r&&o!==a||i===0&&sc(s,t,e)||r===0&&sc(s,n,e)||o===0&&sc(t,s,n)||a===0&&sc(t,e,n))}function sc(s,e,t){return e.x<=Math.max(s.x,t.x)&&e.x>=Math.min(s.x,t.x)&&e.y<=Math.max(s.y,t.y)&&e.y>=Math.min(s.y,t.y)}function rc(s){return s>0?1:s<0?-1:0}function Bb(s,e){let t=s;do{if(t.i!==s.i&&t.next.i!==s.i&&t.i!==e.i&&t.next.i!==e.i&&Ig(t,t.next,s,e))return!0;t=t.next}while(t!==s);return!1}function qa(s,e){return fn(s.prev,s,s.next)<0?fn(s,e,s.next)>=0&&fn(s,s.prev,e)>=0:fn(s,e,s.prev)<0||fn(s,s.next,e)<0}function zb(s,e){let t=s,n=!1,i=(s.x+e.x)/2,r=(s.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&i<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==s);return n}function Lg(s,e){let t=new Of(s.i,s.x,s.y),n=new Of(e.i,e.x,e.y),i=s.next,r=e.prev;return s.next=e,e.prev=s,t.next=i,i.prev=t,n.next=t,t.prev=n,r.next=n,n.prev=r,n}function i0(s,e,t,n){let i=new Of(s,e,t);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function Ya(s){s.next.prev=s.prev,s.prev.next=s.next,s.prevZ&&(s.prevZ.nextZ=s.nextZ),s.nextZ&&(s.nextZ.prevZ=s.prevZ)}function Of(s,e,t){this.i=s,this.x=e,this.y=t,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function kb(s,e,t,n){let i=0;for(let r=e,o=t-n;r<t;r+=n)i+=(s[o]-s[r])*(s[r+1]+s[o+1]),o=r;return i}var Ci=class s{static area(e){let t=e.length,n=0;for(let i=t-1,r=0;r<t;i=r++)n+=e[i].x*e[r].y-e[r].x*e[i].y;return n*.5}static isClockWise(e){return s.area(e)<0}static triangulateShape(e,t){let n=[],i=[],r=[];s0(e),r0(n,e);let o=e.length;t.forEach(s0);for(let l=0;l<t.length;l++)i.push(o),o+=t[l].length,r0(n,t[l]);let a=wb.triangulate(n,i);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}};function s0(s){let e=s.length;e>2&&s[e-1].equals(s[0])&&s.pop()}function r0(s,e){for(let t=0;t<e.length;t++)s.push(e[t].x),s.push(e[t].y)}var mh=class s extends tt{constructor(e=new bs([new _e(.5,.5),new _e(-.5,.5),new _e(-.5,-.5),new _e(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,i=[],r=[];for(let a=0,l=e.length;a<l;a++){let c=e[a];o(c)}this.setAttribute("position",new Me(i,3)),this.setAttribute("uv",new Me(r,2)),this.computeVertexNormals();function o(a){let l=[],c=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,u=t.depth!==void 0?t.depth:1,f=t.bevelEnabled!==void 0?t.bevelEnabled:!0,d=t.bevelThickness!==void 0?t.bevelThickness:.2,p=t.bevelSize!==void 0?t.bevelSize:d-.1,x=t.bevelOffset!==void 0?t.bevelOffset:0,g=t.bevelSegments!==void 0?t.bevelSegments:3,m=t.extrudePath,y=t.UVGenerator!==void 0?t.UVGenerator:Hb,_,v=!1,F,T,U,C;m&&(_=m.getSpacedPoints(h),v=!0,f=!1,F=m.computeFrenetFrames(h,!1),T=new L,U=new L,C=new L),f||(g=0,d=0,p=0,x=0);let S=a.extractPoints(c),M=S.shape,N=S.holes;if(!Ci.isClockWise(M)){M=M.reverse();for(let ye=0,Ce=N.length;ye<Ce;ye++){let B=N[ye];Ci.isClockWise(B)&&(N[ye]=B.reverse())}}let $=Ci.triangulateShape(M,N),ee=M;for(let ye=0,Ce=N.length;ye<Ce;ye++){let B=N[ye];M=M.concat(B)}function pe(ye,Ce,B){return Ce||console.error("THREE.ExtrudeGeometry: vec does not exist"),ye.clone().addScaledVector(Ce,B)}let ie=M.length,be=$.length;function se(ye,Ce,B){let at,Ee,Ke,Ie=ye.x-Ce.x,mt=ye.y-Ce.y,Ze=B.x-ye.x,D=B.y-ye.y,w=Ie*Ie+mt*mt,Q=Ie*D-mt*Ze;if(Math.abs(Q)>Number.EPSILON){let ge=Math.sqrt(w),we=Math.sqrt(Ze*Ze+D*D),xe=Ce.x-mt/ge,Je=Ce.y+Ie/ge,ze=B.x-D/we,$e=B.y+Ze/we,Bt=((ze-xe)*D-($e-Je)*Ze)/(Ie*D-mt*Ze);at=xe+Ie*Bt-ye.x,Ee=Je+mt*Bt-ye.y;let Pe=at*at+Ee*Ee;if(Pe<=2)return new _e(at,Ee);Ke=Math.sqrt(Pe/2)}else{let ge=!1;Ie>Number.EPSILON?Ze>Number.EPSILON&&(ge=!0):Ie<-Number.EPSILON?Ze<-Number.EPSILON&&(ge=!0):Math.sign(mt)===Math.sign(D)&&(ge=!0),ge?(at=-mt,Ee=Ie,Ke=Math.sqrt(w)):(at=Ie,Ee=mt,Ke=Math.sqrt(w/2))}return new _e(at/Ke,Ee/Ke)}let Te=[];for(let ye=0,Ce=ee.length,B=Ce-1,at=ye+1;ye<Ce;ye++,B++,at++)B===Ce&&(B=0),at===Ce&&(at=0),Te[ye]=se(ee[ye],ee[B],ee[at]);let Ue=[],Fe,dt=Te.concat();for(let ye=0,Ce=N.length;ye<Ce;ye++){let B=N[ye];Fe=[];for(let at=0,Ee=B.length,Ke=Ee-1,Ie=at+1;at<Ee;at++,Ke++,Ie++)Ke===Ee&&(Ke=0),Ie===Ee&&(Ie=0),Fe[at]=se(B[at],B[Ke],B[Ie]);Ue.push(Fe),dt=dt.concat(Fe)}for(let ye=0;ye<g;ye++){let Ce=ye/g,B=d*Math.cos(Ce*Math.PI/2),at=p*Math.sin(Ce*Math.PI/2)+x;for(let Ee=0,Ke=ee.length;Ee<Ke;Ee++){let Ie=pe(ee[Ee],Te[Ee],at);Ne(Ie.x,Ie.y,-B)}for(let Ee=0,Ke=N.length;Ee<Ke;Ee++){let Ie=N[Ee];Fe=Ue[Ee];for(let mt=0,Ze=Ie.length;mt<Ze;mt++){let D=pe(Ie[mt],Fe[mt],at);Ne(D.x,D.y,-B)}}}let Gt=p+x;for(let ye=0;ye<ie;ye++){let Ce=f?pe(M[ye],dt[ye],Gt):M[ye];v?(U.copy(F.normals[0]).multiplyScalar(Ce.x),T.copy(F.binormals[0]).multiplyScalar(Ce.y),C.copy(_[0]).add(U).add(T),Ne(C.x,C.y,C.z)):Ne(Ce.x,Ce.y,0)}for(let ye=1;ye<=h;ye++)for(let Ce=0;Ce<ie;Ce++){let B=f?pe(M[Ce],dt[Ce],Gt):M[Ce];v?(U.copy(F.normals[ye]).multiplyScalar(B.x),T.copy(F.binormals[ye]).multiplyScalar(B.y),C.copy(_[ye]).add(U).add(T),Ne(C.x,C.y,C.z)):Ne(B.x,B.y,u/h*ye)}for(let ye=g-1;ye>=0;ye--){let Ce=ye/g,B=d*Math.cos(Ce*Math.PI/2),at=p*Math.sin(Ce*Math.PI/2)+x;for(let Ee=0,Ke=ee.length;Ee<Ke;Ee++){let Ie=pe(ee[Ee],Te[Ee],at);Ne(Ie.x,Ie.y,u+B)}for(let Ee=0,Ke=N.length;Ee<Ke;Ee++){let Ie=N[Ee];Fe=Ue[Ee];for(let mt=0,Ze=Ie.length;mt<Ze;mt++){let D=pe(Ie[mt],Fe[mt],at);v?Ne(D.x,D.y+_[h-1].y,_[h-1].x+B):Ne(D.x,D.y,u+B)}}}me(),Le();function me(){let ye=i.length/3;if(f){let Ce=0,B=ie*Ce;for(let at=0;at<be;at++){let Ee=$[at];ft(Ee[2]+B,Ee[1]+B,Ee[0]+B)}Ce=h+g*2,B=ie*Ce;for(let at=0;at<be;at++){let Ee=$[at];ft(Ee[0]+B,Ee[1]+B,Ee[2]+B)}}else{for(let Ce=0;Ce<be;Ce++){let B=$[Ce];ft(B[2],B[1],B[0])}for(let Ce=0;Ce<be;Ce++){let B=$[Ce];ft(B[0]+ie*h,B[1]+ie*h,B[2]+ie*h)}}n.addGroup(ye,i.length/3-ye,0)}function Le(){let ye=i.length/3,Ce=0;nt(ee,Ce),Ce+=ee.length;for(let B=0,at=N.length;B<at;B++){let Ee=N[B];nt(Ee,Ce),Ce+=Ee.length}n.addGroup(ye,i.length/3-ye,1)}function nt(ye,Ce){let B=ye.length;for(;--B>=0;){let at=B,Ee=B-1;Ee<0&&(Ee=ye.length-1);for(let Ke=0,Ie=h+g*2;Ke<Ie;Ke++){let mt=ie*Ke,Ze=ie*(Ke+1),D=Ce+at+mt,w=Ce+Ee+mt,Q=Ce+Ee+Ze,ge=Ce+at+Ze;pt(D,w,Q,ge)}}}function Ne(ye,Ce,B){l.push(ye),l.push(Ce),l.push(B)}function ft(ye,Ce,B){_t(ye),_t(Ce),_t(B);let at=i.length/3,Ee=y.generateTopUV(n,i,at-3,at-2,at-1);Nt(Ee[0]),Nt(Ee[1]),Nt(Ee[2])}function pt(ye,Ce,B,at){_t(ye),_t(Ce),_t(at),_t(Ce),_t(B),_t(at);let Ee=i.length/3,Ke=y.generateSideWallUV(n,i,Ee-6,Ee-3,Ee-2,Ee-1);Nt(Ke[0]),Nt(Ke[1]),Nt(Ke[3]),Nt(Ke[1]),Nt(Ke[2]),Nt(Ke[3])}function _t(ye){i.push(l[ye*3+0]),i.push(l[ye*3+1]),i.push(l[ye*3+2])}function Nt(ye){r.push(ye.x),r.push(ye.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return Vb(t,n,e)}static fromJSON(e,t){let n=[];for(let r=0,o=e.shapes.length;r<o;r++){let a=t[e.shapes[r]];n.push(a)}let i=e.options.extrudePath;return i!==void 0&&(e.options.extrudePath=new hh[i.type]().fromJSON(i)),new s(n,e.options)}},Hb={generateTopUV:function(s,e,t,n,i){let r=e[t*3],o=e[t*3+1],a=e[n*3],l=e[n*3+1],c=e[i*3],h=e[i*3+1];return[new _e(r,o),new _e(a,l),new _e(c,h)]},generateSideWallUV:function(s,e,t,n,i,r){let o=e[t*3],a=e[t*3+1],l=e[t*3+2],c=e[n*3],h=e[n*3+1],u=e[n*3+2],f=e[i*3],d=e[i*3+1],p=e[i*3+2],x=e[r*3],g=e[r*3+1],m=e[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new _e(o,1-l),new _e(c,1-u),new _e(f,1-p),new _e(x,1-m)]:[new _e(a,1-l),new _e(h,1-u),new _e(d,1-p),new _e(g,1-m)]}};function Vb(s,e,t){if(t.shapes=[],Array.isArray(s))for(let n=0,i=s.length;n<i;n++){let r=s[n];t.shapes.push(r.uuid)}else t.shapes.push(s.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}var Uo=class s extends Zs{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,i=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(i,r,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new s(e.radius,e.detail)}},Za=class s extends Zs{constructor(e=1,t=0){let n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],i=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,i,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new s(e.radius,e.detail)}},gh=class s extends tt{constructor(e=.5,t=1,n=32,i=1,r=0,o=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:i,thetaStart:r,thetaLength:o},n=Math.max(3,n),i=Math.max(1,i);let a=[],l=[],c=[],h=[],u=e,f=(t-e)/i,d=new L,p=new _e;for(let x=0;x<=i;x++){for(let g=0;g<=n;g++){let m=r+g/n*o;d.x=u*Math.cos(m),d.y=u*Math.sin(m),l.push(d.x,d.y,d.z),c.push(0,0,1),p.x=(d.x/t+1)/2,p.y=(d.y/t+1)/2,h.push(p.x,p.y)}u+=f}for(let x=0;x<i;x++){let g=x*(n+1);for(let m=0;m<n;m++){let y=m+g,_=y,v=y+n+1,F=y+n+2,T=y+1;a.push(_,v,T),a.push(v,F,T)}}this.setIndex(a),this.setAttribute("position",new Me(l,3)),this.setAttribute("normal",new Me(c,3)),this.setAttribute("uv",new Me(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}},xh=class s extends tt{constructor(e=new bs([new _e(0,.5),new _e(-.5,-.5),new _e(.5,-.5)]),t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};let n=[],i=[],r=[],o=[],a=0,l=0;if(Array.isArray(e)===!1)c(e);else for(let h=0;h<e.length;h++)c(e[h]),this.addGroup(a,l,h),a+=l,l=0;this.setIndex(n),this.setAttribute("position",new Me(i,3)),this.setAttribute("normal",new Me(r,3)),this.setAttribute("uv",new Me(o,2));function c(h){let u=i.length/3,f=h.extractPoints(t),d=f.shape,p=f.holes;Ci.isClockWise(d)===!1&&(d=d.reverse());for(let g=0,m=p.length;g<m;g++){let y=p[g];Ci.isClockWise(y)===!0&&(p[g]=y.reverse())}let x=Ci.triangulateShape(d,p);for(let g=0,m=p.length;g<m;g++){let y=p[g];d=d.concat(y)}for(let g=0,m=d.length;g<m;g++){let y=d[g];i.push(y.x,y.y,0),r.push(0,0,1),o.push(y.x,y.y)}for(let g=0,m=x.length;g<m;g++){let y=x[g],_=y[0]+u,v=y[1]+u,F=y[2]+u;n.push(_,v,F),l+=3}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes;return Gb(t,e)}static fromJSON(e,t){let n=[];for(let i=0,r=e.shapes.length;i<r;i++){let o=t[e.shapes[i]];n.push(o)}return new s(n,e.curveSegments)}};function Gb(s,e){if(e.shapes=[],Array.isArray(s))for(let t=0,n=s.length;t<n;t++){let i=s[t];e.shapes.push(i.uuid)}else e.shapes.push(s.uuid);return e}var Gr=class s extends tt{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let l=Math.min(o+a,Math.PI),c=0,h=[],u=new L,f=new L,d=[],p=[],x=[],g=[];for(let m=0;m<=n;m++){let y=[],_=m/n,v=0;m===0&&o===0?v=.5/t:m===n&&l===Math.PI&&(v=-.5/t);for(let F=0;F<=t;F++){let T=F/t;u.x=-e*Math.cos(i+T*r)*Math.sin(o+_*a),u.y=e*Math.cos(o+_*a),u.z=e*Math.sin(i+T*r)*Math.sin(o+_*a),p.push(u.x,u.y,u.z),f.copy(u).normalize(),x.push(f.x,f.y,f.z),g.push(T+v,1-_),y.push(c++)}h.push(y)}for(let m=0;m<n;m++)for(let y=0;y<t;y++){let _=h[m][y+1],v=h[m][y],F=h[m+1][y],T=h[m+1][y+1];(m!==0||o>0)&&d.push(_,v,T),(m!==n-1||l<Math.PI)&&d.push(v,F,T)}this.setIndex(d),this.setAttribute("position",new Me(p,3)),this.setAttribute("normal",new Me(x,3)),this.setAttribute("uv",new Me(g,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}},vh=class s extends Zs{constructor(e=1,t=0){let n=[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],i=[2,1,0,0,3,2,1,3,0,2,3,1];super(n,i,e,t),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new s(e.radius,e.detail)}},_h=class s extends tt{constructor(e=1,t=.4,n=12,i=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:i,arc:r},n=Math.floor(n),i=Math.floor(i);let o=[],a=[],l=[],c=[],h=new L,u=new L,f=new L;for(let d=0;d<=n;d++)for(let p=0;p<=i;p++){let x=p/i*r,g=d/n*Math.PI*2;u.x=(e+t*Math.cos(g))*Math.cos(x),u.y=(e+t*Math.cos(g))*Math.sin(x),u.z=t*Math.sin(g),a.push(u.x,u.y,u.z),h.x=e*Math.cos(x),h.y=e*Math.sin(x),f.subVectors(u,h).normalize(),l.push(f.x,f.y,f.z),c.push(p/i),c.push(d/n)}for(let d=1;d<=n;d++)for(let p=1;p<=i;p++){let x=(i+1)*d+p-1,g=(i+1)*(d-1)+p-1,m=(i+1)*(d-1)+p,y=(i+1)*d+p;o.push(x,g,y),o.push(g,m,y)}this.setIndex(o),this.setAttribute("position",new Me(a,3)),this.setAttribute("normal",new Me(l,3)),this.setAttribute("uv",new Me(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}},yh=class s extends tt{constructor(e=1,t=.4,n=64,i=8,r=2,o=3){super(),this.type="TorusKnotGeometry",this.parameters={radius:e,tube:t,tubularSegments:n,radialSegments:i,p:r,q:o},n=Math.floor(n),i=Math.floor(i);let a=[],l=[],c=[],h=[],u=new L,f=new L,d=new L,p=new L,x=new L,g=new L,m=new L;for(let _=0;_<=n;++_){let v=_/n*r*Math.PI*2;y(v,r,o,e,d),y(v+.01,r,o,e,p),g.subVectors(p,d),m.addVectors(p,d),x.crossVectors(g,m),m.crossVectors(x,g),x.normalize(),m.normalize();for(let F=0;F<=i;++F){let T=F/i*Math.PI*2,U=-t*Math.cos(T),C=t*Math.sin(T);u.x=d.x+(U*m.x+C*x.x),u.y=d.y+(U*m.y+C*x.y),u.z=d.z+(U*m.z+C*x.z),l.push(u.x,u.y,u.z),f.subVectors(u,d).normalize(),c.push(f.x,f.y,f.z),h.push(_/n),h.push(F/i)}}for(let _=1;_<=n;_++)for(let v=1;v<=i;v++){let F=(i+1)*(_-1)+(v-1),T=(i+1)*_+(v-1),U=(i+1)*_+v,C=(i+1)*(_-1)+v;a.push(F,T,C),a.push(T,U,C)}this.setIndex(a),this.setAttribute("position",new Me(l,3)),this.setAttribute("normal",new Me(c,3)),this.setAttribute("uv",new Me(h,2));function y(_,v,F,T,U){let C=Math.cos(_),S=Math.sin(_),M=F/v*_,N=Math.cos(M);U.x=T*(2+N)*.5*C,U.y=T*(2+N)*S*.5,U.z=T*Math.sin(M)*.5}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.tube,e.tubularSegments,e.radialSegments,e.p,e.q)}},Mh=class s extends tt{constructor(e=new Va(new L(-1,-1,0),new L(-1,1,0),new L(1,1,0)),t=64,n=1,i=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:i,closed:r};let o=e.computeFrenetFrames(t,r);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;let a=new L,l=new L,c=new _e,h=new L,u=[],f=[],d=[],p=[];x(),this.setIndex(p),this.setAttribute("position",new Me(u,3)),this.setAttribute("normal",new Me(f,3)),this.setAttribute("uv",new Me(d,2));function x(){for(let _=0;_<t;_++)g(_);g(r===!1?t:0),y(),m()}function g(_){h=e.getPointAt(_/t,h);let v=o.normals[_],F=o.binormals[_];for(let T=0;T<=i;T++){let U=T/i*Math.PI*2,C=Math.sin(U),S=-Math.cos(U);l.x=S*v.x+C*F.x,l.y=S*v.y+C*F.y,l.z=S*v.z+C*F.z,l.normalize(),f.push(l.x,l.y,l.z),a.x=h.x+n*l.x,a.y=h.y+n*l.y,a.z=h.z+n*l.z,u.push(a.x,a.y,a.z)}}function m(){for(let _=1;_<=t;_++)for(let v=1;v<=i;v++){let F=(i+1)*(_-1)+(v-1),T=(i+1)*_+(v-1),U=(i+1)*_+v,C=(i+1)*(_-1)+v;p.push(F,T,C),p.push(T,U,C)}}function y(){for(let _=0;_<=t;_++)for(let v=0;v<=i;v++)c.x=_/t,c.y=v/i,d.push(c.x,c.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new s(new hh[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}},bh=class extends tt{constructor(e=null){if(super(),this.type="WireframeGeometry",this.parameters={geometry:e},e!==null){let t=[],n=new Set,i=new L,r=new L;if(e.index!==null){let o=e.attributes.position,a=e.index,l=e.groups;l.length===0&&(l=[{start:0,count:a.count,materialIndex:0}]);for(let c=0,h=l.length;c<h;++c){let u=l[c],f=u.start,d=u.count;for(let p=f,x=f+d;p<x;p+=3)for(let g=0;g<3;g++){let m=a.getX(p+g),y=a.getX(p+(g+1)%3);i.fromBufferAttribute(o,m),r.fromBufferAttribute(o,y),o0(i,r,n)===!0&&(t.push(i.x,i.y,i.z),t.push(r.x,r.y,r.z))}}}else{let o=e.attributes.position;for(let a=0,l=o.count/3;a<l;a++)for(let c=0;c<3;c++){let h=3*a+c,u=3*a+(c+1)%3;i.fromBufferAttribute(o,h),r.fromBufferAttribute(o,u),o0(i,r,n)===!0&&(t.push(i.x,i.y,i.z),t.push(r.x,r.y,r.z))}}this.setAttribute("position",new Me(t,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}};function o0(s,e,t){let n=`${s.x},${s.y},${s.z}-${e.x},${e.y},${e.z}`,i=`${e.x},${e.y},${e.z}-${s.x},${s.y},${s.z}`;return t.has(n)===!0||t.has(i)===!0?!1:(t.add(n),t.add(i),!0)}var a0=Object.freeze({__proto__:null,BoxGeometry:Nr,CapsuleGeometry:fh,CircleGeometry:Lo,ConeGeometry:Do,CylinderGeometry:ni,DodecahedronGeometry:dh,EdgesGeometry:ph,ExtrudeGeometry:mh,IcosahedronGeometry:Uo,LatheGeometry:Wa,OctahedronGeometry:Za,PlaneGeometry:As,PolyhedronGeometry:Zs,RingGeometry:gh,ShapeGeometry:xh,SphereGeometry:Gr,TetrahedronGeometry:vh,TorusGeometry:_h,TorusKnotGeometry:yh,TubeGeometry:Mh,WireframeGeometry:bh}),Sh=class extends xn{static get type(){return"ShadowMaterial"}constructor(e){super(),this.isShadowMaterial=!0,this.color=new Be(0),this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.fog=e.fog,this}},wh=class extends Ot{static get type(){return"RawShaderMaterial"}constructor(e){super(e),this.isRawShaderMaterial=!0}},$s=class extends xn{static get type(){return"MeshStandardMaterial"}constructor(e){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new Be(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Be(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Js,this.normalScale=new _e(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new bi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},ii=class extends $s{static get type(){return"MeshPhysicalMaterial"}constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new _e(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return gn(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Be(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Be(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Be(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}},Eh=class extends xn{static get type(){return"MeshPhongMaterial"}constructor(e){super(),this.isMeshPhongMaterial=!0,this.color=new Be(16777215),this.specular=new Be(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Be(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Js,this.normalScale=new _e(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new bi,this.combine=sl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Ah=class extends xn{static get type(){return"MeshToonMaterial"}constructor(e){super(),this.isMeshToonMaterial=!0,this.defines={TOON:""},this.color=new Be(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Be(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Js,this.normalScale=new _e(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Th=class extends xn{static get type(){return"MeshNormalMaterial"}constructor(e){super(),this.isMeshNormalMaterial=!0,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Js,this.normalScale=new _e(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.flatShading=e.flatShading,this}},Rh=class extends xn{static get type(){return"MeshLambertMaterial"}constructor(e){super(),this.isMeshLambertMaterial=!0,this.color=new Be(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Be(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Js,this.normalScale=new _e(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new bi,this.combine=sl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Ch=class extends xn{static get type(){return"MeshMatcapMaterial"}constructor(e){super(),this.isMeshMatcapMaterial=!0,this.defines={MATCAP:""},this.color=new Be(16777215),this.matcap=null,this.map=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Js,this.normalScale=new _e(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={MATCAP:""},this.color.copy(e.color),this.matcap=e.matcap,this.map=e.map,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.flatShading=e.flatShading,this.fog=e.fog,this}},Ph=class extends Dn{static get type(){return"LineDashedMaterial"}constructor(e){super(),this.isLineDashedMaterial=!0,this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}copy(e){return super.copy(e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this}};function Sr(s,e,t){return!s||!t&&s.constructor===e?s:typeof e.BYTES_PER_ELEMENT=="number"?new e(s):Array.prototype.slice.call(s)}function Dg(s){return ArrayBuffer.isView(s)&&!(s instanceof DataView)}function Ug(s){function e(i,r){return s[i]-s[r]}let t=s.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n}function Bf(s,e,t){let n=s.length,i=new s.constructor(n);for(let r=0,o=0;o!==n;++r){let a=t[r]*e;for(let l=0;l!==e;++l)i[o++]=s[a+l]}return i}function Wd(s,e,t,n){let i=1,r=s[0];for(;r!==void 0&&r[n]===void 0;)r=s[i++];if(r===void 0)return;let o=r[n];if(o!==void 0)if(Array.isArray(o))do o=r[n],o!==void 0&&(e.push(r.time),t.push.apply(t,o)),r=s[i++];while(r!==void 0);else if(o.toArray!==void 0)do o=r[n],o!==void 0&&(e.push(r.time),o.toArray(t,t.length)),r=s[i++];while(r!==void 0);else do o=r[n],o!==void 0&&(e.push(r.time),t.push(o)),r=s[i++];while(r!==void 0)}function Wb(s,e,t,n,i=30){let r=s.clone();r.name=e;let o=[];for(let l=0;l<r.tracks.length;++l){let c=r.tracks[l],h=c.getValueSize(),u=[],f=[];for(let d=0;d<c.times.length;++d){let p=c.times[d]*i;if(!(p<t||p>=n)){u.push(c.times[d]);for(let x=0;x<h;++x)f.push(c.values[d*h+x])}}u.length!==0&&(c.times=Sr(u,c.times.constructor),c.values=Sr(f,c.values.constructor),o.push(c))}r.tracks=o;let a=1/0;for(let l=0;l<r.tracks.length;++l)a>r.tracks[l].times[0]&&(a=r.tracks[l].times[0]);for(let l=0;l<r.tracks.length;++l)r.tracks[l].shift(-1*a);return r.resetDuration(),r}function Xb(s,e=0,t=s,n=30){n<=0&&(n=30);let i=t.tracks.length,r=e/n;for(let o=0;o<i;++o){let a=t.tracks[o],l=a.ValueTypeName;if(l==="bool"||l==="string")continue;let c=s.tracks.find(function(m){return m.name===a.name&&m.ValueTypeName===l});if(c===void 0)continue;let h=0,u=a.getValueSize();a.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(h=u/3);let f=0,d=c.getValueSize();c.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(f=d/3);let p=a.times.length-1,x;if(r<=a.times[0]){let m=h,y=u-h;x=a.values.slice(m,y)}else if(r>=a.times[p]){let m=p*u+h,y=m+u-h;x=a.values.slice(m,y)}else{let m=a.createInterpolant(),y=h,_=u-h;m.evaluate(r),x=m.resultBuffer.slice(y,_)}l==="quaternion"&&new Sn().fromArray(x).normalize().conjugate().toArray(x);let g=c.times.length;for(let m=0;m<g;++m){let y=m*d+f;if(l==="quaternion")Sn.multiplyQuaternionsFlat(c.values,y,x,0,c.values,y);else{let _=d-f*2;for(let v=0;v<_;++v)c.values[y+v]-=x[v]}}}return s.blendMode=Od,s}var qb={convertArray:Sr,isTypedArray:Dg,getKeyframeOrder:Ug,sortedArray:Bf,flattenJSON:Wd,subclip:Wb,makeClipAdditive:Xb},Rs=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],r=t[n-1];e:{t:{let o;n:{i:if(!(e<i)){for(let a=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=i,i=t[++n],e<i)break t}o=t.length;break n}if(!(e>=r)){let a=t[1];e<a&&(n=2,r=a);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=r,r=t[--n-1],e>=r)break t}o=n,n=0;break n}break e}for(;n<o;){let a=n+o>>>1;e<t[a]?o=a:n=a+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let o=0;o!==i;++o)t[o]=n[r+o];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},Ih=class extends Rs{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Mr,endingEnd:Mr}}intervalChanged_(e,t,n){let i=this.parameterPositions,r=e-2,o=e+1,a=i[r],l=i[o];if(a===void 0)switch(this.getSettings_().endingStart){case br:r=e,a=2*t-n;break;case Ea:r=i.length-2,a=t+i[r]-i[r+1];break;default:r=e,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case br:o=e,l=2*n-t;break;case Ea:o=1,l=n+i[1]-i[0];break;default:o=e-1,l=t}let c=(n-t)*.5,h=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this._offsetPrev,u=this._offsetNext,f=this._weightPrev,d=this._weightNext,p=(n-t)/(i-t),x=p*p,g=x*p,m=-f*g+2*f*x-f*p,y=(1+f)*g+(-1.5-2*f)*x+(-.5+f)*p+1,_=(-1-d)*g+(1.5+d)*x+.5*p,v=d*g-d*x;for(let F=0;F!==a;++F)r[F]=m*o[h+F]+y*o[c+F]+_*o[l+F]+v*o[u+F];return r}},$a=class extends Rs{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=(n-t)/(i-t),u=1-h;for(let f=0;f!==a;++f)r[f]=o[c+f]*u+o[l+f]*h;return r}},Lh=class extends Rs{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},wi=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Sr(t,this.TimeBufferType),this.values=Sr(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Sr(e.times,Array),values:Sr(e.values,Array)};let i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Lh(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new $a(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Ih(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case Dr:t=this.InterpolantFactoryMethodDiscrete;break;case Ur:t=this.InterpolantFactoryMethodLinear;break;case dc:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Dr;case this.InterpolantFactoryMethodLinear:return Ur;case this.InterpolantFactoryMethodSmooth:return dc}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){let n=this.times,i=n.length,r=0,o=i-1;for(;r!==i&&n[r]<e;)++r;for(;o!==-1&&n[o]>t;)--o;if(++o,r!==0||o!==i){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,i=this.values,r=n.length;r===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==r;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(i!==void 0&&Dg(i))for(let a=0,l=i.length;a!==l;++a){let c=i[a];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===dc,r=e.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=e[a],h=e[a+1];if(c!==h&&(a!==1||c!==e[0]))if(i)l=!0;else{let u=a*n,f=u-n,d=u+n;for(let p=0;p!==n;++p){let x=t[u+p];if(x!==t[f+p]||x!==t[d+p]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let u=a*n,f=o*n;for(let d=0;d!==n;++d)t[f+d]=t[u+d]}++o}}if(r>0){e[o]=e[r];for(let a=r*n,l=o*n,c=0;c!==n;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}};wi.prototype.TimeBufferType=Float32Array;wi.prototype.ValueBufferType=Float32Array;wi.prototype.DefaultInterpolation=Ur;var Cs=class extends wi{constructor(e,t,n){super(e,t,n)}};Cs.prototype.ValueTypeName="bool";Cs.prototype.ValueBufferType=Array;Cs.prototype.DefaultInterpolation=Dr;Cs.prototype.InterpolantFactoryMethodLinear=void 0;Cs.prototype.InterpolantFactoryMethodSmooth=void 0;var Ka=class extends wi{};Ka.prototype.ValueTypeName="color";var ts=class extends wi{};ts.prototype.ValueTypeName="number";var Dh=class extends Rs{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-t)/(i-t),c=e*a;for(let h=c+a;c!==h;c+=4)Sn.slerpFlat(r,0,o,c-a,o,c,l);return r}},ns=class extends wi{InterpolantFactoryMethodLinear(e){return new Dh(this.times,this.values,this.getValueSize(),e)}};ns.prototype.ValueTypeName="quaternion";ns.prototype.InterpolantFactoryMethodSmooth=void 0;var Ps=class extends wi{constructor(e,t,n){super(e,t,n)}};Ps.prototype.ValueTypeName="string";Ps.prototype.ValueBufferType=Array;Ps.prototype.DefaultInterpolation=Dr;Ps.prototype.InterpolantFactoryMethodLinear=void 0;Ps.prototype.InterpolantFactoryMethodSmooth=void 0;var is=class extends wi{};is.prototype.ValueTypeName="vector";var Is=class{constructor(e="",t=-1,n=[],i=Qh){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=Mi(),this.duration<0&&this.resetDuration()}static parse(e){let t=[],n=e.tracks,i=1/(e.fps||1);for(let o=0,a=n.length;o!==a;++o)t.push(Zb(n[o]).scale(i));let r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r}static toJSON(e){let t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let r=0,o=n.length;r!==o;++r)t.push(wi.toJSON(n[r]));return i}static CreateFromMorphTargetSequence(e,t,n,i){let r=t.length,o=[];for(let a=0;a<r;a++){let l=[],c=[];l.push((a+r-1)%r,a,(a+1)%r),c.push(0,1,0);let h=Ug(l);l=Bf(l,1,h),c=Bf(c,1,h),!i&&l[0]===0&&(l.push(r),c.push(c[0])),o.push(new ts(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/n))}return new this(e,-1,o)}static findByName(e,t){let n=e;if(!Array.isArray(e)){let i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){let i={},r=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){let c=e[a],h=c.name.match(r);if(h&&h.length>1){let u=h[1],f=i[u];f||(i[u]=f=[]),f.push(c)}}let o=[];for(let a in i)o.push(this.CreateFromMorphTargetSequence(a,i[a],t,n));return o}static parseAnimation(e,t){if(!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;let n=function(u,f,d,p,x){if(d.length!==0){let g=[],m=[];Wd(d,g,m,p),g.length!==0&&x.push(new u(f,g,m))}},i=[],r=e.name||"default",o=e.fps||30,a=e.blendMode,l=e.length||-1,c=e.hierarchy||[];for(let u=0;u<c.length;u++){let f=c[u].keys;if(!(!f||f.length===0))if(f[0].morphTargets){let d={},p;for(p=0;p<f.length;p++)if(f[p].morphTargets)for(let x=0;x<f[p].morphTargets.length;x++)d[f[p].morphTargets[x]]=-1;for(let x in d){let g=[],m=[];for(let y=0;y!==f[p].morphTargets.length;++y){let _=f[p];g.push(_.time),m.push(_.morphTarget===x?1:0)}i.push(new ts(".morphTargetInfluence["+x+"]",g,m))}l=d.length*o}else{let d=".bones["+t[u].name+"]";n(is,d+".position",f,"pos",i),n(ns,d+".quaternion",f,"rot",i),n(is,d+".scale",f,"scl",i)}}return i.length===0?null:new this(r,l,i,a)}resetDuration(){let e=this.tracks,t=0;for(let n=0,i=e.length;n!==i;++n){let r=this.tracks[n];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}};function Yb(s){switch(s.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return ts;case"vector":case"vector2":case"vector3":case"vector4":return is;case"color":return Ka;case"quaternion":return ns;case"bool":case"boolean":return Cs;case"string":return Ps}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+s)}function Zb(s){if(s.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=Yb(s.type);if(s.times===void 0){let t=[],n=[];Wd(s.keys,t,n,"value"),s.times=t,s.values=n}return e.parse!==void 0?e.parse(s):new e(s.name,s.times,s.values,s.interpolation)}var _s={enabled:!1,files:{},add:function(s,e){this.enabled!==!1&&(this.files[s]=e)},get:function(s){if(this.enabled!==!1)return this.files[s]},remove:function(s){delete this.files[s]},clear:function(){this.files={}}},Ja=class{constructor(e,t,n){let i=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.itemStart=function(h){a++,r===!1&&i.onStart!==void 0&&i.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,i.onProgress!==void 0&&i.onProgress(h,o,a),o===a&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,u){return c.push(h,u),this},this.removeHandler=function(h){let u=c.indexOf(h);return u!==-1&&c.splice(u,2),this},this.getHandler=function(h){for(let u=0,f=c.length;u<f;u+=2){let d=c[u],p=c[u+1];if(d.global&&(d.lastIndex=0),d.test(h))return p}return null}}},Ng=new Ja,Vn=class{constructor(e){this.manager=e!==void 0?e:Ng,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}};Vn.DEFAULT_MATERIAL_NAME="__DEFAULT";var ms={},zf=class extends Error{constructor(e,t){super(e),this.response=t}},fi=class extends Vn{constructor(e){super(e)}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=_s.get(e);if(r!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0),r;if(ms[e]!==void 0){ms[e].push({onLoad:t,onProgress:n,onError:i});return}ms[e]=[],ms[e].push({onLoad:t,onProgress:n,onError:i});let o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin"}),a=this.mimeType,l=this.responseType;fetch(o).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;let h=ms[e],u=c.body.getReader(),f=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),d=f?parseInt(f):0,p=d!==0,x=0,g=new ReadableStream({start(m){y();function y(){u.read().then(({done:_,value:v})=>{if(_)m.close();else{x+=v.byteLength;let F=new ProgressEvent("progress",{lengthComputable:p,loaded:x,total:d});for(let T=0,U=h.length;T<U;T++){let C=h[T];C.onProgress&&C.onProgress(F)}m.enqueue(v),y()}},_=>{m.error(_)})}}});return new Response(g)}else throw new zf(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,a));case"json":return c.json();default:if(a===void 0)return c.text();{let u=/charset="?([^;"\s]*)"?/i.exec(a),f=u&&u[1]?u[1].toLowerCase():void 0,d=new TextDecoder(f);return c.arrayBuffer().then(p=>d.decode(p))}}}).then(c=>{_s.add(e,c);let h=ms[e];delete ms[e];for(let u=0,f=h.length;u<f;u++){let d=h[u];d.onLoad&&d.onLoad(c)}}).catch(c=>{let h=ms[e];if(h===void 0)throw this.manager.itemError(e),c;delete ms[e];for(let u=0,f=h.length;u<f;u++){let d=h[u];d.onError&&d.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}},kf=class extends Vn{constructor(e){super(e)}load(e,t,n,i){let r=this,o=new fi(this.manager);o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(a){try{t(r.parse(JSON.parse(a)))}catch(l){i?i(l):console.error(l),r.manager.itemError(e)}},n,i)}parse(e){let t=[];for(let n=0;n<e.length;n++){let i=Is.parse(e[n]);t.push(i)}return t}},Hf=class extends Vn{constructor(e){super(e)}load(e,t,n,i){let r=this,o=[],a=new Po,l=new fi(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(r.withCredentials);let c=0;function h(u){l.load(e[u],function(f){let d=r.parse(f,!0);o[u]={width:d.width,height:d.height,format:d.format,mipmaps:d.mipmaps},c+=1,c===6&&(d.mipmapCount===1&&(a.minFilter=cn),a.image=o,a.format=d.format,a.needsUpdate=!0,t&&t(a))},n,i)}if(Array.isArray(e))for(let u=0,f=e.length;u<f;++u)h(u);else l.load(e,function(u){let f=r.parse(u,!0);if(f.isCubemap){let d=f.mipmaps.length/f.mipmapCount;for(let p=0;p<d;p++){o[p]={mipmaps:[]};for(let x=0;x<f.mipmapCount;x++)o[p].mipmaps.push(f.mipmaps[p*f.mipmapCount+x]),o[p].format=f.format,o[p].width=f.width,o[p].height=f.height}a.image=o}else a.image.width=f.width,a.image.height=f.height,a.mipmaps=f.mipmaps;f.mipmapCount===1&&(a.minFilter=cn),a.format=f.format,a.needsUpdate=!0,t&&t(a)},n,i);return a}},Wr=class extends Vn{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=_s.get(e);if(o!==void 0)return r.manager.itemStart(e),setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0),o;let a=Ra("img");function l(){h(),_s.add(e,this),t&&t(this),r.manager.itemEnd(e)}function c(u){h(),i&&i(u),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),r.manager.itemStart(e),a.src=e,a}},Vf=class extends Vn{constructor(e){super(e)}load(e,t,n,i){let r=new Fr;r.colorSpace=An;let o=new Wr(this.manager);o.setCrossOrigin(this.crossOrigin),o.setPath(this.path);let a=0;function l(c){o.load(e[c],function(h){r.images[c]=h,a++,a===6&&(r.needsUpdate=!0,t&&t(r))},void 0,i)}for(let c=0;c<e.length;++c)l(c);return r}},Gf=class extends Vn{constructor(e){super(e)}load(e,t,n,i){let r=this,o=new Ri,a=new fi(this.manager);return a.setResponseType("arraybuffer"),a.setRequestHeader(this.requestHeader),a.setPath(this.path),a.setWithCredentials(r.withCredentials),a.load(e,function(l){let c;try{c=r.parse(l)}catch(h){if(i!==void 0)i(h);else{console.error(h);return}}c.image!==void 0?o.image=c.image:c.data!==void 0&&(o.image.width=c.width,o.image.height=c.height,o.image.data=c.data),o.wrapS=c.wrapS!==void 0?c.wrapS:ci,o.wrapT=c.wrapT!==void 0?c.wrapT:ci,o.magFilter=c.magFilter!==void 0?c.magFilter:cn,o.minFilter=c.minFilter!==void 0?c.minFilter:cn,o.anisotropy=c.anisotropy!==void 0?c.anisotropy:1,c.colorSpace!==void 0&&(o.colorSpace=c.colorSpace),c.flipY!==void 0&&(o.flipY=c.flipY),c.format!==void 0&&(o.format=c.format),c.type!==void 0&&(o.type=c.type),c.mipmaps!==void 0&&(o.mipmaps=c.mipmaps,o.minFilter=yi),c.mipmapCount===1&&(o.minFilter=cn),c.generateMipmaps!==void 0&&(o.generateMipmaps=c.generateMipmaps),o.needsUpdate=!0,t&&t(o,c)},n,i),o}},ja=class extends Vn{constructor(e){super(e)}load(e,t,n,i){let r=new dn,o=new Wr(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){r.image=a,r.needsUpdate=!0,t!==void 0&&t(r)},n,i),r}},ss=class extends Kt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Be(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}},No=class extends ss{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Kt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Be(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}},nf=new ct,l0=new L,c0=new L,Qa=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new _e(512,512),this.map=null,this.mapPass=null,this.matrix=new ct,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Or,this._frameExtents=new _e(1,1),this._viewportCount=1,this._viewports=[new kt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;l0.setFromMatrixPosition(e.matrixWorld),t.position.copy(l0),c0.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(c0),t.updateMatrixWorld(),nf.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(nf),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(nf)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Wf=class extends Qa{constructor(){super(new Mn(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1}updateMatrices(e){let t=this.camera,n=wo*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height,r=e.distance||t.far;(n!==t.fov||i!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=i,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}},Fo=class extends ss{constructor(e,t,n=0,i=Math.PI/3,r=0,o=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Kt.DEFAULT_UP),this.updateMatrix(),this.target=new Kt,this.distance=n,this.angle=i,this.penumbra=r,this.decay=o,this.map=null,this.shadow=new Wf}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}},h0=new ct,ca=new L,sf=new L,Xf=class extends Qa{constructor(){super(new Mn(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new _e(4,2),this._viewportCount=6,this._viewports=[new kt(2,1,1,1),new kt(0,1,1,1),new kt(3,1,1,1),new kt(1,1,1,1),new kt(3,0,1,1),new kt(1,0,1,1)],this._cubeDirections=[new L(1,0,0),new L(-1,0,0),new L(0,0,1),new L(0,0,-1),new L(0,1,0),new L(0,-1,0)],this._cubeUps=[new L(0,1,0),new L(0,1,0),new L(0,1,0),new L(0,1,0),new L(0,0,1),new L(0,0,-1)]}updateMatrices(e,t=0){let n=this.camera,i=this.matrix,r=e.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),ca.setFromMatrixPosition(e.matrixWorld),n.position.copy(ca),sf.copy(n.position),sf.add(this._cubeDirections[t]),n.up.copy(this._cubeUps[t]),n.lookAt(sf),n.updateMatrixWorld(),i.makeTranslation(-ca.x,-ca.y,-ca.z),h0.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(h0)}},Ks=class extends ss{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new Xf}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}},qf=class extends Qa{constructor(){super(new Qi(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Ls=class extends ss{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Kt.DEFAULT_UP),this.updateMatrix(),this.target=new Kt,this.shadow=new qf}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}},Uh=class extends ss{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}},Nh=class extends ss{constructor(e,t,n=10,i=10){super(e,t),this.isRectAreaLight=!0,this.type="RectAreaLight",this.width=n,this.height=i}get power(){return this.intensity*this.width*this.height*Math.PI}set power(e){this.intensity=e/(this.width*this.height*Math.PI)}copy(e){return super.copy(e),this.width=e.width,this.height=e.height,this}toJSON(e){let t=super.toJSON(e);return t.object.width=this.width,t.object.height=this.height,t}},Fh=class{constructor(){this.isSphericalHarmonics3=!0,this.coefficients=[];for(let e=0;e<9;e++)this.coefficients.push(new L)}set(e){for(let t=0;t<9;t++)this.coefficients[t].copy(e[t]);return this}zero(){for(let e=0;e<9;e++)this.coefficients[e].set(0,0,0);return this}getAt(e,t){let n=e.x,i=e.y,r=e.z,o=this.coefficients;return t.copy(o[0]).multiplyScalar(.282095),t.addScaledVector(o[1],.488603*i),t.addScaledVector(o[2],.488603*r),t.addScaledVector(o[3],.488603*n),t.addScaledVector(o[4],1.092548*(n*i)),t.addScaledVector(o[5],1.092548*(i*r)),t.addScaledVector(o[6],.315392*(3*r*r-1)),t.addScaledVector(o[7],1.092548*(n*r)),t.addScaledVector(o[8],.546274*(n*n-i*i)),t}getIrradianceAt(e,t){let n=e.x,i=e.y,r=e.z,o=this.coefficients;return t.copy(o[0]).multiplyScalar(.886227),t.addScaledVector(o[1],2*.511664*i),t.addScaledVector(o[2],2*.511664*r),t.addScaledVector(o[3],2*.511664*n),t.addScaledVector(o[4],2*.429043*n*i),t.addScaledVector(o[5],2*.429043*i*r),t.addScaledVector(o[6],.743125*r*r-.247708),t.addScaledVector(o[7],2*.429043*n*r),t.addScaledVector(o[8],.429043*(n*n-i*i)),t}add(e){for(let t=0;t<9;t++)this.coefficients[t].add(e.coefficients[t]);return this}addScaledSH(e,t){for(let n=0;n<9;n++)this.coefficients[n].addScaledVector(e.coefficients[n],t);return this}scale(e){for(let t=0;t<9;t++)this.coefficients[t].multiplyScalar(e);return this}lerp(e,t){for(let n=0;n<9;n++)this.coefficients[n].lerp(e.coefficients[n],t);return this}equals(e){for(let t=0;t<9;t++)if(!this.coefficients[t].equals(e.coefficients[t]))return!1;return!0}copy(e){return this.set(e.coefficients)}clone(){return new this.constructor().copy(this)}fromArray(e,t=0){let n=this.coefficients;for(let i=0;i<9;i++)n[i].fromArray(e,t+i*3);return this}toArray(e=[],t=0){let n=this.coefficients;for(let i=0;i<9;i++)n[i].toArray(e,t+i*3);return e}static getBasisAt(e,t){let n=e.x,i=e.y,r=e.z;t[0]=.282095,t[1]=.488603*i,t[2]=.488603*r,t[3]=.488603*n,t[4]=1.092548*n*i,t[5]=1.092548*i*r,t[6]=.315392*(3*r*r-1),t[7]=1.092548*n*r,t[8]=.546274*(n*n-i*i)}},Oh=class extends ss{constructor(e=new Fh,t=1){super(void 0,t),this.isLightProbe=!0,this.sh=e}copy(e){return super.copy(e),this.sh.copy(e.sh),this}fromJSON(e){return this.intensity=e.intensity,this.sh.fromArray(e.sh),this}toJSON(e){let t=super.toJSON(e);return t.object.sh=this.sh.toArray(),t}},Bh=class s extends Vn{constructor(e){super(e),this.textures={}}load(e,t,n,i){let r=this,o=new fi(r.manager);o.setPath(r.path),o.setRequestHeader(r.requestHeader),o.setWithCredentials(r.withCredentials),o.load(e,function(a){try{t(r.parse(JSON.parse(a)))}catch(l){i?i(l):console.error(l),r.manager.itemError(e)}},n,i)}parse(e){let t=this.textures;function n(r){return t[r]===void 0&&console.warn("THREE.MaterialLoader: Undefined texture",r),t[r]}let i=this.createMaterialFromType(e.type);if(e.uuid!==void 0&&(i.uuid=e.uuid),e.name!==void 0&&(i.name=e.name),e.color!==void 0&&i.color!==void 0&&i.color.setHex(e.color),e.roughness!==void 0&&(i.roughness=e.roughness),e.metalness!==void 0&&(i.metalness=e.metalness),e.sheen!==void 0&&(i.sheen=e.sheen),e.sheenColor!==void 0&&(i.sheenColor=new Be().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(i.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&i.emissive!==void 0&&i.emissive.setHex(e.emissive),e.specular!==void 0&&i.specular!==void 0&&i.specular.setHex(e.specular),e.specularIntensity!==void 0&&(i.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&i.specularColor!==void 0&&i.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(i.shininess=e.shininess),e.clearcoat!==void 0&&(i.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(i.dispersion=e.dispersion),e.iridescence!==void 0&&(i.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(i.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(i.transmission=e.transmission),e.thickness!==void 0&&(i.thickness=e.thickness),e.attenuationDistance!==void 0&&(i.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&i.attenuationColor!==void 0&&i.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(i.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(i.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(i.fog=e.fog),e.flatShading!==void 0&&(i.flatShading=e.flatShading),e.blending!==void 0&&(i.blending=e.blending),e.combine!==void 0&&(i.combine=e.combine),e.side!==void 0&&(i.side=e.side),e.shadowSide!==void 0&&(i.shadowSide=e.shadowSide),e.opacity!==void 0&&(i.opacity=e.opacity),e.transparent!==void 0&&(i.transparent=e.transparent),e.alphaTest!==void 0&&(i.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(i.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(i.depthFunc=e.depthFunc),e.depthTest!==void 0&&(i.depthTest=e.depthTest),e.depthWrite!==void 0&&(i.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(i.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(i.blendSrc=e.blendSrc),e.blendDst!==void 0&&(i.blendDst=e.blendDst),e.blendEquation!==void 0&&(i.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(i.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(i.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(i.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&i.blendColor!==void 0&&i.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(i.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(i.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(i.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(i.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(i.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(i.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(i.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(i.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(i.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(i.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(i.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(i.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(i.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(i.rotation=e.rotation),e.linewidth!==void 0&&(i.linewidth=e.linewidth),e.dashSize!==void 0&&(i.dashSize=e.dashSize),e.gapSize!==void 0&&(i.gapSize=e.gapSize),e.scale!==void 0&&(i.scale=e.scale),e.polygonOffset!==void 0&&(i.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(i.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(i.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(i.dithering=e.dithering),e.alphaToCoverage!==void 0&&(i.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(i.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(i.forceSinglePass=e.forceSinglePass),e.visible!==void 0&&(i.visible=e.visible),e.toneMapped!==void 0&&(i.toneMapped=e.toneMapped),e.userData!==void 0&&(i.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?i.vertexColors=e.vertexColors>0:i.vertexColors=e.vertexColors),e.uniforms!==void 0)for(let r in e.uniforms){let o=e.uniforms[r];switch(i.uniforms[r]={},o.type){case"t":i.uniforms[r].value=n(o.value);break;case"c":i.uniforms[r].value=new Be().setHex(o.value);break;case"v2":i.uniforms[r].value=new _e().fromArray(o.value);break;case"v3":i.uniforms[r].value=new L().fromArray(o.value);break;case"v4":i.uniforms[r].value=new kt().fromArray(o.value);break;case"m3":i.uniforms[r].value=new wt().fromArray(o.value);break;case"m4":i.uniforms[r].value=new ct().fromArray(o.value);break;default:i.uniforms[r].value=o.value}}if(e.defines!==void 0&&(i.defines=e.defines),e.vertexShader!==void 0&&(i.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(i.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(i.glslVersion=e.glslVersion),e.extensions!==void 0)for(let r in e.extensions)i.extensions[r]=e.extensions[r];if(e.lights!==void 0&&(i.lights=e.lights),e.clipping!==void 0&&(i.clipping=e.clipping),e.size!==void 0&&(i.size=e.size),e.sizeAttenuation!==void 0&&(i.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(i.map=n(e.map)),e.matcap!==void 0&&(i.matcap=n(e.matcap)),e.alphaMap!==void 0&&(i.alphaMap=n(e.alphaMap)),e.bumpMap!==void 0&&(i.bumpMap=n(e.bumpMap)),e.bumpScale!==void 0&&(i.bumpScale=e.bumpScale),e.normalMap!==void 0&&(i.normalMap=n(e.normalMap)),e.normalMapType!==void 0&&(i.normalMapType=e.normalMapType),e.normalScale!==void 0){let r=e.normalScale;Array.isArray(r)===!1&&(r=[r,r]),i.normalScale=new _e().fromArray(r)}return e.displacementMap!==void 0&&(i.displacementMap=n(e.displacementMap)),e.displacementScale!==void 0&&(i.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(i.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(i.roughnessMap=n(e.roughnessMap)),e.metalnessMap!==void 0&&(i.metalnessMap=n(e.metalnessMap)),e.emissiveMap!==void 0&&(i.emissiveMap=n(e.emissiveMap)),e.emissiveIntensity!==void 0&&(i.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(i.specularMap=n(e.specularMap)),e.specularIntensityMap!==void 0&&(i.specularIntensityMap=n(e.specularIntensityMap)),e.specularColorMap!==void 0&&(i.specularColorMap=n(e.specularColorMap)),e.envMap!==void 0&&(i.envMap=n(e.envMap)),e.envMapRotation!==void 0&&i.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(i.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(i.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(i.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(i.lightMap=n(e.lightMap)),e.lightMapIntensity!==void 0&&(i.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(i.aoMap=n(e.aoMap)),e.aoMapIntensity!==void 0&&(i.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(i.gradientMap=n(e.gradientMap)),e.clearcoatMap!==void 0&&(i.clearcoatMap=n(e.clearcoatMap)),e.clearcoatRoughnessMap!==void 0&&(i.clearcoatRoughnessMap=n(e.clearcoatRoughnessMap)),e.clearcoatNormalMap!==void 0&&(i.clearcoatNormalMap=n(e.clearcoatNormalMap)),e.clearcoatNormalScale!==void 0&&(i.clearcoatNormalScale=new _e().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(i.iridescenceMap=n(e.iridescenceMap)),e.iridescenceThicknessMap!==void 0&&(i.iridescenceThicknessMap=n(e.iridescenceThicknessMap)),e.transmissionMap!==void 0&&(i.transmissionMap=n(e.transmissionMap)),e.thicknessMap!==void 0&&(i.thicknessMap=n(e.thicknessMap)),e.anisotropyMap!==void 0&&(i.anisotropyMap=n(e.anisotropyMap)),e.sheenColorMap!==void 0&&(i.sheenColorMap=n(e.sheenColorMap)),e.sheenRoughnessMap!==void 0&&(i.sheenRoughnessMap=n(e.sheenRoughnessMap)),i}setTextures(e){return this.textures=e,this}createMaterialFromType(e){return s.createMaterialFromType(e)}static createMaterialFromType(e){let t={ShadowMaterial:Sh,SpriteMaterial:Oa,RawShaderMaterial:wh,ShaderMaterial:Ot,PointsMaterial:kr,MeshPhysicalMaterial:ii,MeshStandardMaterial:$s,MeshPhongMaterial:Eh,MeshToonMaterial:Ah,MeshNormalMaterial:Th,MeshLambertMaterial:Rh,MeshDepthMaterial:Ua,MeshDistanceMaterial:Na,MeshBasicMaterial:zn,MeshMatcapMaterial:Ch,LineDashedMaterial:Ph,LineBasicMaterial:Dn,Material:xn};return new t[e]}},Xi=class{static decodeText(e){if(console.warn("THREE.LoaderUtils: decodeText() has been deprecated with r165 and will be removed with r175. Use TextDecoder instead."),typeof TextDecoder<"u")return new TextDecoder().decode(e);let t="";for(let n=0,i=e.length;n<i;n++)t+=String.fromCharCode(e[n]);try{return decodeURIComponent(escape(t))}catch{return t}}static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}},zh=class extends tt{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){let e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}},kh=class extends Vn{constructor(e){super(e)}load(e,t,n,i){let r=this,o=new fi(r.manager);o.setPath(r.path),o.setRequestHeader(r.requestHeader),o.setWithCredentials(r.withCredentials),o.load(e,function(a){try{t(r.parse(JSON.parse(a)))}catch(l){i?i(l):console.error(l),r.manager.itemError(e)}},n,i)}parse(e){let t={},n={};function i(d,p){if(t[p]!==void 0)return t[p];let g=d.interleavedBuffers[p],m=r(d,g.buffer),y=vo(g.type,m),_=new Ts(y,g.stride);return _.uuid=g.uuid,t[p]=_,_}function r(d,p){if(n[p]!==void 0)return n[p];let g=d.arrayBuffers[p],m=new Uint32Array(g).buffer;return n[p]=m,m}let o=e.isInstancedBufferGeometry?new zh:new tt,a=e.data.index;if(a!==void 0){let d=vo(a.type,a.array);o.setIndex(new ht(d,1))}let l=e.data.attributes;for(let d in l){let p=l[d],x;if(p.isInterleavedBufferAttribute){let g=i(e.data,p.data);x=new es(g,p.itemSize,p.offset,p.normalized)}else{let g=vo(p.type,p.array),m=p.isInstancedBufferAttribute?kn:ht;x=new m(g,p.itemSize,p.normalized)}p.name!==void 0&&(x.name=p.name),p.usage!==void 0&&x.setUsage(p.usage),o.setAttribute(d,x)}let c=e.data.morphAttributes;if(c)for(let d in c){let p=c[d],x=[];for(let g=0,m=p.length;g<m;g++){let y=p[g],_;if(y.isInterleavedBufferAttribute){let v=i(e.data,y.data);_=new es(v,y.itemSize,y.offset,y.normalized)}else{let v=vo(y.type,y.array);_=new ht(v,y.itemSize,y.normalized)}y.name!==void 0&&(_.name=y.name),x.push(_)}o.morphAttributes[d]=x}e.data.morphTargetsRelative&&(o.morphTargetsRelative=!0);let u=e.data.groups||e.data.drawcalls||e.data.offsets;if(u!==void 0)for(let d=0,p=u.length;d!==p;++d){let x=u[d];o.addGroup(x.start,x.count,x.materialIndex)}let f=e.data.boundingSphere;if(f!==void 0){let d=new L;f.center!==void 0&&d.fromArray(f.center),o.boundingSphere=new Rn(d,f.radius)}return e.name&&(o.name=e.name),e.userData&&(o.userData=e.userData),o}},Yf=class extends Vn{constructor(e){super(e)}load(e,t,n,i){let r=this,o=this.path===""?Xi.extractUrlBase(e):this.path;this.resourcePath=this.resourcePath||o;let a=new fi(this.manager);a.setPath(this.path),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(e,function(l){let c=null;try{c=JSON.parse(l)}catch(u){i!==void 0&&i(u),console.error("THREE:ObjectLoader: Can't parse "+e+".",u.message);return}let h=c.metadata;if(h===void 0||h.type===void 0||h.type.toLowerCase()==="geometry"){i!==void 0&&i(new Error("THREE.ObjectLoader: Can't load "+e)),console.error("THREE.ObjectLoader: Can't load "+e);return}r.parse(c,t)},n,i)}async loadAsync(e,t){let n=this,i=this.path===""?Xi.extractUrlBase(e):this.path;this.resourcePath=this.resourcePath||i;let r=new fi(this.manager);r.setPath(this.path),r.setRequestHeader(this.requestHeader),r.setWithCredentials(this.withCredentials);let o=await r.loadAsync(e,t),a=JSON.parse(o),l=a.metadata;if(l===void 0||l.type===void 0||l.type.toLowerCase()==="geometry")throw new Error("THREE.ObjectLoader: Can't load "+e);return await n.parseAsync(a)}parse(e,t){let n=this.parseAnimations(e.animations),i=this.parseShapes(e.shapes),r=this.parseGeometries(e.geometries,i),o=this.parseImages(e.images,function(){t!==void 0&&t(c)}),a=this.parseTextures(e.textures,o),l=this.parseMaterials(e.materials,a),c=this.parseObject(e.object,r,l,a,n),h=this.parseSkeletons(e.skeletons,c);if(this.bindSkeletons(c,h),this.bindLightTargets(c),t!==void 0){let u=!1;for(let f in o)if(o[f].data instanceof HTMLImageElement){u=!0;break}u===!1&&t(c)}return c}async parseAsync(e){let t=this.parseAnimations(e.animations),n=this.parseShapes(e.shapes),i=this.parseGeometries(e.geometries,n),r=await this.parseImagesAsync(e.images),o=this.parseTextures(e.textures,r),a=this.parseMaterials(e.materials,o),l=this.parseObject(e.object,i,a,o,t),c=this.parseSkeletons(e.skeletons,l);return this.bindSkeletons(l,c),this.bindLightTargets(l),l}parseShapes(e){let t={};if(e!==void 0)for(let n=0,i=e.length;n<i;n++){let r=new bs().fromJSON(e[n]);t[r.uuid]=r}return t}parseSkeletons(e,t){let n={},i={};if(t.traverse(function(r){r.isBone&&(i[r.uuid]=r)}),e!==void 0)for(let r=0,o=e.length;r<o;r++){let a=new Ro().fromJSON(e[r],i);n[a.uuid]=a}return n}parseGeometries(e,t){let n={};if(e!==void 0){let i=new kh;for(let r=0,o=e.length;r<o;r++){let a,l=e[r];switch(l.type){case"BufferGeometry":case"InstancedBufferGeometry":a=i.parse(l);break;default:l.type in a0?a=a0[l.type].fromJSON(l,t):console.warn(`THREE.ObjectLoader: Unsupported geometry type "${l.type}"`)}a.uuid=l.uuid,l.name!==void 0&&(a.name=l.name),l.userData!==void 0&&(a.userData=l.userData),n[l.uuid]=a}}return n}parseMaterials(e,t){let n={},i={};if(e!==void 0){let r=new Bh;r.setTextures(t);for(let o=0,a=e.length;o<a;o++){let l=e[o];n[l.uuid]===void 0&&(n[l.uuid]=r.parse(l)),i[l.uuid]=n[l.uuid]}}return i}parseAnimations(e){let t={};if(e!==void 0)for(let n=0;n<e.length;n++){let i=e[n],r=Is.parse(i);t[r.uuid]=r}return t}parseImages(e,t){let n=this,i={},r;function o(l){return n.manager.itemStart(l),r.load(l,function(){n.manager.itemEnd(l)},void 0,function(){n.manager.itemError(l),n.manager.itemEnd(l)})}function a(l){if(typeof l=="string"){let c=l,h=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(c)?c:n.resourcePath+c;return o(h)}else return l.data?{data:vo(l.type,l.data),width:l.width,height:l.height}:null}if(e!==void 0&&e.length>0){let l=new Ja(t);r=new Wr(l),r.setCrossOrigin(this.crossOrigin);for(let c=0,h=e.length;c<h;c++){let u=e[c],f=u.url;if(Array.isArray(f)){let d=[];for(let p=0,x=f.length;p<x;p++){let g=f[p],m=a(g);m!==null&&(m instanceof HTMLImageElement?d.push(m):d.push(new Ri(m.data,m.width,m.height)))}i[u.uuid]=new vs(d)}else{let d=a(u.url);i[u.uuid]=new vs(d)}}}return i}async parseImagesAsync(e){let t=this,n={},i;async function r(o){if(typeof o=="string"){let a=o,l=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(a)?a:t.resourcePath+a;return await i.loadAsync(l)}else return o.data?{data:vo(o.type,o.data),width:o.width,height:o.height}:null}if(e!==void 0&&e.length>0){i=new Wr(this.manager),i.setCrossOrigin(this.crossOrigin);for(let o=0,a=e.length;o<a;o++){let l=e[o],c=l.url;if(Array.isArray(c)){let h=[];for(let u=0,f=c.length;u<f;u++){let d=c[u],p=await r(d);p!==null&&(p instanceof HTMLImageElement?h.push(p):h.push(new Ri(p.data,p.width,p.height)))}n[l.uuid]=new vs(h)}else{let h=await r(l.url);n[l.uuid]=new vs(h)}}}return n}parseTextures(e,t){function n(r,o){return typeof r=="number"?r:(console.warn("THREE.ObjectLoader.parseTexture: Constant should be in numeric form.",r),o[r])}let i={};if(e!==void 0)for(let r=0,o=e.length;r<o;r++){let a=e[r];a.image===void 0&&console.warn('THREE.ObjectLoader: No "image" specified for',a.uuid),t[a.image]===void 0&&console.warn("THREE.ObjectLoader: Undefined image",a.image);let l=t[a.image],c=l.data,h;Array.isArray(c)?(h=new Fr,c.length===6&&(h.needsUpdate=!0)):(c&&c.data?h=new Ri:h=new dn,c&&(h.needsUpdate=!0)),h.source=l,h.uuid=a.uuid,a.name!==void 0&&(h.name=a.name),a.mapping!==void 0&&(h.mapping=n(a.mapping,$b)),a.channel!==void 0&&(h.channel=a.channel),a.offset!==void 0&&h.offset.fromArray(a.offset),a.repeat!==void 0&&h.repeat.fromArray(a.repeat),a.center!==void 0&&h.center.fromArray(a.center),a.rotation!==void 0&&(h.rotation=a.rotation),a.wrap!==void 0&&(h.wrapS=n(a.wrap[0],u0),h.wrapT=n(a.wrap[1],u0)),a.format!==void 0&&(h.format=a.format),a.internalFormat!==void 0&&(h.internalFormat=a.internalFormat),a.type!==void 0&&(h.type=a.type),a.colorSpace!==void 0&&(h.colorSpace=a.colorSpace),a.minFilter!==void 0&&(h.minFilter=n(a.minFilter,f0)),a.magFilter!==void 0&&(h.magFilter=n(a.magFilter,f0)),a.anisotropy!==void 0&&(h.anisotropy=a.anisotropy),a.flipY!==void 0&&(h.flipY=a.flipY),a.generateMipmaps!==void 0&&(h.generateMipmaps=a.generateMipmaps),a.premultiplyAlpha!==void 0&&(h.premultiplyAlpha=a.premultiplyAlpha),a.unpackAlignment!==void 0&&(h.unpackAlignment=a.unpackAlignment),a.compareFunction!==void 0&&(h.compareFunction=a.compareFunction),a.userData!==void 0&&(h.userData=a.userData),i[a.uuid]=h}return i}parseObject(e,t,n,i,r){let o;function a(f){return t[f]===void 0&&console.warn("THREE.ObjectLoader: Undefined geometry",f),t[f]}function l(f){if(f!==void 0){if(Array.isArray(f)){let d=[];for(let p=0,x=f.length;p<x;p++){let g=f[p];n[g]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",g),d.push(n[g])}return d}return n[f]===void 0&&console.warn("THREE.ObjectLoader: Undefined material",f),n[f]}}function c(f){return i[f]===void 0&&console.warn("THREE.ObjectLoader: Undefined texture",f),i[f]}let h,u;switch(e.type){case"Scene":o=new Br,e.background!==void 0&&(Number.isInteger(e.background)?o.background=new Be(e.background):o.background=c(e.background)),e.environment!==void 0&&(o.environment=c(e.environment)),e.fog!==void 0&&(e.fog.type==="Fog"?o.fog=new eh(e.fog.color,e.fog.near,e.fog.far):e.fog.type==="FogExp2"&&(o.fog=new Qc(e.fog.color,e.fog.density)),e.fog.name!==""&&(o.fog.name=e.fog.name)),e.backgroundBlurriness!==void 0&&(o.backgroundBlurriness=e.backgroundBlurriness),e.backgroundIntensity!==void 0&&(o.backgroundIntensity=e.backgroundIntensity),e.backgroundRotation!==void 0&&o.backgroundRotation.fromArray(e.backgroundRotation),e.environmentIntensity!==void 0&&(o.environmentIntensity=e.environmentIntensity),e.environmentRotation!==void 0&&o.environmentRotation.fromArray(e.environmentRotation);break;case"PerspectiveCamera":o=new Mn(e.fov,e.aspect,e.near,e.far),e.focus!==void 0&&(o.focus=e.focus),e.zoom!==void 0&&(o.zoom=e.zoom),e.filmGauge!==void 0&&(o.filmGauge=e.filmGauge),e.filmOffset!==void 0&&(o.filmOffset=e.filmOffset),e.view!==void 0&&(o.view=Object.assign({},e.view));break;case"OrthographicCamera":o=new Qi(e.left,e.right,e.top,e.bottom,e.near,e.far),e.zoom!==void 0&&(o.zoom=e.zoom),e.view!==void 0&&(o.view=Object.assign({},e.view));break;case"AmbientLight":o=new Uh(e.color,e.intensity);break;case"DirectionalLight":o=new Ls(e.color,e.intensity),o.target=e.target||"";break;case"PointLight":o=new Ks(e.color,e.intensity,e.distance,e.decay);break;case"RectAreaLight":o=new Nh(e.color,e.intensity,e.width,e.height);break;case"SpotLight":o=new Fo(e.color,e.intensity,e.distance,e.angle,e.penumbra,e.decay),o.target=e.target||"";break;case"HemisphereLight":o=new No(e.color,e.groundColor,e.intensity);break;case"LightProbe":o=new Oh().fromJSON(e);break;case"SkinnedMesh":h=a(e.geometry),u=l(e.material),o=new Ys(h,u),e.bindMode!==void 0&&(o.bindMode=e.bindMode),e.bindMatrix!==void 0&&o.bindMatrix.fromArray(e.bindMatrix),e.skeleton!==void 0&&(o.skeleton=e.skeleton);break;case"Mesh":h=a(e.geometry),u=l(e.material),o=new Ft(h,u);break;case"InstancedMesh":h=a(e.geometry),u=l(e.material);let f=e.count,d=e.instanceMatrix,p=e.instanceColor;o=new Wi(h,u,f),o.instanceMatrix=new kn(new Float32Array(d.array),16),p!==void 0&&(o.instanceColor=new kn(new Float32Array(p.array),p.itemSize));break;case"BatchedMesh":h=a(e.geometry),u=l(e.material),o=new ih(e.maxInstanceCount,e.maxVertexCount,e.maxIndexCount,u),o.geometry=h,o.perObjectFrustumCulled=e.perObjectFrustumCulled,o.sortObjects=e.sortObjects,o._drawRanges=e.drawRanges,o._reservedRanges=e.reservedRanges,o._visibility=e.visibility,o._active=e.active,o._bounds=e.bounds.map(x=>{let g=new wn;g.min.fromArray(x.boxMin),g.max.fromArray(x.boxMax);let m=new Rn;return m.radius=x.sphereRadius,m.center.fromArray(x.sphereCenter),{boxInitialized:x.boxInitialized,box:g,sphereInitialized:x.sphereInitialized,sphere:m}}),o._maxInstanceCount=e.maxInstanceCount,o._maxVertexCount=e.maxVertexCount,o._maxIndexCount=e.maxIndexCount,o._geometryInitialized=e.geometryInitialized,o._geometryCount=e.geometryCount,o._matricesTexture=c(e.matricesTexture.uuid),e.colorsTexture!==void 0&&(o._colorsTexture=c(e.colorsTexture.uuid));break;case"LOD":o=new nh;break;case"Line":o=new Ii(a(e.geometry),l(e.material));break;case"LineLoop":o=new Co(a(e.geometry),l(e.material));break;case"LineSegments":o=new ui(a(e.geometry),l(e.material));break;case"PointCloud":case"Points":o=new Hn(a(e.geometry),l(e.material));break;case"Sprite":o=new th(l(e.material));break;case"Group":o=new bn;break;case"Bone":o=new zr;break;default:o=new Kt}if(o.uuid=e.uuid,e.name!==void 0&&(o.name=e.name),e.matrix!==void 0?(o.matrix.fromArray(e.matrix),e.matrixAutoUpdate!==void 0&&(o.matrixAutoUpdate=e.matrixAutoUpdate),o.matrixAutoUpdate&&o.matrix.decompose(o.position,o.quaternion,o.scale)):(e.position!==void 0&&o.position.fromArray(e.position),e.rotation!==void 0&&o.rotation.fromArray(e.rotation),e.quaternion!==void 0&&o.quaternion.fromArray(e.quaternion),e.scale!==void 0&&o.scale.fromArray(e.scale)),e.up!==void 0&&o.up.fromArray(e.up),e.castShadow!==void 0&&(o.castShadow=e.castShadow),e.receiveShadow!==void 0&&(o.receiveShadow=e.receiveShadow),e.shadow&&(e.shadow.intensity!==void 0&&(o.shadow.intensity=e.shadow.intensity),e.shadow.bias!==void 0&&(o.shadow.bias=e.shadow.bias),e.shadow.normalBias!==void 0&&(o.shadow.normalBias=e.shadow.normalBias),e.shadow.radius!==void 0&&(o.shadow.radius=e.shadow.radius),e.shadow.mapSize!==void 0&&o.shadow.mapSize.fromArray(e.shadow.mapSize),e.shadow.camera!==void 0&&(o.shadow.camera=this.parseObject(e.shadow.camera))),e.visible!==void 0&&(o.visible=e.visible),e.frustumCulled!==void 0&&(o.frustumCulled=e.frustumCulled),e.renderOrder!==void 0&&(o.renderOrder=e.renderOrder),e.userData!==void 0&&(o.userData=e.userData),e.layers!==void 0&&(o.layers.mask=e.layers),e.children!==void 0){let f=e.children;for(let d=0;d<f.length;d++)o.add(this.parseObject(f[d],t,n,i,r))}if(e.animations!==void 0){let f=e.animations;for(let d=0;d<f.length;d++){let p=f[d];o.animations.push(r[p])}}if(e.type==="LOD"){e.autoUpdate!==void 0&&(o.autoUpdate=e.autoUpdate);let f=e.levels;for(let d=0;d<f.length;d++){let p=f[d],x=o.getObjectByProperty("uuid",p.object);x!==void 0&&o.addLevel(x,p.distance,p.hysteresis)}}return o}bindSkeletons(e,t){Object.keys(t).length!==0&&e.traverse(function(n){if(n.isSkinnedMesh===!0&&n.skeleton!==void 0){let i=t[n.skeleton];i===void 0?console.warn("THREE.ObjectLoader: No skeleton found with UUID:",n.skeleton):n.bind(i,n.bindMatrix)}})}bindLightTargets(e){e.traverse(function(t){if(t.isDirectionalLight||t.isSpotLight){let n=t.target,i=e.getObjectByProperty("uuid",n);i!==void 0?t.target=i:t.target=new Kt}})}},$b={UVMapping:qh,CubeReflectionMapping:Ss,CubeRefractionMapping:Ws,EquirectangularReflectionMapping:Sa,EquirectangularRefractionMapping:wa,CubeUVReflectionMapping:Oo},u0={RepeatWrapping:ws,ClampToEdgeWrapping:ci,MirroredRepeatWrapping:Pr},f0={NearestFilter:Tn,NearestMipmapNearestFilter:rl,NearestMipmapLinearFilter:Gs,LinearFilter:cn,LinearMipmapNearestFilter:Er,LinearMipmapLinearFilter:yi},el=class extends Vn{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"}}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=_s.get(e);if(o!==void 0){if(r.manager.itemStart(e),o.then){o.then(c=>{t&&t(c),r.manager.itemEnd(e)}).catch(c=>{i&&i(c)});return}return setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0),o}let a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader;let l=fetch(e,a).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(r.options,{colorSpaceConversion:"none"}))}).then(function(c){return _s.add(e,c),t&&t(c),r.manager.itemEnd(e),c}).catch(function(c){i&&i(c),_s.remove(e),r.manager.itemError(e),r.manager.itemEnd(e)});_s.add(e,l),r.manager.itemStart(e)}},oc,tl=class{static getContext(){return oc===void 0&&(oc=new(window.AudioContext||window.webkitAudioContext)),oc}static setContext(e){oc=e}},Zf=class extends Vn{constructor(e){super(e)}load(e,t,n,i){let r=this,o=new fi(this.manager);o.setResponseType("arraybuffer"),o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(l){try{let c=l.slice(0);tl.getContext().decodeAudioData(c,function(u){t(u)}).catch(a)}catch(c){a(c)}},n,i);function a(l){i?i(l):console.error(l),r.manager.itemError(e)}}},d0=new ct,p0=new ct,dr=new ct,$f=class{constructor(){this.type="StereoCamera",this.aspect=1,this.eyeSep=.064,this.cameraL=new Mn,this.cameraL.layers.enable(1),this.cameraL.matrixAutoUpdate=!1,this.cameraR=new Mn,this.cameraR.layers.enable(2),this.cameraR.matrixAutoUpdate=!1,this._cache={focus:null,fov:null,aspect:null,near:null,far:null,zoom:null,eyeSep:null}}update(e){let t=this._cache;if(t.focus!==e.focus||t.fov!==e.fov||t.aspect!==e.aspect*this.aspect||t.near!==e.near||t.far!==e.far||t.zoom!==e.zoom||t.eyeSep!==this.eyeSep){t.focus=e.focus,t.fov=e.fov,t.aspect=e.aspect*this.aspect,t.near=e.near,t.far=e.far,t.zoom=e.zoom,t.eyeSep=this.eyeSep,dr.copy(e.projectionMatrix);let i=t.eyeSep/2,r=i*t.near/t.focus,o=t.near*Math.tan(Tr*t.fov*.5)/t.zoom,a,l;p0.elements[12]=-i,d0.elements[12]=i,a=-o*t.aspect+r,l=o*t.aspect+r,dr.elements[0]=2*t.near/(l-a),dr.elements[8]=(l+a)/(l-a),this.cameraL.projectionMatrix.copy(dr),a=-o*t.aspect-r,l=o*t.aspect-r,dr.elements[0]=2*t.near/(l-a),dr.elements[8]=(l+a)/(l-a),this.cameraR.projectionMatrix.copy(dr)}this.cameraL.matrixWorld.copy(e.matrixWorld).multiply(p0),this.cameraR.matrixWorld.copy(e.matrixWorld).multiply(d0)}},Hh=class{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=m0(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){let t=m0();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}};function m0(){return performance.now()}var pr=new L,g0=new Sn,Kb=new L,mr=new L,Kf=class extends Kt{constructor(){super(),this.type="AudioListener",this.context=tl.getContext(),this.gain=this.context.createGain(),this.gain.connect(this.context.destination),this.filter=null,this.timeDelta=0,this._clock=new Hh}getInput(){return this.gain}removeFilter(){return this.filter!==null&&(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination),this.gain.connect(this.context.destination),this.filter=null),this}getFilter(){return this.filter}setFilter(e){return this.filter!==null?(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination)):this.gain.disconnect(this.context.destination),this.filter=e,this.gain.connect(this.filter),this.filter.connect(this.context.destination),this}getMasterVolume(){return this.gain.gain.value}setMasterVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}updateMatrixWorld(e){super.updateMatrixWorld(e);let t=this.context.listener,n=this.up;if(this.timeDelta=this._clock.getDelta(),this.matrixWorld.decompose(pr,g0,Kb),mr.set(0,0,-1).applyQuaternion(g0),t.positionX){let i=this.context.currentTime+this.timeDelta;t.positionX.linearRampToValueAtTime(pr.x,i),t.positionY.linearRampToValueAtTime(pr.y,i),t.positionZ.linearRampToValueAtTime(pr.z,i),t.forwardX.linearRampToValueAtTime(mr.x,i),t.forwardY.linearRampToValueAtTime(mr.y,i),t.forwardZ.linearRampToValueAtTime(mr.z,i),t.upX.linearRampToValueAtTime(n.x,i),t.upY.linearRampToValueAtTime(n.y,i),t.upZ.linearRampToValueAtTime(n.z,i)}else t.setPosition(pr.x,pr.y,pr.z),t.setOrientation(mr.x,mr.y,mr.z,n.x,n.y,n.z)}},Vh=class extends Kt{constructor(e){super(),this.type="Audio",this.listener=e,this.context=e.context,this.gain=this.context.createGain(),this.gain.connect(e.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,this.loop=!1,this.loopStart=0,this.loopEnd=0,this.offset=0,this.duration=void 0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.source=null,this.sourceType="empty",this._startedAt=0,this._progress=0,this._connected=!1,this.filters=[]}getOutput(){return this.gain}setNodeSource(e){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=e,this.connect(),this}setMediaElementSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(e),this.connect(),this}setMediaStreamSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaStreamNode",this.source=this.context.createMediaStreamSource(e),this.connect(),this}setBuffer(e){return this.buffer=e,this.sourceType="buffer",this.autoplay&&this.play(),this}play(e=0){if(this.isPlaying===!0){console.warn("THREE.Audio: Audio is already playing.");return}if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}this._startedAt=this.context.currentTime+e;let t=this.context.createBufferSource();return t.buffer=this.buffer,t.loop=this.loop,t.loopStart=this.loopStart,t.loopEnd=this.loopEnd,t.onended=this.onEnded.bind(this),t.start(this._startedAt,this._progress+this.offset,this.duration),this.isPlaying=!0,this.source=t,this.setDetune(this.detune),this.setPlaybackRate(this.playbackRate),this.connect()}pause(){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.isPlaying===!0&&(this._progress+=Math.max(this.context.currentTime-this._startedAt,0)*this.playbackRate,this.loop===!0&&(this._progress=this._progress%(this.duration||this.buffer.duration)),this.source.stop(),this.source.onended=null,this.isPlaying=!1),this}stop(e=0){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this._progress=0,this.source!==null&&(this.source.stop(this.context.currentTime+e),this.source.onended=null),this.isPlaying=!1,this}connect(){if(this.filters.length>0){this.source.connect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].connect(this.filters[e]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this._connected=!0,this}disconnect(){if(this._connected!==!1){if(this.filters.length>0){this.source.disconnect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].disconnect(this.filters[e]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this._connected=!1,this}}getFilters(){return this.filters}setFilters(e){return e||(e=[]),this._connected===!0?(this.disconnect(),this.filters=e.slice(),this.connect()):this.filters=e.slice(),this}setDetune(e){return this.detune=e,this.isPlaying===!0&&this.source.detune!==void 0&&this.source.detune.setTargetAtTime(this.detune,this.context.currentTime,.01),this}getDetune(){return this.detune}getFilter(){return this.getFilters()[0]}setFilter(e){return this.setFilters(e?[e]:[])}setPlaybackRate(e){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.playbackRate=e,this.isPlaying===!0&&this.source.playbackRate.setTargetAtTime(this.playbackRate,this.context.currentTime,.01),this}getPlaybackRate(){return this.playbackRate}onEnded(){this.isPlaying=!1}getLoop(){return this.hasPlaybackControl===!1?(console.warn("THREE.Audio: this Audio has no playback control."),!1):this.loop}setLoop(e){if(this.hasPlaybackControl===!1){console.warn("THREE.Audio: this Audio has no playback control.");return}return this.loop=e,this.isPlaying===!0&&(this.source.loop=this.loop),this}setLoopStart(e){return this.loopStart=e,this}setLoopEnd(e){return this.loopEnd=e,this}getVolume(){return this.gain.gain.value}setVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}},gr=new L,x0=new Sn,Jb=new L,xr=new L,Jf=class extends Vh{constructor(e){super(e),this.panner=this.context.createPanner(),this.panner.panningModel="HRTF",this.panner.connect(this.gain)}connect(){super.connect(),this.panner.connect(this.gain)}disconnect(){super.disconnect(),this.panner.disconnect(this.gain)}getOutput(){return this.panner}getRefDistance(){return this.panner.refDistance}setRefDistance(e){return this.panner.refDistance=e,this}getRolloffFactor(){return this.panner.rolloffFactor}setRolloffFactor(e){return this.panner.rolloffFactor=e,this}getDistanceModel(){return this.panner.distanceModel}setDistanceModel(e){return this.panner.distanceModel=e,this}getMaxDistance(){return this.panner.maxDistance}setMaxDistance(e){return this.panner.maxDistance=e,this}setDirectionalCone(e,t,n){return this.panner.coneInnerAngle=e,this.panner.coneOuterAngle=t,this.panner.coneOuterGain=n,this}updateMatrixWorld(e){if(super.updateMatrixWorld(e),this.hasPlaybackControl===!0&&this.isPlaying===!1)return;this.matrixWorld.decompose(gr,x0,Jb),xr.set(0,0,1).applyQuaternion(x0);let t=this.panner;if(t.positionX){let n=this.context.currentTime+this.listener.timeDelta;t.positionX.linearRampToValueAtTime(gr.x,n),t.positionY.linearRampToValueAtTime(gr.y,n),t.positionZ.linearRampToValueAtTime(gr.z,n),t.orientationX.linearRampToValueAtTime(xr.x,n),t.orientationY.linearRampToValueAtTime(xr.y,n),t.orientationZ.linearRampToValueAtTime(xr.z,n)}else t.setPosition(gr.x,gr.y,gr.z),t.setOrientation(xr.x,xr.y,xr.z)}},jf=class{constructor(e,t=2048){this.analyser=e.context.createAnalyser(),this.analyser.fftSize=t,this.data=new Uint8Array(this.analyser.frequencyBinCount),e.getOutput().connect(this.analyser)}getFrequencyData(){return this.analyser.getByteFrequencyData(this.data),this.data}getAverageFrequency(){let e=0,t=this.getFrequencyData();for(let n=0;n<t.length;n++)e+=t[n];return e/t.length}},Gh=class{constructor(e,t,n){this.binding=e,this.valueSize=n;let i,r,o;switch(t){case"quaternion":i=this._slerp,r=this._slerpAdditive,o=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(n*6),this._workIndex=5;break;case"string":case"bool":i=this._select,r=this._select,o=this._setAdditiveIdentityOther,this.buffer=new Array(n*5);break;default:i=this._lerp,r=this._lerpAdditive,o=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(n*5)}this._mixBufferRegion=i,this._mixBufferRegionAdditive=r,this._setIdentity=o,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){let n=this.buffer,i=this.valueSize,r=e*i+i,o=this.cumulativeWeight;if(o===0){for(let a=0;a!==i;++a)n[r+a]=n[a];o=t}else{o+=t;let a=t/o;this._mixBufferRegion(n,r,0,a,i)}this.cumulativeWeight=o}accumulateAdditive(e){let t=this.buffer,n=this.valueSize,i=n*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,i,0,e,n),this.cumulativeWeightAdditive+=e}apply(e){let t=this.valueSize,n=this.buffer,i=e*t+t,r=this.cumulativeWeight,o=this.cumulativeWeightAdditive,a=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,r<1){let l=t*this._origIndex;this._mixBufferRegion(n,i,l,1-r,t)}o>0&&this._mixBufferRegionAdditive(n,i,this._addIndex*t,1,t);for(let l=t,c=t+t;l!==c;++l)if(n[l]!==n[l+t]){a.setValue(n,i);break}}saveOriginalState(){let e=this.binding,t=this.buffer,n=this.valueSize,i=n*this._origIndex;e.getValue(t,i);for(let r=n,o=i;r!==o;++r)t[r]=t[i+r%n];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){let e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){let e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let n=e;n<t;n++)this.buffer[n]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){let e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let n=0;n<this.valueSize;n++)this.buffer[t+n]=this.buffer[e+n]}_select(e,t,n,i,r){if(i>=.5)for(let o=0;o!==r;++o)e[t+o]=e[n+o]}_slerp(e,t,n,i){Sn.slerpFlat(e,t,e,t,e,n,i)}_slerpAdditive(e,t,n,i,r){let o=this._workIndex*r;Sn.multiplyQuaternionsFlat(e,o,e,t,e,n),Sn.slerpFlat(e,t,e,t,e,o,i)}_lerp(e,t,n,i,r){let o=1-i;for(let a=0;a!==r;++a){let l=t+a;e[l]=e[l]*o+e[n+a]*i}}_lerpAdditive(e,t,n,i,r){for(let o=0;o!==r;++o){let a=t+o;e[a]=e[a]+e[n+o]*i}}},Xd="\\[\\]\\.:\\/",jb=new RegExp("["+Xd+"]","g"),qd="[^"+Xd+"]",Qb="[^"+Xd.replace("\\.","")+"]",eS=/((?:WC+[\/:])*)/.source.replace("WC",qd),tS=/(WCOD+)?/.source.replace("WCOD",Qb),nS=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",qd),iS=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",qd),sS=new RegExp("^"+eS+tS+nS+iS+"$"),rS=["material","materials","bones","map"],Qf=class{constructor(e,t,n){let i=n||tn.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},tn=class s{constructor(e,t,n){this.path=t,this.parsedPath=n||s.parseTrackName(t),this.node=s.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new s.Composite(e,t,n):new s(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(jb,"")}static parseTrackName(e){let t=sS.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);rS.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===t||a.uuid===t)return a;let l=n(a.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,i=t.propertyName,r=t.propertyIndex;if(e||(e=s.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[i];if(o===void 0){let c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.needsUpdate!==void 0?a=this.Versioning.NeedsUpdate:e.matrixWorldNeedsUpdate!==void 0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};tn.Composite=Qf;tn.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};tn.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};tn.prototype.GetterByBindingType=[tn.prototype._getValue_direct,tn.prototype._getValue_array,tn.prototype._getValue_arrayElement,tn.prototype._getValue_toArray];tn.prototype.SetterByBindingTypeAndVersioning=[[tn.prototype._setValue_direct,tn.prototype._setValue_direct_setNeedsUpdate,tn.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[tn.prototype._setValue_array,tn.prototype._setValue_array_setNeedsUpdate,tn.prototype._setValue_array_setMatrixWorldNeedsUpdate],[tn.prototype._setValue_arrayElement,tn.prototype._setValue_arrayElement_setNeedsUpdate,tn.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[tn.prototype._setValue_fromArray,tn.prototype._setValue_fromArray_setNeedsUpdate,tn.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var ed=class{constructor(){this.isAnimationObjectGroup=!0,this.uuid=Mi(),this._objects=Array.prototype.slice.call(arguments),this.nCachedObjects_=0;let e={};this._indicesByUUID=e;for(let n=0,i=arguments.length;n!==i;++n)e[arguments[n].uuid]=n;this._paths=[],this._parsedPaths=[],this._bindings=[],this._bindingsIndicesByPath={};let t=this;this.stats={objects:{get total(){return t._objects.length},get inUse(){return this.total-t.nCachedObjects_}},get bindingsPerObject(){return t._bindings.length}}}add(){let e=this._objects,t=this._indicesByUUID,n=this._paths,i=this._parsedPaths,r=this._bindings,o=r.length,a,l=e.length,c=this.nCachedObjects_;for(let h=0,u=arguments.length;h!==u;++h){let f=arguments[h],d=f.uuid,p=t[d];if(p===void 0){p=l++,t[d]=p,e.push(f);for(let x=0,g=o;x!==g;++x)r[x].push(new tn(f,n[x],i[x]))}else if(p<c){a=e[p];let x=--c,g=e[x];t[g.uuid]=p,e[p]=g,t[d]=x,e[x]=f;for(let m=0,y=o;m!==y;++m){let _=r[m],v=_[x],F=_[p];_[p]=v,F===void 0&&(F=new tn(f,n[m],i[m])),_[x]=F}}else e[p]!==a&&console.error("THREE.AnimationObjectGroup: Different objects with the same UUID detected. Clean the caches or recreate your infrastructure when reloading scenes.")}this.nCachedObjects_=c}remove(){let e=this._objects,t=this._indicesByUUID,n=this._bindings,i=n.length,r=this.nCachedObjects_;for(let o=0,a=arguments.length;o!==a;++o){let l=arguments[o],c=l.uuid,h=t[c];if(h!==void 0&&h>=r){let u=r++,f=e[u];t[f.uuid]=h,e[h]=f,t[c]=u,e[u]=l;for(let d=0,p=i;d!==p;++d){let x=n[d],g=x[u],m=x[h];x[h]=g,x[u]=m}}}this.nCachedObjects_=r}uncache(){let e=this._objects,t=this._indicesByUUID,n=this._bindings,i=n.length,r=this.nCachedObjects_,o=e.length;for(let a=0,l=arguments.length;a!==l;++a){let c=arguments[a],h=c.uuid,u=t[h];if(u!==void 0)if(delete t[h],u<r){let f=--r,d=e[f],p=--o,x=e[p];t[d.uuid]=u,e[u]=d,t[x.uuid]=f,e[f]=x,e.pop();for(let g=0,m=i;g!==m;++g){let y=n[g],_=y[f],v=y[p];y[u]=_,y[f]=v,y.pop()}}else{let f=--o,d=e[f];f>0&&(t[d.uuid]=u),e[u]=d,e.pop();for(let p=0,x=i;p!==x;++p){let g=n[p];g[u]=g[f],g.pop()}}}this.nCachedObjects_=r}subscribe_(e,t){let n=this._bindingsIndicesByPath,i=n[e],r=this._bindings;if(i!==void 0)return r[i];let o=this._paths,a=this._parsedPaths,l=this._objects,c=l.length,h=this.nCachedObjects_,u=new Array(c);i=r.length,n[e]=i,o.push(e),a.push(t),r.push(u);for(let f=h,d=l.length;f!==d;++f){let p=l[f];u[f]=new tn(p,e,t)}return u}unsubscribe_(e){let t=this._bindingsIndicesByPath,n=t[e];if(n!==void 0){let i=this._paths,r=this._parsedPaths,o=this._bindings,a=o.length-1,l=o[a],c=e[a];t[c]=n,o[n]=l,o.pop(),r[n]=r[a],r.pop(),i[n]=i[a],i.pop()}}},Wh=class{constructor(e,t,n=null,i=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=n,this.blendMode=i;let r=t.tracks,o=r.length,a=new Array(o),l={endingStart:Mr,endingEnd:Mr};for(let c=0;c!==o;++c){let h=r[c].createInterpolant(null);a[c]=h,h.settings=l}this._interpolantSettings=l,this._interpolants=a,this._propertyBindings=new Array(o),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=og,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,n){if(e.fadeOut(t),this.fadeIn(t),n){let i=this._clip.duration,r=e._clip.duration,o=r/i,a=i/r;e.warp(1,o,t),this.warp(a,1,t)}return this}crossFadeTo(e,t,n){return e.crossFadeFrom(this,t,n)}stopFading(){let e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,n){let i=this._mixer,r=i.time,o=this.timeScale,a=this._timeScaleInterpolant;a===null&&(a=i._lendControlInterpolant(),this._timeScaleInterpolant=a);let l=a.parameterPositions,c=a.sampleValues;return l[0]=r,l[1]=r+n,c[0]=e/o,c[1]=t/o,this}stopWarping(){let e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,n,i){if(!this.enabled){this._updateWeight(e);return}let r=this._startTime;if(r!==null){let l=(e-r)*n;l<0||n===0?t=0:(this._startTime=null,t=n*l)}t*=this._updateTimeScale(e);let o=this._updateTime(t),a=this._updateWeight(e);if(a>0){let l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case Od:for(let h=0,u=l.length;h!==u;++h)l[h].evaluate(o),c[h].accumulateAdditive(a);break;case Qh:default:for(let h=0,u=l.length;h!==u;++h)l[h].evaluate(o),c[h].accumulate(i,a)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;let n=this._weightInterpolant;if(n!==null){let i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopFading(),i===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;let n=this._timeScaleInterpolant;if(n!==null){let i=n.evaluate(e)[0];t*=i,e>n.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){let t=this._clip.duration,n=this.loop,i=this.time+e,r=this._loopCount,o=n===ag;if(e===0)return r===-1?i:o&&(r&1)===1?t-i:i;if(n===rg){r===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(i>=t)i=t;else if(i<0)i=0;else{this.time=i;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(r===-1&&(e>=0?(r=0,this._setEndings(!0,this.repetitions===0,o)):this._setEndings(this.repetitions===0,!0,o)),i>=t||i<0){let a=Math.floor(i/t);i-=t*a,r+=Math.abs(a);let l=this.repetitions-r;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,i=e>0?t:0,this.time=i,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(l===1){let c=e<0;this._setEndings(c,!c,o)}else this._setEndings(!1,!1,o);this._loopCount=r,this.time=i,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:a})}}else this.time=i;if(o&&(r&1)===1)return t-i}return i}_setEndings(e,t,n){let i=this._interpolantSettings;n?(i.endingStart=br,i.endingEnd=br):(e?i.endingStart=this.zeroSlopeAtStart?br:Mr:i.endingStart=Ea,t?i.endingEnd=this.zeroSlopeAtEnd?br:Mr:i.endingEnd=Ea)}_scheduleFading(e,t,n){let i=this._mixer,r=i.time,o=this._weightInterpolant;o===null&&(o=i._lendControlInterpolant(),this._weightInterpolant=o);let a=o.parameterPositions,l=o.sampleValues;return a[0]=r,l[0]=t,a[1]=r+e,l[1]=n,this}},oS=new Float32Array(1),nl=class extends Pi{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(e,t){let n=e._localRoot||this._root,i=e._clip.tracks,r=i.length,o=e._propertyBindings,a=e._interpolants,l=n.uuid,c=this._bindingsByRootAndName,h=c[l];h===void 0&&(h={},c[l]=h);for(let u=0;u!==r;++u){let f=i[u],d=f.name,p=h[d];if(p!==void 0)++p.referenceCount,o[u]=p;else{if(p=o[u],p!==void 0){p._cacheIndex===null&&(++p.referenceCount,this._addInactiveBinding(p,l,d));continue}let x=t&&t._propertyBindings[u].binding.parsedPath;p=new Gh(tn.create(n,d,x),f.ValueTypeName,f.getValueSize()),++p.referenceCount,this._addInactiveBinding(p,l,d),o[u]=p}a[u].resultBuffer=p.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){let n=(e._localRoot||this._root).uuid,i=e._clip.uuid,r=this._actionsByClip[i];this._bindAction(e,r&&r.knownActions[0]),this._addInactiveAction(e,i,n)}let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let r=t[n];r.useCount++===0&&(this._lendBinding(r),r.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let r=t[n];--r.useCount===0&&(r.restoreOriginalState(),this._takeBackBinding(r))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;let e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){let t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,n){let i=this._actions,r=this._actionsByClip,o=r[t];if(o===void 0)o={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,r[t]=o;else{let a=o.knownActions;e._byClipCacheIndex=a.length,a.push(e)}e._cacheIndex=i.length,i.push(e),o.actionByRoot[n]=e}_removeInactiveAction(e){let t=this._actions,n=t[t.length-1],i=e._cacheIndex;n._cacheIndex=i,t[i]=n,t.pop(),e._cacheIndex=null;let r=e._clip.uuid,o=this._actionsByClip,a=o[r],l=a.knownActions,c=l[l.length-1],h=e._byClipCacheIndex;c._byClipCacheIndex=h,l[h]=c,l.pop(),e._byClipCacheIndex=null;let u=a.actionByRoot,f=(e._localRoot||this._root).uuid;delete u[f],l.length===0&&delete o[r],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){let t=e._propertyBindings;for(let n=0,i=t.length;n!==i;++n){let r=t[n];--r.referenceCount===0&&this._removeInactiveBinding(r)}}_lendAction(e){let t=this._actions,n=e._cacheIndex,i=this._nActiveActions++,r=t[i];e._cacheIndex=i,t[i]=e,r._cacheIndex=n,t[n]=r}_takeBackAction(e){let t=this._actions,n=e._cacheIndex,i=--this._nActiveActions,r=t[i];e._cacheIndex=i,t[i]=e,r._cacheIndex=n,t[n]=r}_addInactiveBinding(e,t,n){let i=this._bindingsByRootAndName,r=this._bindings,o=i[t];o===void 0&&(o={},i[t]=o),o[n]=e,e._cacheIndex=r.length,r.push(e)}_removeInactiveBinding(e){let t=this._bindings,n=e.binding,i=n.rootNode.uuid,r=n.path,o=this._bindingsByRootAndName,a=o[i],l=t[t.length-1],c=e._cacheIndex;l._cacheIndex=c,t[c]=l,t.pop(),delete a[r],Object.keys(a).length===0&&delete o[i]}_lendBinding(e){let t=this._bindings,n=e._cacheIndex,i=this._nActiveBindings++,r=t[i];e._cacheIndex=i,t[i]=e,r._cacheIndex=n,t[n]=r}_takeBackBinding(e){let t=this._bindings,n=e._cacheIndex,i=--this._nActiveBindings,r=t[i];e._cacheIndex=i,t[i]=e,r._cacheIndex=n,t[n]=r}_lendControlInterpolant(){let e=this._controlInterpolants,t=this._nActiveControlInterpolants++,n=e[t];return n===void 0&&(n=new $a(new Float32Array(2),new Float32Array(2),1,oS),n.__cacheIndex=t,e[t]=n),n}_takeBackControlInterpolant(e){let t=this._controlInterpolants,n=e.__cacheIndex,i=--this._nActiveControlInterpolants,r=t[i];e.__cacheIndex=i,t[i]=e,r.__cacheIndex=n,t[n]=r}clipAction(e,t,n){let i=t||this._root,r=i.uuid,o=typeof e=="string"?Is.findByName(i,e):e,a=o!==null?o.uuid:e,l=this._actionsByClip[a],c=null;if(n===void 0&&(o!==null?n=o.blendMode:n=Qh),l!==void 0){let u=l.actionByRoot[r];if(u!==void 0&&u.blendMode===n)return u;c=l.knownActions[0],o===null&&(o=c._clip)}if(o===null)return null;let h=new Wh(this,o,t,n);return this._bindAction(h,c),this._addInactiveAction(h,a,r),h}existingAction(e,t){let n=t||this._root,i=n.uuid,r=typeof e=="string"?Is.findByName(n,e):e,o=r?r.uuid:e,a=this._actionsByClip[o];return a!==void 0&&a.actionByRoot[i]||null}stopAllAction(){let e=this._actions,t=this._nActiveActions;for(let n=t-1;n>=0;--n)e[n].stop();return this}update(e){e*=this.timeScale;let t=this._actions,n=this._nActiveActions,i=this.time+=e,r=Math.sign(e),o=this._accuIndex^=1;for(let c=0;c!==n;++c)t[c]._update(i,e,r,o);let a=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)a[c].apply(o);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){let t=this._actions,n=e.uuid,i=this._actionsByClip,r=i[n];if(r!==void 0){let o=r.knownActions;for(let a=0,l=o.length;a!==l;++a){let c=o[a];this._deactivateAction(c);let h=c._cacheIndex,u=t[t.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,u._cacheIndex=h,t[h]=u,t.pop(),this._removeInactiveBindingsForAction(c)}delete i[n]}}uncacheRoot(e){let t=e.uuid,n=this._actionsByClip;for(let o in n){let a=n[o].actionByRoot,l=a[t];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}let i=this._bindingsByRootAndName,r=i[t];if(r!==void 0)for(let o in r){let a=r[o];a.restoreOriginalState(),this._removeInactiveBinding(a)}}uncacheAction(e,t){let n=this.existingAction(e,t);n!==null&&(this._deactivateAction(n),this._removeInactiveAction(n))}},td=class s{constructor(e){this.value=e}clone(){return new s(this.value.clone===void 0?this.value:this.value.clone())}},aS=0,nd=class extends Pi{constructor(){super(),this.isUniformsGroup=!0,Object.defineProperty(this,"id",{value:aS++}),this.name="",this.usage=Aa,this.uniforms=[]}add(e){return this.uniforms.push(e),this}remove(e){let t=this.uniforms.indexOf(e);return t!==-1&&this.uniforms.splice(t,1),this}setName(e){return this.name=e,this}setUsage(e){return this.usage=e,this}dispose(){return this.dispatchEvent({type:"dispose"}),this}copy(e){this.name=e.name,this.usage=e.usage;let t=e.uniforms;this.uniforms.length=0;for(let n=0,i=t.length;n<i;n++){let r=Array.isArray(t[n])?t[n]:[t[n]];for(let o=0;o<r.length;o++)this.uniforms.push(r[o].clone())}return this}clone(){return new this.constructor().copy(this)}},id=class extends Ts{constructor(e,t,n=1){super(e,t),this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=n}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}clone(e){let t=super.clone(e);return t.meshPerAttribute=this.meshPerAttribute,t}toJSON(e){let t=super.toJSON(e);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}},sd=class{constructor(e,t,n,i,r){this.isGLBufferAttribute=!0,this.name="",this.buffer=e,this.type=t,this.itemSize=n,this.elementSize=i,this.count=r,this.version=0}set needsUpdate(e){e===!0&&this.version++}setBuffer(e){return this.buffer=e,this}setType(e,t){return this.type=e,this.elementSize=t,this}setItemSize(e){return this.itemSize=e,this}setCount(e){return this.count=e,this}},v0=new ct,il=class{constructor(e,t,n=0,i=1/0){this.ray=new Xs(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new Ao,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return v0.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(v0),this}intersectObject(e,t=!0,n=[]){return rd(e,this,n,t),n.sort(_0),n}intersectObjects(e,t=!0,n=[]){for(let i=0,r=e.length;i<r;i++)rd(e[i],this,n,t);return n.sort(_0),n}};function _0(s,e){return s.distance-e.distance}function rd(s,e,t,n){let i=!0;if(s.layers.test(e.layers)&&s.raycast(e,t)===!1&&(i=!1),i===!0&&n===!0){let r=s.children;for(let o=0,a=r.length;o<a;o++)rd(r[o],e,t,!0)}}var od=class{constructor(e=1,t=0,n=0){return this.radius=e,this.phi=t,this.theta=n,this}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(gn(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}},ad=class{constructor(e=1,t=0,n=0){return this.radius=e,this.theta=t,this.y=n,this}set(e,t,n){return this.radius=e,this.theta=t,this.y=n,this}copy(e){return this.radius=e.radius,this.theta=e.theta,this.y=e.y,this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+n*n),this.theta=Math.atan2(e,n),this.y=t,this}clone(){return new this.constructor().copy(this)}},ld=class s{constructor(e,t,n,i){s.prototype.isMatrix2=!0,this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){let r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=i,this}},y0=new _e,cd=class{constructor(e=new _e(1/0,1/0),t=new _e(-1/0,-1/0)){this.isBox2=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=y0.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(e){return this.isEmpty()?e.set(0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,y0).distanceTo(e)}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}},M0=new L,ac=new L,hd=class{constructor(e=new L,t=new L){this.start=e,this.end=t}set(e,t){return this.start.copy(e),this.end.copy(t),this}copy(e){return this.start.copy(e.start),this.end.copy(e.end),this}getCenter(e){return e.addVectors(this.start,this.end).multiplyScalar(.5)}delta(e){return e.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(e,t){return this.delta(t).multiplyScalar(e).add(this.start)}closestPointToPointParameter(e,t){M0.subVectors(e,this.start),ac.subVectors(this.end,this.start);let n=ac.dot(ac),r=ac.dot(M0)/n;return t&&(r=gn(r,0,1)),r}closestPointToPoint(e,t,n){let i=this.closestPointToPointParameter(e,t);return this.delta(n).multiplyScalar(i).add(this.start)}applyMatrix4(e){return this.start.applyMatrix4(e),this.end.applyMatrix4(e),this}equals(e){return e.start.equals(this.start)&&e.end.equals(this.end)}clone(){return new this.constructor().copy(this)}},b0=new L,ud=class extends Kt{constructor(e,t){super(),this.light=e,this.matrixAutoUpdate=!1,this.color=t,this.type="SpotLightHelper";let n=new tt,i=[0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,-1,0,1,0,0,0,0,1,1,0,0,0,0,-1,1];for(let o=0,a=1,l=32;o<l;o++,a++){let c=o/l*Math.PI*2,h=a/l*Math.PI*2;i.push(Math.cos(c),Math.sin(c),1,Math.cos(h),Math.sin(h),1)}n.setAttribute("position",new Me(i,3));let r=new Dn({fog:!1,toneMapped:!1});this.cone=new ui(n,r),this.add(this.cone),this.update()}dispose(){this.cone.geometry.dispose(),this.cone.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.light.target.updateWorldMatrix(!0,!1),this.parent?(this.parent.updateWorldMatrix(!0),this.matrix.copy(this.parent.matrixWorld).invert().multiply(this.light.matrixWorld)):this.matrix.copy(this.light.matrixWorld),this.matrixWorld.copy(this.light.matrixWorld);let e=this.light.distance?this.light.distance:1e3,t=e*Math.tan(this.light.angle);this.cone.scale.set(t,t,e),b0.setFromMatrixPosition(this.light.target.matrixWorld),this.cone.lookAt(b0),this.color!==void 0?this.cone.material.color.set(this.color):this.cone.material.color.copy(this.light.color)}},Hs=new L,lc=new ct,rf=new ct,fd=class extends ui{constructor(e){let t=Fg(e),n=new tt,i=[],r=[],o=new Be(0,0,1),a=new Be(0,1,0);for(let c=0;c<t.length;c++){let h=t[c];h.parent&&h.parent.isBone&&(i.push(0,0,0),i.push(0,0,0),r.push(o.r,o.g,o.b),r.push(a.r,a.g,a.b))}n.setAttribute("position",new Me(i,3)),n.setAttribute("color",new Me(r,3));let l=new Dn({vertexColors:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,transparent:!0});super(n,l),this.isSkeletonHelper=!0,this.type="SkeletonHelper",this.root=e,this.bones=t,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1}updateMatrixWorld(e){let t=this.bones,n=this.geometry,i=n.getAttribute("position");rf.copy(this.root.matrixWorld).invert();for(let r=0,o=0;r<t.length;r++){let a=t[r];a.parent&&a.parent.isBone&&(lc.multiplyMatrices(rf,a.matrixWorld),Hs.setFromMatrixPosition(lc),i.setXYZ(o,Hs.x,Hs.y,Hs.z),lc.multiplyMatrices(rf,a.parent.matrixWorld),Hs.setFromMatrixPosition(lc),i.setXYZ(o+1,Hs.x,Hs.y,Hs.z),o+=2)}n.getAttribute("position").needsUpdate=!0,super.updateMatrixWorld(e)}dispose(){this.geometry.dispose(),this.material.dispose()}};function Fg(s){let e=[];s.isBone===!0&&e.push(s);for(let t=0;t<s.children.length;t++)e.push.apply(e,Fg(s.children[t]));return e}var dd=class extends Ft{constructor(e,t,n){let i=new Gr(t,4,2),r=new zn({wireframe:!0,fog:!1,toneMapped:!1});super(i,r),this.light=e,this.color=n,this.type="PointLightHelper",this.matrix=this.light.matrixWorld,this.matrixAutoUpdate=!1,this.update()}dispose(){this.geometry.dispose(),this.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.color!==void 0?this.material.color.set(this.color):this.material.color.copy(this.light.color)}},lS=new L,S0=new Be,w0=new Be,pd=class extends Kt{constructor(e,t,n){super(),this.light=e,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=n,this.type="HemisphereLightHelper";let i=new Za(t);i.rotateY(Math.PI*.5),this.material=new zn({wireframe:!0,fog:!1,toneMapped:!1}),this.color===void 0&&(this.material.vertexColors=!0);let r=i.getAttribute("position"),o=new Float32Array(r.count*3);i.setAttribute("color",new ht(o,3)),this.add(new Ft(i,this.material)),this.update()}dispose(){this.children[0].geometry.dispose(),this.children[0].material.dispose()}update(){let e=this.children[0];if(this.color!==void 0)this.material.color.set(this.color);else{let t=e.geometry.getAttribute("color");S0.copy(this.light.color),w0.copy(this.light.groundColor);for(let n=0,i=t.count;n<i;n++){let r=n<i/2?S0:w0;t.setXYZ(n,r.r,r.g,r.b)}t.needsUpdate=!0}this.light.updateWorldMatrix(!0,!1),e.lookAt(lS.setFromMatrixPosition(this.light.matrixWorld).negate())}},md=class extends ui{constructor(e=10,t=10,n=4473924,i=8947848){n=new Be(n),i=new Be(i);let r=t/2,o=e/t,a=e/2,l=[],c=[];for(let f=0,d=0,p=-a;f<=t;f++,p+=o){l.push(-a,0,p,a,0,p),l.push(p,0,-a,p,0,a);let x=f===r?n:i;x.toArray(c,d),d+=3,x.toArray(c,d),d+=3,x.toArray(c,d),d+=3,x.toArray(c,d),d+=3}let h=new tt;h.setAttribute("position",new Me(l,3)),h.setAttribute("color",new Me(c,3));let u=new Dn({vertexColors:!0,toneMapped:!1});super(h,u),this.type="GridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}},gd=class extends ui{constructor(e=10,t=16,n=8,i=64,r=4473924,o=8947848){r=new Be(r),o=new Be(o);let a=[],l=[];if(t>1)for(let u=0;u<t;u++){let f=u/t*(Math.PI*2),d=Math.sin(f)*e,p=Math.cos(f)*e;a.push(0,0,0),a.push(d,0,p);let x=u&1?r:o;l.push(x.r,x.g,x.b),l.push(x.r,x.g,x.b)}for(let u=0;u<n;u++){let f=u&1?r:o,d=e-e/n*u;for(let p=0;p<i;p++){let x=p/i*(Math.PI*2),g=Math.sin(x)*d,m=Math.cos(x)*d;a.push(g,0,m),l.push(f.r,f.g,f.b),x=(p+1)/i*(Math.PI*2),g=Math.sin(x)*d,m=Math.cos(x)*d,a.push(g,0,m),l.push(f.r,f.g,f.b)}}let c=new tt;c.setAttribute("position",new Me(a,3)),c.setAttribute("color",new Me(l,3));let h=new Dn({vertexColors:!0,toneMapped:!1});super(c,h),this.type="PolarGridHelper"}dispose(){this.geometry.dispose(),this.material.dispose()}},E0=new L,cc=new L,A0=new L,xd=class extends Kt{constructor(e,t,n){super(),this.light=e,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=n,this.type="DirectionalLightHelper",t===void 0&&(t=1);let i=new tt;i.setAttribute("position",new Me([-t,t,0,t,t,0,t,-t,0,-t,-t,0,-t,t,0],3));let r=new Dn({fog:!1,toneMapped:!1});this.lightPlane=new Ii(i,r),this.add(this.lightPlane),i=new tt,i.setAttribute("position",new Me([0,0,0,0,0,1],3)),this.targetLine=new Ii(i,r),this.add(this.targetLine),this.update()}dispose(){this.lightPlane.geometry.dispose(),this.lightPlane.material.dispose(),this.targetLine.geometry.dispose(),this.targetLine.material.dispose()}update(){this.light.updateWorldMatrix(!0,!1),this.light.target.updateWorldMatrix(!0,!1),E0.setFromMatrixPosition(this.light.matrixWorld),cc.setFromMatrixPosition(this.light.target.matrixWorld),A0.subVectors(cc,E0),this.lightPlane.lookAt(cc),this.color!==void 0?(this.lightPlane.material.color.set(this.color),this.targetLine.material.color.set(this.color)):(this.lightPlane.material.color.copy(this.light.color),this.targetLine.material.color.copy(this.light.color)),this.targetLine.lookAt(cc),this.targetLine.scale.z=A0.length()}},hc=new L,mn=new qs,vd=class extends ui{constructor(e){let t=new tt,n=new Dn({color:16777215,vertexColors:!0,toneMapped:!1}),i=[],r=[],o={};a("n1","n2"),a("n2","n4"),a("n4","n3"),a("n3","n1"),a("f1","f2"),a("f2","f4"),a("f4","f3"),a("f3","f1"),a("n1","f1"),a("n2","f2"),a("n3","f3"),a("n4","f4"),a("p","n1"),a("p","n2"),a("p","n3"),a("p","n4"),a("u1","u2"),a("u2","u3"),a("u3","u1"),a("c","t"),a("p","c"),a("cn1","cn2"),a("cn3","cn4"),a("cf1","cf2"),a("cf3","cf4");function a(p,x){l(p),l(x)}function l(p){i.push(0,0,0),r.push(0,0,0),o[p]===void 0&&(o[p]=[]),o[p].push(i.length/3-1)}t.setAttribute("position",new Me(i,3)),t.setAttribute("color",new Me(r,3)),super(t,n),this.type="CameraHelper",this.camera=e,this.camera.updateProjectionMatrix&&this.camera.updateProjectionMatrix(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.pointMap=o,this.update();let c=new Be(16755200),h=new Be(16711680),u=new Be(43775),f=new Be(16777215),d=new Be(3355443);this.setColors(c,h,u,f,d)}setColors(e,t,n,i,r){let a=this.geometry.getAttribute("color");a.setXYZ(0,e.r,e.g,e.b),a.setXYZ(1,e.r,e.g,e.b),a.setXYZ(2,e.r,e.g,e.b),a.setXYZ(3,e.r,e.g,e.b),a.setXYZ(4,e.r,e.g,e.b),a.setXYZ(5,e.r,e.g,e.b),a.setXYZ(6,e.r,e.g,e.b),a.setXYZ(7,e.r,e.g,e.b),a.setXYZ(8,e.r,e.g,e.b),a.setXYZ(9,e.r,e.g,e.b),a.setXYZ(10,e.r,e.g,e.b),a.setXYZ(11,e.r,e.g,e.b),a.setXYZ(12,e.r,e.g,e.b),a.setXYZ(13,e.r,e.g,e.b),a.setXYZ(14,e.r,e.g,e.b),a.setXYZ(15,e.r,e.g,e.b),a.setXYZ(16,e.r,e.g,e.b),a.setXYZ(17,e.r,e.g,e.b),a.setXYZ(18,e.r,e.g,e.b),a.setXYZ(19,e.r,e.g,e.b),a.setXYZ(20,e.r,e.g,e.b),a.setXYZ(21,e.r,e.g,e.b),a.setXYZ(22,e.r,e.g,e.b),a.setXYZ(23,e.r,e.g,e.b),a.setXYZ(24,t.r,t.g,t.b),a.setXYZ(25,t.r,t.g,t.b),a.setXYZ(26,t.r,t.g,t.b),a.setXYZ(27,t.r,t.g,t.b),a.setXYZ(28,t.r,t.g,t.b),a.setXYZ(29,t.r,t.g,t.b),a.setXYZ(30,t.r,t.g,t.b),a.setXYZ(31,t.r,t.g,t.b),a.setXYZ(32,n.r,n.g,n.b),a.setXYZ(33,n.r,n.g,n.b),a.setXYZ(34,n.r,n.g,n.b),a.setXYZ(35,n.r,n.g,n.b),a.setXYZ(36,n.r,n.g,n.b),a.setXYZ(37,n.r,n.g,n.b),a.setXYZ(38,i.r,i.g,i.b),a.setXYZ(39,i.r,i.g,i.b),a.setXYZ(40,r.r,r.g,r.b),a.setXYZ(41,r.r,r.g,r.b),a.setXYZ(42,r.r,r.g,r.b),a.setXYZ(43,r.r,r.g,r.b),a.setXYZ(44,r.r,r.g,r.b),a.setXYZ(45,r.r,r.g,r.b),a.setXYZ(46,r.r,r.g,r.b),a.setXYZ(47,r.r,r.g,r.b),a.setXYZ(48,r.r,r.g,r.b),a.setXYZ(49,r.r,r.g,r.b),a.needsUpdate=!0}update(){let e=this.geometry,t=this.pointMap,n=1,i=1;mn.projectionMatrixInverse.copy(this.camera.projectionMatrixInverse),yn("c",t,e,mn,0,0,-1),yn("t",t,e,mn,0,0,1),yn("n1",t,e,mn,-n,-i,-1),yn("n2",t,e,mn,n,-i,-1),yn("n3",t,e,mn,-n,i,-1),yn("n4",t,e,mn,n,i,-1),yn("f1",t,e,mn,-n,-i,1),yn("f2",t,e,mn,n,-i,1),yn("f3",t,e,mn,-n,i,1),yn("f4",t,e,mn,n,i,1),yn("u1",t,e,mn,n*.7,i*1.1,-1),yn("u2",t,e,mn,-n*.7,i*1.1,-1),yn("u3",t,e,mn,0,i*2,-1),yn("cf1",t,e,mn,-n,0,1),yn("cf2",t,e,mn,n,0,1),yn("cf3",t,e,mn,0,-i,1),yn("cf4",t,e,mn,0,i,1),yn("cn1",t,e,mn,-n,0,-1),yn("cn2",t,e,mn,n,0,-1),yn("cn3",t,e,mn,0,-i,-1),yn("cn4",t,e,mn,0,i,-1),e.getAttribute("position").needsUpdate=!0}dispose(){this.geometry.dispose(),this.material.dispose()}};function yn(s,e,t,n,i,r,o){hc.set(i,r,o).unproject(n);let a=e[s];if(a!==void 0){let l=t.getAttribute("position");for(let c=0,h=a.length;c<h;c++)l.setXYZ(a[c],hc.x,hc.y,hc.z)}}var uc=new wn,_d=class extends ui{constructor(e,t=16776960){let n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),i=new Float32Array(8*3),r=new tt;r.setIndex(new ht(n,1)),r.setAttribute("position",new ht(i,3)),super(r,new Dn({color:t,toneMapped:!1})),this.object=e,this.type="BoxHelper",this.matrixAutoUpdate=!1,this.update()}update(e){if(e!==void 0&&console.warn("THREE.BoxHelper: .update() has no longer arguments."),this.object!==void 0&&uc.setFromObject(this.object),uc.isEmpty())return;let t=uc.min,n=uc.max,i=this.geometry.attributes.position,r=i.array;r[0]=n.x,r[1]=n.y,r[2]=n.z,r[3]=t.x,r[4]=n.y,r[5]=n.z,r[6]=t.x,r[7]=t.y,r[8]=n.z,r[9]=n.x,r[10]=t.y,r[11]=n.z,r[12]=n.x,r[13]=n.y,r[14]=t.z,r[15]=t.x,r[16]=n.y,r[17]=t.z,r[18]=t.x,r[19]=t.y,r[20]=t.z,r[21]=n.x,r[22]=t.y,r[23]=t.z,i.needsUpdate=!0,this.geometry.computeBoundingSphere()}setFromObject(e){return this.object=e,this.update(),this}copy(e,t){return super.copy(e,t),this.object=e.object,this}dispose(){this.geometry.dispose(),this.material.dispose()}},yd=class extends ui{constructor(e,t=16776960){let n=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),i=[1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1],r=new tt;r.setIndex(new ht(n,1)),r.setAttribute("position",new Me(i,3)),super(r,new Dn({color:t,toneMapped:!1})),this.box=e,this.type="Box3Helper",this.geometry.computeBoundingSphere()}updateMatrixWorld(e){let t=this.box;t.isEmpty()||(t.getCenter(this.position),t.getSize(this.scale),this.scale.multiplyScalar(.5),super.updateMatrixWorld(e))}dispose(){this.geometry.dispose(),this.material.dispose()}},Md=class extends Ii{constructor(e,t=1,n=16776960){let i=n,r=[1,-1,0,-1,1,0,-1,-1,0,1,1,0,-1,1,0,-1,-1,0,1,-1,0,1,1,0],o=new tt;o.setAttribute("position",new Me(r,3)),o.computeBoundingSphere(),super(o,new Dn({color:i,toneMapped:!1})),this.type="PlaneHelper",this.plane=e,this.size=t;let a=[1,1,0,-1,1,0,-1,-1,0,1,1,0,-1,-1,0,1,-1,0],l=new tt;l.setAttribute("position",new Me(a,3)),l.computeBoundingSphere(),this.add(new Ft(l,new zn({color:i,opacity:.2,transparent:!0,depthWrite:!1,toneMapped:!1})))}updateMatrixWorld(e){this.position.set(0,0,0),this.scale.set(.5*this.size,.5*this.size,1),this.lookAt(this.plane.normal),this.translateZ(-this.plane.constant),super.updateMatrixWorld(e)}dispose(){this.geometry.dispose(),this.material.dispose(),this.children[0].geometry.dispose(),this.children[0].material.dispose()}},T0=new L,fc,of,bd=class extends Kt{constructor(e=new L(0,0,1),t=new L(0,0,0),n=1,i=16776960,r=n*.2,o=r*.2){super(),this.type="ArrowHelper",fc===void 0&&(fc=new tt,fc.setAttribute("position",new Me([0,0,0,0,1,0],3)),of=new ni(0,.5,1,5,1),of.translate(0,-.5,0)),this.position.copy(t),this.line=new Ii(fc,new Dn({color:i,toneMapped:!1})),this.line.matrixAutoUpdate=!1,this.add(this.line),this.cone=new Ft(of,new zn({color:i,toneMapped:!1})),this.cone.matrixAutoUpdate=!1,this.add(this.cone),this.setDirection(e),this.setLength(n,r,o)}setDirection(e){if(e.y>.99999)this.quaternion.set(0,0,0,1);else if(e.y<-.99999)this.quaternion.set(1,0,0,0);else{T0.set(e.z,0,-e.x).normalize();let t=Math.acos(e.y);this.quaternion.setFromAxisAngle(T0,t)}}setLength(e,t=e*.2,n=t*.2){this.line.scale.set(1,Math.max(1e-4,e-t),1),this.line.updateMatrix(),this.cone.scale.set(n,t,n),this.cone.position.y=e,this.cone.updateMatrix()}setColor(e){this.line.material.color.set(e),this.cone.material.color.set(e)}copy(e){return super.copy(e,!1),this.line.copy(e.line),this.cone.copy(e.cone),this}dispose(){this.line.geometry.dispose(),this.line.material.dispose(),this.cone.geometry.dispose(),this.cone.material.dispose()}},Sd=class extends ui{constructor(e=1){let t=[0,0,0,e,0,0,0,0,0,0,e,0,0,0,0,0,0,e],n=[1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],i=new tt;i.setAttribute("position",new Me(t,3)),i.setAttribute("color",new Me(n,3));let r=new Dn({vertexColors:!0,toneMapped:!1});super(i,r),this.type="AxesHelper"}setColors(e,t,n){let i=new Be,r=this.geometry.attributes.color.array;return i.set(e),i.toArray(r,0),i.toArray(r,3),i.set(t),i.toArray(r,6),i.toArray(r,9),i.set(n),i.toArray(r,12),i.toArray(r,15),this.geometry.attributes.color.needsUpdate=!0,this}dispose(){this.geometry.dispose(),this.material.dispose()}},wd=class{constructor(){this.type="ShapePath",this.color=new Be,this.subPaths=[],this.currentPath=null}moveTo(e,t){return this.currentPath=new Hr,this.subPaths.push(this.currentPath),this.currentPath.moveTo(e,t),this}lineTo(e,t){return this.currentPath.lineTo(e,t),this}quadraticCurveTo(e,t,n,i){return this.currentPath.quadraticCurveTo(e,t,n,i),this}bezierCurveTo(e,t,n,i,r,o){return this.currentPath.bezierCurveTo(e,t,n,i,r,o),this}splineThru(e){return this.currentPath.splineThru(e),this}toShapes(e){function t(m){let y=[];for(let _=0,v=m.length;_<v;_++){let F=m[_],T=new bs;T.curves=F.curves,y.push(T)}return y}function n(m,y){let _=y.length,v=!1;for(let F=_-1,T=0;T<_;F=T++){let U=y[F],C=y[T],S=C.x-U.x,M=C.y-U.y;if(Math.abs(M)>Number.EPSILON){if(M<0&&(U=y[T],S=-S,C=y[F],M=-M),m.y<U.y||m.y>C.y)continue;if(m.y===U.y){if(m.x===U.x)return!0}else{let N=M*(m.x-U.x)-S*(m.y-U.y);if(N===0)return!0;if(N<0)continue;v=!v}}else{if(m.y!==U.y)continue;if(C.x<=m.x&&m.x<=U.x||U.x<=m.x&&m.x<=C.x)return!0}}return v}let i=Ci.isClockWise,r=this.subPaths;if(r.length===0)return[];let o,a,l,c=[];if(r.length===1)return a=r[0],l=new bs,l.curves=a.curves,c.push(l),c;let h=!i(r[0].getPoints());h=e?!h:h;let u=[],f=[],d=[],p=0,x;f[p]=void 0,d[p]=[];for(let m=0,y=r.length;m<y;m++)a=r[m],x=a.getPoints(),o=i(x),o=e?!o:o,o?(!h&&f[p]&&p++,f[p]={s:new bs,p:x},f[p].s.curves=a.curves,h&&p++,d[p]=[]):d[p].push({h:a,p:x[0]});if(!f[0])return t(r);if(f.length>1){let m=!1,y=0;for(let _=0,v=f.length;_<v;_++)u[_]=[];for(let _=0,v=f.length;_<v;_++){let F=d[_];for(let T=0;T<F.length;T++){let U=F[T],C=!0;for(let S=0;S<f.length;S++)n(U.p,f[S].p)&&(_!==S&&y++,C?(C=!1,u[S].push(U)):m=!0);C&&u[_].push(U)}}y>0&&m===!1&&(d=u)}let g;for(let m=0,y=f.length;m<y;m++){l=f[m].s,c.push(l),g=d[m];for(let _=0,v=g.length;_<v;_++)l.holes.push(g[_].h)}return c}},Ed=class extends Pi{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(){}disconnect(){}dispose(){}update(){}},Ad=class extends ti{constructor(e=1,t=1,n=1,i={}){console.warn('THREE.WebGLMultipleRenderTargets has been deprecated and will be removed in r172. Use THREE.WebGLRenderTarget and set the "count" parameter to enable MRT.'),super(e,t,{...i,count:n}),this.isWebGLMultipleRenderTargets=!0}get texture(){return this.textures}};typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Xh}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Xh);function Zd(s,e=!1){let t=s[0].index!==null,n=new Set(Object.keys(s[0].attributes)),i=new Set(Object.keys(s[0].morphAttributes)),r={},o={},a=s[0].morphTargetsRelative,l=new tt,c=0;for(let h=0;h<s.length;++h){let u=s[h],f=0;if(t!==(u.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let d in u.attributes){if(!n.has(d))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+d+'" attribute exists among all geometries, or in none of them.'),null;r[d]===void 0&&(r[d]=[]),r[d].push(u.attributes[d]),f++}if(f!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(a!==u.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let d in u.morphAttributes){if(!i.has(d))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;o[d]===void 0&&(o[d]=[]),o[d].push(u.morphAttributes[d])}if(e){let d;if(t)d=u.index.count;else if(u.attributes.position!==void 0)d=u.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,d,h),c+=d}}if(t){let h=0,u=[];for(let f=0;f<s.length;++f){let d=s[f].index;for(let p=0;p<d.count;++p)u.push(d.getX(p)+h);h+=s[f].attributes.position.count}l.setIndex(u)}for(let h in r){let u=Og(r[h]);if(!u)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,u)}for(let h in o){let u=o[h][0].length;if(u===0)break;l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let f=0;f<u;++f){let d=[];for(let x=0;x<o[h].length;++x)d.push(o[h][x][f]);let p=Og(d);if(!p)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(p)}}return l}function Og(s){let e,t,n,i=-1,r=0;for(let c=0;c<s.length;++c){let h=s[c];if(e===void 0&&(e=h.array.constructor),e!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=h.itemSize),t!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(i===-1&&(i=h.gpuType),i!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*t}let o=new e(r),a=new ht(o,t,n),l=0;for(let c=0;c<s.length;++c){let h=s[c];if(h.isInterleavedBufferAttribute){let u=l/t;for(let f=0,d=h.count;f<d;f++)for(let p=0;p<t;p++){let x=h.getComponent(f,p);a.setComponent(f+u,p,x)}}else o.set(h.array,l);l+=h.count*t}return i!==void 0&&(a.gpuType=i),a}function $d(s,e){if(e===Bd)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),s;if(e===zo||e===al){let t=s.getIndex();if(t===null){let o=[],a=s.getAttribute("position");if(a!==void 0){for(let l=0;l<a.count;l++)o.push(l);s.setIndex(o),t=s.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),s}let n=t.count-2,i=[];if(e===zo)for(let o=1;o<=n;o++)i.push(t.getX(0)),i.push(t.getX(o)),i.push(t.getX(o+1));else for(let o=0;o<n;o++)o%2===0?(i.push(t.getX(o)),i.push(t.getX(o+1)),i.push(t.getX(o+2))):(i.push(t.getX(o+2)),i.push(t.getX(o+1)),i.push(t.getX(o)));i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");let r=s.clone();return r.setIndex(i),r.clearGroups(),r}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),s}var hl=class extends Vn{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new np(t)}),this.register(function(t){return new ip(t)}),this.register(function(t){return new fp(t)}),this.register(function(t){return new dp(t)}),this.register(function(t){return new pp(t)}),this.register(function(t){return new rp(t)}),this.register(function(t){return new op(t)}),this.register(function(t){return new ap(t)}),this.register(function(t){return new lp(t)}),this.register(function(t){return new tp(t)}),this.register(function(t){return new cp(t)}),this.register(function(t){return new sp(t)}),this.register(function(t){return new up(t)}),this.register(function(t){return new hp(t)}),this.register(function(t){return new Qd(t)}),this.register(function(t){return new mp(t)}),this.register(function(t){return new gp(t)})}load(e,t,n,i){let r=this,o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){let c=Xi.extractUrlBase(e);o=Xi.resolveURL(c,this.path)}else o=Xi.extractUrlBase(e);this.manager.itemStart(e);let a=function(c){i?i(c):console.error(c),r.manager.itemError(e),r.manager.itemEnd(e)},l=new fi(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{r.parse(c,o,function(h){t(h),r.manager.itemEnd(e)},a)}catch(h){a(h)}},n,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,i){let r,o={},a={},l=new TextDecoder;if(typeof e=="string")r=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===Vg){try{o[Vt.KHR_BINARY_GLTF]=new xp(e)}catch(u){i&&i(u);return}r=JSON.parse(o[Vt.KHR_BINARY_GLTF].content)}else r=JSON.parse(l.decode(e));else r=e;if(r.asset===void 0||r.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let c=new wp(r,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let h=0;h<this.pluginCallbacks.length;h++){let u=this.pluginCallbacks[h](c);u.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[u.name]=u,o[u.name]=!0}if(r.extensionsUsed)for(let h=0;h<r.extensionsUsed.length;++h){let u=r.extensionsUsed[h],f=r.extensionsRequired||[];switch(u){case Vt.KHR_MATERIALS_UNLIT:o[u]=new ep;break;case Vt.KHR_DRACO_MESH_COMPRESSION:o[u]=new vp(r,this.dracoLoader);break;case Vt.KHR_TEXTURE_TRANSFORM:o[u]=new _p;break;case Vt.KHR_MESH_QUANTIZATION:o[u]=new yp;break;default:f.indexOf(u)>=0&&a[u]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+u+'".')}}c.setExtensions(o),c.setPlugins(a),c.parse(n,i)}parseAsync(e,t){let n=this;return new Promise(function(i,r){n.parse(e,t,i,r)})}};function cS(){let s={};return{get:function(e){return s[e]},add:function(e,t){s[e]=t},remove:function(e){delete s[e]},removeAll:function(){s={}}}}var Vt={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},Qd=class{constructor(e){this.parser=e,this.name=Vt.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let n=0,i=t.length;n<i;n++){let r=t[n];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){let t=this.parser,n="light:"+e,i=t.cache.get(n);if(i)return i;let r=t.json,l=((r.extensions&&r.extensions[this.name]||{}).lights||[])[e],c,h=new Be(16777215);l.color!==void 0&&h.setRGB(l.color[0],l.color[1],l.color[2],Gn);let u=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new Ls(h),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new Ks(h),c.distance=u;break;case"spot":c=new Fo(h),c.distance=u,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),c.decay=2,Ds(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),i=Promise.resolve(c),t.cache.add(n,i),i}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){let t=this,n=this.parser,r=n.json.nodes[e],a=(r.extensions&&r.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(l){return n._getNodeRef(t.cache,a,l)})}},ep=class{constructor(){this.name=Vt.KHR_MATERIALS_UNLIT}getMaterialType(){return zn}extendParams(e,t,n){let i=[];e.color=new Be(1,1,1),e.opacity=1;let r=t.pbrMetallicRoughness;if(r){if(Array.isArray(r.baseColorFactor)){let o=r.baseColorFactor;e.color.setRGB(o[0],o[1],o[2],Gn),e.opacity=o[3]}r.baseColorTexture!==void 0&&i.push(n.assignTexture(e,"map",r.baseColorTexture,An))}return Promise.all(i)}},tp=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let i=this.parser.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=i.extensions[this.name].emissiveStrength;return r!==void 0&&(t.emissiveIntensity=r),Promise.resolve()}},np=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];if(o.clearcoatFactor!==void 0&&(t.clearcoat=o.clearcoatFactor),o.clearcoatTexture!==void 0&&r.push(n.assignTexture(t,"clearcoatMap",o.clearcoatTexture)),o.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=o.clearcoatRoughnessFactor),o.clearcoatRoughnessTexture!==void 0&&r.push(n.assignTexture(t,"clearcoatRoughnessMap",o.clearcoatRoughnessTexture)),o.clearcoatNormalTexture!==void 0&&(r.push(n.assignTexture(t,"clearcoatNormalMap",o.clearcoatNormalTexture)),o.clearcoatNormalTexture.scale!==void 0)){let a=o.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new _e(a,a)}return Promise.all(r)}},ip=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_DISPERSION}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let i=this.parser.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=i.extensions[this.name];return t.dispersion=r.dispersion!==void 0?r.dispersion:0,Promise.resolve()}},sp=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];return o.iridescenceFactor!==void 0&&(t.iridescence=o.iridescenceFactor),o.iridescenceTexture!==void 0&&r.push(n.assignTexture(t,"iridescenceMap",o.iridescenceTexture)),o.iridescenceIor!==void 0&&(t.iridescenceIOR=o.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),o.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=o.iridescenceThicknessMaximum),o.iridescenceThicknessTexture!==void 0&&r.push(n.assignTexture(t,"iridescenceThicknessMap",o.iridescenceThicknessTexture)),Promise.all(r)}},rp=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_SHEEN}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[];t.sheenColor=new Be(0,0,0),t.sheenRoughness=0,t.sheen=1;let o=i.extensions[this.name];if(o.sheenColorFactor!==void 0){let a=o.sheenColorFactor;t.sheenColor.setRGB(a[0],a[1],a[2],Gn)}return o.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=o.sheenRoughnessFactor),o.sheenColorTexture!==void 0&&r.push(n.assignTexture(t,"sheenColorMap",o.sheenColorTexture,An)),o.sheenRoughnessTexture!==void 0&&r.push(n.assignTexture(t,"sheenRoughnessMap",o.sheenRoughnessTexture)),Promise.all(r)}},op=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];return o.transmissionFactor!==void 0&&(t.transmission=o.transmissionFactor),o.transmissionTexture!==void 0&&r.push(n.assignTexture(t,"transmissionMap",o.transmissionTexture)),Promise.all(r)}},ap=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_VOLUME}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];t.thickness=o.thicknessFactor!==void 0?o.thicknessFactor:0,o.thicknessTexture!==void 0&&r.push(n.assignTexture(t,"thicknessMap",o.thicknessTexture)),t.attenuationDistance=o.attenuationDistance||1/0;let a=o.attenuationColor||[1,1,1];return t.attenuationColor=new Be().setRGB(a[0],a[1],a[2],Gn),Promise.all(r)}},lp=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_IOR}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let i=this.parser.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=i.extensions[this.name];return t.ior=r.ior!==void 0?r.ior:1.5,Promise.resolve()}},cp=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_SPECULAR}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];t.specularIntensity=o.specularFactor!==void 0?o.specularFactor:1,o.specularTexture!==void 0&&r.push(n.assignTexture(t,"specularIntensityMap",o.specularTexture));let a=o.specularColorFactor||[1,1,1];return t.specularColor=new Be().setRGB(a[0],a[1],a[2],Gn),o.specularColorTexture!==void 0&&r.push(n.assignTexture(t,"specularColorMap",o.specularColorTexture,An)),Promise.all(r)}},hp=class{constructor(e){this.parser=e,this.name=Vt.EXT_MATERIALS_BUMP}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];return t.bumpScale=o.bumpFactor!==void 0?o.bumpFactor:1,o.bumpTexture!==void 0&&r.push(n.assignTexture(t,"bumpMap",o.bumpTexture)),Promise.all(r)}},up=class{constructor(e){this.parser=e,this.name=Vt.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){let n=this.parser.json.materials[e];return!n.extensions||!n.extensions[this.name]?null:ii}extendMaterialParams(e,t){let n=this.parser,i=n.json.materials[e];if(!i.extensions||!i.extensions[this.name])return Promise.resolve();let r=[],o=i.extensions[this.name];return o.anisotropyStrength!==void 0&&(t.anisotropy=o.anisotropyStrength),o.anisotropyRotation!==void 0&&(t.anisotropyRotation=o.anisotropyRotation),o.anisotropyTexture!==void 0&&r.push(n.assignTexture(t,"anisotropyMap",o.anisotropyTexture)),Promise.all(r)}},fp=class{constructor(e){this.parser=e,this.name=Vt.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,n=t.json,i=n.textures[e];if(!i.extensions||!i.extensions[this.name])return null;let r=i.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,r.source,o)}},dp=class{constructor(e){this.parser=e,this.name=Vt.EXT_TEXTURE_WEBP,this.isSupported=null}loadTexture(e){let t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=i.images[o.source],l=n.textureLoader;if(a.uri){let c=n.options.manager.getHandler(a.uri);c!==null&&(l=c)}return this.detectSupport().then(function(c){if(c)return n.loadTextureImage(e,o.source,l);if(i.extensionsRequired&&i.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: WebP required by asset but unsupported.");return n.loadTexture(e)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){let t=new Image;t.src="data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}},pp=class{constructor(e){this.parser=e,this.name=Vt.EXT_TEXTURE_AVIF,this.isSupported=null}loadTexture(e){let t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=i.images[o.source],l=n.textureLoader;if(a.uri){let c=n.options.manager.getHandler(a.uri);c!==null&&(l=c)}return this.detectSupport().then(function(c){if(c)return n.loadTextureImage(e,o.source,l);if(i.extensionsRequired&&i.extensionsRequired.indexOf(t)>=0)throw new Error("THREE.GLTFLoader: AVIF required by asset but unsupported.");return n.loadTexture(e)})}detectSupport(){return this.isSupported||(this.isSupported=new Promise(function(e){let t=new Image;t.src="data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=",t.onload=t.onerror=function(){e(t.height===1)}})),this.isSupported}},mp=class{constructor(e){this.name=Vt.EXT_MESHOPT_COMPRESSION,this.parser=e}loadBufferView(e){let t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){let i=n.extensions[this.name],r=this.parser.getDependency("buffer",i.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return r.then(function(a){let l=i.byteOffset||0,c=i.byteLength||0,h=i.count,u=i.byteStride,f=new Uint8Array(a,l,c);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(h,u,f,i.mode,i.filter).then(function(d){return d.buffer}):o.ready.then(function(){let d=new ArrayBuffer(h*u);return o.decodeGltfBuffer(new Uint8Array(d),h,u,f,i.mode,i.filter),d})})}else return null}},gp=class{constructor(e){this.name=Vt.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;let i=t.meshes[n.mesh];for(let c of i.primitives)if(c.mode!==Li.TRIANGLES&&c.mode!==Li.TRIANGLE_STRIP&&c.mode!==Li.TRIANGLE_FAN&&c.mode!==void 0)return null;let o=n.extensions[this.name].attributes,a=[],l={};for(let c in o)a.push(this.parser.getDependency("accessor",o[c]).then(h=>(l[c]=h,l[c])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(c=>{let h=c.pop(),u=h.isGroup?h.children:[h],f=c[0].count,d=[];for(let p of u){let x=new ct,g=new L,m=new Sn,y=new L(1,1,1),_=new Wi(p.geometry,p.material,f);for(let v=0;v<f;v++)l.TRANSLATION&&g.fromBufferAttribute(l.TRANSLATION,v),l.ROTATION&&m.fromBufferAttribute(l.ROTATION,v),l.SCALE&&y.fromBufferAttribute(l.SCALE,v),_.setMatrixAt(v,x.compose(g,m,y));for(let v in l)if(v==="_COLOR_0"){let F=l[v];_.instanceColor=new kn(F.array,F.itemSize,F.normalized)}else v!=="TRANSLATION"&&v!=="ROTATION"&&v!=="SCALE"&&p.geometry.setAttribute(v,l[v]);Kt.prototype.copy.call(_,p),this.parser.assignFinalMaterial(_),d.push(_)}return h.isGroup?(h.clear(),h.add(...d),h):d[0]}))}},Vg="glTF",cl=12,Bg={JSON:1313821514,BIN:5130562},xp=class{constructor(e){this.name=Vt.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,cl),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Vg)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");let i=this.header.length-cl,r=new DataView(e,cl),o=0;for(;o<i;){let a=r.getUint32(o,!0);o+=4;let l=r.getUint32(o,!0);if(o+=4,l===Bg.JSON){let c=new Uint8Array(e,cl+o,a);this.content=n.decode(c)}else if(l===Bg.BIN){let c=cl+o;this.body=e.slice(c,c+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},vp=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=Vt.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let n=this.json,i=this.dracoLoader,r=e.extensions[this.name].bufferView,o=e.extensions[this.name].attributes,a={},l={},c={};for(let h in o){let u=bp[h]||h.toLowerCase();a[u]=o[h]}for(let h in e.attributes){let u=bp[h]||h.toLowerCase();if(o[h]!==void 0){let f=n.accessors[e.attributes[h]],d=Ho[f.componentType];c[u]=d.name,l[u]=f.normalized===!0}}return t.getDependency("bufferView",r).then(function(h){return new Promise(function(u,f){i.decodeDracoFile(h,function(d){for(let p in d.attributes){let x=d.attributes[p],g=l[p];g!==void 0&&(x.normalized=g)}u(d)},a,c,Gn,f)})})}},_p=class{constructor(){this.name=Vt.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}},yp=class{constructor(){this.name=Vt.KHR_MESH_QUANTIZATION}},nu=class extends Rs{constructor(e,t,n,i){super(e,t,n,i)}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i*3+i;for(let o=0;o!==i;o++)t[o]=n[r+o];return t}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=a*2,c=a*3,h=i-t,u=(n-t)/h,f=u*u,d=f*u,p=e*c,x=p-c,g=-2*d+3*f,m=d-f,y=1-g,_=m-f+u;for(let v=0;v!==a;v++){let F=o[x+v+a],T=o[x+v+l]*h,U=o[p+v+a],C=o[p+v]*h;r[v]=y*F+_*T+g*U+m*C}return r}},hS=new Sn,Mp=class extends nu{interpolate_(e,t,n,i){let r=super.interpolate_(e,t,n,i);return hS.fromArray(r).normalize().toArray(r),r}},Li={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Ho={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},zg={9728:Tn,9729:cn,9984:rl,9985:Er,9986:Gs,9987:yi},kg={33071:ci,33648:Pr,10497:ws},Kd={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},bp={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},js={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},uS={CUBICSPLINE:void 0,LINEAR:Ur,STEP:Dr},Jd={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function fS(s){return s.DefaultMaterial===void 0&&(s.DefaultMaterial=new $s({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Gi})),s.DefaultMaterial}function Xr(s,e,t){for(let n in t.extensions)s[n]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[n]=t.extensions[n])}function Ds(s,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(s.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function dS(s,e,t){let n=!1,i=!1,r=!1;for(let c=0,h=e.length;c<h;c++){let u=e[c];if(u.POSITION!==void 0&&(n=!0),u.NORMAL!==void 0&&(i=!0),u.COLOR_0!==void 0&&(r=!0),n&&i&&r)break}if(!n&&!i&&!r)return Promise.resolve(s);let o=[],a=[],l=[];for(let c=0,h=e.length;c<h;c++){let u=e[c];if(n){let f=u.POSITION!==void 0?t.getDependency("accessor",u.POSITION):s.attributes.position;o.push(f)}if(i){let f=u.NORMAL!==void 0?t.getDependency("accessor",u.NORMAL):s.attributes.normal;a.push(f)}if(r){let f=u.COLOR_0!==void 0?t.getDependency("accessor",u.COLOR_0):s.attributes.color;l.push(f)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l)]).then(function(c){let h=c[0],u=c[1],f=c[2];return n&&(s.morphAttributes.position=h),i&&(s.morphAttributes.normal=u),r&&(s.morphAttributes.color=f),s.morphTargetsRelative=!0,s})}function pS(s,e){if(s.updateMorphTargets(),e.weights!==void 0)for(let t=0,n=e.weights.length;t<n;t++)s.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){let t=e.extras.targetNames;if(s.morphTargetInfluences.length===t.length){s.morphTargetDictionary={};for(let n=0,i=t.length;n<i;n++)s.morphTargetDictionary[t[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function mS(s){let e,t=s.extensions&&s.extensions[Vt.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+jd(t.attributes):e=s.indices+":"+jd(s.attributes)+":"+s.mode,s.targets!==void 0)for(let n=0,i=s.targets.length;n<i;n++)e+=":"+jd(s.targets[n]);return e}function jd(s){let e="",t=Object.keys(s).sort();for(let n=0,i=t.length;n<i;n++)e+=t[n]+":"+s[t[n]]+";";return e}function Sp(s){switch(s){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function gS(s){return s.search(/\.jpe?g($|\?)/i)>0||s.search(/^data\:image\/jpeg/)===0?"image/jpeg":s.search(/\.webp($|\?)/i)>0||s.search(/^data\:image\/webp/)===0?"image/webp":s.search(/\.ktx2($|\?)/i)>0||s.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}var xS=new ct,wp=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new cS,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,r=!1,o=-1;if(typeof navigator<"u"){let a=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(a)===!0;let l=a.match(/Version\/(\d+)/);i=n&&l?parseInt(l[1],10):-1,r=a.indexOf("Firefox")>-1,o=r?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||r&&o<98?this.textureLoader=new ja(this.options.manager):this.textureLoader=new el(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new fi(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let n=this,i=this.json,r=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(o){let a={scene:o[0][i.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:i.asset,parser:n,userData:{}};return Xr(r,a,i),Ds(a,i),Promise.all(n._invokeAll(function(l){return l.afterRoot&&l.afterRoot(a)})).then(function(){for(let l of a.scenes)l.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let i=0,r=t.length;i<r;i++){let o=t[i].joints;for(let a=0,l=o.length;a<l;a++)e[o[a]].isBone=!0}for(let i=0,r=e.length;i<r;i++){let o=e[i];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(n[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;let i=n.clone(),r=(o,a)=>{let l=this.associations.get(o);l!=null&&this.associations.set(a,l);for(let[c,h]of o.children.entries())r(h,a.children[c])};return r(n,i),i.name+="_instance_"+e.uses[t]++,i}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){let i=e(t[n]);if(i)return i}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let n=[];for(let i=0;i<t.length;i++){let r=e(t[i]);r&&n.push(r)}return n}getDependency(e,t){let n=e+":"+t,i=this.cache.get(n);if(!i){switch(e){case"scene":i=this.loadScene(t);break;case"node":i=this._invokeOne(function(r){return r.loadNode&&r.loadNode(t)});break;case"mesh":i=this._invokeOne(function(r){return r.loadMesh&&r.loadMesh(t)});break;case"accessor":i=this.loadAccessor(t);break;case"bufferView":i=this._invokeOne(function(r){return r.loadBufferView&&r.loadBufferView(t)});break;case"buffer":i=this.loadBuffer(t);break;case"material":i=this._invokeOne(function(r){return r.loadMaterial&&r.loadMaterial(t)});break;case"texture":i=this._invokeOne(function(r){return r.loadTexture&&r.loadTexture(t)});break;case"skin":i=this.loadSkin(t);break;case"animation":i=this._invokeOne(function(r){return r.loadAnimation&&r.loadAnimation(t)});break;case"camera":i=this.loadCamera(t);break;default:if(i=this._invokeOne(function(r){return r!=this&&r.getDependency&&r.getDependency(e,t)}),!i)throw new Error("Unknown type: "+e);break}this.cache.add(n,i)}return i}getDependencies(e){let t=this.cache.get(e);if(!t){let n=this,i=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(i.map(function(r,o){return n.getDependency(e,o)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[Vt.KHR_BINARY_GLTF].body);let i=this.options;return new Promise(function(r,o){n.load(Xi.resolveURL(t.uri,i.path),r,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){let i=t.byteLength||0,r=t.byteOffset||0;return n.slice(r,r+i)})}loadAccessor(e){let t=this,n=this.json,i=this.json.accessors[e];if(i.bufferView===void 0&&i.sparse===void 0){let o=Kd[i.type],a=Ho[i.componentType],l=i.normalized===!0,c=new a(i.count*o);return Promise.resolve(new ht(c,o,l))}let r=[];return i.bufferView!==void 0?r.push(this.getDependency("bufferView",i.bufferView)):r.push(null),i.sparse!==void 0&&(r.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),r.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(r).then(function(o){let a=o[0],l=Kd[i.type],c=Ho[i.componentType],h=c.BYTES_PER_ELEMENT,u=h*l,f=i.byteOffset||0,d=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,p=i.normalized===!0,x,g;if(d&&d!==u){let m=Math.floor(f/d),y="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+m+":"+i.count,_=t.cache.get(y);_||(x=new c(a,m*d,i.count*d/h),_=new Ts(x,d/h),t.cache.add(y,_)),g=new es(_,l,f%d/h,p)}else a===null?x=new c(i.count*l):x=new c(a,f,i.count*l),g=new ht(x,l,p);if(i.sparse!==void 0){let m=Kd.SCALAR,y=Ho[i.sparse.indices.componentType],_=i.sparse.indices.byteOffset||0,v=i.sparse.values.byteOffset||0,F=new y(o[1],_,i.sparse.count*m),T=new c(o[2],v,i.sparse.count*l);a!==null&&(g=new ht(g.array.slice(),g.itemSize,g.normalized)),g.normalized=!1;for(let U=0,C=F.length;U<C;U++){let S=F[U];if(g.setX(S,T[U*l]),l>=2&&g.setY(S,T[U*l+1]),l>=3&&g.setZ(S,T[U*l+2]),l>=4&&g.setW(S,T[U*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}g.normalized=p}return g})}loadTexture(e){let t=this.json,n=this.options,r=t.textures[e].source,o=t.images[r],a=this.textureLoader;if(o.uri){let l=n.manager.getHandler(o.uri);l!==null&&(a=l)}return this.loadTextureImage(e,r,a)}loadTextureImage(e,t,n){let i=this,r=this.json,o=r.textures[e],a=r.images[t],l=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[l])return this.textureCache[l];let c=this.loadImageSource(t,n).then(function(h){h.flipY=!1,h.name=o.name||a.name||"",h.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(h.name=a.uri);let f=(r.samplers||{})[o.sampler]||{};return h.magFilter=zg[f.magFilter]||cn,h.minFilter=zg[f.minFilter]||yi,h.wrapS=kg[f.wrapS]||ws,h.wrapT=kg[f.wrapT]||ws,h.generateMipmaps=!h.isCompressedTexture&&h.minFilter!==Tn&&h.minFilter!==cn,i.associations.set(h,{textures:e}),h}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){let n=this,i=this.json,r=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(u=>u.clone());let o=i.images[e],a=self.URL||self.webkitURL,l=o.uri||"",c=!1;if(o.bufferView!==void 0)l=n.getDependency("bufferView",o.bufferView).then(function(u){c=!0;let f=new Blob([u],{type:o.mimeType});return l=a.createObjectURL(f),l});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let h=Promise.resolve(l).then(function(u){return new Promise(function(f,d){let p=f;t.isImageBitmapLoader===!0&&(p=function(x){let g=new dn(x);g.needsUpdate=!0,f(g)}),t.load(Xi.resolveURL(u,r.path),p,void 0,d)})}).then(function(u){return c===!0&&a.revokeObjectURL(l),Ds(u,o),u.userData.mimeType=o.mimeType||gS(o.uri),u}).catch(function(u){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),u});return this.sourceCache[e]=h,h}assignTexture(e,t,n,i){let r=this;return this.getDependency("texture",n.index).then(function(o){if(!o)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(o=o.clone(),o.channel=n.texCoord),r.extensions[Vt.KHR_TEXTURE_TRANSFORM]){let a=n.extensions!==void 0?n.extensions[Vt.KHR_TEXTURE_TRANSFORM]:void 0;if(a){let l=r.associations.get(o);o=r.extensions[Vt.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),r.associations.set(o,l)}}return i!==void 0&&(o.colorSpace=i),e[t]=o,o})}assignFinalMaterial(e){let t=e.geometry,n=e.material,i=t.attributes.tangent===void 0,r=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(e.isPoints){let a="PointsMaterial:"+n.uuid,l=this.cache.get(a);l||(l=new kr,xn.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,l.sizeAttenuation=!1,this.cache.add(a,l)),n=l}else if(e.isLine){let a="LineBasicMaterial:"+n.uuid,l=this.cache.get(a);l||(l=new Dn,xn.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,this.cache.add(a,l)),n=l}if(i||r||o){let a="ClonedMaterial:"+n.uuid+":";i&&(a+="derivative-tangents:"),r&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let l=this.cache.get(a);l||(l=n.clone(),r&&(l.vertexColors=!0),o&&(l.flatShading=!0),i&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(a,l),this.associations.set(l,this.associations.get(n))),n=l}e.material=n}getMaterialType(){return $s}loadMaterial(e){let t=this,n=this.json,i=this.extensions,r=n.materials[e],o,a={},l=r.extensions||{},c=[];if(l[Vt.KHR_MATERIALS_UNLIT]){let u=i[Vt.KHR_MATERIALS_UNLIT];o=u.getMaterialType(),c.push(u.extendParams(a,r,t))}else{let u=r.pbrMetallicRoughness||{};if(a.color=new Be(1,1,1),a.opacity=1,Array.isArray(u.baseColorFactor)){let f=u.baseColorFactor;a.color.setRGB(f[0],f[1],f[2],Gn),a.opacity=f[3]}u.baseColorTexture!==void 0&&c.push(t.assignTexture(a,"map",u.baseColorTexture,An)),a.metalness=u.metallicFactor!==void 0?u.metallicFactor:1,a.roughness=u.roughnessFactor!==void 0?u.roughnessFactor:1,u.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(a,"metalnessMap",u.metallicRoughnessTexture)),c.push(t.assignTexture(a,"roughnessMap",u.metallicRoughnessTexture))),o=this._invokeOne(function(f){return f.getMaterialType&&f.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(f){return f.extendMaterialParams&&f.extendMaterialParams(e,a)})))}r.doubleSided===!0&&(a.side=Bn);let h=r.alphaMode||Jd.OPAQUE;if(h===Jd.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,h===Jd.MASK&&(a.alphaTest=r.alphaCutoff!==void 0?r.alphaCutoff:.5)),r.normalTexture!==void 0&&o!==zn&&(c.push(t.assignTexture(a,"normalMap",r.normalTexture)),a.normalScale=new _e(1,1),r.normalTexture.scale!==void 0)){let u=r.normalTexture.scale;a.normalScale.set(u,u)}if(r.occlusionTexture!==void 0&&o!==zn&&(c.push(t.assignTexture(a,"aoMap",r.occlusionTexture)),r.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=r.occlusionTexture.strength)),r.emissiveFactor!==void 0&&o!==zn){let u=r.emissiveFactor;a.emissive=new Be().setRGB(u[0],u[1],u[2],Gn)}return r.emissiveTexture!==void 0&&o!==zn&&c.push(t.assignTexture(a,"emissiveMap",r.emissiveTexture,An)),Promise.all(c).then(function(){let u=new o(a);return r.name&&(u.name=r.name),Ds(u,r),t.associations.set(u,{materials:e}),r.extensions&&Xr(i,u,r),u})}createUniqueName(e){let t=tn.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,n=this.extensions,i=this.primitiveCache;function r(a){return n[Vt.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(l){return Hg(l,a,t)})}let o=[];for(let a=0,l=e.length;a<l;a++){let c=e[a],h=mS(c),u=i[h];if(u)o.push(u.promise);else{let f;c.extensions&&c.extensions[Vt.KHR_DRACO_MESH_COMPRESSION]?f=r(c):f=Hg(new tt,c,t),i[h]={primitive:c,promise:f},o.push(f)}}return Promise.all(o)}loadMesh(e){let t=this,n=this.json,i=this.extensions,r=n.meshes[e],o=r.primitives,a=[];for(let l=0,c=o.length;l<c;l++){let h=o[l].material===void 0?fS(this.cache):this.getDependency("material",o[l].material);a.push(h)}return a.push(t.loadGeometries(o)),Promise.all(a).then(function(l){let c=l.slice(0,l.length-1),h=l[l.length-1],u=[];for(let d=0,p=h.length;d<p;d++){let x=h[d],g=o[d],m,y=c[d];if(g.mode===Li.TRIANGLES||g.mode===Li.TRIANGLE_STRIP||g.mode===Li.TRIANGLE_FAN||g.mode===void 0)m=r.isSkinnedMesh===!0?new Ys(x,y):new Ft(x,y),m.isSkinnedMesh===!0&&m.normalizeSkinWeights(),g.mode===Li.TRIANGLE_STRIP?m.geometry=$d(m.geometry,al):g.mode===Li.TRIANGLE_FAN&&(m.geometry=$d(m.geometry,zo));else if(g.mode===Li.LINES)m=new ui(x,y);else if(g.mode===Li.LINE_STRIP)m=new Ii(x,y);else if(g.mode===Li.LINE_LOOP)m=new Co(x,y);else if(g.mode===Li.POINTS)m=new Hn(x,y);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+g.mode);Object.keys(m.geometry.morphAttributes).length>0&&pS(m,r),m.name=t.createUniqueName(r.name||"mesh_"+e),Ds(m,r),g.extensions&&Xr(i,m,g),t.assignFinalMaterial(m),u.push(m)}for(let d=0,p=u.length;d<p;d++)t.associations.set(u[d],{meshes:e,primitives:d});if(u.length===1)return r.extensions&&Xr(i,u[0],r),u[0];let f=new bn;r.extensions&&Xr(i,f,r),t.associations.set(f,{meshes:e});for(let d=0,p=u.length;d<p;d++)f.add(u[d]);return f})}loadCamera(e){let t,n=this.json.cameras[e],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new Mn(Hd.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(t=new Qi(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),Ds(t,n),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],n=[];for(let i=0,r=t.joints.length;i<r;i++)n.push(this._loadNodeShallow(t.joints[i]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){let r=i.pop(),o=i,a=[],l=[];for(let c=0,h=o.length;c<h;c++){let u=o[c];if(u){a.push(u);let f=new ct;r!==null&&f.fromArray(r.array,c*16),l.push(f)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Ro(a,l)})}loadAnimation(e){let t=this.json,n=this,i=t.animations[e],r=i.name?i.name:"animation_"+e,o=[],a=[],l=[],c=[],h=[];for(let u=0,f=i.channels.length;u<f;u++){let d=i.channels[u],p=i.samplers[d.sampler],x=d.target,g=x.node,m=i.parameters!==void 0?i.parameters[p.input]:p.input,y=i.parameters!==void 0?i.parameters[p.output]:p.output;x.node!==void 0&&(o.push(this.getDependency("node",g)),a.push(this.getDependency("accessor",m)),l.push(this.getDependency("accessor",y)),c.push(p),h.push(x))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l),Promise.all(c),Promise.all(h)]).then(function(u){let f=u[0],d=u[1],p=u[2],x=u[3],g=u[4],m=[];for(let y=0,_=f.length;y<_;y++){let v=f[y],F=d[y],T=p[y],U=x[y],C=g[y];if(v===void 0)continue;v.updateMatrix&&v.updateMatrix();let S=n._createAnimationTracks(v,F,T,U,C);if(S)for(let M=0;M<S.length;M++)m.push(S[M])}return new Is(r,void 0,m)})}createNodeMesh(e){let t=this.json,n=this,i=t.nodes[e];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(r){let o=n._getNodeRef(n.meshCache,i.mesh,r);return i.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let l=0,c=i.weights.length;l<c;l++)a.morphTargetInfluences[l]=i.weights[l]}),o})}loadNode(e){let t=this.json,n=this,i=t.nodes[e],r=n._loadNodeShallow(e),o=[],a=i.children||[];for(let c=0,h=a.length;c<h;c++)o.push(n.getDependency("node",a[c]));let l=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([r,Promise.all(o),l]).then(function(c){let h=c[0],u=c[1],f=c[2];f!==null&&h.traverse(function(d){d.isSkinnedMesh&&d.bind(f,xS)});for(let d=0,p=u.length;d<p;d++)h.add(u[d]);return h})}_loadNodeShallow(e){let t=this.json,n=this.extensions,i=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let r=t.nodes[e],o=r.name?i.createUniqueName(r.name):"",a=[],l=i._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&a.push(l),r.camera!==void 0&&a.push(i.getDependency("camera",r.camera).then(function(c){return i._getNodeRef(i.cameraCache,r.camera,c)})),i._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){a.push(c)}),this.nodeCache[e]=Promise.all(a).then(function(c){let h;if(r.isBone===!0?h=new zr:c.length>1?h=new bn:c.length===1?h=c[0]:h=new Kt,h!==c[0])for(let u=0,f=c.length;u<f;u++)h.add(c[u]);if(r.name&&(h.userData.name=r.name,h.name=o),Ds(h,r),r.extensions&&Xr(n,h,r),r.matrix!==void 0){let u=new ct;u.fromArray(r.matrix),h.applyMatrix4(u)}else r.translation!==void 0&&h.position.fromArray(r.translation),r.rotation!==void 0&&h.quaternion.fromArray(r.rotation),r.scale!==void 0&&h.scale.fromArray(r.scale);return i.associations.has(h)||i.associations.set(h,{}),i.associations.get(h).nodes=e,h}),this.nodeCache[e]}loadScene(e){let t=this.extensions,n=this.json.scenes[e],i=this,r=new bn;n.name&&(r.name=i.createUniqueName(n.name)),Ds(r,n),n.extensions&&Xr(t,r,n);let o=n.nodes||[],a=[];for(let l=0,c=o.length;l<c;l++)a.push(i.getDependency("node",o[l]));return Promise.all(a).then(function(l){for(let h=0,u=l.length;h<u;h++)r.add(l[h]);let c=h=>{let u=new Map;for(let[f,d]of i.associations)(f instanceof xn||f instanceof dn)&&u.set(f,d);return h.traverse(f=>{let d=i.associations.get(f);d!=null&&u.set(f,d)}),u};return i.associations=c(r),r})}_createAnimationTracks(e,t,n,i,r){let o=[],a=e.name?e.name:e.uuid,l=[];js[r.path]===js.weights?e.traverse(function(f){f.morphTargetInfluences&&l.push(f.name?f.name:f.uuid)}):l.push(a);let c;switch(js[r.path]){case js.weights:c=ts;break;case js.rotation:c=ns;break;case js.position:case js.scale:c=is;break;default:switch(n.itemSize){case 1:c=ts;break;case 2:case 3:default:c=is;break}break}let h=i.interpolation!==void 0?uS[i.interpolation]:Ur,u=this._getArrayFromAccessor(n);for(let f=0,d=l.length;f<d;f++){let p=new c(l[f]+"."+js[r.path],t.array,u,h);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(p),o.push(p)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let n=Sp(t.constructor),i=new Float32Array(t.length);for(let r=0,o=t.length;r<o;r++)i[r]=t[r]*n;t=i}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){let i=this instanceof ns?Mp:nu;return new i(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function vS(s,e,t){let n=e.attributes,i=new wn;if(n.POSITION!==void 0){let a=t.json.accessors[n.POSITION],l=a.min,c=a.max;if(l!==void 0&&c!==void 0){if(i.set(new L(l[0],l[1],l[2]),new L(c[0],c[1],c[2])),a.normalized){let h=Sp(Ho[a.componentType]);i.min.multiplyScalar(h),i.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let r=e.targets;if(r!==void 0){let a=new L,l=new L;for(let c=0,h=r.length;c<h;c++){let u=r[c];if(u.POSITION!==void 0){let f=t.json.accessors[u.POSITION],d=f.min,p=f.max;if(d!==void 0&&p!==void 0){if(l.setX(Math.max(Math.abs(d[0]),Math.abs(p[0]))),l.setY(Math.max(Math.abs(d[1]),Math.abs(p[1]))),l.setZ(Math.max(Math.abs(d[2]),Math.abs(p[2]))),f.normalized){let x=Sp(Ho[f.componentType]);l.multiplyScalar(x)}a.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(a)}s.boundingBox=i;let o=new Rn;i.getCenter(o.center),o.radius=i.min.distanceTo(i.max)/2,s.boundingSphere=o}function Hg(s,e,t){let n=e.attributes,i=[];function r(o,a){return t.getDependency("accessor",o).then(function(l){s.setAttribute(a,l)})}for(let o in n){let a=bp[o]||o.toLowerCase();a in s.attributes||i.push(r(n[o],a))}if(e.indices!==void 0&&!s.index){let o=t.getDependency("accessor",e.indices).then(function(a){s.setIndex(a)});i.push(o)}return zt.workingColorSpace!==Gn&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${zt.workingColorSpace}" not supported.`),Ds(s,e),vS(s,e,t),Promise.all(i).then(function(){return e.targets!==void 0?dS(s,e.targets,t):s})}var Gg=23283064365386963e-26,_S=12,Wg=typeof TextDecoder>"u"?null:new TextDecoder("utf-8"),Ep=0,iu=1,ul=2,su=5,fl=class{constructor(e=new Uint8Array(16)){this.buf=ArrayBuffer.isView(e)?e:new Uint8Array(e),this.dataView=new DataView(this.buf.buffer),this.pos=0,this.type=0,this.length=this.buf.length}readFields(e,t,n=this.length){for(;this.pos<n;){let i=this.readVarint(),r=i>>3,o=this.pos;this.type=i&7,e(r,t,this),this.pos===o&&this.skip(i)}return t}readMessage(e,t){return this.readFields(e,t,this.readVarint()+this.pos)}readFixed32(){let e=this.dataView.getUint32(this.pos,!0);return this.pos+=4,e}readSFixed32(){let e=this.dataView.getInt32(this.pos,!0);return this.pos+=4,e}readFixed64(){let e=this.dataView.getUint32(this.pos,!0)+this.dataView.getUint32(this.pos+4,!0)*4294967296;return this.pos+=8,e}readSFixed64(){let e=this.dataView.getUint32(this.pos,!0)+this.dataView.getInt32(this.pos+4,!0)*4294967296;return this.pos+=8,e}readFloat(){let e=this.dataView.getFloat32(this.pos,!0);return this.pos+=4,e}readDouble(){let e=this.dataView.getFloat64(this.pos,!0);return this.pos+=8,e}readVarint(e){let t=this.buf,n,i;return i=t[this.pos++],n=i&127,i<128||(i=t[this.pos++],n|=(i&127)<<7,i<128)||(i=t[this.pos++],n|=(i&127)<<14,i<128)||(i=t[this.pos++],n|=(i&127)<<21,i<128)?n:(i=t[this.pos],n|=(i&15)<<28,yS(n,e,this))}readVarint64(){return this.readVarint(!0)}readSVarint(){let e=this.readVarint();return e%2===1?(e+1)/-2:e/2}readBoolean(){return!!this.readVarint()}readString(){let e=this.readVarint()+this.pos,t=this.pos;return this.pos=e,e-t>=_S&&Wg?Wg.decode(this.buf.subarray(t,e)):DS(this.buf,t,e)}readBytes(){let e=this.readVarint()+this.pos,t=this.buf.subarray(this.pos,e);return this.pos=e,t}readPackedVarint(e=[],t){let n=this.readPackedEnd();for(;this.pos<n;)e.push(this.readVarint(t));return e}readPackedSVarint(e=[]){let t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readSVarint());return e}readPackedBoolean(e=[]){let t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readBoolean());return e}readPackedFloat(e=[]){let t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readFloat());return e}readPackedDouble(e=[]){let t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readDouble());return e}readPackedFixed32(e=[]){let t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readFixed32());return e}readPackedSFixed32(e=[]){let t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readSFixed32());return e}readPackedFixed64(e=[]){let t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readFixed64());return e}readPackedSFixed64(e=[]){let t=this.readPackedEnd();for(;this.pos<t;)e.push(this.readSFixed64());return e}readPackedEnd(){return this.type===ul?this.readVarint()+this.pos:this.pos+1}skip(e){let t=e&7;if(t===Ep)for(;this.buf[this.pos++]>127;);else if(t===ul)this.pos=this.readVarint()+this.pos;else if(t===su)this.pos+=4;else if(t===iu)this.pos+=8;else throw new Error(`Unimplemented type: ${t}`)}writeTag(e,t){this.writeVarint(e<<3|t)}realloc(e){let t=this.length||16;for(;t<this.pos+e;)t*=2;if(t!==this.length){let n=new Uint8Array(t);n.set(this.buf),this.buf=n,this.dataView=new DataView(n.buffer),this.length=t}}finish(){return this.length=this.pos,this.pos=0,this.buf.subarray(0,this.length)}writeFixed32(e){this.realloc(4),this.dataView.setInt32(this.pos,e,!0),this.pos+=4}writeSFixed32(e){this.realloc(4),this.dataView.setInt32(this.pos,e,!0),this.pos+=4}writeFixed64(e){this.realloc(8),this.dataView.setInt32(this.pos,e&-1,!0),this.dataView.setInt32(this.pos+4,Math.floor(e*Gg),!0),this.pos+=8}writeSFixed64(e){this.realloc(8),this.dataView.setInt32(this.pos,e&-1,!0),this.dataView.setInt32(this.pos+4,Math.floor(e*Gg),!0),this.pos+=8}writeVarint(e){if(e=+e||0,e>268435455||e<0){MS(e,this);return}this.realloc(4),this.buf[this.pos++]=e&127|(e>127?128:0),!(e<=127)&&(this.buf[this.pos++]=(e>>>=7)&127|(e>127?128:0),!(e<=127)&&(this.buf[this.pos++]=(e>>>=7)&127|(e>127?128:0),!(e<=127)&&(this.buf[this.pos++]=e>>>7&127)))}writeSVarint(e){this.writeVarint(e<0?-e*2-1:e*2)}writeBoolean(e){this.writeVarint(+e)}writeString(e){e=String(e),this.realloc(e.length*4),this.pos++;let t=this.pos;this.pos=US(this.buf,e,this.pos);let n=this.pos-t;n>=128&&Xg(t,n,this),this.pos=t-1,this.writeVarint(n),this.pos+=n}writeFloat(e){this.realloc(4),this.dataView.setFloat32(this.pos,e,!0),this.pos+=4}writeDouble(e){this.realloc(8),this.dataView.setFloat64(this.pos,e,!0),this.pos+=8}writeBytes(e){let t=e.length;this.writeVarint(t),this.realloc(t);for(let n=0;n<t;n++)this.buf[this.pos++]=e[n]}writeRawMessage(e,t){this.pos++;let n=this.pos;e(t,this);let i=this.pos-n;i>=128&&Xg(n,i,this),this.pos=n-1,this.writeVarint(i),this.pos+=i}writeMessage(e,t,n){this.writeTag(e,ul),this.writeRawMessage(t,n)}writePackedVarint(e,t){t.length&&this.writeMessage(e,wS,t)}writePackedSVarint(e,t){t.length&&this.writeMessage(e,ES,t)}writePackedBoolean(e,t){t.length&&this.writeMessage(e,RS,t)}writePackedFloat(e,t){t.length&&this.writeMessage(e,AS,t)}writePackedDouble(e,t){t.length&&this.writeMessage(e,TS,t)}writePackedFixed32(e,t){t.length&&this.writeMessage(e,CS,t)}writePackedSFixed32(e,t){t.length&&this.writeMessage(e,PS,t)}writePackedFixed64(e,t){t.length&&this.writeMessage(e,IS,t)}writePackedSFixed64(e,t){t.length&&this.writeMessage(e,LS,t)}writeBytesField(e,t){this.writeTag(e,ul),this.writeBytes(t)}writeFixed32Field(e,t){this.writeTag(e,su),this.writeFixed32(t)}writeSFixed32Field(e,t){this.writeTag(e,su),this.writeSFixed32(t)}writeFixed64Field(e,t){this.writeTag(e,iu),this.writeFixed64(t)}writeSFixed64Field(e,t){this.writeTag(e,iu),this.writeSFixed64(t)}writeVarintField(e,t){this.writeTag(e,Ep),this.writeVarint(t)}writeSVarintField(e,t){this.writeTag(e,Ep),this.writeSVarint(t)}writeStringField(e,t){this.writeTag(e,ul),this.writeString(t)}writeFloatField(e,t){this.writeTag(e,su),this.writeFloat(t)}writeDoubleField(e,t){this.writeTag(e,iu),this.writeDouble(t)}writeBooleanField(e,t){this.writeVarintField(e,+t)}};function yS(s,e,t){let n=t.buf,i,r;if(r=n[t.pos++],i=(r&112)>>4,r<128||(r=n[t.pos++],i|=(r&127)<<3,r<128)||(r=n[t.pos++],i|=(r&127)<<10,r<128)||(r=n[t.pos++],i|=(r&127)<<17,r<128)||(r=n[t.pos++],i|=(r&127)<<24,r<128)||(r=n[t.pos++],i|=(r&1)<<31,r<128))return Vo(s,i,e);throw new Error("Expected varint not more than 10 bytes")}function Vo(s,e,t){return t?e*4294967296+(s>>>0):(e>>>0)*4294967296+(s>>>0)}function MS(s,e){let t,n;if(s>=0?(t=s%4294967296|0,n=s/4294967296|0):(t=~(-s%4294967296),n=~(-s/4294967296),t^4294967295?t=t+1|0:(t=0,n=n+1|0)),s>=18446744073709552e3||s<-18446744073709552e3)throw new Error("Given varint doesn't fit into 10 bytes");e.realloc(10),bS(t,n,e),SS(n,e)}function bS(s,e,t){t.buf[t.pos++]=s&127|128,s>>>=7,t.buf[t.pos++]=s&127|128,s>>>=7,t.buf[t.pos++]=s&127|128,s>>>=7,t.buf[t.pos++]=s&127|128,s>>>=7,t.buf[t.pos]=s&127}function SS(s,e){let t=(s&7)<<4;e.buf[e.pos++]|=t|((s>>>=3)?128:0),s&&(e.buf[e.pos++]=s&127|((s>>>=7)?128:0),s&&(e.buf[e.pos++]=s&127|((s>>>=7)?128:0),s&&(e.buf[e.pos++]=s&127|((s>>>=7)?128:0),s&&(e.buf[e.pos++]=s&127|((s>>>=7)?128:0),s&&(e.buf[e.pos++]=s&127)))))}function Xg(s,e,t){let n=e<=16383?1:e<=2097151?2:e<=268435455?3:Math.floor(Math.log(e)/(Math.LN2*7));t.realloc(n);for(let i=t.pos-1;i>=s;i--)t.buf[i+n]=t.buf[i]}function wS(s,e){for(let t=0;t<s.length;t++)e.writeVarint(s[t])}function ES(s,e){for(let t=0;t<s.length;t++)e.writeSVarint(s[t])}function AS(s,e){for(let t=0;t<s.length;t++)e.writeFloat(s[t])}function TS(s,e){for(let t=0;t<s.length;t++)e.writeDouble(s[t])}function RS(s,e){for(let t=0;t<s.length;t++)e.writeBoolean(s[t])}function CS(s,e){for(let t=0;t<s.length;t++)e.writeFixed32(s[t])}function PS(s,e){for(let t=0;t<s.length;t++)e.writeSFixed32(s[t])}function IS(s,e){for(let t=0;t<s.length;t++)e.writeFixed64(s[t])}function LS(s,e){for(let t=0;t<s.length;t++)e.writeSFixed64(s[t])}function DS(s,e,t){let n="",i=e;for(;i<t;){let r=s[i],o=null,a=r>239?4:r>223?3:r>191?2:1;if(i+a>t)break;let l,c,h;a===1?r<128&&(o=r):a===2?(l=s[i+1],(l&192)===128&&(o=(r&31)<<6|l&63,o<=127&&(o=null))):a===3?(l=s[i+1],c=s[i+2],(l&192)===128&&(c&192)===128&&(o=(r&15)<<12|(l&63)<<6|c&63,(o<=2047||o>=55296&&o<=57343)&&(o=null))):a===4&&(l=s[i+1],c=s[i+2],h=s[i+3],(l&192)===128&&(c&192)===128&&(h&192)===128&&(o=(r&15)<<18|(l&63)<<12|(c&63)<<6|h&63,(o<=65535||o>=1114112)&&(o=null))),o===null?(o=65533,a=1):o>65535&&(o-=65536,n+=String.fromCharCode(o>>>10&1023|55296),o=56320|o&1023),n+=String.fromCharCode(o),i+=a}return n}function US(s,e,t){for(let n=0,i,r;n<e.length;n++){if(i=e.charCodeAt(n),i>55295&&i<57344)if(r)if(i<56320){s[t++]=239,s[t++]=191,s[t++]=189,r=i;continue}else i=r-55296<<10|i-56320|65536,r=null;else{i>56319||n+1===e.length?(s[t++]=239,s[t++]=191,s[t++]=189):r=i;continue}else r&&(s[t++]=239,s[t++]=191,s[t++]=189,r=null);i<128?s[t++]=i:(i<2048?s[t++]=i>>6|192:(i<65536?s[t++]=i>>12|224:(s[t++]=i>>18|240,s[t++]=i>>12&63|128),s[t++]=i>>6&63|128),s[t++]=i&63|128)}return t}function rs(s,e){this.x=s,this.y=e}rs.prototype={clone(){return new rs(this.x,this.y)},add(s){return this.clone()._add(s)},sub(s){return this.clone()._sub(s)},multByPoint(s){return this.clone()._multByPoint(s)},divByPoint(s){return this.clone()._divByPoint(s)},mult(s){return this.clone()._mult(s)},div(s){return this.clone()._div(s)},rotate(s){return this.clone()._rotate(s)},rotateAround(s,e){return this.clone()._rotateAround(s,e)},matMult(s){return this.clone()._matMult(s)},unit(){return this.clone()._unit()},perp(){return this.clone()._perp()},round(){return this.clone()._round()},mag(){return Math.sqrt(this.x*this.x+this.y*this.y)},equals(s){return this.x===s.x&&this.y===s.y},dist(s){return Math.sqrt(this.distSqr(s))},distSqr(s){let e=s.x-this.x,t=s.y-this.y;return e*e+t*t},angle(){return Math.atan2(this.y,this.x)},angleTo(s){return Math.atan2(this.y-s.y,this.x-s.x)},angleWith(s){return this.angleWithSep(s.x,s.y)},angleWithSep(s,e){return Math.atan2(this.x*e-this.y*s,this.x*s+this.y*e)},_matMult(s){let e=s[0]*this.x+s[1]*this.y,t=s[2]*this.x+s[3]*this.y;return this.x=e,this.y=t,this},_add(s){return this.x+=s.x,this.y+=s.y,this},_sub(s){return this.x-=s.x,this.y-=s.y,this},_mult(s){return this.x*=s,this.y*=s,this},_div(s){return this.x/=s,this.y/=s,this},_multByPoint(s){return this.x*=s.x,this.y*=s.y,this},_divByPoint(s){return this.x/=s.x,this.y/=s.y,this},_unit(){return this._div(this.mag()),this},_perp(){let s=this.y;return this.y=this.x,this.x=-s,this},_rotate(s){let e=Math.cos(s),t=Math.sin(s),n=e*this.x-t*this.y,i=t*this.x+e*this.y;return this.x=n,this.y=i,this},_rotateAround(s,e){let t=Math.cos(s),n=Math.sin(s),i=e.x+t*(this.x-e.x)-n*(this.y-e.y),r=e.y+n*(this.x-e.x)+t*(this.y-e.y);return this.x=i,this.y=r,this},_round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this},constructor:rs};rs.convert=function(s){if(s instanceof rs)return s;if(Array.isArray(s))return new rs(+s[0],+s[1]);if(s.x!==void 0&&s.y!==void 0)return new rs(+s.x,+s.y);throw new Error("Expected [x, y] or {x, y} point format")};var ru=class{constructor(e,t,n,i,r){this.properties={},this.extent=n,this.type=0,this.id=void 0,this._pbf=e,this._geometry=-1,this._keys=i,this._values=r,e.readFields(NS,this,t)}loadGeometry(){let e=this._pbf;e.pos=this._geometry;let t=e.readVarint()+e.pos,n=[],i,r=1,o=0,a=0,l=0;for(;e.pos<t;){if(o<=0){let c=e.readVarint();r=c&7,o=c>>3}if(o--,r===1||r===2)a+=e.readSVarint(),l+=e.readSVarint(),r===1&&(i&&n.push(i),i=[]),i&&i.push(new rs(a,l));else if(r===7)i&&i.push(i[0].clone());else throw new Error(`unknown command ${r}`)}return i&&n.push(i),n}bbox(){let e=this._pbf;e.pos=this._geometry;let t=e.readVarint()+e.pos,n=1,i=0,r=0,o=0,a=1/0,l=-1/0,c=1/0,h=-1/0;for(;e.pos<t;){if(i<=0){let u=e.readVarint();n=u&7,i=u>>3}if(i--,n===1||n===2)r+=e.readSVarint(),o+=e.readSVarint(),r<a&&(a=r),r>l&&(l=r),o<c&&(c=o),o>h&&(h=o);else if(n!==7)throw new Error(`unknown command ${n}`)}return[a,c,l,h]}toGeoJSON(e,t,n){let i=this.extent*Math.pow(2,n),r=this.extent*e,o=this.extent*t,a=this.loadGeometry();function l(f){return[(f.x+r)*360/i-180,360/Math.PI*Math.atan(Math.exp((1-(f.y+o)*2/i)*Math.PI))-90]}function c(f){return f.map(l)}let h;if(this.type===1){let f=[];for(let p of a)f.push(p[0]);let d=c(f);h=f.length===1?{type:"Point",coordinates:d[0]}:{type:"MultiPoint",coordinates:d}}else if(this.type===2){let f=a.map(c);h=f.length===1?{type:"LineString",coordinates:f[0]}:{type:"MultiLineString",coordinates:f}}else if(this.type===3){let f=OS(a),d=[];for(let p of f)d.push(p.map(c));h=d.length===1?{type:"Polygon",coordinates:d[0]}:{type:"MultiPolygon",coordinates:d}}else throw new Error("unknown feature type");let u={type:"Feature",geometry:h,properties:this.properties};return this.id!=null&&(u.id=this.id),u}};ru.types=["Unknown","Point","LineString","Polygon"];function NS(s,e,t){s===1?e.id=t.readVarint():s===2?FS(t,e):s===3?e.type=t.readVarint():s===4&&(e._geometry=t.pos)}function FS(s,e){let t=s.readVarint()+s.pos;for(;s.pos<t;){let n=e._keys[s.readVarint()],i=e._values[s.readVarint()];e.properties[n]=i}}function OS(s){let e=s.length;if(e<=1)return[s];let t=[],n,i;for(let r=0;r<e;r++){let o=BS(s[r]);o!==0&&(i===void 0&&(i=o<0),i===o<0?(n&&t.push(n),n=[s[r]]):n&&n.push(s[r]))}return n&&t.push(n),t}function BS(s){let e=0;for(let t=0,n=s.length,i=n-1,r,o;t<n;i=t++)r=s[t],o=s[i],e+=(o.x-r.x)*(r.y+o.y);return e}var Ap=class{constructor(e,t){this.version=1,this.name="",this.extent=4096,this.length=0,this._pbf=e,this._keys=[],this._values=[],this._features=[],e.readFields(zS,this,t),this.length=this._features.length}feature(e){if(e<0||e>=this._features.length)throw new Error("feature index out of bounds");this._pbf.pos=this._features[e];let t=this._pbf.readVarint()+this._pbf.pos;return new ru(this._pbf,t,this.extent,this._keys,this._values)}};function zS(s,e,t){s===15?e.version=t.readVarint():s===1?e.name=t.readString():s===5?e.extent=t.readVarint():s===2?e._features.push(t.pos):s===3?e._keys.push(t.readString()):s===4&&e._values.push(kS(t))}function kS(s){let e=null,t=s.readVarint()+s.pos;for(;s.pos<t;){let n=s.readVarint()>>3;e=n===1?s.readString():n===2?s.readFloat():n===3?s.readDouble():n===4?s.readVarint64():n===5?s.readVarint():n===6?s.readSVarint():n===7?s.readBoolean():null}return e}var ou=class{constructor(e,t){this.layers=e.readFields(HS,{},t)}};function HS(s,e,t){if(s===3){let n=new Ap(t,t.readVarint()+t.pos);n.length&&(e[n.name]=n)}}var lu=16,os=2**lu,VS=650,GS=1600,WS=72,Qs=72,au=26,Qt=50,vn=1e7,er=-1e4,Ei=1500,qg=26,Yg=3.6,Lp=4.52,Tp=60,qr=700,XS=32,Wo=24,_n=(s,e,t)=>Math.max(e,Math.min(t,s)),Rp=(s,e,t)=>{let n=_n((t-s)/(e-s),0,1);return n*n*(3-2*n)},Ai=s=>{let e=Math.sin(s*12.9898+78.233)*43758.5453;return e-Math.floor(e)},qS=(s,e,t)=>s+(((e-s)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI)*t;function YS(s){let e=s>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function ZS(){let s=["interpolate",["exponential",1.7],["zoom"],13,["match",["get","class"],["motorway","trunk","primary"],2.2,["secondary","tertiary"],1.6,.6],18,["match",["get","class"],["motorway","trunk","primary"],34,["secondary","tertiary"],26,["street","street_limited","service"],16,7]],e=["all",["==",["geometry-type"],"LineString"],["!=",["get","structure"],"bridge"],["!",["match",["get","class"],["major_rail","minor_rail","service_rail","ferry","aerialway","golf","construction"],!0,!1]]];return{version:8,glyphs:"mapbox://fonts/mapbox/{fontstack}/{range}.pbf",sources:{streets:{type:"vector",url:"mapbox://mapbox.mapbox-streets-v8"}},fog:{range:[1.2,7],color:"#121926","high-color":"#0D1421","horizon-blend":.12,"space-color":"#0B111C","star-intensity":0},layers:[{id:"bg",type:"background",paint:{"background-color":"#111723"}},{id:"green",type:"fill",source:"streets","source-layer":"landuse",filter:["match",["get","class"],["park","grass","wood","scrub","cemetery","pitch"],!0,!1],paint:{"fill-color":"#15211D"}},{id:"water",type:"fill",source:"streets","source-layer":"water",paint:{"fill-color":"#0A1322"}},{id:"waterway",type:"line",source:"streets","source-layer":"waterway",filter:["match",["get","class"],["river","canal","stream","stream_intermittent","drain","ditch"],!0,!1],layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#0A1322","line-width":["interpolate",["exponential",1.7],["zoom"],13,["match",["get","class"],["river","canal"],2,.8],18,["match",["get","class"],["river","canal"],44,["stream","stream_intermittent"],14,8]]}},{id:"water-edge",type:"line",source:"streets","source-layer":"water",paint:{"line-color":"#2A3A55","line-width":.8,"line-blur":.8,"line-opacity":.7}},{id:"roads-casing",type:"line",source:"streets","source-layer":"road",filter:e,layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#2C3649","line-gap-width":s,"line-width":["interpolate",["linear"],["zoom"],15,.4,18,1.4],"line-opacity":["interpolate",["linear"],["zoom"],15,0,16.5,.9]}},{id:"roads",type:"line",source:"streets","source-layer":"road",filter:e,layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":["match",["get","class"],["path","pedestrian","track"],"#19212E","#212A39"],"line-width":s}},{id:"footprints",type:"fill",source:"streets","source-layer":"building",filter:["!=",["get","type"],"roof"],paint:{"fill-color":"#151C28"}}]}}var Dp="float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",$r="uniform float uRefW; uniform vec3 uFog; vec3 fogged(vec3 c, float w){ return mix(c, uFog, smoothstep(1.7, 5.5, w / uRefW) * 0.85); }",Kr="normalize(vec3(-0.45, 0.55, 0.72))",Yr="uPxM * uPR * uRefW / gl_Position.w",ri={transparent:!0,depthWrite:!1,blending:ba,side:Bn},dl=`
  float warmFlick(float since, float seed){ return since < 0.4 ? step(0.5, fract(since * 16.0 + seed * 7.0)) : 1.0; }
  float warmRamp(float since){ return smoothstep(0.0, 1.8, since); }
  vec3 lampColour(float ramp){ return mix(vec3(1.0, 0.52, 0.18), vec3(1.0, 0.80, 0.50), ramp); }`;function $S(s){let e=new Ot({uniforms:s,side:Bn,vertexShader:`
      attribute vec3 aFace; attribute vec2 aLit; attribute vec4 aSeg; attribute vec2 aBld; attribute vec4 aRoof;
      varying vec3 vN; varying vec3 vFace; varying vec2 vLit; varying vec4 vSeg; varying vec2 vBld; varying float vW; varying vec3 vPos; varying vec4 vRoof;
      void main(){
        vN = normal; vFace = aFace; vLit = aLit; vSeg = aSeg; vBld = aBld; vPos = position; vRoof = aRoof;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vW = gl_Position.w;
      }`,fragmentShader:`
      uniform float uTime; uniform vec3 uRunner; uniform float uCut;
      ${$r}
      varying vec3 vN; varying vec3 vFace; varying vec2 vLit; varying vec4 vSeg; varying vec2 vBld; varying float vW; varying vec3 vPos; varying vec4 vRoof;
      ${Dp}
      // Tbilisi plaster: cream, ochre, terracotta, dusty rose, sage, grey \u2014 one per building
      vec3 plaster(float s){
        float k = floor(s * 6.0);
        vec3 c = k < 1.0 ? vec3(0.91, 0.84, 0.70) : k < 2.0 ? vec3(0.85, 0.66, 0.42) : k < 3.0 ? vec3(0.78, 0.51, 0.37)
               : k < 4.0 ? vec3(0.80, 0.64, 0.58) : k < 5.0 ? vec3(0.68, 0.72, 0.60) : vec3(0.76, 0.76, 0.78);
        return c * (0.92 + 0.16 * hash(vec2(s, 8.8)));
      }
      void main(){
        // See-through: walls between the camera and the runner open up around it; the hole is filled with faint glass.
        float cutFade = 0.0;
        if (uCut > 0.0) {
          vec3 seg = uRunner - cameraPosition;
          float t = clamp(dot(vPos - cameraPosition, seg) / dot(seg, seg), 0.0, 1.0);
          float d = length(vPos - (cameraPosition + seg * t)), r = uCut * t;
          cutFade = (1.0 - smoothstep(r * 0.8, r, d)) * (1.0 - smoothstep(0.97, 0.995, t));
        }
        #ifdef GHOST
          if (cutFade < 0.02) discard;      // the glass pass only draws what the opaque pass cut away
        #else
          if (cutFade > 0.5) discard;       // a clean hole where a wall would hide the runner
        #endif
        vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        float roof = vFace.z, v = vFace.y, seed = vBld.x, top = vBld.y, strength = vLit.y;
        bool shaped = roof > 1.5, mark = vRoof.w > 0.5;   // a pitched / domed roof \xB7 a church or landmark
        float since = uTime - vLit.x;
        float on = step(0.0, since) * strength;
        float lit = on * smoothstep(0.0, 1.6, since);
        float moon = max(dot(n, ${Kr}), 0.0);

        // The street light: the nearest point of the stretch of trail that lit this building, at lantern height.
        vec2 ba = vSeg.zw - vSeg.xy;
        float hh = clamp(dot(vPos.xy - vSeg.xy, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
        vec3 Lp = vec3(vSeg.xy + ba * hh, 4.6);
        vec3 toL = Lp - vPos;
        float d = length(toL);
        vec3 ldir = toL / max(d, 1e-3);
        float atten = 1.0 / (1.0 + d * d / 90.0);
        float lam = clamp(dot(n, ldir) * 0.8 + 0.25, 0.0, 1.0);

        vec3 albedo = mark ? vec3(0.82, 0.77, 0.66) * (0.92 + 0.12 * hash(vec2(seed, 4.4))) : plaster(seed);
        vec3 sky = vec3(0.16, 0.20, 0.29) * (0.5 + 0.6 * moon);
        bool metal = false;
        if (shaped) {
          // OSM roof colour when tagged; otherwise grey-green stone on churches, red tin on houses
          albedo = dot(vRoof.rgb, vec3(1.0)) > 0.0 ? vRoof.rgb : mark ? vec3(0.44, 0.50, 0.47) : vec3(0.60, 0.31, 0.23);
          metal = vRoof.r > 0.6 && vRoof.b < 0.45 && vRoof.r - vRoof.b > 0.3;
          sky *= 1.2;
        } else if (roof > 0.5) { sky *= 1.35; albedo = mix(albedo, vec3(0.62, 0.64, 0.70), 0.6); }
        vec3 col = albedo * sky;
        float g = (v - 0.5) / 3.3, fl = floor(g), fy = fract(g);
        if (roof < 0.5) {
          col *= mix(0.55, 1.0, smoothstep(0.0, 9.0, v));   // the sky lights the upper floors first
          if (fl >= 1.0 && v < top - 0.6) col *= 1.0 - (1.0 - smoothstep(0.0, 0.05, fy)) * 0.22 * (1.0 - smoothstep(0.1, 0.3, fwidth(g)));
        }
        // warm light: the lamp with falloff, plus a soft bounce from the pavement that fades up the wall
        vec3 warmL = vec3(1.0, 0.70, 0.42);
        float street = roof > 0.5 ? 0.0 : 1.15 * atten * lam;
        float bounce = roof > 0.5 ? 0.08 : 0.38 * exp(-v / 15.0);
        col += albedo * warmL * min(street + bounce, 1.1) * lit;
        // landmarks are floodlit from the ground: bright at the foot of the wall, the light climbing the drum and dome
        if (mark && !shaped && roof < 0.5) col += albedo * vec3(1.0, 0.86, 0.66) * lit * (0.16 + 0.55 * exp(-v / 14.0));
        if (shaped) {
          col += albedo * vec3(1.0, 0.84, 0.62) * lit * (mark ? 0.75 : 0.28) * (0.55 + 0.45 * (1.0 - n.z));
          if (metal) { vec3 V = normalize(cameraPosition - vPos); float rim = pow(1.0 - abs(dot(n, V)), 2.0);
            col += vec3(1.0, 0.78, 0.36) * (0.12 * moon + lit * (0.55 + 0.9 * rim)); }
        }
        if (roof < 0.5 && v > top - 0.5) col *= 1.0 + 0.3 * lit;              // the cornice catches the light
        col += vec3(1.0, 0.62, 0.3) * on * exp(-max(since, 0.0) * 2.4) * 0.4;  // the ignition flash
        if (roof > 0.5 && !shaped && hash(floor(vPos.xy / 2.5) + seed) > 0.94) col *= 0.86;   // roof clutter (vents, skylights)

        if (roof < 0.5 && vFace.x >= 0.0 && fl >= 0.0 && v < top - 1.0) {
          float cx = floor(vFace.x), fx = fract(vFace.x);
          bool shop = fl < 0.5;
          float h = hash(vec2(cx + seed * 97.0, fl + seed * 31.0));
          float kind = hash(vec2(cx * 3.1 + seed * 13.0, fl * 1.7 + seed * 5.0));
          bool door = !shop && kind > 0.86;                       // balcony door: tall, down to the floor
          bool tv = !shop && kind < 0.07;
          bool cool = !shop && kind >= 0.07 && kind < 0.19;
          bool curtain = !shop && kind >= 0.19 && kind < 0.40;
          vec2 hs = shop ? vec2(0.38, 0.36) : door ? vec2(0.14, 0.36) : vec2(0.17, 0.27);
          vec2 c = vec2(fx - 0.5, fy - (door ? 0.40 : 0.48));
          vec2 aa = fwidth(vec2(vFace.x, g)) * 1.2;
          float lod = 1.0 - smoothstep(0.12, 0.35, max(aa.x, aa.y));
          float win = (1.0 - smoothstep(hs.x - aa.x, hs.x + aa.x, abs(c.x))) * (1.0 - smoothstep(hs.y - aa.y, hs.y + aa.y, abs(c.y))) * lod;
          // the windows come on from the street upward: nearest the runner's path first, floor by floor
          float order = d / 13.0 + h * 1.1 + fl * 0.18 + (shop ? 0.0 : 0.3);
          // most shops are shut at night: fewer ground-floor windows, and dimmer than the homes above
          float wOn = on * step(order, since) * step(h, shop ? 0.2 + 0.4 * strength : 0.3 + 0.65 * strength);
          float age = since - order;
          float flick = age < 0.3 ? step(0.45, fract(age * 18.0 + h)) : 1.0;
          float level = (0.75 + 0.5 * hash(vec2(h, 3.3))) * (shop ? 0.55 : 1.0);
          vec3 glow = shop ? vec3(1.0, 0.74, 0.40)
            : tv ? mix(vec3(0.45, 0.68, 1.0), vec3(0.85, 0.90, 1.0), hash(vec2(floor(uTime * 2.3) + h * 17.0, 1.0)))
            : cool ? vec3(0.80, 0.89, 1.0)
            : mix(vec3(1.0, 0.62, 0.27), vec3(1.0, 0.86, 0.56), hash(vec2(h, 9.1)));
          glow *= level;
          if (tv) glow *= 0.55 + 0.45 * hash(vec2(floor(uTime * 3.7) + h * 23.0, 2.0));
          float shade = curtain ? 0.45 + 0.55 * (1.0 - smoothstep(0.0, hs.x, abs(c.x))) : 1.0;   // light through a curtain
          float mull = (shop || door) ? 1.0 : 1.0 - (1.0 - smoothstep(0.01, 0.03, abs(c.x))) * 0.55;
          // a few windows are lit in the dark city too \u2014 someone is up
          float sleepless = step(0.965, h) * 0.5;
          vec3 off = mix(vec3(0.05, 0.07, 0.11), mix(vec3(1.0, 0.72, 0.40), vec3(0.50, 0.70, 1.0), step(0.5, hash(vec2(h, 5.5)))) * 0.9, sleepless);
          float light = wOn * flick;
          col = mix(col, mix(off, glow * 1.6 * mull * shade, light), win * 0.95);
          // light spills onto the wall around the window, strongest on the sill below it
          vec2 outside = max(abs(c) - hs, 0.0) * vec2(3.1, 3.3);
          float below = max(-c.y - hs.y, 0.0);
          float spill = exp(-length(outside) * (shop ? 1.3 : 2.0)) * 0.25 + exp(-below * 6.0) * (1.0 - smoothstep(hs.x, hs.x + 0.12, abs(c.x))) * step(0.001, below) * 0.4;
          col += glow * spill * (1.0 - win) * light * lod;
          col += glow * light * (1.0 - lod) * 0.35;
          // a neon sign above some shop fronts
          if (shop) {
            float sg = hash(vec2(cx * 7.7 + seed * 41.0, 2.5));
            if (sg > 0.72) {
              float sy = c.y - 0.36;
              float band = (1.0 - smoothstep(0.045 - aa.y, 0.045 + aa.y, abs(sy))) * (1.0 - smoothstep(0.42 - aa.x, 0.42 + aa.x, abs(c.x))) * lod;
              vec3 neon = sg > 0.93 ? vec3(0.98, 0.45, 0.55) : sg > 0.86 ? vec3(0.37, 0.65, 1.0) : sg > 0.79 ? vec3(1.0, 0.76, 0.26) : vec3(0.25, 0.86, 0.78);
              float signOn = on * step(order + 0.4, since);
              col = mix(col, neon * mix(0.12, 2.2, signOn), band * 0.9);
              col += neon * exp(-abs(sy) * 9.0) * signOn * 0.25 * lod;
            }
          }
        }
        #ifdef GHOST
          gl_FragColor = vec4(fogged(col, vW) * 1.15, 0.2 * cutFade);
        #else
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        #endif
      }`}),t=new Ot({uniforms:s,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader,defines:{GHOST:1},side:Bn,transparent:!0,depthWrite:!1}),n=`
    attribute float aAlong; attribute float aAcross;
    varying float vAlong; varying float vAcross; varying float vW;
    void main(){ vAlong = aAlong; vAcross = aAcross; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,i={...ri,uniforms:s,vertexShader:n,fragmentShader:`
      uniform float uHead, uTime;
      varying float vAlong; varying float vAcross;
      void main(){
        float behind = uHead - vAlong, a = abs(vAcross);
        if (behind < 0.0) discard;
        float edge = 1.0 - smoothstep(0.55, 1.0, a);
        float center = 1.0 - smoothstep(0.0, 0.5, a);
        float head = exp(-behind / 18.0);
        float pulse = pow(0.5 + 0.5 * sin((vAlong - uTime * 26.0) * 0.18), 6.0);
        vec3 c = mix(vec3(0.30, 0.95, 0.80), vec3(0.90, 1.0, 0.97), center * 0.85) * (0.9 + 0.55 * pulse + 1.7 * head);
        gl_FragColor = vec4(c, edge * XRAY);
      }`};return{building:e,buildingGhost:t,core:new Ot({...i,defines:{XRAY:"1.0"}}),xray:new Ot({...i,defines:{XRAY:"0.28"},depthFunc:Cr}),aura:new Ot({...ri,uniforms:s,vertexShader:n,fragmentShader:`
        uniform float uHead; varying float vAlong; varying float vAcross;
        void main(){ float behind = uHead - vAlong; if (behind < 0.0) discard;
          gl_FragColor = vec4(vec3(0.16, 0.85, 0.72), pow(1.0 - abs(vAcross), 2.4) * (0.18 + 0.5 * exp(-behind / 30.0))); }`}),warm:new Ot({...ri,uniforms:s,vertexShader:n,fragmentShader:`
        uniform float uHead; varying float vAlong; varying float vAcross;
        void main(){ float behind = uHead - vAlong; if (behind < 0.0) discard;
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.22), pow(1.0 - abs(vAcross), 1.6) * smoothstep(4.0, 60.0, behind) * 0.16); }`}),curtain:new Ot({...ri,uniforms:s,vertexShader:`attribute float aAlong; attribute float aH; varying float vAlong; varying float vH;
        void main(){ vAlong = aAlong; vH = aH; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
        uniform float uHead, uTime; varying float vAlong; varying float vH;
        void main(){ float behind = uHead - vAlong; if (behind < 0.0) discard;
          float shimmer = 0.75 + 0.25 * sin(vAlong * 0.9 - uTime * 7.0);
          gl_FragColor = vec4(vec3(0.25, 0.95, 0.8), pow(1.0 - vH, 2.2) * (0.10 + 0.55 * exp(-behind / 22.0)) * shimmer); }`}),water:new Ot({uniforms:s,vertexShader:"varying vec3 vP; varying float vW; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }",fragmentShader:`
        uniform float uTime; uniform vec4 uWL[${Wo}]; uniform vec3 uWC[${Wo}]; uniform int uWN;
        ${$r}
        varying vec3 vP; varying float vW;
        vec2 wave(vec2 p, vec2 d, float k, float w, float a, float px){ return d * k * a * cos(dot(d, p) * k + uTime * w) * (1.0 - smoothstep(0.5, 1.8, px * k)); }
        void main(){
          float px = length(fwidth(vP.xy));
          vec2 g = wave(vP.xy, vec2(0.94, 0.33), 0.9, 1.3, 0.06, px) + wave(vP.xy, vec2(-0.51, 0.86), 1.7, 1.9, 0.035, px)
                 + wave(vP.xy, vec2(0.2, -0.98), 3.1, 2.7, 0.02, px) + wave(vP.xy, vec2(-0.96, -0.29), 5.3, 3.6, 0.012, px)
                 + wave(vP.xy, vec2(0.66, 0.75), 9.7, 5.0, 0.006, px);
          vec3 N = normalize(vec3(-g * 1.6, 1.0));
          vec3 V = normalize(vP - cameraPosition);
          vec3 R = reflect(V, N);
          float fres = 0.03 + 0.97 * pow(1.0 - clamp(dot(-V, N), 0.0, 1.0), 5.0);
          // the night sky in the water: the city's haze near the horizon, dark overhead
          vec3 sky = mix(vec3(0.16, 0.16, 0.21), vec3(0.035, 0.05, 0.09), smoothstep(0.0, 0.5, R.z));
          vec3 col = mix(vec3(0.012, 0.024, 0.045), sky, fres);
          float mr = max(dot(R, ${Kr}), 0.0);
          col += vec3(0.75, 0.82, 1.0) * (pow(mr, 400.0) * 1.4 + pow(mr, 30.0) * 0.04);
          // Each light lays a streak on the water from the shore toward the viewer, widening with distance and
          // broken up by the waves that face the light; the water only shows where it is (the streak starts at the shore).
          vec3 lights = vec3(0.0);
          for (int i = 0; i < ${Wo}; i++) {
            if (i >= uWN) break;
            vec2 lg = uWL[i].xy, toCam = cameraPosition.xy - lg;
            float lc = length(toCam);
            if (lc < 1.0) continue;
            vec2 dir = toCam / lc, rel = vP.xy - lg;
            float along = dot(rel, dir), across = dot(rel, vec2(-dir.y, dir.x));
            if (along < 0.0) continue;
            float wid = 1.0 + along * 0.03 + uWL[i].z * 0.05, len = 16.0 + uWL[i].z * 5.0;
            float band = exp(-across * across / (wid * wid)) * exp(-along / len);
            float broken = smoothstep(0.15, 0.85, 0.45 + 4.5 * dot(g, dir));
            lights += uWC[i] * uWL[i].w * band * broken;
          }
          col += lights * 1.1;
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`}),lamp:new Ot({...ri,uniforms:s,vertexShader:`
        attribute float aT; attribute float aSeed; uniform float uTime, uRefW, uPxM, uPR; varying float vOn; varying float vRamp;
        ${dl}
        void main(){
          float since = uTime - aT;
          vRamp = warmRamp(since);
          vOn = step(0.0, since) * warmFlick(since, aSeed) * (0.35 + 0.65 * vRamp);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 2.4 * ${Yr};
        }`,fragmentShader:`
        varying float vOn; varying float vRamp;
        ${dl}
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
          float core = 1.0 - smoothstep(0.0, 0.32, r), halo = pow(1.0 - r, 2.4);
          gl_FragColor = vec4(lampColour(vRamp) * (core * 1.8 + halo * 0.5), (core + halo * 0.5) * vOn); }`}),post:new Ot({uniforms:s,vertexShader:`
        attribute float aGlass; attribute float iT; attribute float iSeed; uniform float uTime;
        varying vec3 vN; varying float vW; varying float vGlass; varying float vOn; varying float vRamp; varying float vZ;
        ${dl}
        void main(){
          float since = uTime - iT;
          vRamp = warmRamp(since);
          vOn = step(0.0, since) * warmFlick(since, iSeed) * (0.35 + 0.65 * vRamp);
          vGlass = aGlass; vZ = position.z;
          vN = normalize(mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,fragmentShader:`${$r} varying vec3 vN; varying float vW; varying float vGlass; varying float vOn; varying float vRamp; varying float vZ;
        ${dl}
        void main(){
          vec3 n = normalize(vN); float moon = max(dot(n, ${Kr}), 0.0);
          vec3 col;
          if (vGlass > 0.5) col = mix(vec3(0.12, 0.14, 0.19) * (0.5 + moon), lampColour(vRamp) * 2.6, vOn);
          else col = vec3(0.10, 0.11, 0.14) * (0.45 + 0.9 * moon) + vec3(1.0, 0.70, 0.42) * vOn * exp(-abs(vZ - 4.5) * 1.3) * 0.8;
          gl_FragColor = vec4(fogged(col, vW), 1.0); }`}),cone:new Ot({...ri,uniforms:s,depthTest:!0,vertexShader:`
        attribute float iT; attribute float iSeed; uniform float uTime;
        varying vec3 vN; varying vec3 vP; varying float vH; varying float vOn;
        ${dl}
        void main(){
          float since = uTime - iT;
          vOn = step(0.0, since) * warmFlick(since, iSeed) * (0.35 + 0.65 * warmRamp(since));
          vH = clamp((position.z - 0.1) / 4.3, 0.0, 1.0);
          vec4 wp = instanceMatrix * vec4(position, 1.0); vP = wp.xyz;
          vN = normalize(mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * wp; }`,fragmentShader:`
        varying vec3 vN; varying vec3 vP; varying float vH; varying float vOn;
        void main(){
          vec3 V = normalize(cameraPosition - vP);
          float cen = pow(abs(dot(normalize(vN), V)), 1.3);
          float fall = smoothstep(0.0, 0.1, vH) * pow(vH, 1.4) * (1.0 - smoothstep(0.93, 1.0, vH));
          float a = fall * (0.42 * cen + 0.08) * vOn;
          gl_FragColor = vec4(vec3(1.0, 0.68, 0.38), a); }`}),pool:new Ot({...ri,uniforms:s,vertexShader:`
        attribute vec2 aUV; attribute vec2 aLit; attribute vec3 aC; uniform float uTime;
        varying vec2 vUV; varying float vOn;
        void main(){
          vUV = aUV; vOn = smoothstep(0.0, 0.8, uTime - aLit.x) * aLit.y;
          vec3 p = mix(aC, position, step(0.003, vOn));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,fragmentShader:`varying vec2 vUV; varying float vOn;
        void main(){ float r = length(vUV); if (r > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.64, 0.32), (pow(1.0 - r, 2.2) * 0.6 + pow(1.0 - r, 7.0) * 0.4) * vOn); }`}),haze:new Ot({...ri,uniforms:s,vertexShader:`
        attribute vec2 aLit; attribute float aSize; uniform float uTime, uRefW, uPxM, uPR; varying float vOn;
        void main(){
          vOn = smoothstep(0.0, 2.5, uTime - aLit.x) * aLit.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = vOn < 0.01 ? 0.0 : min(aSize * ${Yr}, 420.0);
        }`,fragmentShader:`varying float vOn;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.6, 0.28), pow(1.0 - r, 2.6) * 0.07 * vOn); }`}),spark:new Ot({...ri,uniforms:s,vertexShader:`
        attribute vec3 aVel; attribute float aBirth; uniform float uTime, uRefW, uPxM, uPR; varying float vLife;
        void main(){
          float age = uTime - aBirth;
          vLife = clamp(1.0 - age / 1.7, 0.0, 1.0);
          vec3 p = position + aVel * age - vec3(0.0, 0.0, 0.7 * age * age);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = vLife <= 0.0 ? 0.0 : (0.35 + 0.7 * vLife) * ${Yr};
        }`,fragmentShader:`varying float vLife;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vec3(0.6, 1.0, 0.92), pow(1.0 - r, 1.8) * vLife); }`}),mote:new Ot({...ri,uniforms:s,vertexShader:`
        attribute vec3 aVel; attribute float aBirth; attribute float aLife; attribute float aSize; attribute float aSeed;
        uniform float uTime, uRefW, uPxM, uPR; varying float vA;
        void main(){
          float age = uTime - aBirth, t = clamp(age / aLife, 0.0, 1.0);
          vA = (age < 0.0 || t >= 1.0) ? 0.0 : smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.55, 1.0, t));
          vec3 p = position + aVel * age + vec3(sin(age * 1.6 + aSeed * 6.3) * 0.35, cos(age * 1.1 + aSeed * 9.1) * 0.35, 0.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = vA <= 0.0 ? 0.0 : aSize * ${Yr} * (0.7 + 0.3 * (1.0 - t));
        }`,fragmentShader:`varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float core = pow(1.0 - r, 1.6);
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * (0.8 + 0.6 * core), core * vA); }`}),beacon:new Ot({...ri,uniforms:s,vertexShader:`
        attribute float aPhase; uniform float uTime, uRefW, uPxM, uPR; varying float vB;
        void main(){
          vB = smoothstep(0.3, 0.5, 0.5 + 0.5 * sin(uTime * 2.4 + aPhase * 6.2832));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.1 * ${Yr}, 3.0 * uPR);
        }`,fragmentShader:`varying float vB;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
          float core = 1.0 - smoothstep(0.0, 0.35, r), halo = pow(1.0 - r, 2.5);
          gl_FragColor = vec4(vec3(1.0, 0.25, 0.2) * (core * 1.6 + halo * 0.6), (core + halo * 0.5) * (0.15 + 0.85 * vB)); }`}),tree:new Ot({uniforms:s,vertexShader:`
        attribute vec3 iLit; attribute float iSeed;
        varying vec3 vN; varying float vZ; varying vec3 vLit; varying float vSeed; varying float vW;
        void main(){
          vec4 wp = instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(instanceMatrix) * normal); vZ = position.z; vLit = iLit; vSeed = iSeed;
          gl_Position = projectionMatrix * modelViewMatrix * wp; vW = gl_Position.w;
        }`,fragmentShader:`
        uniform float uTime;
        ${$r}
        ${Dp}
        varying vec3 vN; varying float vZ; varying vec3 vLit; varying float vSeed; varying float vW;
        void main(){
          vec3 n = normalize(vN);
          float since = uTime - vLit.x;
          float lit = step(0.0, since) * vLit.y * smoothstep(0.0, 1.5, since);
          float moon = max(dot(n, ${Kr}), 0.0);
          bool canopy = vZ > 2.6;
          vec3 base = canopy ? mix(vec3(0.07, 0.13, 0.12), vec3(0.11, 0.18, 0.14), hash(vec2(vSeed, 2.0))) : vec3(0.11, 0.09, 0.08);
          vec3 col = base * (0.5 + 0.9 * moon);
          float under = clamp(0.5 - n.z * 0.5, 0.0, 1.0);
          col += lit * (vec3(0.95, 0.52, 0.22) * 0.34 * (0.4 + under) + vec3(0.2, 0.9, 0.75) * 0.3 * exp(-vLit.z / 9.0));
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`}),deck:new Ot({uniforms:s,side:Bn,vertexShader:`
        attribute vec2 aLit; attribute vec3 aM; varying vec3 vN; varying vec2 vLit; varying vec3 vM; varying float vW;
        void main(){ vN = normal; vLit = aLit; vM = aM; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,fragmentShader:`
        uniform float uTime; ${$r}
        varying vec3 vN; varying vec2 vLit; varying vec3 vM; varying float vW;
        void main(){
          vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
          float since = uTime - vLit.x, lit = step(0.0, since) * vLit.y * smoothstep(0.0, 1.4, since);
          float moon = max(dot(n, ${Kr}), 0.0), m = vM.x, h = vM.y, s = vM.z;
          vec3 base = m < 0.5 ? vec3(0.24, 0.26, 0.31) : m < 1.5 ? vec3(0.62, 0.58, 0.52) : vec3(0.12, 0.13, 0.16);
          vec3 col = base * vec3(0.16, 0.20, 0.29) * (0.6 + 0.8 * moon);
          vec3 warm = vec3(1.0, 0.72, 0.44);
          if (m < 0.5) {            // the deck: pools of lamplight every 20 m
            float d = mod(s, 20.0) - 10.0;
            col += base * warm * lit * (0.35 + 1.6 * exp(-d * d / 22.0));
          } else if (m < 1.5) {     // stone: washed from below, an LED line along the top of the fascia
            col += base * warm * lit * (0.25 + 0.75 * exp(-h * 2.0));
            col += vec3(0.35, 0.95, 0.84) * lit * smoothstep(0.86, 0.97, h) * (1.0 - step(1.5, h)) * 1.3;
          } else col += base * warm * lit * 0.6 + warm * lit * 0.05;
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`}),mon:new Ot({uniforms:s,side:Bn,vertexShader:`
        attribute vec2 aLit; attribute vec2 aM; varying vec3 vN; varying vec2 vLit; varying vec2 vM; varying float vW; varying vec3 vPos;
        void main(){ vN = normal; vLit = aLit; vM = aM; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,fragmentShader:`
        uniform float uTime; ${$r}
        varying vec3 vN; varying vec2 vLit; varying vec2 vM; varying float vW; varying vec3 vPos;
        void main(){
          vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
          float since = uTime - vLit.x, lit = step(0.0, since) * vLit.y * smoothstep(0.0, 1.8, since);
          float moon = max(dot(n, ${Kr}), 0.0), m = vM.x, h = vM.y;
          vec3 V = normalize(cameraPosition - vPos);
          float rim = pow(1.0 - abs(dot(n, V)), 2.4);
          vec3 base = m < 0.5 ? vec3(0.80, 0.76, 0.68) : m < 1.5 ? vec3(0.34, 0.25, 0.16) : m < 2.5 ? vec3(0.88, 0.68, 0.28) : m < 3.5 ? vec3(0.13, 0.14, 0.17) : vec3(0.10, 0.17, 0.24);
          vec3 col = base * vec3(0.16, 0.20, 0.29) * (0.55 + 0.8 * moon) + base * rim * 0.06;
          float flood = 0.22 + 0.72 * exp(-h * 2.4);     // floodlights stand on the ground and shine up
          vec3 warm = vec3(1.0, 0.85, 0.64);
          if (m < 0.5) col += base * warm * flood * lit;
          else if (m < 1.5) col += base * warm * flood * lit * 1.5 + vec3(1.0, 0.72, 0.42) * rim * lit * 0.55;
          else if (m < 2.5) col += vec3(1.0, 0.78, 0.36) * (0.10 * moon + lit * (0.45 + 1.1 * rim));
          else if (m < 3.5) {     // the tower's LED lattice: a slow wave of light climbing the steel
            float wave = 0.55 + 0.45 * sin(h * 26.0 - uTime * 1.6);
            col = mix(col, mix(vec3(0.30, 0.92, 0.82), vec3(0.95, 0.98, 1.0), wave * 0.5) * (0.6 + 0.8 * wave), lit * 0.92);
          } else col += vec3(0.32, 0.85, 0.95) * lit * (0.45 + 0.35 * sin(uTime * 2.2 + vPos.x * 1.3 + vPos.y * 0.9));
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`}),towerLed:new Ot({...ri,uniforms:s,vertexShader:`
        attribute float aH; attribute float aSeed; uniform float uTime, uRun, uRefW, uPxM, uPR; varying vec3 vC; varying float vA;
        void main(){
          float wave = pow(0.5 + 0.5 * sin(aH * 30.0 - uTime * (1.4 + 1.6 * uRun)), 4.0);
          float ring = 1.0 - smoothstep(0.0, 0.03, abs(fract(uTime * 0.11) - aH));
          float tw = 0.75 + 0.25 * sin(uTime * (1.5 + 2.0 * aSeed) + aSeed * 40.0);
          vC = mix(vec3(0.08, 0.78, 0.68), vec3(0.55, 1.0, 0.90), wave) * (0.7 + 0.8 * wave + 1.6 * ring) * tw;
          vA = 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          // never smaller than a few pixels: the tower is seen from across the city
          gl_PointSize = clamp(3.0 * ${Yr}, 7.0 * uPR, 24.0 * uPR);
        }`,fragmentShader:`varying vec3 vC; varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float core = 1.0 - smoothstep(0.15, 0.55, r), halo = pow(1.0 - r, 2.0);
          gl_FragColor = vec4(vC * (core * 1.6 + halo * 0.6), (core + halo * 0.6) * vA); }`}),jet:new Ot({...ri,uniforms:s,vertexShader:`
        attribute vec2 aLit; attribute vec4 aJet; uniform float uTime, uRefW, uPxM, uPR; varying float vA;
        void main(){
          float on = smoothstep(0.0, 1.5, uTime - aLit.x) * aLit.y;
          float T = 1.5, age = fract(uTime / T + aJet.w) * T;
          vec3 p = position + vec3(aJet.xy * age, aJet.z * age - 4.9 * age * age);
          p.z = max(p.z, position.z);
          vA = on * (1.0 - age / T);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = vA < 0.01 ? 0.0 : 0.32 * ${Yr};
        }`,fragmentShader:`varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vec3(0.55, 0.92, 1.0), pow(1.0 - r, 1.5) * vA * 0.8); }`}),ring:new Ot({...ri,uniforms:s,vertexShader:"varying vec2 vUV; void main(){ vUV = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
        uniform float uTime, uRun; varying vec2 vUV;
        void main(){
          float r = length(vUV); if (r > 1.0) discard;
          float a = 0.0;
          for (int k = 0; k < 2; k++) {
            float t = fract(uTime / 1.3 - float(k) * 0.16);
            a += exp(-pow((r - t) * 22.0, 2.0)) * (1.0 - t) * (k == 0 ? 1.0 : 0.6);
          }
          gl_FragColor = vec4(vec3(0.3, 0.98, 0.84), a * 0.55 * uRun + pow(1.0 - r, 6.0) * 0.6);
        }`})}}function cu(s){let e=0;for(let t=0;t<s.length;t++){let n=s[t],i=s[(t+1)%s.length];e+=n[0]*i[1]-i[0]*n[1]}return e/2}function KS(s,e){let t=s;for(let[n,i,r]of[[0,0,-1],[0,e,1],[1,0,-1],[1,e,1]]){let o=t;t=[];for(let a=0;a<o.length;a++){let l=o[a],c=o[(a+1)%o.length],h=(l[n]-i)*r<=0,u=(c[n]-i)*r<=0;if(h&&t.push(l),h!==u){let f=(i-l[n])/(c[n]-l[n]),d=[l[0]+(c[0]-l[0])*f,l[1]+(c[1]-l[1])*f];d[n]=i,t.push(d)}}if(!t.length)return t}return t.filter((n,i)=>{let r=t[(i+1)%t.length];return n[0]!==r[0]||n[1]!==r[1]})}function Cp(s){let e=s.extent,t=[],n=0;for(let i of s.loadGeometry()){let r=i.map(l=>[l.x,l.y]);r.length>1&&r[0][0]===r[r.length-1][0]&&r[0][1]===r[r.length-1][1]&&r.pop();let o=cu(r);if(r.length<3||!o)continue;n||(n=Math.sign(o));let a=KS(r,e);Math.sign(o)===n?t.push(a.length>=3?[a]:null):t.length&&t[t.length-1]&&a.length>=3&&t[t.length-1].push(a)}return t.filter(Boolean)}var JS=(s,e,t)=>s[0]===e[0]&&(s[0]===0||s[0]===t)||s[1]===e[1]&&(s[1]===0||s[1]===t);function Pp(s,e,t){return s.map((n,i)=>{let r=n.map(a=>({t:a,l:t(a[0],a[1],e)})),o=cu(r.map(a=>a.l));return(i===0&&o<0||i>0&&o>0)&&(r=r.reverse()),r})}function Ip(s){let e=s[0].map(i=>new _e(i.l[0],i.l[1])),t=s.slice(1).map(i=>i.map(r=>new _e(r.l[0],r.l[1]))),n=Ci.triangulateShape(e,t);return{verts:e.concat(...t),tris:n}}var Zg=(()=>{let s=new Uo(1,1).scale(2.3,2.3,2.6).translate(0,0,4.3),e=new ni(.16,.24,3.2,6).rotateX(Math.PI/2).translate(0,0,1.6).toNonIndexed();return Zd([s,e])})(),jS={park:110,wood:70,scrub:140,cemetery:120,grass:420},$g=(()=>{let s=[],e=n=>n.rotateX(Math.PI/2),t=(n,i)=>{n.setAttribute("aGlass",new Me(new Float32Array(n.attributes.position.count).fill(i),1)),s.push(n)};return t(e(new ni(.2,.27,.45,8)).translate(0,0,.225),0),t(e(new ni(.055,.085,4.55,8)).translate(0,0,2.725),0),t(new Gr(.1,8,6).translate(0,0,5.02),0),t(new ni(.035,.045,.85,6).translate(0,.42,4.95),0),t(e(new ni(.03,.03,.26,5)).translate(0,.8,4.84),0),t(e(new Do(.27,.2,6)).translate(0,.8,4.83),0),t(e(new ni(.2,.17,.42,6)).translate(0,.8,Lp),1),t(e(new ni(.17,.11,.07,6)).translate(0,.8,4.28),0),Zd(s)})(),QS=new ni(.22,3.4,4.3,16,1,!0).rotateX(Math.PI/2).translate(0,.8,2.25),pl=class{constructor(e=2){this.P=[],this.N=[],this.M=[],this.I=[],this.n=0,this.mSize=e,this.cur={mat:0,z0:0,H:1}}v(e,t,n,i,r,o,a){return this.P.push(e,t,n),this.N.push(i,r,o),a?this.M.push(...a):(this.M.push(this.cur.mat,_n((n-this.cur.z0)/this.cur.H,0,1)),this.mSize===3&&this.M.push(this.cur.s||0)),this.n++}tri(e,t,n){this.I.push(e,t,n)}face(e,t,n){let[i,r,o]=e,a=(r[1]-i[1])*(o[2]-i[2])-(r[2]-i[2])*(o[1]-i[1]),l=(r[2]-i[2])*(o[0]-i[0])-(r[0]-i[0])*(o[2]-i[2]),c=(r[0]-i[0])*(o[1]-i[1])-(r[1]-i[1])*(o[0]-i[0]),h=Math.hypot(a,l,c)||1;if(a/=h,l/=h,c/=h,t){let f=e.reduce((x,g)=>x+g[0],0)/e.length,d=e.reduce((x,g)=>x+g[1],0)/e.length,p=e.reduce((x,g)=>x+g[2],0)/e.length;a*(f-t[0])+l*(d-t[1])+c*(p-t[2])<0&&(a=-a,l=-l,c=-c)}let u=e.map(f=>this.v(f[0],f[1],f[2],a,l,c,n));for(let f=1;f<u.length-1;f++)this.tri(u[0],u[f],u[f+1])}geometry(e={}){let t=new tt;t.setAttribute("position",new Me(this.P,3)),t.setAttribute("normal",new Me(this.N,3)),t.setAttribute("aM",new Me(this.M,this.mSize));for(let[n,i]of Object.entries(e))t.setAttribute(n,i);return t.setIndex(this.I),t}};function Zn(s,e,t,n,i,r,o,a=0){let l=Math.cos(a),c=Math.sin(a),h=(d,p,x)=>[e+d*l-p*c,t+d*c+p*l,x],u=[[-i/2,-r/2],[i/2,-r/2],[i/2,r/2],[-i/2,r/2]],f=[e,t,n+o/2];for(let d=0;d<4;d++){let p=u[d],x=u[(d+1)%4];s.face([h(p[0],p[1],n),h(x[0],x[1],n),h(x[0],x[1],n+o),h(p[0],p[1],n+o)],f)}s.face(u.map(d=>h(d[0],d[1],n+o)),f)}function ew(s,e,t,n,i,r,o,a=0,l=0){let c=Math.cos(l),h=Math.sin(l),u=(p,x,g)=>[e+p*c-x*h,t+p*h+x*c,g],f=[[-1,-1],[1,-1],[1,1],[-1,1]],d=[e,t,(n+i)/2];for(let p=0;p<4;p++){let x=f[p],g=f[(p+1)%4];s.face([u(x[0]*r,x[1]*r,n),u(g[0]*r,g[1]*r,n),u(g[0]*o,g[1]*o,i),u(x[0]*o,x[1]*o,i)],d)}if(a>0)for(let p=0;p<4;p++){let x=f[p],g=f[(p+1)%4];s.face([u(x[0]*o,x[1]*o,i),u(g[0]*o,g[1]*o,i),[e,t,i+a]],[e,t,i])}else s.face(f.map(p=>u(p[0]*o,p[1]*o,i)),d)}function Go(s,e,t,n){let i=[t[0]-e[0],t[1]-e[1],t[2]-e[2]],r=Math.hypot(...i)||1,o=i.map(d=>d/r),a=Math.abs(o[2])>.95?[1,0,0]:[-o[1],o[0],0],l=Math.hypot(...a);a=a.map(d=>d/l);let c=[o[1]*a[2]-o[2]*a[1],o[2]*a[0]-o[0]*a[2],o[0]*a[1]-o[1]*a[0]],h=(d,p,x)=>[d[0]+(a[0]*p+c[0]*x)*n/2,d[1]+(a[1]*p+c[1]*x)*n/2,d[2]+(a[2]*p+c[2]*x)*n/2],u=[[-1,-1],[1,-1],[1,1],[-1,1]],f=[(e[0]+t[0])/2,(e[1]+t[1])/2,(e[2]+t[2])/2];for(let d=0;d<4;d++){let p=u[d],x=u[(d+1)%4];s.face([h(e,p[0],p[1]),h(e,x[0],x[1]),h(t,x[0],x[1]),h(t,p[0],p[1])],f)}}function Zr(s,e,t,n,i,r,o=12){let a=i.map(([l,c],h)=>{let u=i[Math.max(0,h-1)],f=i[Math.min(i.length-1,h+1)],d=f[0]-u[0],p=f[1]-u[1],x=Math.hypot(d,p)||1,g=[];for(let m=0;m<=o;m++){let y=m/o*Math.PI*2,_=Math.cos(y),v=Math.sin(y);g.push(s.v(e+_*l*r,t+v*l*r,n+c*r,_*p/x,v*p/x,-d/x))}return g});for(let l=0;l<a.length-1;l++)for(let c=0;c<o;c++){let h=a[l][c],u=a[l][c+1],f=a[l+1][c+1],d=a[l+1][c];s.tri(h,u,f),s.tri(h,f,d)}}var Kg=[[.2,0],[.22,.08],[.15,.5],[.17,.95],[.2,1.3],[.19,1.5],[.24,1.85],[.32,2.02],[.33,2.1],[.26,2.16],[.09,2.22],[.1,2.3],[.15,2.44],[.14,2.62],[.08,2.74],[0,2.78],[0,2.9]],tw=[[.44,0],[.42,.22],[.2,.36],[.12,.43],[.16,.56],[.155,.74],[.08,.85],[0,.88]],nw={red:"a8473a",darkred:"7c2e27",brown:"7a5236",grey:"8a8f96",gray:"8a8f96",darkgrey:"5a5f66",green:"4f7a5a",darkgreen:"35553f",blue:"4d6a8f",gold:"d6a640",golden:"d6a640",yellow:"c9a240",silver:"b8bec6",white:"d8d8d4",black:"2a2c30",orange:"b8673a"};function iw(s){let e=/^[0-9a-f]{6}$/i.test(s||"")?s:nw[String(s||"").toLowerCase()];return e?[parseInt(e.slice(0,2),16)/255,parseInt(e.slice(2,4),16)/255,parseInt(e.slice(4,6),16)/255]:[0,0,0]}function sw(s,e,t,n,i,r,o){let a=n-t,l=0,c=0,h=0;for(let C=0;C<e.length;C++){let S=e[C],M=e[(C+1)%e.length],N=S[0]*M[1]-M[0]*S[1];h+=N,l+=(S[0]+M[0])*N,c+=(S[1]+M[1])*N}if(Math.abs(h)<1e-6)return;l/=3*h,c/=3*h;let u=(C,S)=>{let[M,N,J]=C,$=(N[1]-M[1])*(J[2]-M[2])-(N[2]-M[2])*(J[1]-M[1]),ee=(N[2]-M[2])*(J[0]-M[0])-(N[0]-M[0])*(J[2]-M[2]),pe=(N[0]-M[0])*(J[1]-M[1])-(N[1]-M[1])*(J[0]-M[0]),ie=Math.hypot($,ee,pe)||1;$/=ie,ee/=ie,pe/=ie;let be=C.reduce((Fe,dt)=>Fe+dt[0],0)/C.length,se=C.reduce((Fe,dt)=>Fe+dt[1],0)/C.length,Te=C.reduce((Fe,dt)=>Fe+dt[2],0)/C.length;$*(be-S[0])+ee*(se-S[1])+pe*(Te-S[2])<0&&($=-$,ee=-ee,pe=-pe);let Ue=C.map(Fe=>r(Fe[0],Fe[1],Fe[2],$,ee,pe));for(let Fe=1;Fe<Ue.length-1;Fe++)o(Ue[0],Ue[Fe],Ue[Fe+1])},f=[l,c,t-a];if(s===1||s===2){let C=s===1?Array.from({length:7},(M,N)=>{let J=N/6*Math.PI/2;return[Math.cos(J),Math.sin(J)]}):[[1,0],[1.12,.1],[1.18,.22],[1.1,.36],[.9,.5],[.62,.64],[.36,.77],[.16,.88],[.05,.96],[0,1]],S=C.map(([M,N],J)=>{let $=C[Math.max(0,J-1)],ee=C[Math.min(C.length-1,J+1)],pe=ee[0]-$[0],ie=ee[1]-$[1];return e.map(([be,se])=>{let Te=be-l,Ue=se-c,Fe=Math.hypot(Te,Ue)||1,dt=a*ie,Gt=-Fe*pe,me=Math.hypot(dt,Gt)||1;return dt/=me,Gt/=me,r(l+Te*M,c+Ue*M,t+a*N,Te/Fe*dt,Ue/Fe*dt,Gt)})});for(let M=0;M<S.length-1;M++)for(let N=0;N<e.length;N++){let J=(N+1)%e.length;o(S[M][N],S[M][J],S[M+1][J]),o(S[M][N],S[M+1][J],S[M+1][N])}return}if(s===3){for(let C=0;C<e.length;C++){let S=e[C],M=e[(C+1)%e.length],N=(pe,ie)=>{let be=pe-l,se=ie-c,Te=Math.hypot(be,se)||1,Ue=Math.hypot(a,Te);return[be/Te*a/Ue,se/Te*a/Ue,Te/Ue]},J=N(S[0],S[1]),$=N(M[0],M[1]),ee=N((S[0]+M[0])/2,(S[1]+M[1])/2);o(r(S[0],S[1],t,...J),r(M[0],M[1],t,...$),r(l,c,n,...ee))}return}let d=null;if((s===5||s===6)&&e.length===4){let C=(be,se)=>Math.hypot(se[0]-be[0],se[1]-be[1]),[S,M,N,J]=e,$=C(S,M),ee=C(M,N),pe=C(N,J),ie=C(J,S);Math.abs($-pe)<.2*Math.max($,pe)&&Math.abs(ee-ie)<.2*Math.max(ee,ie)&&(d=$+pe>=ee+ie!==i?[S,M,N,J]:[M,N,J,S])}if(!d){for(let C=0;C<e.length;C++){let S=e[C],M=e[(C+1)%e.length];u([[S[0],S[1],t],[M[0],M[1],t],[l,c,n]],f)}return}let[p,x,g,m]=d,y=(C,S)=>[(C[0]+S[0])/2,(C[1]+S[1])/2],_=y(m,p),v=y(x,g);if(s===5){let C=v[0]-_[0],S=v[1]-_[1],M=Math.hypot(C,S)||1,N=Math.min(Math.hypot(p[0]-m[0],p[1]-m[1])/2,M*.45);_=[_[0]+C/M*N,_[1]+S/M*N],v=[v[0]-C/M*N,v[1]-S/M*N]}let F=(C,S)=>[C[0],C[1],S],T=F(_,n),U=F(v,n);u([F(p,t),F(x,t),U,T],f),u([F(g,t),F(m,t),T,U],f),u([F(x,t),F(g,t),U],f),u([F(m,t),F(p,t),T],f)}function rw(s,e){let t=[],n=null;for(let i=0;i<s.length-1;i++){let[r,o]=s[i],[a,l]=s[i+1],c=0,h=1,u=a-r,f=l-o,d=!0;for(let[g,m]of[[-u,r],[u,e-r],[-f,o],[f,e-o]]){if(g===0){if(m<0){d=!1;break}continue}let y=m/g;if(g<0){if(y>h){d=!1;break}y>c&&(c=y)}else{if(y<c){d=!1;break}y<h&&(h=y)}}if(!d){n=null;continue}let p=[r+u*c,o+f*c],x=[r+u*h,o+f*h];(!n||c>0)&&(n={pts:[p],openStart:c>0,openEnd:!1},t.push(n)),n.pts.push(x),h<1&&(n.openEnd=!0,n=null)}return t.filter(i=>i.pts.length>=2)}var Jg=[0,0,0,0],ow=new Set(["church","cathedral","chapel","monastery","mosque","synagogue","temple","shrine","castle","bell_tower"]),aw={river:14,canal:10,stream:4,stream_intermittent:3,drain:2.5,ditch:2},lw={motorway:20,trunk:20,primary:18,secondary:14,tertiary:12,street:9,street_limited:8,service:6,pedestrian:6,path:4,track:4,major_rail:7,minor_rail:6,service_rail:5};function cw({mapboxgl:s,map:e,token:t,assetBase:n="",detailBase:i,hero:r="m",onLit:o,lite:a=!1,bloom:l=!0,adaptive:c=!0,onQuality:h}){i==null&&(i=`${n}detail/`);let u=e.getCenter(),f=s.MercatorCoordinate.fromLngLat([u.lng,u.lat],0),d=f.meterInMercatorCoordinateUnits(),p=(b,A)=>[(b-f.x)/d,-(A-f.y)/d],x=(b,A)=>{let R=s.MercatorCoordinate.fromLngLat([b,A],0);return p(R.x,R.y)},g=(b,A)=>({x:f.x+b*d,y:f.y-A*d}),m=(b,A)=>{let R=g(b,A);return new s.MercatorCoordinate(R.x,R.y,0).toLngLat()},y=new ct().makeTranslation(f.x,f.y,0).scale(new L(d,-d,d)),_={uTime:{value:0},uHead:{value:0},uRunner:{value:new L},uCut:{value:0},uRefW:{value:1},uPxM:{value:2},uPR:{value:Math.min(2,window.devicePixelRatio||1)},uFog:{value:new Be("#121926")},uRun:{value:0},uWL:{value:Array.from({length:Wo},()=>new kt)},uWC:{value:Array.from({length:Wo},()=>new L)},uWN:{value:0}},v=$S(_),F=new Br,T=new qs;F.add(new No(10467040,3811095,1.6));let U=new Ls(13229311,1.8);U.position.set(-45,55,72),F.add(U);let C=new Ks(16754784,0,60,1.2);F.add(C);let S=new Ls(15135487,.5);F.add(S);let M=!1,N=()=>_.uTime.value,J=l&&!a,$=new Map,ee=new Map,pe=new Map,ie=(b,A)=>Math.floor(b/Qt)+","+Math.floor(A/Qt),be=new Set,se=[];function Te(b){let A=ie(b.cx,b.cy);b.cell=A,$.has(A)||$.set(A,[]),$.get(A).push(b)}function Ue(b,A,R){let P=Math.hypot(b.cx-A,b.cy-R),I=b.pts;if(I)for(let k=0;k<I.length;k+=2)P=Math.min(P,Math.hypot(I[k]-A,I[k+1]-R));return P}function Fe(b){for(let A of b.ranges){let R=A.attr.array,P=A.attr.itemSize,I=A.xy&&b.lp&&b.time>er+1?A.xy:null;for(let k=A.start;k<A.start+A.count;k++){let Y=I?b.time+Math.max(0,Math.hypot(I[(k-A.start)*2]-b.lp[0],I[(k-A.start)*2+1]-b.lp[1])-b.dist)/au:b.time;R[k*P]=Y,P>1&&(R[k*P+1]=b.strength),P>2&&(R[k*P+2]=b.dist)}A.attr.addUpdateRange(A.start*P,A.count*P),A.attr.needsUpdate=!0}b.onLit&&b.onLit(b)}function dt(b){let A=b.seg;for(let R of b.segRanges){let P=R.attr.array;for(let I=R.start;I<R.start+R.count;I++)P[I*4]=A[0],P[I*4+1]=A[1],P[I*4+2]=A[2],P[I*4+3]=A[3];R.attr.addUpdateRange(R.start*4,R.count*4),R.attr.needsUpdate=!0}b.segWritten=[A[2],A[3]]}function Gt(b,A,R){if(!b.segRanges||A==null)return;let P=b.seg,I=!1;if(!P||Math.hypot(A-P[2],R-P[3])>40)P=b.seg=[A,R,A,R],I=!0;else{P[2]=A,P[3]=R;let Y=Math.hypot(P[2]-P[0],P[3]-P[1]);Y>Tp&&(P[0]=P[2]-(P[2]-P[0])*Tp/Y,P[1]=P[3]-(P[3]-P[1])*Tp/Y)}let k=b.segWritten;(I||!k||Math.hypot(P[2]-k[0],P[3]-k[1])>2)&&dt(b)}function me(b,A,R,P,I,k){let Y=1-Rp(b.tree?10:14,b.tree?60:Qs,R);P&&b.key&&Y>.25&&!be.has(b.key)&&(be.add(b.key),_l=!0),!(Y<=.02)&&(Gt(b,I,k),!(Y<=b.strength+.08)&&(b.strength<=0&&(b.time=A,b.lp=[I??b.cx,k??b.cy],A>er+1&&se.length<600&&se.push(b)),b.strength=Y,b.dist=Math.min(b.dist??1e9,R),Fe(b)))}function Le(b,A,R,P,I){let k=Math.floor(b/Qt),Y=Math.floor(A/Qt),H=Math.ceil(Qs/Qt);for(let O=-H;O<=H;O++)for(let K=-H;K<=H;K++){let V=$.get(k+O+","+(Y+K));if(V)for(let he of V){let W=Ue(he,b,A);W<Qs&&me(he,I?er:R+W/au,W,P,b,A)}}}function nt(b,A,R){let P=ie(A,R);b.has(P)||b.set(P,[]),b.get(P).push(A,R)}function Ne(b,A){let R=Math.floor(A.cx/Qt),P=Math.floor(A.cy/Qt),I=Math.ceil(Qs/Qt),k={d:1e9,x:0,y:0};for(let Y=-I;Y<=I;Y++)for(let H=-I;H<=I;H++){let O=b.get(R+Y+","+(P+H));if(O)for(let K=0;K<O.length;K+=2){let V=Ue(A,O[K],O[K+1]);V<k.d&&(k.d=V,k.x=O[K],k.y=O[K+1])}}return k}function ft(b){let A=Ne(ee,b),R=Ne(pe,b);A.d<Qs&&me(b,er,A.d,!0,A.x,A.y),R.d<Qs&&me(b,er,R.d,!1,R.x,R.y)}let pt=new Map;function _t(b,A){let R=b.hw+2,P=Math.floor((Math.min(b.ax,b.bx)-R)/Qt),I=Math.floor((Math.max(b.ax,b.bx)+R)/Qt),k=Math.floor((Math.min(b.ay,b.by)-R)/Qt),Y=Math.floor((Math.max(b.ay,b.by)+R)/Qt);for(let H=P;H<=I;H++)for(let O=k;O<=Y;O++){let K=H+","+O;pt.has(K)||pt.set(K,[]),pt.get(K).push(b),A.push(K)}}function Nt(b,A,R,P){let I=pt.get(ie(b,A));if(!I)return 0;let k=0,Y=R==null?0:Math.hypot(R,P);for(let H of I){let O=H.bx-H.ax,K=H.by-H.ay,V=O*O+K*K||1e-6,he=_n(((b-H.ax)*O+(A-H.ay)*K)/V,0,1);Math.hypot(H.ax+O*he-b,H.ay+K*he-A)>H.hw+1.5||Y>.01&&Math.abs((O*R+K*P)/(Math.sqrt(V)*Y))<.5||(k=Math.max(k,H.za+(H.zb-H.za)*he))}return k}let ye=new Map,Ce=new Map,B=new Set,at=new Set,Ee=new Map,Ke=i?fetch(`${i}index.json`).then(b=>b.ok?b.json():null).then(b=>new Set(b&&b.v===1?b.tiles:[])).catch(()=>new Set):Promise.resolve(new Set),Ie=[],mt=i?fetch(`${i}landmarks.json`).then(b=>b.ok?b.json():null).then(b=>{for(let A of b&&b.v===1&&b.models||[]){let R=A.from||A.at,P=A.to||A.at,[I,k]=x(R[0],R[1]),[Y,H]=x(P[0],P[1]),O={spec:A,ax:I,ay:k,bx:Y,by:H,state:null,group:null,rec:null};O.ready=new Promise(K=>{O.resolve=K}),Ie.push(O);for(let K of A.replaces||[])B.add(K)}}).catch(()=>{}):Promise.resolve(),Ze=(b,A)=>Ie.some(R=>R.spec.replacesMonument&&Math.hypot(b-R.ax,A-R.ay)<R.spec.replacesMonument),D=(b,A,R)=>Ie.some(P=>P.spec.clearsAll&&Math.hypot(b-P.ax,A-P.ay)<P.spec.clearsAll||R>=25&&P.spec.clearsTall&&Math.hypot(b-P.ax,A-P.ay)<P.spec.clearsTall),w=(b,A)=>Ie.some(R=>R.spec.plaza&&Math.hypot(b-R.ax,A-R.ay)<R.spec.plaza.road[1]+1),Q=(b,A)=>Ie.some(R=>R.spec.replacesTower&&Math.hypot(b-R.ax,A-R.ay)<R.spec.replacesTower);function ge(b,A){for(let R of Ie){if(!R.spec.replacesBridge)continue;let P=R.bx-R.ax,I=R.by-R.ay,k=Math.hypot(P,I)||1,Y=P/k,H=I/k,O=4;if(Op(b,A,R.ax-Y*O,R.ay-H*O,R.bx+Y*O,R.by+H*O)<(R.spec.canopyWidth||12)/2+2)return R}return null}let we=b=>{let A=new Float32Array(b.count*b.itemSize);for(let R=0;R<b.count;R++)for(let P=0;P<b.itemSize;P++)A[R*b.itemSize+P]=b.getComponent(R,P);return new ht(A,b.itemSize)};function xe(b){b.updateMatrixWorld(!0);let A=[];b.traverse(P=>{P.isMesh&&A.push(P)});for(let P of A){let I=P.geometry.clone();for(let k of["position","normal"])I.attributes[k]&&I.setAttribute(k,we(I.attributes[k]));I.applyMatrix4(P.matrixWorld),P.geometry=I}b.traverse(P=>{P.position.set(0,0,0),P.rotation.set(0,0,0),P.scale.set(1,1,1)});let R=new wn;for(let P of A)P.geometry.computeBoundingBox(),R.union(P.geometry.boundingBox);return{meshes:A,box3:R,size:R.getSize(new L),centre:R.getCenter(new L)}}function Je(b,A){let R=new L;for(let P of b){let I=P.geometry.attributes.position;for(let k=0;k<I.count;k++)R.fromBufferAttribute(I,k),A(R,I,k)}}function ze(b){for(let A of b)A.geometry.attributes.position.needsUpdate=!0,A.geometry.computeVertexNormals(),A.geometry.computeBoundingBox(),A.geometry.computeBoundingSphere()}function $e(b,A,R,P,I){let k=b.spec,Y=P.x>=P.z,H=Y?P.x:P.z,O=Xe=>Y?Xe.x-I.x:Xe.z-I.z,K=Xe=>Y?Xe.z-I.z:I.x-Xe.x,V=[];Je(A,Xe=>{Math.abs(O(Xe))>H*.47&&V.push([Xe.y,Math.abs(K(Xe))])});let he=(Xe,Pt)=>(Xe.sort((an,ln)=>an-ln),Xe.length?Xe[Math.min(Xe.length-1,Math.floor(Xe.length*Pt))]:0),W=R.min.y,ae=P.z*.1;if(V.length){let Xe=P.y/40,Pt=new Map;for(let[At]of V){let jt=Math.floor((At-R.min.y)/Xe);Pt.set(jt,(Pt.get(jt)||0)+1)}let an=[...Pt.entries()].sort((At,jt)=>jt[1]-At[1])[0][0],ln=R.min.y+(an-1)*Xe,Yt=R.min.y+(an+2)*Xe,xt=V.filter(([At])=>At>=ln&&At<=Yt);W=Math.max(...xt.map(([At])=>At)),ae=Math.max(1e-4,he(xt.map(([,At])=>At),.75))}let Se=(Y?P.z:P.x)/2,X=Math.hypot(b.bx-b.ax,b.by-b.ay),z=1/0,ce=-1/0;Je(A,Xe=>{if(Math.abs(K(Xe))>ae*2){let Pt=O(Xe);Pt<z&&(z=Pt),Pt>ce&&(ce=Pt)}});let ne=ce>z?ce-z:H,de=ce>z?(ce+z)/2:0,te=X/ne,j=(k.rise||8)/Math.max(1e-4,R.max.y-W),Re=(k.deckWidth||5)/2,it=(k.canopyWidth||12)/2,ut=Xe=>Xe<=ae?Xe/ae*Re:Re+(Xe-ae)/Math.max(1e-4,Se-ae)*Math.max(0,it-Re);Je(A,(Xe,Pt,an)=>{let ln=K(Xe);Pt.setXYZ(an,(O(Xe)-de)*te,(Xe.y-W)*j,Math.sign(ln)*ut(Math.abs(ln)))}),ze(A);let Ge=(b.ax+b.bx)/2,Rt=(b.ay+b.by)/2,Mt=k.deck||Nt(Ge,Rt,b.bx-b.ax,b.by-b.ay)||4.2,Zt=Math.max(2,Math.ceil(X/10)+1),Ct=new Float32Array(Zt*2);for(let Xe=0;Xe<Zt;Xe++){let Pt=Xe/(Zt-1);Ct[Xe*2]=b.ax+(b.bx-b.ax)*Pt,Ct[Xe*2+1]=b.ay+(b.by-b.ay)*Pt}return{x:Ge,y:Rt,z:Mt+.06,turn:Math.atan2(b.by-b.ay,b.bx-b.ax),pts:Ct,top:Mt+(k.rise||8),base:Mt}}function Bt(b,A,R,P){let I=b.spec,k=R.min.y+(I.fitAbove||0)*P.y,Y=1/0,H=-1/0,O=1/0,K=-1/0;Je(A,j=>{j.y>k&&(Y=Math.min(Y,j.x),H=Math.max(H,j.x),O=Math.min(O,j.z),K=Math.max(K,j.z))});let V=I.fitWidth?I.fitWidth/Math.max(H-Y,K-O):I.height?I.height/P.y:1,he=V*(I.squash||1),W=(Y+H)/2,ae=(O+K)/2,Se=R.min.y+(I.levelAt||0)*P.y;Je(A,(j,Re,it)=>Re.setXYZ(it,(j.x-W)*V,(j.y-Se)*he,(j.z-ae)*V)),I.reachGround&&I.level>0&&Je(A,(j,Re,it)=>{j.y<.3&&Re.setY(it,-I.level)}),ze(A);let X=-((I.facing??0)-(I.front==="x"?90:180))*Math.PI/180,z=Math.max(R.max.x-W,W-R.min.x)*V,ce=Math.max(R.max.z-ae,ae-R.min.z)*V,ne=Math.cos(X),de=Math.sin(X),te=[];for(let[j,Re]of[[0,0],[z,0],[-z,0],[0,ce],[0,-ce],[z,ce],[-z,-ce],[z,-ce],[-z,ce]])te.push(b.ax+j*ne+Re*de,b.ay+j*de-Re*ne);return{x:b.ax,y:b.ay,z:I.level||0,turn:X,pts:new Float32Array(te),top:(I.level||0)+(R.max.y-Se)*he,base:I.reachGround?0:(I.level||0)-(Se-R.min.y)*he}}function Pe(b,A,R){if(!b||!b.group)return null;b.group.updateMatrixWorld(!0);let I=new il(new L(A,R,500),new L(0,0,-1)).intersectObject(b.group,!0)[0];return I?I.point.z:null}function Qe(b){let A=b.spec,R=A.plaza,P=b.ax,I=b.ay,k=160,Y=[],H=[],O=[],K=(ue,et,Ye,Ut,Ht,$t)=>(Y.push(ue,et,Ye),H.push(Ut,Ht,$t),Y.length/3-1),V=(ue,et,Ye)=>{for(let Ut=0;Ut<k;Ut++){let Ht=Ut/k*Math.PI*2,$t=(Ut+1)/k*Math.PI*2,un=[K(P+Math.cos(Ht)*ue,I+Math.sin(Ht)*ue,Ye,0,0,1),K(P+Math.cos($t)*ue,I+Math.sin($t)*ue,Ye,0,0,1),K(P+Math.cos($t)*et,I+Math.sin($t)*et,Ye,0,0,1),K(P+Math.cos(Ht)*et,I+Math.sin(Ht)*et,Ye,0,0,1)];O.push(un[0],un[1],un[2],un[0],un[2],un[3])}},he=(ue,et,Ye)=>{for(let Ut=0;Ut<k;Ut++){let Ht=Ut/k*Math.PI*2,$t=(Ut+1)/k*Math.PI*2,un=(Ht+$t)/2,Ni=[K(P+Math.cos(Ht)*ue,I+Math.sin(Ht)*ue,et,Math.cos(un),Math.sin(un),0),K(P+Math.cos($t)*ue,I+Math.sin($t)*ue,et,Math.cos(un),Math.sin(un),0),K(P+Math.cos($t)*ue,I+Math.sin($t)*ue,Ye,Math.cos(un),Math.sin(un),0),K(P+Math.cos(Ht)*ue,I+Math.sin(Ht)*ue,Ye,Math.cos(un),Math.sin(un),0)];O.push(Ni[0],Ni[1],Ni[2],Ni[0],Ni[2],Ni[3])}},W=.12,ae=R.steps,Se=R.road[1]+.6;V(ae[0][0],Se,W),ae.forEach(([ue,et],Ye)=>{he(ue,Ye?ae[Ye-1][1]:W,et),V(Ye+1<ae.length?ae[Ye+1][0]:0,ue,et)});let X=new tt;X.setAttribute("position",new Me(Y,3)),X.setAttribute("normal",new Me(H,3)),X.setIndex(O);let z=R.lamps||12,ce=R.road[1]+1.6,ne={uC:{value:new _e(P,I)},uZ:{value:new kt(ae[0][0],R.lawn[0],R.lawn[1],R.road[1])},uPathW:{value:R.pathWidth||3.5},uLamps:{value:z},uLampR:{value:ce},uLitT:{value:vn},uLitS:{value:0}},de=new Ft(X,new Ot({uniforms:{..._,...ne},vertexShader:"varying vec3 vP; varying vec3 vN; varying float vW; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }",fragmentShader:`
        uniform float uTime, uLitT, uLitS, uPathW, uLamps, uLampR; uniform vec2 uC; uniform vec4 uZ;
        ${$r}
        ${Dp}
        varying vec3 vP; varying vec3 vN; varying float vW;
        // joints between stones: thin lines at the cell borders, faded out where they would alias
        float joints(vec2 f, vec2 w){ vec2 e = min(f, 1.0 - f); vec2 j = 1.0 - smoothstep(vec2(0.0), w, e); return max(j.x, j.y); }
        void main(){
          vec2 d = vP.xy - uC; float r = length(d), a = atan(d.y, d.x) / 6.2832 + 0.5;
          if (r > uZ.w + 0.6) discard;
          vec3 n = normalize(vN), base; float j = 0.0;
          float since = uTime - uLitT, lit = step(0.0, since) * uLitS * smoothstep(0.0, 2.0, since);
          if (n.z < 0.5) base = vec3(0.60, 0.58, 0.54);                                     // the risers of the steps
          else if (r < uZ.x) {                                                             // the platform: granite in rings
            float rw = 1.15, ring = floor(r / rw), arc = max(3.0, floor(6.2832 * (ring + 0.5) * rw / 1.5)), off = mod(ring, 2.0) * 0.5;
            float sa = a * arc + off;
            base = mix(vec3(0.58, 0.55, 0.50), vec3(0.74, 0.70, 0.64), hash(vec2(ring, floor(sa))));
            j = joints(vec2(fract(r / rw), fract(sa)), vec2(0.035, 0.035 * arc / max(r, 0.5)));
          } else if (r < uZ.z) {                                                           // lawns, paths on the four axes
            vec2 q = abs(d);
            if (min(q.x, q.y) < uPathW * 0.5 || r < uZ.y) {
              base = mix(vec3(0.55, 0.53, 0.49), vec3(0.66, 0.63, 0.58), hash(floor(vP.xy / 0.9)));
              j = joints(fract(vP.xy / 0.9), vec2(0.04));
            } else base = vec3(0.07, 0.12, 0.08) * (0.8 + 0.4 * hash(floor(vP.xy * 1.5)));
          } else if (r < uZ.w - 0.35) {                                                    // the ring road: granite setts in fans
            float sw = 0.55, row = floor((r - uZ.z) / sw), sa = a * 6.2832 * r / sw + row * 0.5;
            base = mix(vec3(0.20, 0.20, 0.21), vec3(0.34, 0.33, 0.32), hash(vec2(row, floor(sa))));
            j = joints(vec2(fract((r - uZ.z) / sw), fract(sa)), vec2(0.07));
          } else base = vec3(0.58, 0.57, 0.55);                                            // the curb
          float aa = 1.0 - smoothstep(0.08, 0.3, fwidth(r));
          base *= 1.0 - j * 0.5 * aa;
          float moon = max(dot(n, ${Kr}), 0.0);
          vec3 col = base * vec3(0.20, 0.24, 0.33) * (0.85 + 0.7 * moon);
          float pools = 0.0;
          for (int i = 0; i < 24; i++) { if (float(i) >= uLamps) break; float ang = 6.2832 * (float(i) + 0.5) / uLamps; vec2 lp = vec2(cos(ang), sin(ang)) * (uLampR - 2.5); vec2 dd = d - lp; pools += exp(-dot(dd, dd) / 70.0); }
          col += base * vec3(1.0, 0.76, 0.48) * lit * (0.35 + 1.5 * pools + 1.0 * exp(-r / 9.0));
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`}));de.renderOrder=1,de.frustumCulled=!1;let te=new bn;te.add(de);let j=A.column,Re=new pl(2),it=ae[ae.length-1][1];Re.cur={mat:0,z0:it,H:j.top-it},Zn(Re,P,I,it,j.pedestal,j.pedestal,j.pedestalTop-it-.4),Zn(Re,P,I,j.pedestalTop-.4,j.pedestal+.4,j.pedestal+.4,.4);let ut=(ue,et,Ye)=>{Re.cur.mat=Ye,Zr(Re,P,I,ue,et,1,32)};ut(j.pedestalTop,[[j.r+.35,0],[j.r+.35,.35],[j.r+.1,.6],[j.r,.8],[j.r*.86,j.band[0]-j.pedestalTop]],0),ut(j.band[0],[[j.r*.86,0],[j.bandR,.25],[j.bandR,j.band[1]-j.band[0]-.25],[j.r*.82,j.band[1]-j.band[0]]],2),ut(j.band[1],[[j.r*.82,0],[j.r*.78,j.top-2.2-j.band[1]]],0),ut(j.top-2.2,[[j.r*.78,0],[j.r*1.15,1.2],[j.r*1.25,1.7],[j.r*1.1,2.2],[0,2.2]],2);let Ge=new Me(new Float32Array(Re.n*2).map((ue,et)=>et%2?0:vn),2);Ge.setUsage(si);let Rt=new Ft(Re.geometry({aLit:Ge}),v.mon);Rt.renderOrder=1,Rt.frustumCulled=!1,te.add(Rt);let Mt=$g.clone(),Zt=new kn(new Float32Array(z).fill(vn),1);Zt.setUsage(si),Mt.setAttribute("iT",Zt),Mt.setAttribute("iSeed",new kn(Float32Array.from({length:z},(ue,et)=>Ai(et+3)),1));let Ct=new Wi(Mt,v.post,z);Ct.renderOrder=1,Ct.frustumCulled=!1;let Xe=[],Pt=[],an=new Me(new Float32Array(z).fill(vn),1),ln=new Float32Array(z*2);for(let ue=0;ue<z;ue++){let et=Math.PI*2*(ue+.5)/z,Ye=Math.cos(et),Ut=Math.sin(et),Ht=P+Ye*ce,$t=I+Ut*ce;Ct.setMatrixAt(ue,new ct().makeRotationZ(Math.atan2(Ye,-Ut)).setPosition(Ht,$t,0)),Xe.push(Ht-Ye*.8,$t-Ut*.8,Lp),Pt.push(Ai(ue+5)),ln[ue*2]=Ht,ln[ue*2+1]=$t}te.add(Ct);let Yt=new tt;an.setUsage(si),Yt.setAttribute("position",new Me(Xe,3)),Yt.setAttribute("aT",an),Yt.setAttribute("aSeed",new Me(Pt,1));let xt=new Hn(Yt,v.lamp);xt.renderOrder=8,xt.frustumCulled=!1,te.add(xt),Oe.add(te),b.group=te,b.state="ready";let At=new Float32Array(Re.n*2);for(let ue=0;ue<Re.n;ue++)At[ue*2]=Re.P[ue*3],At[ue*2+1]=Re.P[ue*3+1];let jt=new Float32Array(18);for(let ue=0;ue<8;ue++)jt[ue*2]=P+Math.cos(ue/8*Math.PI*2)*R.lawn[1],jt[ue*2+1]=I+Math.sin(ue/8*Math.PI*2)*R.lawn[1];jt[16]=P,jt[17]=I;let Ae={cx:P,cy:I,pts:jt,h:j.top,strength:0,time:vn,waterColor:[1,.8,.55],waterZ:12,ranges:[{attr:Ge,start:0,count:Re.n,xy:At},{attr:Zt,start:0,count:z,xy:ln},{attr:an,start:0,count:z,xy:ln}],onLit:ue=>{ne.uLitT.value=ue.time,ne.uLitS.value=ue.strength}};Te(Ae),ft(Ae),b.rec=Ae,b.resolve()}function gt(b){if(b.spec.plaza){b.state="loading",Qe(b);return}b.state="loading",new hl().load(`${i}${b.spec.file}`,async A=>{if(ir)return;let R=b.spec,P=A.scene,{meshes:I,box3:k,size:Y,centre:H}=xe(P),O=R.from?$e(b,I,k,Y,H):Bt(b,I,k,Y);if(R.standOn){let ne=Ie.find(te=>te.spec.id===R.standOn);ne&&(ne.state||gt(ne),await Promise.race([ne.ready,new Promise(te=>setTimeout(te,15e3))]));let de=Pe(ne,O.x,O.y);de!=null&&(O.base+=de-O.z,O.top+=de-O.z,O.z=de)}if(ir)return;let K=new bn;K.rotation.x=Math.PI/2,K.add(P);let V=new bn;V.position.set(O.x,O.y,O.z),V.rotation.z=O.turn,V.add(K);let he={uLitT:{value:vn},uLitS:{value:0},uLitP:{value:new _e(O.x,O.y)},uLitD:{value:0},uBaseZ:{value:Math.max(0,O.base)},uSpanZ:{value:Math.max(2,O.top-Math.max(0,O.base))}},W=R.look||(R.from?"canopy":"flood"),ae=new Be(...R.glow||[.55,.85,1]),Se=W==="flood",X=W==="paint"?`
              totalEmissiveRadiance += heroBase * 0.16;   // its own paint under the night sky, nothing added`:W==="medirun"?`
              {
                // its own paint under the night sky, and the teal of its lamps reflected on the steel
                float hz = clamp((vHeroW.z - uBaseZ) / uSpanZ, 0.0, 1.0);
                float wave = pow(0.5 + 0.5 * sin(hz * 30.0 - uTime * (1.4 + 1.6 * uRun)), 6.0);
                totalEmissiveRadiance += heroBase * 0.16 + vec3(0.06, 0.45, 0.40) * (0.10 + 0.22 * wave) * smoothstep(0.25, 0.7, dot(heroBase, vec3(0.333)));
              }`:Se?`
              {
                float hz = clamp((vHeroW.z - uBaseZ) / uSpanZ, 0.0, 1.0);
                totalEmissiveRadiance += heroBase * vec3(1.0, 0.84, 0.62) * heroLit * (0.12 + 0.8 * exp(-hz * 2.4));
                float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
                totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * rim * heroLit * 0.4 + vec3(0.35, 0.45, 0.65) * rim * 0.05;
              }`:`
              {
                float lum = dot(heroBase, vec3(0.333));
                float frame = smoothstep(0.62, 0.9, lum);
                totalEmissiveRadiance += uGlow * heroLit * (0.05 + 0.85 * frame);
                // small round LEDs over the canopy, each twinkling on its own beat
                vec2 q = vHeroW.xy * 1.3 + vHeroW.z * 0.7, cell = floor(q);
                float dotMask = 1.0 - smoothstep(0.07, 0.17, length(fract(q) - 0.5));
                float led = step(0.7, heroHash(cell)) * dotMask * (0.45 + 0.55 * frame) * (0.5 + 0.5 * sin(uTime * (1.2 + 2.5 * heroHash(cell + 3.1)) + heroHash(cell) * 40.0));
                totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * led * heroLit * 1.6;
              }`,z=W==="medirun"||W==="paint"?"diffuseColor.rgb *= 0.55;":Se?"diffuseColor.rgb *= mix(0.40, 0.55, heroLit);":"diffuseColor.rgb *= mix(0.30, 0.42, heroLit) * mix(vec3(0.75, 0.85, 1.0), vec3(1.0), smoothstep(0.55, 0.85, dot(heroBase, vec3(0.333))));";if(P.traverse(ne=>{if(ne.isMesh){ne.frustumCulled=!1,ne.renderOrder=2;for(let de of Array.isArray(ne.material)?ne.material:[ne.material])de.onBeforeCompile=te=>{Object.assign(te.uniforms,he,{uTime:_.uTime,uRun:_.uRun,uGlow:{value:ae}}),te.vertexShader=te.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vHeroW;`).replace("#include <worldpos_vertex>",`#include <worldpos_vertex>
vHeroW = (modelMatrix * vec4(transformed, 1.0)).xyz;`),te.fragmentShader=te.fragmentShader.replace("#include <common>",`#include <common>
              varying vec3 vHeroW; uniform float uTime, uRun, uLitT, uLitS, uLitD, uBaseZ, uSpanZ; uniform vec2 uLitP; uniform vec3 uGlow;
              float heroHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`).replace("#include <clipping_planes_fragment>",`if (vHeroW.z < -0.05) discard;
#include <clipping_planes_fragment>`).replace("#include <map_fragment>",`#include <map_fragment>
              float heroSince = uTime - uLitT - max(0.0, distance(vHeroW.xy, uLitP) - uLitD) / ${au.toFixed(1)};
              float heroLit = step(0.0, heroSince) * uLitS * smoothstep(0.0, 1.6, heroSince);
              vec3 heroBase = diffuseColor.rgb;
              ${z}`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>${X}`)},de.customProgramCacheKey=()=>`hero-${W}`,de.needsUpdate=!0}}),R.leds){V.position.set(O.x,O.y,O.z),Oe.add(V),V.updateMatrixWorld(!0);let ne=[],de=[],te=[],j=new L,Re=new L,it=Math.max(1,O.top-O.base),ut=0;if(P.traverse(Ge=>{if(!Ge.isMesh)return;let Rt=Ge.geometry.attributes.position,Mt=Ge.geometry.attributes.normal,Zt=new wt().getNormalMatrix(Ge.matrixWorld);for(let Ct=0;Ct<Rt.count;Ct++)Ai(Ct*1.37+.5)>R.leds/Math.max(1,Rt.count)||(j.fromBufferAttribute(Rt,Ct).applyMatrix4(Ge.matrixWorld),Mt&&j.addScaledVector(Re.fromBufferAttribute(Mt,Ct).applyMatrix3(Zt).normalize(),.8),ne.push(j.x,j.y,j.z),de.push(_n((j.z-O.base)/it,0,1)),te.push(Ai(Ct+7.7)),ut++)}),Oe.remove(V),ut){let Ge=new tt;Ge.setAttribute("position",new Me(ne,3)),Ge.setAttribute("aH",new Me(de,1)),Ge.setAttribute("aSeed",new Me(te,1));let Rt=new Hn(Ge,v.towerLed);Rt.renderOrder=9,Rt.frustumCulled=!1,Oe.add(Rt)}}if(R.beacons){let ne=[],de=[];for(let Re of R.beacons)ne.push(O.x,O.y,O.base+(O.top-O.base)*Re),de.push(Re*4.1);let te=new tt;te.setAttribute("position",new Me(ne,3)),te.setAttribute("aPhase",new Me(de,1));let j=new Hn(te,v.beacon);j.renderOrder=9,j.frustumCulled=!1,Oe.add(j)}Oe.add(V),b.group=V,b.state="ready";let ce={cx:O.x,cy:O.y,pts:O.pts,h:O.top,strength:0,time:vn,ranges:[],waterColor:Se?[1,.82,.58]:[ae.r,ae.g,ae.b],waterZ:(O.top+Math.max(0,O.base))/2,waterGain:R.from?.7:1.6,line:!!R.from,onLit:ne=>{he.uLitT.value=ne.time,he.uLitS.value=ne.strength,he.uLitD.value=ne.dist||0,ne.lp&&he.uLitP.value.set(ne.lp[0],ne.lp[1])}};R.alwaysLit&&(ce.time=er,ce.strength=1,he.uLitT.value=er,he.uLitS.value=1),Te(ce),ft(ce),b.rec=ce,b.resolve()},void 0,()=>{b.state="failed",b.resolve()})}let yt=new Set,qe=new Map;function Wt(b,A){let R=qe.get(ie(b,A));if(R)for(let[P,I,k,Y,H,O]of R){let K=(b-k)*(I-Y)-(P-k)*(A-Y),V=(b-H)*(Y-O)-(k-H)*(A-O),he=(b-P)*(O-I)-(H-P)*(A-I);if(!((K<0||V<0||he<0)&&(K>0||V>0||he>0)))return!0}return!1}function It(b,A){let R=T.position.x-b,P=T.position.y-A,I=Math.hypot(R,P);if(I<1)return null;for(let k=0;k<=Math.min(240,I);k+=3){let Y=b+R/I*k,H=A+P/I*k;if(Wt(Y,H))return[Y,H]}return null}let on=[1,.72,.42],q=[1,.74,.44];function ke(b,A){let R=Math.floor(b/Qt),P=Math.floor(A/Qt);for(let I=-2;I<=2;I++)for(let k=-2;k<=2;k++)if(yt.has(R+I+","+(P+k)))return!0;return!1}function fe(b,A){let R=N(),P=[],I=650,k=Math.floor(b/Qt),Y=Math.floor(A/Qt),H=Math.ceil(I/Qt);for(let W=-H;W<=H;W++)for(let ae=-H;ae<=H;ae++){let Se=k+W+","+(Y+ae),X=$.get(Se);if(X)for(let z of X){if(z.tree||z.strength<.2||z.time>R||!ke(z.cx,z.cy))continue;let ce=z.waterColor||on,ne=z.waterZ??Math.min((z.h||8)*.55,14);if(z.line){let de=0;for(let te=0;te<z.pts.length&&de<5;te+=6)ke(z.pts[te],z.pts[te+1])&&(P.push([z.pts[te],z.pts[te+1],z.waterZ??(z.h||4)+4,z.strength*(z.waterGain||.8),ce]),de++)}else P.push([z.cx,z.cy,ne,z.strength*(z.waterGain||1),ce])}}let O=Nn.attributes.position,K=Nn.attributes.aT;for(let W=0;W<st.lampCount;W++)K.getX(W)<=R&&ke(O.getX(W),O.getY(W))&&P.push([O.getX(W),O.getY(W),O.getZ(W),1.3,q]);for(let W of P)W.push(Math.hypot(W[0]-b,W[1]-A));P.sort((W,ae)=>W[5]-ae[5]);let V=a?8:Wo,he=0;for(let W=0;W<P.length&&W<90&&he<V;W++){let ae=P[W],Se=It(ae[0],ae[1]);Se&&(_.uWL.value[he].set(Se[0],Se[1],ae[2],ae[3]),_.uWC.value[he].set(ae[4][0],ae[4][1],ae[4][2]),he++)}_.uWN.value=he}let ve=new Map,Ve=new Set,Oe=new bn;F.add(Oe);function Tt(b,A){let{tx:R,ty:P}=b,I=(H,O,K)=>p((R+H/K)/os,(P+O/K)/os),k=new bn,Y=[];{let H=[],O=[],K=(he,W,ae,Se)=>{for(let X=Math.floor(he/Qt);X<=Math.floor(ae/Qt);X++)for(let z=Math.floor(W/Qt);z<=Math.floor(Se/Qt);z++)yt.add(X+","+z)},V=(he,W,ae,Se,X,z)=>{let ce=[he,W,ae,Se,X,z];for(let ne=Math.floor(Math.min(he,ae,X)/Qt);ne<=Math.floor(Math.max(he,ae,X)/Qt);ne++)for(let de=Math.floor(Math.min(W,Se,z)/Qt);de<=Math.floor(Math.max(W,Se,z)/Qt);de++){let te=ne+","+de;qe.has(te)||qe.set(te,[]),qe.get(te).push(ce),b.waterKeys.add(te),b.waterTriSet.add(ce)}};if(b.waterKeys=new Set,b.waterTriSet=new Set,A.layers.water)for(let he=0;he<A.layers.water.length;he++){let W=A.layers.water.feature(he);if(W.type===3)for(let ae of Cp(W)){let{verts:Se,tris:X}=Ip(Pp(ae,W.extent,I)),z=H.length/3;Se.forEach(ce=>H.push(ce.x,ce.y,.1)),X.forEach(ce=>{O.push(z+ce[0],z+ce[1],z+ce[2]);let ne=Se[ce[0]],de=Se[ce[1]],te=Se[ce[2]];V(ne.x,ne.y,de.x,de.y,te.x,te.y),K(Math.min(ne.x,de.x,te.x),Math.min(ne.y,de.y,te.y),Math.max(ne.x,de.x,te.x),Math.max(ne.y,de.y,te.y))})}}if(A.layers.waterway)for(let he=0;he<A.layers.waterway.length;he++){let W=A.layers.waterway.feature(he),ae=aw[W.properties.class];if(!(W.type!==2||!ae))for(let Se of W.loadGeometry()){let X=Se.map(ne=>I(ne.x,ne.y,W.extent)),z=X.length;if(z<2)continue;let ce=H.length/3;X.forEach((ne,de)=>{let te=X[Math.max(0,de-1)],j=X[Math.min(z-1,de+1)],Re=Math.hypot(j[0]-te[0],j[1]-te[1])||1,it=-(j[1]-te[1])/Re*ae/2,ut=(j[0]-te[0])/Re*ae/2;if(H.push(ne[0]+it,ne[1]+ut,.08,ne[0]-it,ne[1]-ut,.08),de){let Ge=ce+de*2;O.push(Ge-2,Ge-1,Ge,Ge-1,Ge+1,Ge),V(ne[0]+it,ne[1]+ut,ne[0]-it,ne[1]-ut,te[0]-it,te[1]-ut),V(ne[0]+it,ne[1]+ut,te[0]-it,te[1]-ut,te[0]+it,te[1]+ut),K(Math.min(ne[0],te[0])-ae,Math.min(ne[1],te[1])-ae,Math.max(ne[0],te[0])+ae,Math.max(ne[1],te[1])+ae)}})}}if(H.length){let he=new tt;he.setAttribute("position",new Me(H,3)),he.setIndex(O);let W=new Ft(he,v.water);W.renderOrder=0,W.frustumCulled=!1,k.add(W)}}if(A.layers.landuse){let H=YS(R*7919+P),O=[],K=[],V=[],he=A.layers.landuse;for(let W=0;W<he.length&&O.length<450;W++){let ae=he.feature(W),Se=jS[ae.properties.class];if(!(ae.type!==3||!Se))for(let X of Cp(ae)){let{verts:z,tris:ce}=Ip(Pp(X,ae.extent,I));for(let ne of ce){let de=z[ne[0]],te=z[ne[1]],j=z[ne[2]],Re=Math.abs((te.x-de.x)*(j.y-de.y)-(j.x-de.x)*(te.y-de.y))/2,it=Math.floor(Re/Se+H());for(;it-- >0&&O.length<450;){let ut=Math.sqrt(H()),Ge=H(),Rt=de.x*(1-ut)+te.x*ut*(1-Ge)+j.x*ut*Ge,Mt=de.y*(1-ut)+te.y*ut*(1-Ge)+j.y*ut*Ge;if(w(Rt,Mt))continue;let Zt=.75+H()*.6;O.push(new ct().compose(new L(Rt,Mt,0),new Sn().setFromAxisAngle(new L(0,0,1),H()*6.28),new L(Zt,Zt,Zt*(.85+H()*.4)))),K.push(H()),V.push(Rt,Mt)}}}}if(O.length){let W=Zg.clone(),ae=new kn(new Float32Array(O.length*3),3);for(let X=0;X<O.length;X++)ae.array[X*3]=vn,ae.array[X*3+2]=99;ae.setUsage(si),W.setAttribute("iLit",ae),W.setAttribute("iSeed",new kn(new Float32Array(K),1));let Se=new Wi(W,v.tree,O.length);O.forEach((X,z)=>Se.setMatrixAt(z,X)),Se.renderOrder=1,Se.frustumCulled=!1,k.add(Se);for(let X=0;X<O.length;X++)Y.push({tree:!0,cx:V[X*2],cy:V[X*2+1],strength:0,time:vn,ranges:[{attr:ae,start:X,count:1}]})}}if(A.layers.building){let H=A.layers.building,O=[],K=[],V=[],he=[],W=[],ae=[],Se=[],X=[],z=[],ce=[],ne=[],de=[],te=[],j=[],Re=[],it=0,ut=Jg,Ge=(Rt,Mt,Zt,Ct,Xe,Pt,an,ln,Yt,xt,At)=>(O.push(Rt,Mt,Zt),K.push(Ct,Xe,Pt),V.push(an,ln,Yt),he.push(xt,At),W.push(ut[0],ut[1],ut[2],ut[3]),it++);for(let Rt=0;Rt<H.length;Rt++){let Mt=H.feature(Rt);if(Mt.type!==3)continue;let Zt=Mt.properties;if(Zt.underground==="true"||Zt.extrude==="false")continue;let Ct=Mt.id!=null?Number(Mt.id):null;if(Ct!=null&&B.has(Ct))continue;let Xe=Ct!=null?ye.get(Ct):null;for(let Pt of Cp(Mt)){let an=Pp(Pt,Mt.extent,I),ln=an[0],Yt=0,xt=0;ln.forEach(vt=>{Yt+=vt.l[0],xt+=vt.l[1]}),Yt/=ln.length,xt/=ln.length;let At=Ai(Mt.id!=null?Number(Mt.id)%1e5:Yt*.37+xt*.61),jt=Number(Zt.height)||0,Ae=Number(Zt.min_height)||0;if(jt<4&&(jt=6+At*8),D(Yt,xt,jt))continue;let ue=jt,et=null,Ye=Xe&&Xe[1]<=3||ow.has(Zt.type)||at.has(Ct);if(Xe){let vt=[],Cn=Xe[5];for(let Pn=0;Pn<Cn.length;Pn+=2){let pn=x(Cn[Pn],Cn[Pn+1]),xi=vt[vt.length-1];(!xi||Math.hypot(pn[0]-xi[0],pn[1]-xi[1])>.3)&&vt.push(pn)}if(vt.length>2&&Math.hypot(vt[0][0]-vt[vt.length-1][0],vt[0][1]-vt[vt.length-1][1])<.3&&vt.pop(),vt.length>=3){cu(vt)<0&&vt.reverse();let Pn=0;for(let Oi=0;Oi<vt.length;Oi++)Pn+=Math.hypot(vt[(Oi+1)%vt.length][0]-vt[Oi][0],vt[(Oi+1)%vt.length][1]-vt[Oi][1]);let pn=4*cu(vt)/(Pn||1),xi=Xe[1],Us=Xe[2]>0?Xe[2]:xi===1?pn*.5:xi===2?pn*.95:xi===3?pn*.8:xi===4?pn*.45:Math.min(pn*.2,6);Us>(jt-Ae)*.75&&(Us=Math.max(.8,(jt-Ae)*.5)),ue=jt-Us;let Fi=Ce.get(Ct);(!Fi||!ve.has(Fi)||Fi===b.key)&&(Ce.set(Ct,b.key),et=vt)}}ut=Ye?[0,0,0,1]:Jg;let Ut=it;an.forEach(vt=>{for(let Cn=0;Cn<vt.length;Cn++){let Pn=vt[Cn],pn=vt[(Cn+1)%vt.length];if(JS(Pn.t,pn.t,Mt.extent))continue;let xi=pn.l[0]-Pn.l[0],Us=pn.l[1]-Pn.l[1],Fi=Math.hypot(xi,Us);if(Fi<.3)continue;let Oi=Us/Fi,Ml=-xi/Fi,gu=Fi>=2.4&&!Ye?Math.max(1,Math.round(Fi/3.1)):0,xu=gu?Cn*7%997:-1,Wp=gu?xu+gu:-1,Xp=Ge(Pn.l[0],Pn.l[1],Ae,Oi,Ml,0,xu,Ae,0,At,ue),ox=Ge(pn.l[0],pn.l[1],Ae,Oi,Ml,0,Wp,Ae,0,At,ue),qp=Ge(pn.l[0],pn.l[1],ue,Oi,Ml,0,Wp,ue,0,At,ue),ax=Ge(Pn.l[0],Pn.l[1],ue,Oi,Ml,0,xu,ue,0,At,ue);ae.push(Xp,ox,qp,Xp,qp,ax)}});let{verts:Ht,tris:$t}=Ip(an),un=it;if(Ht.forEach(vt=>Ge(vt.x,vt.y,ue,0,0,1,-1,ue,1,At,ue)),$t.forEach(vt=>ae.push(un+vt[0],un+vt[1],un+vt[2])),et){let vt=iw(Xe[3]);ut=[vt[0],vt[1],vt[2],Ye?1:0],sw(Xe[1],et,ue,jt,Xe[4]===-2,(Cn,Pn,pn,xi,Us,Fi)=>Ge(Cn,Pn,pn,xi,Us,Fi,-1,pn,2,At,jt),(Cn,Pn,pn)=>ae.push(Cn,Pn,pn))}let Ni=0,mu=new Float32Array(ln.length*2);ln.forEach((vt,Cn)=>{Ni=Math.max(Ni,Math.hypot(vt.l[0]-Yt,vt.l[1]-xt)),mu[Cn*2]=vt.l[0],mu[Cn*2+1]=vt.l[1]});let sr=X.length/3,Gp=Ni+9;[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([vt,Cn])=>{X.push(Yt+vt*Gp,xt+Cn*Gp,.15),z.push(vt,Cn),ce.push(Yt,xt,.15)}),ne.push(sr,sr+1,sr+2,sr,sr+2,sr+3),de.push(Yt,xt,Math.min(jt,18)*.8),te.push(_n(Ni*2.6,16,46)),jt>=XS&&(j.push(Yt,xt,jt+1.2),Re.push(At)),Se.push({key:Mt.id!=null?"id"+Mt.id:null,cx:Yt,cy:xt,pts:mu,h:jt,first:Ut,count:it-Ut,pool:sr,haze:te.length-1})}}if(it){let Rt=new tt,Mt=new Me(new Float32Array(it*2).map((xt,At)=>At%2?0:vn),2);Mt.setUsage(si);let Zt=new Me(new Float32Array(it*4),4);Zt.setUsage(si),Rt.setAttribute("position",new Me(O,3)),Rt.setAttribute("normal",new Me(K,3)),Rt.setAttribute("aFace",new Me(V,3)),Rt.setAttribute("aBld",new Me(he,2)),Rt.setAttribute("aRoof",new Me(W,4)),Rt.setAttribute("aLit",Mt),Rt.setAttribute("aSeg",Zt),Rt.setIndex(ae);let Ct=new Ft(Rt,v.building);Ct.renderOrder=1,Ct.frustumCulled=!1,k.add(Ct);let Xe=new Ft(Rt,v.buildingGhost);Xe.renderOrder=4,Xe.frustumCulled=!1,Xe.visible=_.uCut.value>0,k.add(Xe),Ve.add(Xe);let Pt=new tt,an=new Me(new Float32Array(X.length/3*2).map((xt,At)=>At%2?0:vn),2);an.setUsage(si),Pt.setAttribute("position",new Me(X,3)),Pt.setAttribute("aUV",new Me(z,2)),Pt.setAttribute("aC",new Me(ce,3)),Pt.setAttribute("aLit",an),Pt.setIndex(ne);let ln=new Ft(Pt,v.pool);ln.renderOrder=2,ln.frustumCulled=!1,k.add(ln);let Yt=null;if(!a){let xt=new tt;Yt=new Me(new Float32Array(te.length*2).map((jt,Ae)=>Ae%2?0:vn),2),Yt.setUsage(si),xt.setAttribute("position",new Me(de,3)),xt.setAttribute("aSize",new Me(te,1)),xt.setAttribute("aLit",Yt);let At=new Hn(xt,v.haze);At.renderOrder=10,At.frustumCulled=!1,k.add(At)}if(j.length){let xt=new tt;xt.setAttribute("position",new Me(j,3)),xt.setAttribute("aPhase",new Me(Re,1));let At=new Hn(xt,v.beacon);At.renderOrder=9,At.frustumCulled=!1,k.add(At)}for(let xt of Se){let At=[{attr:Mt,start:xt.first,count:xt.count},{attr:an,start:xt.pool,count:4}];Yt&&At.push({attr:Yt,start:xt.haze,count:1});let jt=1/0,Ae=1/0,ue=-1/0,et=-1/0;for(let Ye=0;Ye<xt.pts.length;Ye+=2)jt=Math.min(jt,xt.pts[Ye]),ue=Math.max(ue,xt.pts[Ye]),Ae=Math.min(Ae,xt.pts[Ye+1]),et=Math.max(et,xt.pts[Ye+1]);Y.push({key:xt.key,cx:xt.cx,cy:xt.cy,pts:xt.pts,h:xt.h,bb:[jt,Ae,ue,et],strength:0,time:vn,ranges:At,segRanges:[{attr:Zt,start:xt.first,count:xt.count}],seg:null,segWritten:null})}}}b.deckCells=[],b.deckSegSet=new Set,A.layers.road&&hn(A.layers.road,I,k,Y,b);for(let H of Y)Te(H),ft(H);Oe.add(k),b.group=k,b.recs=Y,b.deckCells.length&&st.raw.length>1&&(st.dirty=!0)}function hn(b,A,R,P,I){let k=[];for(let X=0;X<b.length;X++){let z=b.feature(X),ce=z.properties;if(ce.structure!=="bridge"||z.type!==2)continue;let ne=String(ce.class||"").replace(/_link$/,""),de=lw[ne]||(/_link$/.test(ce.class)?8:0);if(!de)continue;let te=/rail/.test(ne),Re=(te?6:ne==="path"||ne==="pedestrian"||ne==="track"?4.2:5.5)+(Number(ce.layer)>=2?4:0);for(let it of z.loadGeometry())for(let ut of rw(it.map(Ge=>[Ge.x,Ge.y]),z.extent))k.push({pts:ut.pts.map(Ge=>A(Ge[0],Ge[1],z.extent)),openStart:ut.openStart,openEnd:ut.openEnd,w:de,deck:Re,rail:te,key:ne+Re})}if(!k.length)return;let Y=(X,z)=>Math.hypot(X[0]-z[0],X[1]-z[1])<1.2;for(let X=!0;X;){X=!1;for(let z=0;z<k.length&&!X;z++)for(let ce=0;ce<k.length&&!X;ce++){if(z===ce)continue;let ne=k[z],de=k[ce];if(ne.key!==de.key||ne.openEnd||de.openStart&&de.openEnd)continue;let te=null;Y(ne.pts[ne.pts.length-1],de.pts[0])&&!de.openStart?te=de:Y(ne.pts[ne.pts.length-1],de.pts[de.pts.length-1])&&!de.openEnd&&(te={...de,pts:de.pts.slice().reverse(),openStart:de.openEnd,openEnd:de.openStart}),te&&(ne.pts=ne.pts.concat(te.pts.slice(1)),ne.openEnd=te.openEnd,k.splice(ce,1),X=!0)}}let H=new pl(3),O=[],K=[],V=[],he=[];for(let X of k){let z=[],ce=0;for(let Ae=0;Ae<X.pts.length;Ae++){let ue=X.pts[Ae];if(Ae){let et=X.pts[Ae-1],Ye=Math.hypot(ue[0]-et[0],ue[1]-et[1]),Ut=Math.max(1,Math.ceil(Ye/3));for(let Ht=1;Ht<=Ut;Ht++)ce+=Ye/Ut,z.push({x:et[0]+(ue[0]-et[0])*Ht/Ut,y:et[1]+(ue[1]-et[1])*Ht/Ut,s:ce})}else z.push({x:ue[0],y:ue[1],s:0})}let ne=ce;if(ne<4)continue;let de=X.openStart||X.openEnd,te=z.length,j=z.map(Ae=>ge(Ae.x,Ae.y)),Re=j.find(Boolean);if(Re){let Ae=Re.bx-Re.ax,ue=Re.by-Re.ay,et=z[te-1].x-z[0].x,Ye=z[te-1].y-z[0].y;Math.abs((Ae*et+ue*Ye)/((Math.hypot(Ae,ue)||1)*(Math.hypot(et,Ye)||1)))<.8&&j.fill(Re)}let it=Re&&Re.spec.deck?Re.spec.deck:de||ne>=40?X.deck:_n((ne-6)*.14,.6,X.deck),ut=Math.min(30,ne*.35),Ge=X.w/2,Rt=Ae=>it*Math.min(X.openStart?1:Rp(0,ut,Ae),X.openEnd?1:Rp(0,ut,ne-Ae)),Mt=H.n,Zt=z.length,Ct=[],Xe=[],Pt=[];z.forEach((Ae,ue)=>{let et=z[Math.max(0,ue-1)],Ye=z[Math.min(Zt-1,ue+1)],Ut=Math.hypot(Ye.x-et.x,Ye.y-et.y)||1,Ht=-(Ye.y-et.y)/Ut,$t=(Ye.x-et.x)/Ut;Ae.z=Rt(Ae.s),Ae.nx=Ht,Ae.ny=$t,Ct.push([Ae.x+Ht*Ge,Ae.y+$t*Ge]),Xe.push([Ae.x-Ht*Ge,Ae.y-$t*Ge]),Pt.push(Ae.z)});let an=(Ae,ue)=>{let et=null;for(let Ye=0;Ye<Zt;Ye++){if(j[Ye]){et=null;continue}let[Ut,Ht,$t]=Ae(Ye),un=[H.v(Ut[0],Ut[1],Ut[2],$t[0],$t[1],$t[2],[ue,0,z[Ye].s]),H.v(Ht[0],Ht[1],Ht[2],$t[0],$t[1],$t[2],[ue,1,z[Ye].s])];et&&(H.tri(et[0],un[0],un[1]),H.tri(et[0],un[1],et[1])),et=un}};if(an(Ae=>[[Xe[Ae][0],Xe[Ae][1],Pt[Ae]+.05],[Ct[Ae][0],Ct[Ae][1],Pt[Ae]+.05],[0,0,1]],0),it>.5){let Ae=Math.min(1.1,it*.4);an(ue=>[[Ct[ue][0],Ct[ue][1],Pt[ue]-Ae],[Ct[ue][0],Ct[ue][1],Pt[ue]+.05],[z[ue].nx,z[ue].ny,0]],1),an(ue=>[[Xe[ue][0],Xe[ue][1],Pt[ue]-Ae],[Xe[ue][0],Xe[ue][1],Pt[ue]+.05],[-z[ue].nx,-z[ue].ny,0]],1),an(ue=>[[Xe[ue][0],Xe[ue][1],Pt[ue]-Ae],[Ct[ue][0],Ct[ue][1],Pt[ue]-Ae],[0,0,-1]],2)}let ln=X.rail?.6:1.05,Yt=.25;an(Ae=>{let ue=z[Ae];return[[Ct[Ae][0]-ue.nx*Yt,Ct[Ae][1]-ue.ny*Yt,Pt[Ae]],[Ct[Ae][0]-ue.nx*Yt,Ct[Ae][1]-ue.ny*Yt,Pt[Ae]+ln],[ue.nx,ue.ny,0]]},2),an(Ae=>{let ue=z[Ae];return[[Xe[Ae][0]+ue.nx*Yt,Xe[Ae][1]+ue.ny*Yt,Pt[Ae]],[Xe[Ae][0]+ue.nx*Yt,Xe[Ae][1]+ue.ny*Yt,Pt[Ae]+ln],[-ue.nx,-ue.ny,0]]},2);for(let Ae=16;Ae<ne-8;Ae+=32){let ue=z.findIndex(Ye=>Ye.s>=Ae),et=z[ue];!et||j[ue]||et.z<it*.9||et.z<2||(H.cur={mat:1,z0:0,H:et.z*1.25,s:et.s},Zn(H,et.x,et.y,0,X.w*.75,1.6,et.z-Math.min(1.1,it*.4),Math.atan2(et.ny,et.nx)))}let xt=K.length;if(!X.rail&&ne>14)for(let Ae=8,ue=1;Ae<ne-4;Ae+=22,ue=-ue){let et=z.findIndex(Ut=>Ut.s>=Ae),Ye=z[et];if(!(!Ye||j[et]))for(let Ut of[1,-1]){let Ht=Ye.x+Ye.nx*(Ge-Yt)*Ut,$t=Ye.y+Ye.ny*(Ge-Yt)*Ut;H.cur={mat:2,z0:Ye.z,H:5,s:Ye.s},Go(H,[Ht,$t,Ye.z],[Ht,$t,Ye.z+4.6],.14),Go(H,[Ht,$t,Ye.z+4.5],[Ht-Ye.nx*.7*Ut,$t-Ye.ny*.7*Ut,Ye.z+4.6],.08),O.push(Ht-Ye.nx*.7*Ut,$t-Ye.ny*.7*Ut,Ye.z+4.45),K.push(vn),V.push(Ai(Ye.s+Ut))}}for(let Ae=1;Ae<Zt;Ae++){let ue={ax:z[Ae-1].x,ay:z[Ae-1].y,bx:z[Ae].x,by:z[Ae].y,za:z[Ae-1].z,zb:z[Ae].z,hw:Ge};I.deckSegSet.add(ue),_t(ue,I.deckCells)}let At=new Float32Array(Math.ceil(Zt/3)*2);for(let Ae=0,ue=0;Ae<Zt;Ae+=3,ue++)At[ue*2]=z[Ae].x,At[ue*2+1]=z[Ae].y;let jt=z[Math.floor(Zt/2)];H.n===Mt&&K.length===xt||he.push({first:Mt,count:H.n-Mt,bulbStart:xt,bulbCount:K.length-xt,pts:At,cx:jt.x,cy:jt.y,h:it})}if(!H.n)return;let W=new Me(new Float32Array(H.n*2).map((X,z)=>z%2?0:vn),2);W.setUsage(si);let ae=new Ft(H.geometry({aLit:W}),v.deck);ae.renderOrder=1,ae.frustumCulled=!1,R.add(ae);let Se=null;if(O.length){let X=new tt;X.setAttribute("position",new Me(O,3)),Se=new Me(new Float32Array(K),1),Se.setUsage(si),X.setAttribute("aT",Se),X.setAttribute("aSeed",new Me(V,1));let z=new Hn(X,v.lamp);z.renderOrder=8,z.frustumCulled=!1,R.add(z)}for(let X of he){let z=new Float32Array(X.count*2);for(let ne=0;ne<X.count;ne++)z[ne*2]=H.P[(X.first+ne)*3],z[ne*2+1]=H.P[(X.first+ne)*3+1];let ce=[{attr:W,start:X.first,count:X.count,xy:z}];if(Se&&X.bulbCount>0){let ne=new Float32Array(X.bulbCount*2);for(let de=0;de<X.bulbCount;de++)ne[de*2]=O[(X.bulbStart+de)*3],ne[de*2+1]=O[(X.bulbStart+de)*3+1];ce.push({attr:Se,start:X.bulbStart,count:X.bulbCount,xy:ne})}P.push({cx:X.cx,cy:X.cy,pts:X.pts,h:X.h,strength:0,time:vn,ranges:ce,line:!0})}}function Un(b){let A=ve.get(b);if(ve.delete(b),!(!A||!A.group)){for(let R of A.recs){let P=$.get(R.cell);if(P){let I=P.indexOf(R);I>=0&&P.splice(I,1)}}for(let R of A.deckCells||[]){let P=pt.get(R);if(P){let I=P.filter(k=>!A.deckSegSet.has(k));I.length?pt.set(R,I):pt.delete(R)}}for(let[R,P]of Ce)P===b&&Ce.delete(R);for(let R of A.waterKeys||[]){let P=qe.get(R);if(P){let I=P.filter(k=>!A.waterTriSet.has(k));I.length?qe.set(R,I):qe.delete(R)}}Oe.remove(A.group),A.group.traverse(R=>Ve.delete(R)),A.group.traverse(R=>{R.geometry&&R.geometry!==Zg&&R.geometry.dispose()})}}function en(b,A){let R=b+"/"+A;if(Ee.has(R))return Ee.get(R).ready;let P={dx:b,dy:A,group:null,recs:[],ready:null};return P.ready=Promise.all([Ke,mt]).then(([I])=>{if(I.has(R))return fetch(`${i}14/${R}.json`).then(k=>k.ok?k.json():null).then(k=>{k&&!ir&&Ee.get(R)===P&&di(P,k)}).catch(()=>{})}),Ee.set(R,P),P.ready}function di(b,A){for(let W of A.roofs||[])ye.set(W[0],W);for(let W of A.towers||[])W[4]&&B.add(W[4]);for(let W of A.marks||[])at.add(W);let R=new bn,P=[],I=new pl(2),k=[],Y=[],H=[],O=[],K=[],V=(W,ae,Se)=>({first:I.n,cx:W,cy:ae,h:Se,jetStart:k.length/3}),he=(W,ae)=>{W.count=I.n-W.first,W.jetCount=k.length/3-W.jetStart,K.push(Object.assign(W,ae))};for(let[W,ae,Se,X]of A.monuments||[]){let[z,ce]=x(Se,X);if(Ze(z,ce))continue;let ne=V(z,ce,0),de=Ai(z*.13+ce*.71)*Math.PI*2,te=ae>0?ae:[6,2.6,15,8,3,3.2,4,35][W];if(I.cur={mat:0,z0:0,H:te},W===0){let j=Math.max(te,3),Re=j*.42,it=_n(j*.3,1.2,7);Zn(I,z,ce,0,it,it,Re*.12,de),Zn(I,z,ce,Re*.12,it*.8,it*.8,Re*.88,de),I.cur.mat=1,Zr(I,z,ce,Re,Kg,j*.58/2.9)}else if(W===1){let j=Math.max(te,1.8);Zn(I,z,ce,0,.75,.75,j*.62,de),I.cur.mat=1,Zr(I,z,ce,j*.62,tw,j*.38/.88)}else if(W===2){let j=Math.max(.6,te*.035);Zn(I,z,ce,0,j*6,j*6,te*.05,de),Zn(I,z,ce,te*.05,j*4,j*4,te*.07,de),Zr(I,z,ce,te*.12,[[j,0],[j*.82,te*.66],[j*1.3,te*.68],[j*1.3,te*.71],[0,te*.71]],1,16),I.cur.mat=2,Zr(I,z,ce,te*.83,Kg,te*.17/2.9)}else if(W===3){let j=Math.max(.7,te*.09);Zn(I,z,ce,0,j*3,j*3,te*.06,de),ew(I,z,ce,te*.06,te*.92,j,j*.62,te*.08,de)}else if(W===4)Zn(I,z,ce,0,Math.max(1.2,te*.45),.45,te,de);else if(W===5){I.cur.mat=1;for(let j=0;j<3;j++)Zn(I,z,ce,te/3*j,te*(.32-j*.06),te*(.2-j*.03),te/3,de+j*.6)}else if(W===6)Zn(I,z,ce,0,.35,.35,te,de),Zn(I,z,ce,te*.66,te*.48,.3,.32,de);else if(W===7)for(let j=0;j<16;j++){let Re=j/16*Math.PI*2;Zn(I,z+Math.cos(Re)*22,ce+Math.sin(Re)*22,0,4.2,1.6,te*(.85+.15*Ai(j)),Re+Math.PI/2)}he(ne,{h:te})}for(let[W,ae,Se]of A.fountains||[]){let[X,z]=x(W,ae),ce=V(X,z,1);I.cur={mat:0,z0:0,H:2},Zr(I,X,z,0,[[Se,0],[Se+.15,.45],[Se-.25,.5],[Se-.3,.3]],1,24),I.cur={mat:4,z0:0,H:2},Zr(I,X,z,.3,[[Se-.3,0],[0,1e-4]],1,24);let ne=Math.round(_n(Se*10,18,70)),de=_n(Se*1.6,3,9);for(let te=0;te<ne;te++){let j=te/ne*Math.PI*2,Re=.25+.5*Ai(te*3.1+X);k.push(X,z,.35),Y.push(Math.cos(j)*Re*Se*.45,Math.sin(j)*Re*Se*.45,de*(.8+.3*Ai(te+z)),Ai(te*7.7))}he(ce,{h:2})}for(let[W,ae,Se]of A.towers||[]){let[X,z]=x(W,ae);if(Q(X,z))continue;let ce=V(X,z,Se);I.cur={mat:3,z0:0,H:Se};let ne=12,de=(Re,it)=>{let ut=Se*.075*(1-it/Se*.86),Ge=Math.PI/4+Re*Math.PI/2;return[X+Math.cos(Ge)*ut*1.414,z+Math.sin(Ge)*ut*1.414,it]},te=Math.max(.5,Se*.006),j=Se*.86;for(let Re=0;Re<ne;Re++){let it=j*Re/ne,ut=j*(Re+1)/ne;for(let Ge=0;Ge<4;Ge++)Go(I,de(Ge,it),de(Ge,ut),te*1.6),Go(I,de(Ge,ut),de((Ge+1)%4,ut),te),Go(I,de(Ge,it),de((Ge+1)%4,ut),te*.7)}Go(I,[X,z,j],[X,z,Se],te*1.2);for(let Re of[.3,.55,.86,1])H.push(X,z,Se*Re+.6),O.push(Re*3.1);he(ce,{h:Se})}for(let[W,ae,Se]of A.walls||[]){let X=[];for(let te=0;te<Se.length;te+=2)X.push(x(Se[te],Se[te+1]));if(X.length<2)continue;let z=0,ce=0;X.forEach(te=>{z+=te[0],ce+=te[1]}),z/=X.length,ce/=X.length;let ne=V(z,ce,W);I.cur={mat:0,z0:0,H:W*1.1};let de=[];for(let te=1;te<X.length;te++){let[j,Re]=X[te-1],[it,ut]=X[te],Ge=Math.hypot(it-j,ut-Re);if(Ge<.2)continue;let Rt=Math.atan2(ut-Re,it-j);Zn(I,(j+it)/2,(Re+ut)/2,0,Ge+ae*.5,ae,W,Rt);for(let Mt=1.1;Mt<Ge-.5;Mt+=2.4){let Zt=Mt/Ge;Zn(I,j+(it-j)*Zt,Re+(ut-Re)*Zt,W,1.2,ae,.9,Rt)}for(let Mt=0;Mt<Ge;Mt+=8)de.push(j+(it-j)*Mt/Ge,Re+(ut-Re)*Mt/Ge)}he(ne,{h:W,pts:new Float32Array(de),along:!0})}if(I.n){let W=new Me(new Float32Array(I.n*2).map((X,z)=>z%2?0:vn),2);W.setUsage(si);let ae=new Ft(I.geometry({aLit:W}),v.mon);ae.renderOrder=1,ae.frustumCulled=!1,R.add(ae);let Se=null;if(k.length){let X=new tt;X.setAttribute("position",new Me(k,3)),X.setAttribute("aJet",new Me(Y,4)),Se=new Me(new Float32Array(k.length/3*2).map((ce,ne)=>ne%2?0:vn),2),Se.setUsage(si),X.setAttribute("aLit",Se);let z=new Hn(X,v.jet);z.renderOrder=9,z.frustumCulled=!1,R.add(z)}if(H.length){let X=new tt;X.setAttribute("position",new Me(H,3)),X.setAttribute("aPhase",new Me(O,1));let z=new Hn(X,v.beacon);z.renderOrder=9,z.frustumCulled=!1,R.add(z)}for(let X of K){if(!X.count)continue;let z=[{attr:W,start:X.first,count:X.count}];if(X.along){let ce=new Float32Array(X.count*2);for(let ne=0;ne<X.count;ne++)ce[ne*2]=I.P[(X.first+ne)*3],ce[ne*2+1]=I.P[(X.first+ne)*3+1];z[0].xy=ce}Se&&X.jetCount&&z.push({attr:Se,start:X.jetStart,count:X.jetCount}),P.push({cx:X.cx,cy:X.cy,pts:X.pts&&X.pts.length?X.pts:null,h:X.h,strength:0,time:vn,ranges:z,line:!!X.along})}}for(let W of P)Te(W),ft(W);Oe.add(R),b.group=R,b.recs=P}function Di(b){let A=Ee.get(b);if(Ee.delete(b),!(!A||!A.group)){for(let R of A.recs){let P=$.get(R.cell);if(P){let I=P.indexOf(R);I>=0&&P.splice(I,1)}}Oe.remove(A.group),A.group.traverse(R=>{R.geometry&&R.geometry.dispose()})}}let Jr=0;function ml(b,A,R){let P=g(b,A),I=R*d,k=Math.floor((P.x-I)*os),Y=Math.floor((P.x+I)*os),H=Math.floor((P.y-I)*os),O=Math.floor((P.y+I)*os),K=[];for(let V=k;V<=Y;V++)for(let he=H;he<=O;he++){let W=p((V+.5)/os,(he+.5)/os),ae=Math.hypot(W[0]-b,W[1]-A);ae<R+250&&!ve.has(V+"/"+he)&&K.push({tx:V,ty:he,d:ae})}for(let[V,he]of ve){let W=p((he.tx+.5)/os,(he.ty+.5)/os);he.group&&Math.hypot(W[0]-b,W[1]-A)>R+700&&Un(V)}for(let V of Ie)!V.state&&Math.hypot((V.ax+V.bx)/2-b,(V.ay+V.by)/2-A)<R+(V.spec.farLoad||900)&&gt(V);for(let[V,he]of Ee){let W=p((he.dx+.5)/16384,(he.dy+.5)/16384);he.group&&Math.hypot(W[0]-b,W[1]-A)>R+2600&&Di(V)}K.sort((V,he)=>V.d-he.d);for(let V of K){if(Jr>=4||ve.size>=WS)break;let he={tx:V.tx,ty:V.ty,key:V.tx+"/"+V.ty,group:null,recs:[]};ve.set(V.tx+"/"+V.ty,he),Jr++;let W=en(V.tx>>lu-14,V.ty>>lu-14);fetch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${lu}/${V.tx}/${V.ty}.vector.pbf?access_token=${t}`).then(ae=>ae.ok?ae.arrayBuffer():null).then(ae=>Promise.all([W,mt]).then(()=>ae)).then(ae=>{ae&&ve.get(V.tx+"/"+V.ty)===he&&!ir&&Tt(he,new ou(new fl(new Uint8Array(ae))))}).catch(()=>{ve.delete(V.tx+"/"+V.ty)}).finally(()=>{Jr--})}}let st={raw:[],path:null,total:0,end:null,head:0,meshes:[],dirty:!1,lastBuild:0,lampNext:12,lampCount:0,sampled:0},Xo=[[16,.25,v.warm,3],[7,.3,v.aura,4],[1.1,.4,v.core,5],[1.1,.4,v.xray,12]];function gl(b){let A=[];for(let Y of b){let H=A[A.length-1];(!H||Math.hypot(Y[0]-H[0],Y[1]-H[1])>1.5)&&A.push(Y)}let R=b[b.length-1];A.length&&A[A.length-1]!==R&&A.push(R);let P=[A[0]];for(let Y=0;Y<A.length-1;Y++){let H=A[Math.max(0,Y-1)],O=A[Y],K=A[Y+1],V=A[Math.min(A.length-1,Y+2)],he=(z,ce)=>Math.sqrt(Math.hypot(ce[0]-z[0],ce[1]-z[1]))+1e-4,W=he(H,O),ae=W+he(O,K),Se=ae+he(K,V),X=Math.max(1,Math.ceil(Math.hypot(K[0]-O[0],K[1]-O[1])/2));for(let z=1;z<=X;z++){let ce=W+(ae-W)*z/X,ne=[0,1].map(de=>{let te=((W-ce)*H[de]+ce*O[de])/W,j=((ae-ce)*O[de]+(ce-W)*K[de])/(ae-W),Re=((Se-ce)*K[de]+(ce-ae)*V[de])/(Se-ae),it=((ae-ce)*te+ce*j)/ae,ut=((Se-ce)*j+(ce-W)*Re)/(Se-W);return((ae-ce)*it+(ce-W)*ut)/(ae-W)});P.push(ne)}}let I=[],k=0;return P.forEach((Y,H)=>{H&&(k+=Math.hypot(Y[0]-P[H-1][0],Y[1]-P[H-1][1])),I.push({x:Y[0],y:Y[1],s:k})}),I}function xl(b,A){let R=b.length,P=Math.max(1,Math.round(A/2)),I=new Float64Array(R+1),k=new Float64Array(R+1);for(let Y=0;Y<R;Y++)I[Y+1]=I[Y]+b[Y].x,k[Y+1]=k[Y]+b[Y].y;return b.map((Y,H)=>{let O=Math.min(P,H,R-1-H);return O<1?Y:{x:(I[H+O+1]-I[H-O])/(2*O+1),y:(k[H+O+1]-k[H-O])/(2*O+1),s:Y.s}})}function as(b,A){let R=0,P=b.length-1;if(A<=0||P<1)return b[0];for(;P-R>1;){let H=R+P>>1;b[H].s<=A?R=H:P=H}let I=b[R],k=b[P],Y=_n((A-I.s)/Math.max(1e-6,k.s-I.s),0,1);return{x:I.x+(k.x-I.x)*Y,y:I.y+(k.y-I.y)*Y}}function vl(){if(st.meshes.forEach(O=>{F.remove(O),O.geometry.dispose()}),st.meshes=[],st.raw.length<2){st.total=0,st.end=null,st.head=0,_.uHead.value=0;return}let b=gl(st.raw),A=b.length;st.total=b[A-1].s,st.end=b[A-1],b.forEach((O,K)=>{let V=b[Math.max(0,K-1)],he=b[Math.min(A-1,K+1)];O.z=Nt(O.x,O.y,he.x-V.x,he.y-V.y)});for(let[O,K,V,he]of Xo){let W=new Float32Array(A*6),ae=new Float32Array(A*2),Se=new Float32Array(A*2),X=[],z=Math.max(2,O*1.3),ce=O>3?xl(b,O*1.6):b;ce.forEach((te,j)=>{let Re=as(ce,te.s-z),it=as(ce,te.s+z),ut=Math.hypot(it.x-Re.x,it.y-Re.y)||1,Ge=-(it.y-Re.y)/ut,Rt=(it.x-Re.x)/ut,Mt=K+b[j].z;W.set([te.x+Ge*O,te.y+Rt*O,Mt,te.x-Ge*O,te.y-Rt*O,Mt],j*6),ae[j*2]=ae[j*2+1]=te.s,Se[j*2]=-1,Se[j*2+1]=1,j&&X.push(j*2-2,j*2-1,j*2,j*2-1,j*2+1,j*2)});let ne=new tt;ne.setAttribute("position",new ht(W,3)),ne.setAttribute("aAlong",new ht(ae,1)),ne.setAttribute("aAcross",new ht(Se,1)),ne.setIndex(X);let de=new Ft(ne,V);de.renderOrder=he,de.frustumCulled=!1,F.add(de),st.meshes.push(de)}let R=new Float32Array(A*6),P=new Float32Array(A*2),I=new Float32Array(A*2),k=[];b.forEach((O,K)=>{R.set([O.x,O.y,.3+O.z,O.x,O.y,2.6+O.z],K*6),P[K*2]=P[K*2+1]=O.s,I[K*2+1]=1,K&&k.push(K*2-2,K*2-1,K*2,K*2-1,K*2+1,K*2)});let Y=new tt;Y.setAttribute("position",new ht(R,3)),Y.setAttribute("aAlong",new ht(P,1)),Y.setAttribute("aH",new ht(I,1)),Y.setIndex(k);let H=new Ft(Y,v.curtain);H.renderOrder=6,H.frustumCulled=!1,F.add(H),st.meshes.push(H),st.path=b}let Nn=new tt;Nn.setAttribute("position",new ht(new Float32Array(Ei*3),3)),Nn.setAttribute("aT",new ht(new Float32Array(Ei).fill(vn),1)),Nn.setAttribute("aSeed",new ht(new Float32Array(Ei).map((b,A)=>Ai(A)),1)),Nn.setDrawRange(0,0);let jr=new Hn(Nn,v.lamp);jr.renderOrder=8,jr.frustumCulled=!1,F.add(jr);let qo=b=>{let A=b.clone(),R=new kn(new Float32Array(Ei).fill(vn),1);R.setUsage(si);let P=new kn(new Float32Array(Ei).map((I,k)=>Ai(k+7)),1);return A.setAttribute("iT",R),A.setAttribute("iSeed",P),A},Yo=qo($g),Zo=qo(QS),qi=new Wi(Yo,v.post,Ei);qi.count=0,qi.renderOrder=1,qi.frustumCulled=!1,F.add(qi);let E=new Wi(Zo,v.cone,Ei);E.count=0,E.renderOrder=3,E.frustumCulled=!1,F.add(E);let G=new tt;G.setAttribute("position",new ht(new Float32Array(Ei*12),3)),G.setAttribute("aUV",new ht(new Float32Array(Ei*8),2)),G.setAttribute("aC",new ht(new Float32Array(Ei*12),3)),G.setAttribute("aLit",new ht(new Float32Array(Ei*8).map((b,A)=>A%2?0:vn),2)),G.setIndex(Array.from({length:Ei*6},(b,A)=>Math.floor(A/6)*4+[0,1,2,0,2,3][A%6])),G.setDrawRange(0,0);let re=new Ft(G,v.pool);re.renderOrder=2,re.frustumCulled=!1,F.add(re);let oe=new ct;function Z(b,A,R,P,I,k=0){let Y=st.lampCount++,H=b+P*.8,O=A+I*.8;Nn.attributes.position.setXYZ(Y,H,O,Lp+k),Nn.attributes.aT.setX(Y,R),Nn.attributes.position.needsUpdate=Nn.attributes.aT.needsUpdate=!0,Nn.setDrawRange(0,st.lampCount),oe.makeRotationZ(Math.atan2(-P,I)).setPosition(b,A,k),qi.setMatrixAt(Y,oe),qi.count=st.lampCount,qi.instanceMatrix.needsUpdate=!0,E.setMatrixAt(Y,oe),E.count=st.lampCount,E.instanceMatrix.needsUpdate=!0,Yo.attributes.iT.setX(Y,R),Yo.attributes.iT.needsUpdate=!0,Zo.attributes.iT.setX(Y,R),Zo.attributes.iT.needsUpdate=!0;let K=G.attributes.position,V=G.attributes.aUV,he=G.attributes.aC,W=G.attributes.aLit,ae=8;[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([Se,X],z)=>{K.setXYZ(Y*4+z,H+Se*ae,O+X*ae,.15+k),V.setXY(Y*4+z,Se,X),he.setXYZ(Y*4+z,H,O,.15+k),W.setXY(Y*4+z,R,.36)}),K.needsUpdate=V.needsUpdate=he.needsUpdate=W.needsUpdate=!0,G.setDrawRange(0,st.lampCount*6)}function De(){st.lampCount=0,st.lampNext=12,Nn.setDrawRange(0,0),qi.count=0,E.count=0,G.setDrawRange(0,0)}function We(b){let A=(b||[]).map(I=>x(I[0],I[1]));(A.length<st.raw.length||st.raw.length&&A.length&&Math.hypot(A[0][0]-st.raw[0][0],A[0][1]-st.raw[0][1])>1)&&(st.raw=[],st.sampled=0,st.head=0,De(),be.clear(),ee.clear(),_l=!0);let P=Math.max(1,st.raw.length);st.raw=A,A.length===1&&(nt(ee,A[0][0],A[0][1]),rt(A[0][0],A[0][1]));for(let I=P;I<A.length;I++){let[k,Y]=A[I-1],[H,O]=A[I],K=Math.hypot(H-k,O-Y),V=Math.max(1,Math.ceil(K/4));for(let he=1;he<=V;he++){let W=k+(H-k)*he/V,ae=Y+(O-Y)*he/V;nt(ee,W,ae),rt(W,ae)}}st.dirty=!0}function rt(b,A){let R=Math.floor(b/Qt),P=Math.floor(A/Qt),I=Math.ceil(Qs/Qt),k=N();for(let Y=-I;Y<=I;Y++)for(let H=-I;H<=I;H++){let O=$.get(R+Y+","+(P+H));if(O)for(let K of O){let V=Ue(K,b,A);V<Qs&&me(K,k+V/au,V,!0,b,A)}}}let ot="";function bt(b){let A=(b||[]).length+":"+(b||[]).reduce((R,P)=>R+P.length,0);if(A!==ot){ot=A;for(let R of b||[]){let P=R.map(I=>x(I[0],I[1]));for(let I=1;I<P.length;I++){let[k,Y]=P[I-1],[H,O]=P[I],K=Math.hypot(H-k,O-Y),V=Math.max(1,Math.ceil(K/8));for(let he=0;he<=V;he++){let W=k+(H-k)*he/V,ae=Y+(O-Y)*he/V;nt(pe,W,ae),Le(W,ae,er,!1,!0)}}}}}let St=500,je=new tt;je.setAttribute("position",new ht(new Float32Array(St*3),3)),je.setAttribute("aVel",new ht(new Float32Array(St*3),3)),je.setAttribute("aBirth",new ht(new Float32Array(St).fill(-99),1));let Xt=new Hn(je,v.spark);Xt.renderOrder=9,Xt.frustumCulled=!1,F.add(Xt);let nn=0,sn=0;function Wn(b,A,R,P=0){let I=je.attributes.position,k=je.attributes.aVel,Y=je.attributes.aBirth;for(let H=0;H<b;H++){let O=nn;nn=(nn+1)%St,I.setXYZ(O,A+(Math.random()-.5)*1.8,R+(Math.random()-.5)*1.8,.5+P),k.setXYZ(O,(Math.random()-.5)*1.4,(Math.random()-.5)*1.4,1.2+Math.random()*2.4),Y.setX(O,N()-Math.random()*.05)}I.needsUpdate=k.needsUpdate=Y.needsUpdate=!0}let Et=new tt;Et.setAttribute("position",new ht(new Float32Array(qr*3),3)),Et.setAttribute("aVel",new ht(new Float32Array(qr*3),3)),Et.setAttribute("aBirth",new ht(new Float32Array(qr).fill(-99),1)),Et.setAttribute("aLife",new ht(new Float32Array(qr).fill(1),1)),Et.setAttribute("aSize",new ht(new Float32Array(qr),1)),Et.setAttribute("aSeed",new ht(new Float32Array(qr),1));let lt=new Hn(Et,v.mote);lt.renderOrder=9,lt.frustumCulled=!1,F.add(lt);let pi=0;function Jt(b,A,R,P,I){let k=Et.attributes.position,Y=Et.attributes.aVel,H=Et.attributes.aBirth,O=Et.attributes.aLife,K=Et.attributes.aSize,V=Et.attributes.aSeed;for(let he=0;he<P;he++){let W=pi;pi=(pi+1)%qr,k.setXYZ(W,b+(Math.random()-.5)*I*2,A+(Math.random()-.5)*I*2,.6+Math.random()*R),Y.setXYZ(W,(Math.random()-.5)*.3,(Math.random()-.5)*.3,.5+Math.random()*.7),H.setX(W,N()+Math.random()*.8),O.setX(W,3+Math.random()*2.5),K.setX(W,.22+Math.random()*.22),V.setX(W,Math.random())}k.needsUpdate=Y.needsUpdate=H.needsUpdate=O.needsUpdate=K.needsUpdate=V.needsUpdate=!0}function mi(b){if(b.tree){Jt(b.cx,b.cy,3.5,2,1.5);return}let A=b.cx,R=b.cy,P=b.seg;if(P){let I=P[2]-P[0],k=P[3]-P[1],Y=I*I+k*k||.001,H=_n(((b.cx-P[0])*I+(b.cy-P[1])*k)/Y,0,1);A=P[0]+I*H,R=P[1]+k*H}Jt(A+(b.cx-A)*.6,R+(b.cy-R)*.6,Math.min(b.h,9),5+Math.min(6,Math.floor(b.h/6)),4)}let $n=new Ft(new As(1,1),v.ring);$n.renderOrder=7,$n.frustumCulled=!1,$n.scale.setScalar(22),F.add($n);let le={root:new bn,raw:null,target:null,pos:null,from:null,t0:0,dur:1,interval:0,angle:0,heading:null,moveHeading:null,speed:0,speedIn:0,lastFix:0,z:0,scale:3.5,gait:"idle",activity:"idle",forced:null,visible:!0};F.add(le.root);let Yi=new Ft(new Lo(1,32),new Ot({...ri,uniforms:_,vertexShader:"varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:"varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(vec3(0.3, 0.98, 0.84), pow(1.0 - r, 2.0) * 0.55); }"}));Yi.position.z=.32,Yi.renderOrder=7,Yi.frustumCulled=!1,le.root.add(Yi);let qt={},Fn=r,ls=null;function oi(b){b.onBeforeCompile=A=>{A.fragmentShader=A.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        { float rim = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.6); totalEmissiveRadiance += vec3(0.22, 0.95, 0.80) * rim * 0.45; }`)},b.needsUpdate=!0}function Ui(b){qt[b]||(qt[b]={loading:!0},new hl().load(`${n}runner-${b}.glb`,A=>{let R=A.scene,P=new bn;P.rotation.x=Math.PI/2,P.add(R);let I=new zn({color:6220500,transparent:!0,opacity:.4,depthFunc:Cr,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-6,polygonOffsetUnits:-6}),k=[];R.traverse(O=>{O.isMesh&&(O.frustumCulled=!1,O.renderOrder=11,(Array.isArray(O.material)?O.material:[O.material]).forEach(oi),O.isSkinnedMesh&&k.push(O))});for(let O of k){let K=new Ys(O.geometry,I);K.bind(O.skeleton,O.bindMatrix),K.frustumCulled=!1,K.renderOrder=13,O.parent.add(K)}let Y=new nl(R),H={};A.animations.forEach(O=>{H[O.name]=Y.clipAction(O)}),qt[b]={holder:P,mixer:Y,actions:H,current:null},P.visible=b===Fn,le.root.add(P),b===Fn&&ls&&ls(b)},void 0,()=>{delete qt[b]}))}let gi={walkOn:.6,walkOff:.35,runOn:2.5,runOff:2.1},$o={walk:1.35,run:3},hu=b=>Math.atan2(Math.sin(b*Math.PI/180),-Math.cos(b*Math.PI/180));function jg(b,A,R){let P=b.actions[A]||b.actions.idle||Object.values(b.actions)[0];if(!P||b.current===P)return;P.reset();let I=b.current,k=Y=>Y&&/walk|run/.test(Y.getClip().name);k(I)&&k(P)&&(P.time=I.time/I.getClip().duration*P.getClip().duration),P.setEffectiveWeight(1).fadeIn(R).play(),I&&I.fadeOut(R),b.current=P}Ui(Fn);function Qg(b,A,R,P){let[I,k]=x(b,A),Y=performance.now()/1e3,H=typeof P=="number"&&Number.isFinite(P)&&P>=0,O=typeof R=="number"&&Number.isFinite(R);if(le.raw&&Math.hypot(I-le.raw[0],k-le.raw[1])<.05){O&&(le.heading=hu(R)),H&&(le.speedIn=P);return}if(le.raw){let W=Math.hypot(I-le.raw[0],k-le.raw[1]),ae=_n(Y-le.lastFix,.2,3);if(le.interval=le.interval?le.interval*.7+ae*.3:ae,le.speedIn=H?P:W/ae,le.speedIn<.4&&W<3){le.lastFix=Y,O&&(le.heading=hu(R));return}W>.4&&(le.moveHeading=Math.atan2(I-le.raw[0],-(k-le.raw[1])))}else H&&(le.speedIn=P);O?le.heading=hu(R):le.moveHeading!=null&&(le.heading=le.moveHeading),le.raw=[I,k];let[K,V]=Bp(I,k),he=!le.pos||Math.hypot(K-le.pos[0],V-le.pos[1])>120;le.from=he?[K,V]:le.pos.slice(),le.target=[K,V],le.lastFix=Y,le.t0=Y,le.dur=_n(le.interval||1,.25,2),he&&(le.pos=[K,V],le.heading!=null&&(le.angle=le.heading))}function ex(b,A,R){let P=!1;for(let I=0,k=b.length-2;I<b.length;k=I,I+=2){let Y=b[I],H=b[I+1],O=b[k],K=b[k+1];H>R!=K>R&&A<(O-Y)*(R-H)/(K-H)+Y&&(P=!P)}return P}function Ko(b,A){let R=Math.floor(b/Qt),P=Math.floor(A/Qt);for(let I=-2;I<=2;I++)for(let k=-2;k<=2;k++){let Y=$.get(R+I+","+(P+k));if(Y){for(let H of Y)if(H.bb&&b>=H.bb[0]&&b<=H.bb[2]&&A>=H.bb[1]&&A<=H.bb[3]&&ex(H.pts,b,A))return H}}return null}let Up=0,Np=!1,Fp=!1;function tx(b,A,R){let P=T.position,I=P.x-b,k=P.y-A,Y=P.z-R,H=Math.hypot(I,k)||1;for(let O=1.5;O<70;O+=2){let K=O/H,V=R+Y*K;if(V>80)break;let he=Ko(b+I*K,A+k*K);if(he&&V<he.h)return!0}return!1}function Op(b,A,R,P,I,k){let Y=I-R,H=k-P,O=_n(((b-R)*Y+(A-P)*H)/(Y*Y+H*H||1),0,1);return Math.hypot(R+Y*O-b,P+H*O-A)}function nx(b,A){let R=25,P=Math.floor(b/Qt),I=Math.floor(A/Qt);for(let k=-1;k<=1;k++)for(let Y=-1;Y<=1;Y++){let H=$.get(P+k+","+(I+Y));if(H)for(let O of H){if(!O.bb||b<O.bb[0]-25||b>O.bb[2]+25||A<O.bb[1]-25||A>O.bb[3]+25)continue;let K=O.pts;for(let V=0,he=K.length-2;V<K.length;he=V,V+=2)R=Math.min(R,Op(b,A,K[he],K[he+1],K[V],K[V+1]))}}return R}function Bp(b,A){let R=Ko(b,A);if(!R)return[b,A];let P=R.pts,I=null;for(let k=0,Y=P.length-2;k<P.length;Y=k,k+=2){let H=P[Y],O=P[Y+1],K=P[k]-H,V=P[k+1]-O,he=Math.hypot(K,V);if(he<1.5)continue;let W=_n(((b-H)*K+(A-O)*V)/(he*he),.15,.85),ae=V/he,Se=-K/he;for(let X=3;X<=15;X+=3){let z=H+K*W+ae*X,ce=O+V*W+Se*X;if(Ko(z,ce))continue;let ne=Math.min(nx(z,ce),12)-.35*Math.hypot(z-b,ce-A);(!I||ne>I.score)&&(I={qx:z,qy:ce,score:ne});break}}return I?[I.qx,I.qy]:[b,A]}function ix(b){le.forced=b==="auto"?null:b}function sx(b){let A="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",R=(z,ce)=>new Ot({uniforms:ce,vertexShader:A,fragmentShader:z,depthTest:!1,depthWrite:!1,blending:Vi}),P=R(`uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
               + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
        c *= 0.25;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(c * smoothstep(0.55, 0.95, l), 1.0); }`,{tSrc:{value:null},uTexel:{value:new _e}}),I=R(`uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
        c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
        c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
        gl_FragColor = vec4(c, 1.0); }`,{tSrc:{value:null},uDir:{value:new _e}}),k=R(`uniform sampler2D tFrame; uniform sampler2D tB1; uniform sampler2D tB2; uniform float uBloom; uniform float uVignette; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tFrame, vUv).rgb;
        vec3 b = texture2D(tB1, vUv).rgb * 0.55 + texture2D(tB2, vUv).rgb * 0.45;
        c += b * vec3(1.0, 0.95, 0.88) * uBloom;
        c = c / (1.0 + max(c - 0.85, 0.0) * 1.6);
        float vig = smoothstep(1.35, 0.35, length((vUv - 0.5) * vec2(1.0, 1.15)) * 1.7);
        c *= mix(1.0 - uVignette, 1.0, vig);
        gl_FragColor = vec4(c, 1.0); }`,{tFrame:{value:null},tB1:{value:null},tB2:{value:null},uBloom:{value:1},uVignette:{value:.18}}),Y=new Ft(new As(2,2),P);Y.frustumCulled=!1;let H=new Br;H.add(Y);let O=new Qi(-1,1,1,-1,0,1),K=()=>new ti(1,1,{depthBuffer:!1,stencilBuffer:!1}),V={w:0,h:0,frame:null,a4:K(),b4:K(),a8:K(),b8:K(),d4:[1,1],d8:[1,1],composite:k};function he(z,ce){V.w=z,V.h=ce,V.frame&&V.frame.dispose(),V.frame=new Ba(z,ce),V.frame.minFilter=V.frame.magFilter=cn,V.d4=[Math.max(1,Math.round(z/4)),Math.max(1,Math.round(ce/4))],V.d8=[Math.max(1,Math.round(z/8)),Math.max(1,Math.round(ce/8))],V.a4.setSize(V.d4[0],V.d4[1]),V.b4.setSize(V.d4[0],V.d4[1]),V.a8.setSize(V.d8[0],V.d8[1]),V.b8.setSize(V.d8[0],V.d8[1])}function W(z,ce,ne,de){Y.material=z,z.uniforms.tSrc.value=ce,de&&z.uniforms.uDir.value.set(de[0],de[1]),b.setRenderTarget(ne),b.render(H,O)}let ae=0,Se=0,X=new Uint8Array(4);return V.verify=z=>ae>=20?!0:(ae++,z.getError()!==z.NO_ERROR?!1:(z.readPixels(Math.floor(V.w/2),Math.floor(V.h/2),1,1,z.RGBA,z.UNSIGNED_BYTE,X),Se=X[0]+X[1]+X[2]===0?Se+1:0,Se<4)),V.run=z=>{let ce=z.drawingBufferWidth,ne=z.drawingBufferHeight;(ce!==V.w||ne!==V.h)&&he(ce,ne);let de=z.getParameter(z.FRAMEBUFFER_BINDING);b.copyFramebufferToTexture(V.frame),P.uniforms.uTexel.value.set(1/ce,1/ne),W(P,V.frame,V.a4),W(I,V.a4.texture,V.b4,[1/V.d4[0],0]),W(I,V.b4.texture,V.a4,[0,1/V.d4[1]]),W(I,V.a4.texture,V.b8,[1/V.d8[0],0]),W(I,V.b8.texture,V.a8,[0,1/V.d8[1]]),b.setRenderTarget(null),de&&z.bindFramebuffer(z.FRAMEBUFFER,de),b.setViewport(0,0,ce,ne),Y.material=k,k.uniforms.tFrame.value=V.frame,k.uniforms.tB1.value=V.a4.texture,k.uniforms.tB2.value=V.a8.texture,b.render(H,O)},V.dispose=()=>{for(let z of[V.a4,V.b4,V.a8,V.b8])z.dispose();V.frame&&V.frame.dispose()},V}let Jo=new ct,zp=new ct,rx=new ct,tr=new kt,nr=null,cs=null,ir=!1,_l=!1,uu=-1,fu=0,du=performance.now(),kp=0,pu=16,yl=0,Hp=0;e.addLayer({id:"medirun-glow",type:"custom",renderingMode:"3d",onAdd(b,A){nr=new Fa({canvas:b.getCanvas(),context:A,antialias:!0}),nr.autoClear=!1,cs=sx(nr)},render(b,A){if(ir)return;Jo.fromArray(A).multiply(y),zp.copy(Jo).invert(),tr.set(0,0,1,0).applyMatrix4(zp),T.position.set(tr.x/tr.w,tr.y/tr.w,tr.z/tr.w),T.updateMatrixWorld(!0),T.projectionMatrix.copy(Jo).multiply(rx.makeTranslation(T.position.x,T.position.y,T.position.z)),T.projectionMatrixInverse.copy(T.projectionMatrix).invert();let R=e.getCenter(),P=x(R.lng,R.lat),I=Jo.elements;if(_.uRefW.value=Math.max(1e-6,I[3]*P[0]+I[7]*P[1]+I[15]),nr.resetState(),nr.setViewport(0,0,b.drawingBufferWidth,b.drawingBufferHeight),nr.render(F,T),J&&cs)try{cs.run(b),cs.verify(b)||(J=!1,h&&h("lite","post pass unverified"))}catch(k){J=!1,h&&h("lite",k)}e.triggerRepaint()}});function Vp(b){if(ir)return;let A=Math.min(.1,(b-du)/1e3);pu+=(b-du-pu)*.08,du=b,_.uTime.value+=A,c&&J&&(pu>30?yl?b-yl>3e3&&(J=!1,h&&h("lite")):yl=b:yl=0);let R=e.getCenter(),P=x(R.lng,R.lat);if(b-Hp>250&&(Hp=b,fe(P[0],P[1])),b-kp>500){kp=b;let Y=e.getCanvas(),H=e.unproject([Y.clientWidth/2,Y.clientHeight*.18]),O=x(H.lng,H.lat);if(ml(P[0],P[1],_n(Math.hypot(O[0]-P[0],O[1]-P[1])*1.15,VS,GS)),le.raw&&le.pos){let K=Bp(le.raw[0],le.raw[1]);Math.hypot(K[0]-le.target[0],K[1]-le.target[1])>.5&&(le.from=le.pos.slice(),le.target=K,le.t0=performance.now()/1e3,le.dur=.8)}}st.dirty&&b-st.lastBuild>90&&(st.dirty=!1,st.lastBuild=b,vl());let I=e.project(R),k=e.project(m(P[0]+1,P[1]));if(_.uPxM.value=Math.max(.2,Math.hypot(k.x-I.x,k.y-I.y)),le.target){let Y=performance.now()/1e3;le.pos||(le.pos=le.target.slice(),le.from=le.target.slice());let H=_n((Y-le.t0)/le.dur,0,1);le.pos[0]=le.from[0]+(le.target[0]-le.from[0])*H,le.pos[1]=le.from[1]+(le.target[1]-le.from[1])*H,Y-le.lastFix>4&&(le.speedIn*=Math.exp(-A*2)),le.speed+=(le.speedIn-le.speed)*(1-Math.exp(-A/.6)),le.heading!=null&&(le.angle=qS(le.angle,le.heading,1-Math.exp(-A*5)));let O=le.speed,K=le.gait;K==="idle"&&O>gi.walkOn&&(K="walk"),K==="walk"&&O<gi.walkOff&&(K="idle"),K!=="run"&&O>gi.runOn&&(K="run"),K==="run"&&O<gi.runOff&&(K="walk"),le.gait=K;let V=le.forced||K;le.activity=V;let[he,W]=le.pos,ae=le.moveHeading,Se=Nt(he,W,ae==null?null:Math.sin(ae),ae==null?null:-Math.cos(ae));le.z+=(Se-le.z)*Math.min(1,A*5);let X=le.z;le.root.position.set(he,W,.3+X),le.root.rotation.z=le.angle;let z=M?_n(e.getCanvas().clientHeight*.3/(_.uPxM.value*1.75),1.4,6):_n(44/(_.uPxM.value*1.75),2.2,6);le.scale+=(z-le.scale)*Math.min(1,A*3),le.root.scale.setScalar(le.scale),le.root.visible=le.visible,$n.visible=le.visible,$n.position.set(he,W,.33+X),$n.scale.setScalar(le.scale*6.3);let ce=.3+X+1.75*le.scale*.55;_.uRunner.value.set(he,W,ce),b-Up>120&&(Up=b,Np=le.visible&&tx(he,W,ce)),_.uCut.value+=((Np?1.75*le.scale*.8+2.5:0)-_.uCut.value)*Math.min(1,A*6),_.uCut.value<.05&&(_.uCut.value=0);let ne=_.uCut.value>0;if(ne!==Fp){Fp=ne;for(let Re of Ve)Re.visible=ne}let de=T.position.clone().sub(le.root.position);de.z=Math.max(de.z,de.length()*.35),S.target=le.root,S.position.copy(le.root.position).add(de.normalize().multiplyScalar(10)),S.intensity+=((M?1.7:.5)-S.intensity)*Math.min(1,A*3);let te=V==="run"||V==="walk";if(_.uRun.value+=((te?1:0)-_.uRun.value)*Math.min(1,A*3),C.position.set(he+4,W-3,6+X),C.intensity=30*_.uRun.value,te&&le.visible){sn+=A*(V==="run"?30+10*O:10);let Re=Math.floor(sn);sn-=Re,Re&&Wn(Re,he,W,X)}let j=qt[Fn];j&&j.mixer&&(jg(j,V,V==="idle"||j.current===j.actions.idle?.5:.35),j.actions.walk&&(j.actions.walk.timeScale=_n(O/$o.walk,.7,1.4)),j.actions.run&&(j.actions.run.timeScale=_n(O/$o.run,.85,1.75)),j.mixer.update(A))}else le.root.visible=!1,$n.visible=!1;if(st.end){let Y=le.pos&&le.visible?Math.hypot(le.pos[0]-st.end.x,le.pos[1]-st.end.y):0,H=_n(st.total-(Y<40?Y:0),0,st.total);for(st.head=Math.max(st.head,H),_.uHead.value=st.head;st.path&&st.lampNext<st.head&&st.lampCount<Ei;){let O=as(st.path,st.lampNext),K=as(st.path,st.lampNext+2),V=Math.hypot(K.x-O.x,K.y-O.y)||1,he=-(K.y-O.y)/V,W=(K.x-O.x)/V,ae=st.lampCount%2?1:-1,Se=Nt(O.x,O.y,K.x-O.x,K.y-O.y);if(Se>.5&&ge(O.x,O.y)){st.lampNext+=qg;continue}for(let X of[ae,-ae]){let z=O.x+he*Yg*X,ce=O.y+W*Yg*X;if(!Ko(z,ce)){Z(z,ce,N(),-he*X,-W*X,Se);break}}st.lampNext+=qg}}if(se.length){let Y=N();for(let H=se.length-1;H>=0;H--){let O=se[H];O.time<=Y&&(se[H]=se[se.length-1],se.pop(),mi(O))}}_l&&be.size!==uu&&(_l=!1,uu=be.size,o&&o(uu)),fu=requestAnimationFrame(Vp)}return fu=requestAnimationFrame(Vp),{setTrail:We,setPaint:bt,setRunner:Qg,setActivity:ix,setHero(b){if(!(b!=="m"&&b!=="f")){Fn=b,Ui(b);for(let A of Object.keys(qt))qt[A].holder&&(qt[A].holder.visible=A===b)}},setRunnerVisible(b){le.visible=!!b},setHeroView(b){M=!!b},setBloom(b,A){J=!!b&&!a,cs&&typeof A=="number"&&(cs.composite.uniforms.uBloom.value=A)},quality:()=>J?"full":"lite",runnerScreen(){if(!le.pos||!le.visible||!nr)return null;let b=e.getCanvas(),A=b.clientWidth,R=b.clientHeight,P=Y=>{let H=new kt(le.pos[0],le.pos[1],Y,1).applyMatrix4(Jo);return H.w>0?{x:(H.x/H.w+1)/2*A,y:(1-H.y/H.w)/2*R}:null},I=P(.3+le.z),k=P(.3+le.z+1.75*le.scale);return!I||!k?null:{x:I.x,y:I.y,headX:k.x,headY:k.y,height:Math.hypot(I.x-k.x,I.y-k.y)}},runnerHit(b,A){let R=this.runnerScreen();if(!R)return!1;let P=(R.x+R.headX)/2,I=(R.y+R.headY)/2,k=Math.max(34,R.height*.6);return Math.abs(b-P)<Math.max(34,R.height*.4)&&Math.abs(A-I)<k},onHeroReady(b){ls=b,qt[Fn]?.holder&&b(Fn)},runner(){if(!le.pos)return null;let b=m(le.pos[0],le.pos[1]);return{lng:b.lng,lat:b.lat,heading:le.heading==null?null:(Math.atan2(Math.sin(le.heading),-Math.cos(le.heading))*180/Math.PI+360)%360,speed:le.speed,activity:le.activity}},litCount:()=>be.size,debug:{THREE:Yd,scene:F,camera:T,U:_,tiles:ve,details:Ee,roofInfo:ye,heroModels:Ie,heroes:qt,runner:le,grid:$,insideBuilding:Ko,deckZ:Nt,toLngLat:m,toLocal:x,post:()=>cs},dispose(){ir=!0,cancelAnimationFrame(fu),cs&&cs.dispose();try{e.removeLayer("medirun-glow")}catch{}}}}return fx(hw);})();
