import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, getAssignmentInterval, getShiftInterval, type ShiftPeriod } from "@/lib/shifts/time";

export async function POST(request:Request){
  try{
    const admin=await requireAdmin(); const body=await request.json(); const selected=Array.isArray(body.teams)?body.teams:[];
    const cycleDays=Math.max(1,Math.min(30,Number(body.cycleDays)||4)); const count=Math.max(1,Math.min(100,Number(body.count)||1)); const mode=body.mode==="until"?"until":"count"; const untilDate=String(body.untilDate??""); const skipExisting=body.skipExisting!==false;
    if(!selected.length)return NextResponse.json({error:"Selecione pelo menos uma equipe."},{status:400});
    const supabase=createAdminClient(); let createdShifts=0; let skippedShifts=0; const batchId=crypto.randomUUID();

    for(const config of selected){
      const teamId=String(config.teamId??""); const firstDate=String(config.firstDate??""); if(!teamId||!/^\d{4}-\d{2}-\d{2}$/.test(firstDate))return NextResponse.json({error:"Equipe ou primeira data inválida."},{status:400});
      const {data:roster,error:rosterError}=await supabase.from("agent_teams").select("agent_id,default_period,profiles!inner(id,full_name,status,work_hours)").eq("team_id",teamId).eq("profiles.status","active");
      if(rosterError)return NextResponse.json({error:rosterError.message},{status:400});
      if(!(roster?.length))return NextResponse.json({error:"Uma das equipes selecionadas não possui agentes ativos vinculados."},{status:400});

      const dates:string[]=[]; let current=firstDate;
      if(mode==="count"){for(let i=0;i<count;i++){dates.push(current);current=addDays(current,cycleDays)}}
      else {if(!untilDate)return NextResponse.json({error:"Informe a data final."},{status:400});while(current<=untilDate&&dates.length<200){dates.push(current);current=addDays(current,cycleDays)}}

      for(const serviceDate of dates){
        const shiftInterval=getShiftInterval(serviceDate);
        const {data:existing}=await supabase.from("shifts").select("id").eq("team_id",teamId).eq("starts_at",shiftInterval.startsAt).eq("status","scheduled").maybeSingle();
        if(existing){if(skipExisting){skippedShifts++;continue}return NextResponse.json({error:`Já existe plantão desta equipe em ${serviceDate}.`},{status:409})}

        // Bloqueia conflito: cada membro automático não pode estar em outra equipe no mesmo horário.
        for(const member of roster){
          const period=(member.default_period||((member as any).profiles?.work_hours===24?"full":"day")) as ShiftPeriod;
          const interval=getAssignmentInterval(serviceDate,period);
          const {data:conflict}=await supabase.from("shift_agents").select("id").eq("agent_id",member.agent_id).eq("status","scheduled").lt("starts_at",interval.endsAt).gt("ends_at",interval.startsAt).limit(1).maybeSingle();
          if(conflict)return NextResponse.json({error:`Existe conflito de escala para um agente da equipe na data ${serviceDate}. Corrija antes de gerar o lote.`},{status:409});
        }

        const {data:shift,error:shiftError}=await supabase.from("shifts").insert({team_id:teamId,starts_at:shiftInterval.startsAt,ends_at:shiftInterval.endsAt,status:"scheduled",generation_batch_id:batchId,created_by:admin.id,notes:"Gerado automaticamente pela escala 24×72"}).select("id").single();
        if(shiftError||!shift)return NextResponse.json({error:shiftError?.message??"Falha ao criar plantão."},{status:400});
        const assignments=roster.map(member=>{const period=(member.default_period||"day") as ShiftPeriod;const interval=getAssignmentInterval(serviceDate,period);return{shift_id:shift.id,agent_id:member.agent_id,team_id:teamId,starts_at:interval.startsAt,ends_at:interval.endsAt,status:"scheduled"}});
        const {error:assignmentError}=await supabase.from("shift_agents").insert(assignments);
        if(assignmentError){await supabase.from("shifts").delete().eq("id",shift.id);return NextResponse.json({error:assignmentError.message},{status:400})}
        createdShifts++;
      }
    }

    await supabase.from("audit_logs").insert({user_id:admin.id,action:"shift.batch_created",entity_type:"shifts",entity_id:batchId,details:{createdShifts,skippedShifts,cycleDays}});
    return NextResponse.json({message:"Escala gerada.",createdShifts,skippedShifts,batchId});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Erro interno."},{status:500})}
}
