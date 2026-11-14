import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import './style.css';
const db=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
const cats=['음악방송','팬사인회','공연','이벤트','콘텐츠','기타'];
const empty={title:'',starts_at:'',ends_at:'',category:'이벤트',place:'',source_url:'',description:'',image_path:null};
const local=s=>{if(!s)return '';const d=new Date(s);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
function App(){
const [viewEvent,SetViewEvent]=useState(null);
const [imageFiles,SetImageFiles]=useState([]),[removedPaths,SetRemovedPaths]=useState([]),[imageUrls,SetImageUrls]=useState({}),[eventImages,SetEventImages]=useState({}),[galleryIndex,SetGalleryIndex]=useState(0),[clock,SetClock]=useState(Date.now());
const [session,S]=useState(null),[ready,R]=useState(false),[email,E]=useState(''),[password,P]=useState(''),[events,V]=useState([]),[tab,T]=useState('calendar'),[month,M]=useState(new Date()),[filter,F]=useState('전체'),[form,Q]=useState(null),[error,X]=useState(''),[busy,B]=useState(false);
useEffect(()=>{const t=setInterval(()=>SetClock(Date.now()),60000);return()=>clearInterval(t)},[]);
useEffect(()=>{if(!db){R(true);return}db.auth.getSession().then(({data})=>{S(data.session);R(true)});const {data:{subscription}}=db.auth.onAuthStateChange((_,s)=>S(s));return()=>subscription.unsubscribe()},[]);
async function reload(){if(!session)return;
const [a,b]=await Promise.all([db.from('events').select('*').order('starts_at'),db.from('event_images').select('*').order('sort_order').order('created_at')]);
X(a.error?.message||b.error?.message||'');V(a.data||[]);
if(a.error||b.error)return;
const grouped={};for(const img of b.data||[]){(grouped[img.event_id]??=[]).push(img)}
// Legacy single-image data is also shown until migrated.
for(const e of a.data||[]){if(e.image_path&&!(grouped[e.id]||[]).some(img=>img.storage_path===e.image_path))(grouped[e.id]??=[]).unshift({id:'legacy-'+e.id,event_id:e.id,storage_path:e.image_path})}
SetEventImages(grouped);
const urls={};const paths=[...new Set(Object.values(grouped).flat().map(img=>img.storage_path))];
await Promise.all(paths.map(async path=>{const {data}=await db.storage.from('event-images').createSignedUrl(path,3600);if(data?.signedUrl)urls[path]=data.signedUrl}));
SetImageUrls(urls);
}
useEffect(()=>{reload()},[session]);
async function login(e){e.preventDefault();const {error}=await db.auth.signInWithPassword({email,password});X(error?.message||'')}
function edit(e=null){SetViewEvent(null);SetImageFiles([]);SetRemovedPaths([]);Q(e?{...e,starts_at:local(e.starts_at),ends_at:local(e.ends_at)}:{...empty})}
async function save(e){e.preventDefault();if(!form?.starts_at||busy)return;B(true);X('');
const uploaded=[];let createdEvent=null;
try{
const oldImages=eventImages[form.id]||[];
const remaining=oldImages.filter(img=>!removedPaths.includes(img.storage_path));
if(remaining.length+imageFiles.length>10)throw new Error('한 일정에는 사진을 최대 10장까지 등록할 수 있어요.');
for(const file of imageFiles){if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024)throw new Error('사진은 JPG, PNG, WEBP, GIF 형식의 장당 5MB 이하만 가능해요.')}
const payload={title:form.title,starts_at:new Date(form.starts_at).toISOString(),ends_at:form.ends_at?new Date(form.ends_at).toISOString():null,category:form.category,place:form.place||'',source_url:form.source_url?.trim()||null,description:form.description||'',user_id:session.user.id};
let id=form.id;
if(id){const r=await db.from('events').update(payload).eq('id',id);if(r.error)throw r.error}
else{const r=await db.from('events').insert(payload).select('id').single();if(r.error)throw r.error;id=r.data.id;createdEvent=id}
for(let i=0;i<imageFiles.length;i++){
const file=imageFiles[i];const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type];
const path=session.user.id+'/'+crypto.randomUUID()+'.'+ext;
const up=await db.storage.from('event-images').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;uploaded.push(path);
const row=await db.from('event_images').insert({event_id:id,user_id:session.user.id,storage_path:path,sort_order:oldImages.length+i});
if(row.error)throw row.error;
}
for(const img of oldImages.filter(img=>removedPaths.includes(img.storage_path))){
if(!img.id.startsWith('legacy-')){const r=await db.from('event_images').delete().eq('id',img.id);if(r.error)throw r.error;}
if(form.image_path===img.storage_path){const r=await db.from('events').update({image_path:null}).eq('id',id);if(r.error)throw r.error;}
await db.storage.from('event-images').remove([img.storage_path]);
}
Q(null);SetImageFiles([]);SetRemovedPaths([]);await reload();
}catch(err){
if(createdEvent){await db.from('events').delete().eq('id',createdEvent)}
if(uploaded.length){await db.storage.from('event-images').remove(uploaded);await db.from('event_images').delete().in('storage_path',uploaded)}
X(err.message||'일정 저장에 실패했어요. 이미 변경된 정보가 있다면 새로고침 후 확인해 주세요.');
}finally{B(false)}
}
async function del(id){if(!confirm('일정을 삭제할까요?'))return;const paths=(eventImages[id]||[]).map(x=>x.storage_path);const r=await db.from('events').delete().eq('id',id);if(r.error)X(r.error.message);else{if(paths.length)await db.storage.from('event-images').remove(paths);Q(null);reload()}}

const start=new Date(month.getFullYear(),month.getMonth(),1),offset=start.getDay(),length=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(),cells=Array.from({length:Math.ceil((offset+length)/7)*7},(_,i)=>i-offset+1);
const shown=events.filter(e=>filter==='전체'||e.category===filter),ongoing=events.filter(e=>new Date(e.starts_at).getTime()<=clock&&e.ends_at&&new Date(e.ends_at).getTime()>=clock),upcoming=events.filter(e=>new Date(e.starts_at).getTime()>clock).slice(0,5);
const weeks=Array.from({length:cells.length/7},(_,wi)=>{
 const first=new Date(month.getFullYear(),month.getMonth(),1-offset+wi*7);
 const last=new Date(first.getFullYear(),first.getMonth(),first.getDate()+7);
 const segments=shown.flatMap(event=>{
  const startTime=new Date(event.starts_at).getTime();
  const endTime=event.ends_at?new Date(event.ends_at).getTime():startTime;
  if(!Number.isFinite(startTime)||!Number.isFinite(endTime)||endTime<startTime)return [];
  // End at midnight means the previous day is the last occupied date.
  const effectiveEnd=endTime>startTime?endTime-1:endTime;
  const startDate=new Date(startTime),endDate=new Date(effectiveEnd);
  const eventFirst=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate());
  const eventLast=new Date(endDate.getFullYear(),endDate.getMonth(),endDate.getDate()+1);
  if(eventFirst>=last||eventLast<=first)return [];
  const left=Math.max(0,Math.round((Math.max(eventFirst.getTime(),first.getTime())-first.getTime())/86400000));
  const right=Math.min(7,Math.round((Math.min(eventLast.getTime(),last.getTime())-first.getTime())/86400000));
  return [{event,left,right,continuesBefore:eventFirst<first,continuesAfter:eventLast>last}];
 }).sort((a,b)=>a.left-b.left||b.right-a.right||a.event.title.localeCompare(b.event.title));
 const lanes=[];
 const placed=segments.map(segment=>{
  let lane=lanes.findIndex(end=>end<=segment.left);
  if(lane<0){lane=lanes.length;lanes.push(segment.right)}else lanes[lane]=segment.right;
  return {...segment,lane};
 });
 return {first,placed,laneCount:lanes.length};
});
const imageList=id=>(eventImages[id]||[]).map(img=>({path:img.storage_path,url:imageUrls[img.storage_path]})).filter(img=>img.url);
if(!db)return <main className="center"><h1>RESCENE PRIVATE</h1><p>Supabase 연결 설정이 필요합니다. README를 참고해 GitHub Actions Variables에 URL과 공개 키를 등록해 주세요.</p></main>;
if(!ready)return <main className="center">불러오는 중...</main>;
if(!session)return <main className="center"><form className="login" onSubmit={login}><h1>✧ RESCENE PRIVATE</h1><p>개인 일정 관리 공간</p><input type="email" required placeholder="이메일" value={email} onChange={e=>E(e.target.value)}/><input type="password" required placeholder="비밀번호" value={password} onChange={e=>P(e.target.value)}/><button>로그인</button>{error&&<p className="error">{error}</p>}</form></main>;
return <div className="app"><aside><h2>✧ RESCENE<br/><small>PRIVATE</small></h2><p>My Schedule & Event Archive</p><nav><button className={tab==='calendar'?'active':''} onClick={()=>T('calendar')}>▦ 캘린더</button><button onClick={()=>edit()}>＋ 직접 일정 등록</button></nav><small>🔒 개인 전용 공간</small></aside><main><header><div><p className="eyebrow">RESCENE · PERSONAL ARCHIVE</p><h1>리센느와 함께하는 모든 순간 ✨</h1><p>일정과 이벤트를 나만의 공간에 기록해요.</p></div><div className="account">{session.user.email}<button onClick={()=>db.auth.signOut()}>로그아웃</button></div></header>{error&&<div className="error">{error}<button onClick={()=>X('')}>닫기</button></div>}<div className="stats"><div>등록된 일정<strong>{events.length}</strong></div><div>진행 중인 일정<strong>{ongoing.length}</strong></div><div>다가오는 일정<strong>{upcoming.length}</strong></div></div>
{tab==='calendar'&&<div className="columns"><section className="panel"><div className="panelHead"><h2>{month.getFullYear()}년 {month.getMonth()+1}월</h2><div><button onClick={()=>M(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button><button onClick={()=>M(new Date())}>오늘</button><button onClick={()=>M(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button></div></div><div className="filters">{['전체',...cats].map(c=><button className={filter===c?'selected':''} onClick={()=>F(c)} key={c}>{c}</button>)}</div><div className="calendar"><div className="weekdays">{['일','월','화','수','목','금','토'].map(d=><div className="weekday" key={d}>{d}</div>)}</div>{weeks.map((week,wi)=><div className="calendarWeek" key={wi} style={{'--lanes':Math.max(week.laneCount,1)}}>{Array.from({length:7},(_,di)=>{const d=new Date(week.first.getFullYear(),week.first.getMonth(),week.first.getDate()+di);return <div key={di} className={'weekDay '+(d.getMonth()!==month.getMonth()?'muted':'')} style={{gridColumn:di+1,gridRow:'1 / '+(Math.max(week.laneCount,1)+2)}}><span>{d.getDate()}</span></div>})}{week.placed.map(({event,left,right,lane,continuesBefore,continuesAfter})=><button key={event.id} type="button" title={event.title} className={'rangeEvent '+(continuesBefore?'continuesBefore ':'')+(continuesAfter?'continuesAfter':'')} style={{gridColumn:(left+1)+' / '+(right+1),gridRow:lane+2}} onClick={()=>{SetGalleryIndex(0);SetViewEvent(event)}}>{continuesBefore?'↔ ':''}{event.title}{continuesAfter?' ↔':''}</button>)}</div>)}</div></section><div className="right"><section className="panel"><h2>● 현재 진행 중인 일정</h2>{ongoing.length?ongoing.map(x=><article key={x.id} onClick={()=>{SetGalleryIndex(0);SetViewEvent(x)}}>{imageList(x.id)[0]&&<img className="eventThumb" src={imageList(x.id)[0].url} alt="일정 첨부 이미지"/>}<b>{x.title}</b><small>{new Date(x.starts_at).toLocaleString('ko-KR')} · {x.category}</small></article>):<p>현재 진행 중인 일정이 없어요.</p>}</section><section className="panel"><h2>다가오는 일정</h2>{upcoming.length?upcoming.map(x=><article key={x.id} onClick={()=>{SetGalleryIndex(0);SetViewEvent(x)}}>{imageList(x.id)[0]&&<img className="eventThumb" src={imageList(x.id)[0].url} alt="일정 첨부 이미지"/>}<b>{x.title}</b><small>{new Date(x.starts_at).toLocaleString('ko-KR')} · {x.category}</small></article>):<p>다가오는 일정이 없어요.</p>}</section></div></div>}
</main>{viewEvent&&!form&&<div className="overlay" onClick={()=>SetViewEvent(null)}><div className="dialog detailDialog" role="dialog" aria-modal="true" aria-label="일정 상세 정보" onClick={e=>e.stopPropagation()}><div className="panelHead"><h2>일정 상세</h2><button type="button" className="ghost" onClick={()=>SetViewEvent(null)}>✕</button></div>{imageList(viewEvent.id).length>0&&<div className="gallery"><img className="detailImage" src={imageList(viewEvent.id)[galleryIndex%imageList(viewEvent.id).length].url} alt={viewEvent.title+' 첨부 이미지'}/>{imageList(viewEvent.id).length>1&&<div className="galleryNav"><button type="button" onClick={()=>SetGalleryIndex(i=>(i+imageList(viewEvent.id).length-1)%imageList(viewEvent.id).length)}>‹ 이전</button><span>{galleryIndex%imageList(viewEvent.id).length+1} / {imageList(viewEvent.id).length}</span><button type="button" onClick={()=>SetGalleryIndex(i=>(i+1)%imageList(viewEvent.id).length)}>다음 ›</button></div>}<div className="galleryThumbnails">{imageList(viewEvent.id).map((img,i)=><button type="button" key={img.path} className={i===galleryIndex?'selected':''} onClick={()=>SetGalleryIndex(i)}><img src={img.url} alt={'사진 '+(i+1)}/></button>)}</div></div>}<h2 className="detailTitle">{viewEvent.title}</h2><span className="detailCategory">{viewEvent.category}</span><dl className="detailFields"><dt>시작</dt><dd>{new Date(viewEvent.starts_at).toLocaleString('ko-KR')}</dd>{viewEvent.ends_at&&<><dt>종료</dt><dd>{new Date(viewEvent.ends_at).toLocaleString('ko-KR')}</dd></>}{viewEvent.place&&<><dt>장소</dt><dd>{viewEvent.place}</dd></>}{viewEvent.description&&<><dt>설명</dt><dd className="detailDescription">{viewEvent.description}</dd></>}{viewEvent.source_url&&<><dt>공식 출처</dt><dd><a href={viewEvent.source_url} target="_blank" rel="noopener noreferrer">원문 보기 ↗</a></dd></>}</dl><div className="actions"><button type="button" onClick={()=>edit(viewEvent)}>수정하기</button><button type="button" className="ghost" onClick={()=>SetViewEvent(null)}>닫기</button></div></div></div>}{form&&<div className="overlay"><div className="dialog"><div className="panelHead"><h2>{form.id?'일정 수정':'일정 등록'}</h2><button onClick={()=>{Q(null)}}>✕</button></div><form className="entry" onSubmit={save}><label>일정 제목<input required value={form.title} onChange={e=>Q({...form,title:e.target.value})}/></label><div className="two"><label>시작 일시<input required type="datetime-local" value={form.starts_at} onChange={e=>Q({...form,starts_at:e.target.value})}/></label><label>종료 일시<input type="datetime-local" value={form.ends_at||''} onChange={e=>Q({...form,ends_at:e.target.value})}/></label></div><div className="two"><label>카테고리<select value={form.category} onChange={e=>Q({...form,category:e.target.value})}>{cats.map(c=><option key={c}>{c}</option>)}</select></label><label>장소<input value={form.place||''} onChange={e=>Q({...form,place:e.target.value})}/></label></div><label>공식 출처 URL (선택)<input type="url" value={form.source_url||''} onChange={e=>Q({...form,source_url:e.target.value})}/></label><label>사진 첨부 (선택 · 최대 10장, 장당 5MB)<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>SetImageFiles(Array.from(e.target.files||[]))}/>{imageFiles.length>0&&<span className="imageHint">새 사진 {imageFiles.length}장 선택됨</span>}{form.id&&(eventImages[form.id]||[]).length>0&&<div className="editImageList">{(eventImages[form.id]||[]).map(img=><div key={img.storage_path}>{imageUrls[img.storage_path]&&<img src={imageUrls[img.storage_path]} alt="기존 사진"/>}<button type="button" className="ghost" onClick={()=>SetRemovedPaths(p=>p.includes(img.storage_path)?p.filter(x=>x!==img.storage_path):[...p,img.storage_path])}>{removedPaths.includes(img.storage_path)?'제거 취소':'제거'}</button>{removedPaths.includes(img.storage_path)&&<small>제거 예정</small>}</div>)}</div>}</label><label>설명 (선택)<textarea rows="4" value={form.description||''} onChange={e=>Q({...form,description:e.target.value})}/></label><div className="actions"><button disabled={busy}>저장하기</button>{form.id&&<button type="button" className="ghost" onClick={()=>del(form.id)}>삭제</button>}</div></form></div></div>}</div>
}
createRoot(document.getElementById('root')).render(<App/>);