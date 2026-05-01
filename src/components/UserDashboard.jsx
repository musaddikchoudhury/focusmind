import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { getDashboardData } from "../db/userService";

const fmtTime = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s || 0}s`;
};
const FREQ_COLOR = { gamma:"#ff4d1a", beta:"#00e5ff", alpha:"#b57bee", theta:"#00ffb3" };
const MASTERY_COLOR = { mastered:"#00e5ff", proficient:"#00ffb3", developing:"#b57bee", learning:"#ff4d1a" };

function SessionBars({ sessions }) {
  if (!sessions?.length) return null;
  const last12 = sessions.slice(0, 12).reverse();
  const max = Math.max(...last12.map(s => s.duration_seconds), 1);
  return (
    <div>
      <div style={{ fontSize:9, color:"#1e3a5f", fontFamily:"'Space Mono',monospace",
        letterSpacing:"0.14em", marginBottom:10 }}>STUDY TIME PER SESSION</div>
      <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:72 }}>
        {last12.map((s, i) => {
          const pct = s.duration_seconds / max;
          const color = FREQ_COLOR[s.freq_key] || "#00e5ff";
          return (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", gap:2, height:"100%" }}>
              <div style={{ flex:1, display:"flex", alignItems:"flex-end", width:"100%" }}>
                <div title={`${fmtTime(s.duration_seconds)}`}
                  style={{ width:"100%", minHeight:4,
                    height:`${Math.max(pct*100,4)}%`,
                    background:color, borderRadius:"3px 3px 0 0", opacity:0.75+pct*0.25 }} />
              </div>
              <div style={{ fontSize:7, color:color, fontFamily:"'Space Mono',monospace", opacity:0.7 }}>
                {new Date(s.created_at).toLocaleDateString([],{month:"numeric",day:"numeric"})}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height:1, background:"rgba(255,255,255,0.06)", marginTop:2 }} />
      <div style={{ display:"flex", gap:10, marginTop:8, flexWrap:"wrap" }}>
        {Object.entries(FREQ_COLOR).map(([k,c]) => (
          <div key={k} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:6, height:6, borderRadius:1, background:c }} />
            <span style={{ fontSize:8, color:"#334155", fontFamily:"'Space Mono',monospace" }}>{k.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusSparkline({ sessions }) {
  const rated = sessions?.filter(s => s.focus_rating > 0).slice(0,16).reverse() || [];
  if (rated.length < 2) return null;
  const W = 240, H = 52;
  const pts = rated.map((s, i) => ({
    x: (i / (rated.length-1)) * (W-16) + 8,
    y: H - 8 - ((s.focus_rating-1)/4) * (H-16),
    r: s.focus_rating,
  }));
  const path = pts.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const avg = (rated.reduce((a,s)=>a+s.focus_rating,0)/rated.length).toFixed(1);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div style={{ fontSize:9, color:"#1e3a5f", fontFamily:"'Space Mono',monospace", letterSpacing:"0.14em" }}>FOCUS TREND</div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"#00e5ff", lineHeight:1 }}>
          {avg}<span style={{ fontSize:11, color:"#334155" }}>/5</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[1,2,3,4,5].map(r => {
          const y = H-8-((r-1)/4)*(H-16);
          return <line key={r} x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>;
        })}
        <path d={`${path} L${pts[pts.length-1].x},${H} L${pts[0].x},${H} Z`} fill="url(#sg)"/>
        <path d={path} fill="none" stroke="#00e5ff" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#00e5ff" stroke="#020810" strokeWidth="1.5"><title>Rating: {p.r}/5</title></circle>)}
      </svg>
    </div>
  );
}

function FreqDonut({ sessions }) {
  if (!sessions?.length) return null;
  const counts = {};
  sessions.forEach(s => { counts[s.freq_key] = (counts[s.freq_key]||0)+1; });
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const items = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const R=34, cx=42, cy=42, sw=11;
  let cum=0;
  const arcs = items.map(([key,count]) => {
    const pct=count/total;
    const s=cum*2*Math.PI-Math.PI/2; cum+=pct;
    const e=cum*2*Math.PI-Math.PI/2;
    const x1=cx+R*Math.cos(s),y1=cy+R*Math.sin(s),x2=cx+R*Math.cos(e),y2=cy+R*Math.sin(e);
    return { key, count, pct, path:`M ${x1} ${y1} A ${R} ${R} 0 ${pct>0.5?1:0} 1 ${x2} ${y2}`,
      color:FREQ_COLOR[key]||"#475569" };
  });
  return (
    <div>
      <div style={{ fontSize:9, color:"#1e3a5f", fontFamily:"'Space Mono',monospace", letterSpacing:"0.14em", marginBottom:8 }}>FREQUENCY USAGE</div>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <svg width="84" height="84" style={{ flexShrink:0 }}>
          {arcs.map((a,i) => <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={sw} opacity="0.85"/>)}
          <text x={cx} y={cy+4} textAnchor="middle" fill="#f1f5f9" fontSize="13" fontFamily="'Bebas Neue',sans-serif">{total}</text>
          <text x={cx} y={cy+14} textAnchor="middle" fill="#334155" fontSize="7" fontFamily="'Space Mono',monospace">SESSIONS</text>
        </svg>
        <div style={{ display:"flex", flexDirection:"column", gap:6, flex:1 }}>
          {arcs.map(a => (
            <div key={a.key} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:a.color,flexShrink:0 }}/>
              <span style={{ fontSize:9,color:"#94a3b8",fontFamily:"'Space Mono',monospace",flex:1 }}>{a.key.toUpperCase()}</span>
              <span style={{ fontSize:9,color:a.color,fontFamily:"'Space Mono',monospace" }}>{a.count}</span>
              <div style={{ width:36,height:3,borderRadius:2,background:"rgba(255,255,255,0.06)" }}>
                <div style={{ width:`${a.pct*100}%`,height:"100%",borderRadius:2,background:a.color }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityHeatmap({ sessions }) {
  const weeks=12, days=7;
  const map={};
  sessions?.forEach(s => {
    const d=s.created_at?.slice(0,10);
    if(d) map[d]=(map[d]||0)+s.duration_seconds;
  });
  const maxSecs=Math.max(...Object.values(map),1);
  const grid=[];
  const today=new Date();
  for(let w=weeks-1;w>=0;w--) {
    const col=[];
    for(let d=0;d<days;d++) {
      const dt=new Date(today);
      dt.setDate(today.getDate()-(w*7+(days-1-d)));
      const key=dt.toISOString().slice(0,10);
      col.push({key,val:map[key]||0});
    }
    grid.push(col);
  }
  const dayL=["S","M","T","W","T","F","S"];
  return (
    <div>
      <div style={{ fontSize:9, color:"#1e3a5f", fontFamily:"'Space Mono',monospace", letterSpacing:"0.14em", marginBottom:8 }}>ACTIVITY (12 WEEKS)</div>
      <div style={{ display:"flex", gap:2 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:2, marginRight:2 }}>
          {dayL.map((l,i) => <div key={i} style={{ height:10,fontSize:7,color:"#1e3a5f",fontFamily:"'Space Mono',monospace",lineHeight:"10px" }}>{l}</div>)}
        </div>
        {grid.map((col,wi) => (
          <div key={wi} style={{ display:"flex", flexDirection:"column", gap:2 }}>
            {col.map((cell,di) => {
              const intensity=cell.val/maxSecs;
              const isToday=cell.key===today.toISOString().slice(0,10);
              return (
                <div key={di} title={cell.val?`${cell.key}: ${fmtTime(cell.val)}`:cell.key}
                  style={{ width:10,height:10,borderRadius:2,
                    background:cell.val>0?`rgba(0,229,255,${0.12+intensity*0.88})`:"rgba(255,255,255,0.04)",
                    border:isToday?"1px solid rgba(0,229,255,0.5)":"none" }} />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:3, marginTop:6 }}>
        <span style={{ fontSize:8,color:"#1e3a5f",fontFamily:"'Space Mono',monospace" }}>LESS</span>
        {[0.05,0.25,0.5,0.75,1].map((v,i) => <div key={i} style={{ width:10,height:10,borderRadius:2,background:`rgba(0,229,255,${v})` }}/>)}
        <span style={{ fontSize:8,color:"#1e3a5f",fontFamily:"'Space Mono',monospace" }}>MORE</span>
      </div>
    </div>
  );
}

function MasteryBars({ progress }) {
  if (!progress?.length) return (
    <div style={{ textAlign:"center",padding:"20px 0",color:"#1e3a5f",fontSize:13 }}>
      Complete quizzes to track your learning progress.
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {progress.slice(0,15).map((p,i) => {
        const acc=p.encounter_count>0?Math.round(p.correct_count/p.encounter_count*100):0;
        const color=MASTERY_COLOR[p.mastery_level]||"#475569";
        return (
          <div key={i}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
              <span style={{ fontSize:12,color:"#94a3b8",textTransform:"capitalize",
                maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.topic}</span>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:10,color:"#334155" }}>{acc}%</span>
                <span style={{ fontSize:8,color,fontFamily:"'Space Mono',monospace",
                  padding:"1px 7px",borderRadius:999,background:color+"14",
                  border:`1px solid ${color}33`,letterSpacing:"0.04em" }}>{p.mastery_level}</span>
              </div>
            </div>
            <div style={{ height:4,borderRadius:2,background:"rgba(255,255,255,0.06)" }}>
              <div style={{ width:`${acc}%`,height:"100%",borderRadius:2,
                background:`linear-gradient(to right,${color}88,${color})`,transition:"width 0.6s ease" }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function UserDashboard({ onClose }) {
  const { user, signOut } = useAuth();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("overview");
  const scrollRef=useRef(null);

  const load=useCallback(async()=>{
    if(!user?.id) return;
    setLoading(true);
    try { setData(await getDashboardData(user.id)); }
    catch(e) { console.warn("Dashboard:",e.message); }
    finally { setLoading(false); }
  },[user]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=0; },[tab]);

  const profile=data?.profile;
  const sessions=data?.sessions||[];
  const progress=data?.progress||[];

  const handleSignOut=async()=>{ onClose(); await signOut(); };

  return (
    <div onClick={onClose}
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",
        zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",
        backdropFilter:"blur(14px)",padding:16,fontFamily:"'DM Sans',sans-serif" }}>
      <div onClick={e=>e.stopPropagation()} ref={scrollRef}
        style={{ width:"100%",maxWidth:520,maxHeight:"88vh",overflowY:"auto",
          background:"rgba(4,12,24,0.98)",border:"1px solid rgba(255,255,255,0.09)",
          borderRadius:22,color:"#e2e8f0",animation:"dashIn 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
          @keyframes dashIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
          @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          .dt{background:transparent;border:1px solid transparent;cursor:pointer;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:0.1em;padding:7px 14px;border-radius:999px;transition:all 0.2s;color:#475569;}
          .dt:hover{color:#94a3b8;}
          .dt.on{color:#00e5ff;background:rgba(0,229,255,0.1);border-color:rgba(0,229,255,0.3);}
          .card{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;}
          ::-webkit-scrollbar{width:3px}
          ::-webkit-scrollbar-thumb{background:#0f2744;border-radius:2px}
        `}</style>

        {/* Header */}
        <div style={{ padding:"20px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:44,height:44,borderRadius:"50%",overflow:"hidden",
              border:"2px solid rgba(0,229,255,0.3)",flexShrink:0 }}>
              {user?.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                : <div style={{ width:"100%",height:"100%",background:"rgba(0,229,255,0.1)",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:"#00e5ff" }}>
                    {(user?.user_metadata?.name||user?.email||"U")[0].toUpperCase()}
                  </div>}
            </div>
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:"0.06em",color:"#f1f5f9",lineHeight:1 }}>
                {user?.user_metadata?.full_name||user?.user_metadata?.name||"Student"}
              </div>
              <div style={{ fontSize:11,color:"#475569",marginTop:3 }}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={handleSignOut}
              style={{ padding:"6px 12px",borderRadius:9,cursor:"pointer",
                border:"1px solid rgba(255,107,107,0.3)",background:"transparent",
                color:"#ff8080",fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:"0.07em",transition:"all 0.2s" }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,107,107,0.08)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>SIGN OUT</button>
            <button onClick={onClose}
              style={{ width:30,height:30,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.1)",
                background:"transparent",cursor:"pointer",color:"#475569",fontSize:14,
                display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
          </div>
        </div>

        {/* Stats row */}
        {!loading && (
          <div style={{ padding:"12px 20px 0",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
            {[
              {label:"STUDY TIME",value:fmtTime(profile?.total_study_seconds||0),color:"#00e5ff"},
              {label:"SESSIONS",value:profile?.total_sessions||0,color:"#00ffb3"},
              {label:"STREAK",value:`${profile?.streak_days||0}🔥`,color:"#f59e0b"},
              {label:"TOPICS",value:progress.length,color:"#b57bee"},
            ].map(s=>(
              <div key={s.label} style={{ padding:"9px 6px",borderRadius:11,textAlign:"center",
                background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:s.color,lineHeight:1,marginBottom:3 }}>{s.value}</div>
                <div style={{ fontSize:7,color:"#334155",fontFamily:"'Space Mono',monospace",letterSpacing:"0.1em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex",gap:4,padding:"12px 20px 0" }}>
          {["overview","sessions","progress"].map(t=>(
            <button key={t} className={`dt${tab===t?" on":""}`} onClick={()=>setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding:"12px 20px 22px" }}>
          {loading ? (
            <div style={{ padding:"40px 0",textAlign:"center" }}>
              <div style={{ width:26,height:26,border:"2px solid rgba(0,229,255,0.2)",borderTopColor:"#00e5ff",
                borderRadius:"50%",margin:"0 auto 12px",animation:"spin 0.9s linear infinite" }}/>
              <p style={{ color:"#334155",fontSize:13 }}>Loading your data...</p>
            </div>
          ) : (
            <>
              {tab==="overview" && (
                <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                  {sessions.length>0 ? (
                    <>
                      <div className="card"><ActivityHeatmap sessions={sessions}/></div>
                      <div className="card"><SessionBars sessions={sessions}/></div>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                        <div className="card"><FreqDonut sessions={sessions}/></div>
                        <div className="card"><FocusSparkline sessions={sessions}/></div>
                      </div>
                    </>
                  ) : (
                    <div className="card" style={{ textAlign:"center",padding:"30px 20px" }}>
                      <div style={{ fontSize:30,marginBottom:10 }}>📊</div>
                      <p style={{ color:"#475569",fontSize:13,lineHeight:1.7 }}>
                        Complete your first Pomodoro session to see your analytics here.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {tab==="sessions" && (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {sessions.length ? sessions.map((s,i)=>(
                    <div key={i} className="card" style={{ padding:"12px 14px" }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0 }}>
                          <div style={{ width:6,height:6,borderRadius:"50%",flexShrink:0,
                            background:FREQ_COLOR[s.freq_key]||"#00e5ff" }}/>
                          <span style={{ fontSize:13,color:"#e2e8f0",fontWeight:500,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{s.material}</span>
                        </div>
                        <span style={{ fontSize:10,color:"#334155",fontFamily:"'Space Mono',monospace",flexShrink:0,marginLeft:8 }}>
                          {fmtTime(s.duration_seconds)}
                        </span>
                      </div>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <span style={{ fontSize:9,color:FREQ_COLOR[s.freq_key]||"#00e5ff",
                          fontFamily:"'Space Mono',monospace",letterSpacing:"0.06em" }}>
                          {s.freq_key?.toUpperCase()}
                        </span>
                        {s.focus_rating>0 && (
                          <div style={{ display:"flex",gap:1 }}>
                            {[1,2,3,4,5].map(n=>(
                              <div key={n} style={{ width:7,height:7,borderRadius:"50%",
                                background:n<=s.focus_rating?"#f59e0b":"rgba(255,255,255,0.08)" }}/>
                            ))}
                          </div>
                        )}
                        {s.voice_questions>0 && <span style={{ fontSize:9,color:"#334155" }}>🎤{s.voice_questions}</span>}
                        <span style={{ fontSize:9,color:"#1e3a5f",fontFamily:"'Space Mono',monospace",marginLeft:"auto" }}>
                          {new Date(s.created_at).toLocaleDateString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                        </span>
                      </div>
                      {s.ai_insight && (
                        <div style={{ marginTop:8,padding:"6px 10px",borderRadius:8,
                          background:"rgba(0,229,255,0.04)",border:"1px solid rgba(0,229,255,0.1)",
                          fontSize:11,color:"#475569",lineHeight:1.5 }}>{s.ai_insight}</div>
                      )}
                    </div>
                  )) : (
                    <div className="card" style={{ textAlign:"center",padding:"28px 0" }}>
                      <p style={{ color:"#475569",fontSize:13 }}>No sessions recorded yet.</p>
                    </div>
                  )}
                </div>
              )}
              {tab==="progress" && (
                <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                  {progress.length>0 && (
                    <div className="card">
                      <div style={{ fontSize:9,color:"#1e3a5f",fontFamily:"'Space Mono',monospace",
                        letterSpacing:"0.14em",marginBottom:10 }}>MASTERY OVERVIEW</div>
                      <div style={{ display:"flex",gap:8 }}>
                        {Object.entries(MASTERY_COLOR).map(([level,color])=>{
                          const count=progress.filter(p=>p.mastery_level===level).length;
                          return (
                            <div key={level} style={{ flex:1,textAlign:"center",padding:"9px 6px",
                              borderRadius:10,background:color+"08",border:`1px solid ${color}22` }}>
                              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color,lineHeight:1 }}>{count}</div>
                              <div style={{ fontSize:7,color:"#334155",fontFamily:"'Space Mono',monospace",
                                letterSpacing:"0.06em",marginTop:3,textTransform:"capitalize" }}>{level}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="card">
                    <div style={{ fontSize:9,color:"#1e3a5f",fontFamily:"'Space Mono',monospace",
                      letterSpacing:"0.14em",marginBottom:12 }}>TOPIC ACCURACY</div>
                    <MasteryBars progress={progress}/>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
