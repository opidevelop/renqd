import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const reply=(data:unknown,status=410)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});

Deno.serve((req:Request)=>{
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 return reply({error:"Track Record placements are manual. Automated placement import has been retired; season templates now contain structure only."},410);
});
