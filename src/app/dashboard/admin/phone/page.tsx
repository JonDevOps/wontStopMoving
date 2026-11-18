'use client';
import { useEffect,useState,useCallback } from 'react';
import { useAuth,useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Button } from '@/components/ui/button';
type Item={id:string;kind:string;phone:string;body:string;mediaCount:number;status:string;createdAt:string|null};
export default function PhoneInbox(){const auth=useAuth(),{user}=useUser();const [items,setItems]=useState<Item[]>([]),[error,setError]=useState('');
  const load=useCallback(async()=>{try{const result=await apiFetch<{items:Item[]}>(auth,'/api/admin/phone');setItems(result.items);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not load phone inbox.');}},[auth]);
  useEffect(()=>{if(user)void load();},[user,load]);
  return <EmployeeLayout><main className="space-y-5 max-w-4xl"><h1 className="text-3xl font-bold">Business phone inbox</h1><p>Incoming texts and calls, newest 50. Messaging and voice activation require their separate setup. No automatic AI replies or outbound calling are enabled. View protected voicemail recordings in Twilio.</p><Button onClick={()=>void load()}>Refresh</Button>{error&&<p role="alert">{error}</p>}{!items.length&&!error&&<p>No incoming messages or calls yet.</p>}{items.map(item=><article className="border rounded-xl bg-white p-5 space-y-2" key={item.id}><h2 className="font-bold">{item.kind==='sms'?'Text':'Call'} · {item.phone}</h2><p className="text-sm">{item.createdAt?new Date(item.createdAt).toLocaleString():''} · {item.status}</p><p className="whitespace-pre-wrap break-words">{item.body}</p>{item.mediaCount>0&&<p>Contains {item.mediaCount} media attachment(s). View them securely in Twilio; media is not automatically downloaded.</p>}</article>)}</main></EmployeeLayout>;
}
