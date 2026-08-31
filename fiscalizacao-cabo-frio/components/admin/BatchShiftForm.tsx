"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Team = { id:string; name:string; memberCount:number; members:string[] };
type Row = { teamId:string; enabled:boolean; firstDate:string };

function addDays(dateText:string,days:number){if(!dateText)return "";const [y,m,d]=dateText.split("-").map(Number);const dt=new Date(Date.UTC(y,m-1,d));dt.setUTCDate(dt.getUTCDate()+days);return dt.toISOString().slice(0,10)}
function formatBr(dateText:string){if(!dateText)return "";const [y,m,d]=dateText.split("-");return `${d}/${m}/${y}`}

export function BatchShiftForm({teams,defaultCycleDays}:{teams:Team[];defaultCycleDays:number}){
  const router=useRouter();
  const [rows,setRows]=useState<Row[]>(teams.map(t=>({teamId:t.id,enabled:false,firstDate:""})));
  const [mode,setMode]=useState<"count"|"until">("count");
  const [count,setCount]=useState(12);
  const [untilDate,setUntilDate]=useState("");
  const [cycleDays,setCycleDays]=useState(defaultCycleDays||4);
  const [skipExisting,setSkipExisting]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  function update(teamId:string,patch:Partial<Row>){setRows(current=>current.map(r=>r.teamId===teamId?{...r,...patch}:r))}
  function preview(firstDate:string){const dates:string[]=[];if(!firstDate)return dates;let current=firstDate;for(let i=0;i<Math.min(count,8);i++){if(mode==="until"&&untilDate&&current>untilDate)break;dates.push(current);current=addDays(current,cycleDays)}return dates}
  const selectedCount=useMemo(()=>rows.filter(r=>r.enabled).length,[rows]);

  async function submit(e:FormEvent){e.preventDefault();setSaving(true);setMessage("");try{const selected=rows.filter(r=>r.enabled);if(!selected.length)throw new Error("Selecione pelo menos uma equipe.");if(selected.some(r=>!r.firstDate))throw new Error("Informe a primeira data de cada equipe selecionada.");const response=await fetch("/api/admin/shifts/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teams:selected,mode,count,untilDate,cycleDays,skipExisting})});const result=await response.json();if(!response.ok)throw new Error(result.error??"Falha ao gerar escala.");setMessage(`Escala gerada: ${result.createdShifts} plantões criados, ${result.skippedShifts} já existentes ignorados.`);router.refresh();}catch(err){setMessage(err instanceof Error?err.message:"Erro ao gerar escala.");}finally{setSaving(false)}}

  return <form className="card" onSubmit={submit}>
    <div className="notice notice-success"><strong>Escala 24×72:</strong> intervalo padrão de 4 dias. Ex.: equipe iniciando dia 27 volta nos dias 31, 04, 08... Os agentes são puxados automaticamente do cadastro da equipe.</div>
    <div className="grid grid-3">
      <div className="field"><label className="label">Forma de geração</label><select className="select" value={mode} onChange={e=>setMode(e.target.value as "count"|"until")}><option value="count">Quantidade de plantões</option><option value="until">Gerar até uma data</option></select></div>
      {mode==="count"?<div className="field"><label className="label">Plantões por equipe</label><input className="input" type="number" min={1} max={100} value={count} onChange={e=>setCount(Number(e.target.value))}/></div>:<div className="field"><label className="label">Gerar até</label><input className="input" type="date" value={untilDate} onChange={e=>setUntilDate(e.target.value)} required/></div>}
      <div className="field"><label className="label">Intervalo entre plantões</label><input className="input" type="number" min={1} max={30} value={cycleDays} onChange={e=>setCycleDays(Number(e.target.value))}/><span className="field-help">Para 24×72 use 4 dias.</span></div>
    </div>

    <div className="form-section-title">Equipes e primeira data</div>
    <div className="grid grid-2">
      {teams.map(team=>{const row=rows.find(r=>r.teamId===team.id)!;return <div className="batch-team-card" key={team.id}>
        <label style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" checked={row.enabled} onChange={e=>update(team.id,{enabled:e.target.checked})}/><strong>{team.name}</strong><span className="metric-label">{team.memberCount} agentes</span></label>
        <div className="field" style={{marginTop:12,marginBottom:8}}><label className="label">Primeiro plantão</label><input className="input" type="date" value={row.firstDate} onChange={e=>update(team.id,{firstDate:e.target.value})} disabled={!row.enabled}/></div>
        <div className="roster-list">{team.members.slice(0,8).map(name=><span className="roster-chip" key={name}>{name}</span>)}{team.members.length>8&&<span className="roster-chip">+{team.members.length-8}</span>}</div>
        {row.enabled&&row.firstDate&&<div className="batch-preview">{preview(row.firstDate).map(d=><span className="date-chip" key={d}>{formatBr(d)}</span>)}</div>}
      </div>})}
    </div>

    <label className="team-checkbox" style={{marginTop:16}}><input type="checkbox" checked={skipExisting} onChange={e=>setSkipExisting(e.target.checked)}/><span><strong>Ignorar plantões que já existirem</strong><br/><span className="field-help">Evita duplicar equipe/data caso você gere novamente o mesmo período.</span></span></label>
    {message&&<div className={message.startsWith("Escala gerada")?"notice notice-success":"notice notice-error"}>{message}</div>}
    <div className="form-actions"><button type="button" className="button button-secondary" onClick={()=>router.push("/admin/escalas")}>Voltar</button><button className="button" disabled={saving||selectedCount===0}>{saving?"Gerando...":`Gerar escala de ${selectedCount} equipe(s)`}</button></div>
  </form>
}
