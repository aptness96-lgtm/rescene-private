import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
const url=process.env.EXPO_PUBLIC_SUPABASE_URL||'';
const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY||'';
export const configured=!!(url&&key);
export const supabase=createClient(url||'https://example.supabase.co',key||'missing-key',{
 auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}
});
export type EventRow={id:string;user_id:string;title:string;starts_at:string;ends_at:string|null;category:string;place:string|null;source_url:string|null;description:string|null;image_path:string|null};
export type EventImage={id:string;event_id:string;storage_path:string;sort_order:number};
export const categories=['음악방송','팬사인회','공연','이벤트','콘텐츠','기타'];
export async function loadCalendar(){
 const [a,b]=await Promise.all([supabase.from('events').select('*').order('starts_at'),supabase.from('event_images').select('*').order('sort_order')]);
 if(a.error)throw a.error;if(b.error)throw b.error;
 const events=(a.data||[]) as EventRow[], images=(b.data||[]) as EventImage[];
 const result:Record<string,string[]>={};
 for(const e of events){
  const paths=[...new Set([...images.filter(i=>i.event_id===e.id).map(i=>i.storage_path),...(e.image_path?[e.image_path]:[])])];
  const urls=await Promise.all(paths.map(async p=>{const {data,error}=await supabase.storage.from('event-images').createSignedUrl(p,3600);return error?null:data?.signedUrl||null}));
  result[e.id]=urls.filter((x):x is string=>!!x);
 }
 return {events,photos:result};
}
