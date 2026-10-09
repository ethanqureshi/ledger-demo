/* perf.js. The Analysis tab, derived on every load from data.js.
   Nothing here is typed: every figure is computed off FUNDED, EVAL_ACCOUNTS,
   PAYOUTS and SIGNALS, so the tab moves when a trade is logged.
   Three kinds of trade, as the trader names them:
     winning-day trade  m:"D", 1 contract, banks a winning day on a funded account
     eval trade         any other trade on an eval
     funded trade       any other trade on a funded account
   Loaded after the main script, so its top-level consts are in scope. */
(function(){
  const host=document.getElementById('perfSec'); if(!host) return;
  const FU=(typeof FUNDED!=='undefined'?FUNDED:[]), EV=(typeof EVAL_ACCOUNTS!=='undefined'?EVAL_ACCOUNTS:[]);
  const PAY=(typeof PAYOUTS!=='undefined'?PAYOUTS:[]), SIG=(typeof SIGNALS!=='undefined'?SIGNALS:[]);
  const RE=/balanc\w*\s+from\s+\$?([0-9][0-9,]*(?:\.[0-9]+)?)\s+to\s+(?:exactly\s+)?(?:the\s+)?\$?([0-9][0-9,]*(?:\.[0-9]+)?)/i;
  const num=v=>parseFloat(String(v).replace(/,/g,''));
  const firmOf=a=>String(a.firm).split(' ')[0];
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dOf=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d);};
  const key=dt=>dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  const wk=s=>{const x=dOf(s);x.setDate(x.getDate()-((x.getDay()+6)%7));return key(x);};
  const lab=s=>{const x=dOf(s);return x.getDate()+' '+MON[x.getMonth()];};
  const MINUS='−';
  const money=v=>(v<0?MINUS:'')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});   /* cents, the sitewide format */
  const money2=v=>(v<0?MINUS:'')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const signed=v=>(v>0?'+':'')+money(v);
  const pct=v=>v==null||!isFinite(v)?'n/a':Math.round(v*100)+'%';
  const wr=(typeof WIN_RATE==='function')?WIN_RATE:((w,l)=>w+l?w/(w+l):null);   /* BE excluded, the sitewide rule */

  /* ---------- derive ---------- */
  const T=[];
  EV.concat(FU).forEach(a=>{
    const stage=FU.includes(a)?'funded':'eval';
    (a.trades||[]).forEach((t,i)=>{
      if(!t.d) return;
      const m=t.n&&RE.exec(t.n);
      T.push({a, t, stage, first:i===0, d:t.d, r:t.r, pl:m?Math.round((num(m[2])-num(m[1]))*100)/100:null,
        kind:(t.m==='D')?'day':(stage==='eval'?'eval':'funded')});
    });
  });
  const lastD=T.reduce((m,x)=>x.d>m?x.d:m,'');
  const weeksAll=[...new Set(T.map(x=>wk(x.d)))].sort();

  const byKind=k=>T.filter(x=>x.kind===k);
  const rec=rows=>{let w=0,l=0,be=0;rows.forEach(x=>{if(x.r==='Win')w++;else if(x.r==='Loss')l++;else be++;});return {w,l,be};};
  const median=v=>{const x=v.slice().sort((a,b)=>a-b),h=x.length>>1;return x.length?(x.length%2?x[h]:(x[h-1]+x[h])/2):null;};
  /* break-even from the MEAN win and loss, which is what P/L runs on, with the
     median alongside as a check on whether a few large fills carry the mean */
  const breakeven=rows=>{const W=rows.filter(x=>x.r==='Win'&&x.pl!=null).map(x=>x.pl), L=rows.filter(x=>x.r==='Loss'&&x.pl!=null).map(x=>-x.pl);
    if(!W.length||!L.length) return null; const aw=W.reduce((s,v)=>s+v,0)/W.length, al=L.reduce((s,v)=>s+v,0)/L.length, mw=median(W), ml=median(L);
    const top2=W.slice().sort((a,b)=>b-a).slice(0,2).reduce((s,v)=>s+v,0), sumW=W.reduce((s,v)=>s+v,0);
    return {aw,al,be:al/(aw+al),mw,ml,beMed:ml/(mw+ml),nW:W.length,nL:L.length,carried:(aw>1.25*mw)||(W.length>=4&&top2/sumW>0.6)};};
  const weekly=rows=>weeksAll.map(w=>{const r=rec(rows.filter(x=>wk(x.d)===w));return Object.assign({wk:w},r,{rate:wr(r.w,r.l)});});

  /* money */
  const spendRows=EV.filter(a=>a.bought&&a.cost>0).map(a=>({d:a.bought,v:a.cost}));
  const payRows=PAY.filter(p=>p.amount>0&&p.d).map(p=>({d:p.d,v:p.amount}));
  const spend=spendRows.reduce((s,x)=>s+x.v,0), recv=payRows.reduce((s,x)=>s+x.v,0);
  const mWeeks=[...new Set(spendRows.concat(payRows).map(x=>wk(x.d)))].sort();
  let run=0;
  const flow=mWeeks.map(w=>{const s=spendRows.filter(x=>wk(x.d)===w).reduce((a,x)=>a+x.v,0), p=payRows.filter(x=>wk(x.d)===w).reduce((a,x)=>a+x.v,0);run+=p-s;return {w,s,p,run};});
  /* the same money by calendar month, 2026-09-24, by request */
  const mo=d=>String(d).slice(0,7), moLab=m=>MON[+m.slice(5,7)-1]+' '+m.slice(0,4);
  let runM=0;
  const mSeen=[...new Set(spendRows.concat(payRows).map(x=>mo(x.d)))].sort(), mAll=[];
  /* every month from the first to the last, an empty one shown as empty */
  if(mSeen.length){ let [yy,mm]=mSeen[0].split('-').map(Number); const end=mSeen[mSeen.length-1];
    for(;;){ const k=yy+'-'+String(mm).padStart(2,'0'); mAll.push(k); if(k>=end) break; mm++; if(mm>12){mm=1;yy++;} } }
  const flowM=mAll.map(m=>{const s=spendRows.filter(x=>mo(x.d)===m).reduce((a,x)=>a+x.v,0), p=payRows.filter(x=>mo(x.d)===m).reduce((a,x)=>a+x.v,0);runM+=p-s;return {m,s:+s.toFixed(2),p:+p.toFixed(2),run:+runM.toFixed(2)};});

  /* evals decided, by the week of their last trade */
  /* an eval terminated by the firm is out of every pass rate, 2026-10-01: PASS_DECIDED, index.html */
  const decided=EV.filter(a=>(typeof PASS_DECIDED==='function'?PASS_DECIDED(a):(a.status==='passed'||a.status==='blown')));
  const dated=decided.filter(a=>(a.trades||[]).some(t=>t.d));
  const lastOf=a=>(a.trades||[]).filter(t=>t.d).map(t=>t.d).sort().pop();
  /* by the MONTH of the eval's last trade, 2026-09-28 by request; it was by week */
  const passW=[...new Set(dated.map(a=>mo(lastOf(a))))].sort().map(w=>{const g=dated.filter(a=>mo(lastOf(a))===w);const p=g.filter(a=>a.status==='passed').length;return {w,p,n:g.length,rate:p/g.length};});
  const passAll=decided.filter(a=>a.status==='passed').length;
  const firms=[...new Set(EV.map(firmOf))].map(f=>{const g=decided.filter(a=>firmOf(a)===f), p=g.filter(a=>a.status==='passed').length,
    cost=EV.filter(a=>firmOf(a)===f).reduce((s,a)=>s+(a.cost||0),0);return {f,p,n:g.length,rate:g.length?p/g.length:null,cpp:p?cost/p:null};})
    .filter(x=>x.n>=5).sort((a,b)=>b.rate-a.rate);

  /* first trade on an eval, then what happened */
  const firstOut=['Win','Loss'].map(r=>{const g=decided.filter(a=>a.trades&&a.trades[0]&&a.trades[0].r===r);
    return {k:r==='Win'?'First trade won':'First trade lost',pass:g.filter(a=>a.status==='passed').length,blown:g.filter(a=>a.status==='blown').length};});

  /* days */
  const dayKeys=[...new Set(T.map(x=>x.d))].sort();
  const days=dayKeys.map(d=>{const g=T.filter(x=>x.d===d);return {d,v:g.reduce((s,x)=>s+(x.pl||0),0),partial:g.some(x=>x.pl==null),priced:g.some(x=>x.pl!=null)};})
    .filter(x=>x.priced).slice(-20);

  /* NY AM timing, eval and funded trades */
  const buckets=[['Before 9:30',-1e9,0],['9:30 to 9:44',0,15],['9:45 to 10:14',15,45],['10:15 to 10:59',45,90],['11:00 on',90,1e9]].map(([k,lo,hi])=>({k,lo,hi,w:0,l:0}));
  T.filter(x=>x.kind!=='day'&&x.t.s==='NY AM').forEach(x=>{const m=/(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(x.t.t||'');if(!m)return;
    const mins=(+m[1])*60+(+m[2])-570, b=buckets.find(b=>mins>=b.lo&&mins<b.hi);if(!b)return;if(x.r==='Win')b.w++;else if(x.r==='Loss')b.l++;});

  /* groups: one read on many accounts */
  const groups=SIG.filter(s=>s.kind==='one'&&s.rec).map(s=>{const m=/(\d+)W (\d+)L/.exec(s.rec);return m?{w:+m[1],l:+m[2]}:null;}).filter(Boolean);
  const gWin=groups.filter(g=>g.l===0).length, gLoss=groups.filter(g=>g.w===0).length;

  const E=byKind('eval'), F=byKind('funded'), DY=byKind('day');
  const eRec=rec(E), fRec=rec(F), dRec=rec(DY);
  const eBE=breakeven(E), fBE=breakeven(F), dBE=breakeven(DY);
  /* EVAL BREAK-EVEN BY FIRM, 2026-09-29 by request. One blended figure mixed two
     shapes: Lucid and Topstep at 25 stop / 38 target break even near 40 percent,
     the FundedNext fullport at 37.5 stop / 25 target near 56, and the blend read
     47. Each firm is read off its own eval trades; a firm with under 10 is left
     out as too few to price. */
  const eFirmBE=[...new Set(E.map(x=>firmOf(x.a)))].map(f=>{const g=E.filter(x=>firmOf(x.a)===f),r=rec(g),b=breakeven(g);
    return {f,n:g.length,rate:wr(r.w,r.l),be:b?b.be:null};}).filter(x=>x.n>=10&&x.be!=null).sort((a,b)=>b.n-a.n);
  /* the verdict prints each firm as a row: its win rate, the rate it needs,
     and how far over or short, in points, 2026-09-29 by request */
  const pct1=v=>v==null?'n/a':(Math.round(v*1000)/10).toFixed(1)+'%';   /* always one decimal, 41.0 not 41 */
  const beGrid=()=>'<div class="pf-be"><span class="h">Firm</span><span class="h r">Win rate</span><span class="h r">Break-even</span>'
    +eFirmBE.map(x=>'<span>'+x.f+'</span><span class="r '+(x.rate<x.be?'neg':'pos')+'">'+pct1(x.rate)+'</span><span class="r">'+pct1(x.be)+'</span>').join('')+'</div>';
  const beFirmTxt=(you)=>eFirmBE.map(x=>x.f+' '+pct(x.be)+(you?' (you '+pct(x.rate)+')':'')).join(', ');
  const eW=weekly(E), fW=weekly(F), dW=weekly(DY);
  /* trade win rate by calendar month, 2026-09-29 by request, beside the pass
     rate by month: eval, funded and winning-day trades, BE excluded */
  const monthsAll=[...new Set(T.map(x=>mo(x.d)))].sort();
  const winM=monthsAll.map(m=>{const r={m};[['e',E],['f',F],['d',DY]].forEach(([k,rows])=>{const q=rec(rows.filter(x=>mo(x.d)===m));r[k]=Object.assign(q,{rate:wr(q.w,q.l)});});return r;});
  const lastW=weeksAll[weeksAll.length-1], prevW=weeksAll.slice(-2);
  const recIn=(rows,ws)=>rec(rows.filter(x=>ws.includes(wk(x.d))));
  const fundFirst=rec(FU.filter(a=>a.trades&&a.trades.length).map(a=>({r:a.trades[0].r})));
  const fundDead=FU.filter(a=>a.status==='blown'), fundDeadFirstLoss=fundDead.filter(a=>a.trades&&a.trades[0]&&a.trades[0].r==='Loss').length;
  const fLast2=recIn(F,prevW), eLast=recIn(E,[lastW]), eLast2=recIn(E,prevW), ePrev2=recIn(E,weeksAll.slice(-4,-2));
  const firmPL=[...new Set(T.map(x=>firmOf(x.a)))].map(f=>{const g=T.filter(x=>firmOf(x.a)===f&&x.kind!=='day');const r=rec(g);
    return {f,pl:g.reduce((s,x)=>s+(x.pl||0),0),rate:wr(r.w,r.l),n:g.length};}).filter(x=>x.n>=10).sort((a,b)=>a.pl-b.pl);
  const worstB=buckets.filter(b=>b.w+b.l>=10).sort((a,b)=>wr(a.w,a.l)-wr(b.w,b.l))[0];

  /* funded P/L, priced trades only, from the one funded trade set */
  const fPriced=F.filter(x=>x.pl!=null), fNet=fPriced.reduce((s,x)=>s+x.pl,0);

  /* ---------- sentinel ---------- */
  const fails=[], check=(ok,msg)=>{if(!ok)fails.push(msg);console.assert(ok,'ANALYSIS SENTINEL: '+msg);};
  const trades=EV.concat(FU).reduce((s,a)=>s+(a.trades||[]).filter(t=>t.d).length,0);
  check(E.length+F.length+DY.length===trades, 'trade kinds hold '+(E.length+F.length+DY.length)+' of '+trades+' trades');
  check(Math.abs(flow.length?flow[flow.length-1].run-(recv-spend):0)<0.005, 'running net does not end at received less spend');
  check(passW.reduce((s,x)=>s+x.p,0)<=passAll, 'monthly passes exceed passes recorded');
  check(eFirmBE.length>0 && eFirmBE.reduce((s,x)=>s+x.n,0)<=E.length && eFirmBE.every(x=>x.be>0&&x.be<1), 'eval break-even by firm must be priced off the eval trades of each firm');
  /* the monthly win rates hold every trade once, and agree with the Money tab's Performance by month */
  check(['e','f','d'].every(k=>{const t=winM.reduce((a,r)=>({w:a.w+r[k].w,l:a.l+r[k].l,be:a.be+r[k].be}),{w:0,l:0,be:0}), o={e:eRec,f:fRec,d:dRec}[k];return t.w===o.w&&t.l===o.l&&t.be===o.be;}),
    'monthly win rates do not add up to the eval, funded and winning-day records');
  if(typeof MONTHLY_PERF!=='undefined') check(winM.every(r=>{const p=MONTHLY_PERF.find(x=>x.k===r.m);return !!p&&p.eval.w===r.e.w&&p.eval.l===r.e.l&&p.funded.w===r.f.w&&p.funded.l===r.f.l&&p.day.w===r.d.w&&p.day.l===r.d.l;}),
    'monthly win rates disagree with the Money tab Performance by month');
  check(firstOut.reduce((s,x)=>s+x.pass+x.blown,0)<=decided.length, 'first-trade outcomes exceed decided evals');
  /* FUNDED P/L IS DERIVED ONE WAY, 2026-09-23. On 9/23 two figures circulated:
     8W 21L 3BE at minus 3,321.46 (target trades only, the two overnight limit
     trades dropped) and 9W 22L 3BE. The funded trade set is FUNDED_TRADES in the
     main script, and this tab must hold exactly that set, trade for trade, with
     the same record and the same priced net; and no funded trade may carry a
     mode outside T, O and D, so a new mode cannot fall between the two. */
  if(typeof FUNDED_TRADES==='function'){
    const G=FUNDED_TRADES().filter(x=>x.t.d), gRec=rec(G.map(x=>({r:x.t.r})));
    const gNet=G.reduce((s,x)=>{const m=x.t.n&&RE.exec(x.t.n);return s+(m?num(m[2])-num(m[1]):0);},0);
    check(G.length===F.length && gRec.w===fRec.w && gRec.l===fRec.l && gRec.be===fRec.be,
      'funded trades derived two ways: the Funded tab set holds '+G.length+' ('+gRec.w+'W '+gRec.l+'L '+gRec.be+'BE), this tab '+F.length+' ('+fRec.w+'W '+fRec.l+'L '+fRec.be+'BE)');
    check(Math.abs(gNet-fNet)<0.005, 'funded P/L derived two ways: '+gNet.toFixed(2)+' against '+fNet.toFixed(2));
    check(F.every(x=>F.includes(x)&&G.some(g=>g.t===x.t)), 'a funded trade on this tab is not in FUNDED_TRADES');
  } else check(false,'FUNDED_TRADES is not defined, so funded P/L has no single definition');
  FU.forEach(a=>(a.trades||[]).forEach(t=>check(['T','O','D'].includes(t.m||'T'), a.id+' '+(t.t||t.d)+' carries trade mode '+t.m+', outside T, O and D')));

  /* ---------- render: text ---------- */
  const $=id=>document.getElementById(id);
  const net=recv-spend, roi=spend?recv/spend:null;
  const trend=(a,b)=>a==null||b==null?'flat':b>a+0.03?'up':b<a-0.03?'down':'flat';
  const chip=(dir)=>dir==='up'?'<span class="pf-chip good">Improving</span>':dir==='down'?'<span class="pf-chip bad">Slipping</span>':'<span class="pf-chip warn">Holding</span>';
  const eTr=trend(wr(ePrev2.w,ePrev2.l),wr(eLast2.w,eLast2.l));
  const dPrev=recIn(DY,weeksAll.slice(-4,-2)), dLast=recIn(DY,prevW), dTr=trend(wr(dPrev.w,dPrev.l),wr(dLast.w,dLast.l));
  const mPrev=flow.length>2?flow[flow.length-3].run:0, mTr=net>mPrev?'up':net<mPrev?'down':'flat';
  $('pfAsOf').textContent='Book through '+lab(lastD)+' '+lastD.slice(0,4)+' · '+T.length+' trades';
  $('pfVerdict').innerHTML=
    '<div class="pf-v">'+chip(mTr)+'<h4>Real money</h4><p><b>'+money(recv)+'</b> received, <b>'+signed(net)+'</b> profit on '+money(spend)+' spent; '+(roi!=null?roi.toFixed(2)+'x':'n/a')+' back.</p></div>'
   +'<div class="pf-v">'+chip(dTr)+'<h4>Winning-day trades</h4><p>'+pct(wr(dPrev.w,dPrev.l))+' → <b>'+pct(wr(dLast.w,dLast.l))+'</b> over the last two weeks against the two before.</p></div>'
   +'<div class="pf-v">'+chip(eTr)+'<h4>Eval trades</h4><p>Last two weeks <b>'+pct(wr(eLast2.w,eLast2.l))+'</b>, '+(wr(eLast2.w,eLast2.l)<wr(ePrev2.w,ePrev2.l)?'down':'up')+' from '+pct(wr(ePrev2.w,ePrev2.l))+' the two weeks before.</p>'+beGrid()+'</div>';
  const k=(l,v,d,cls)=>'<div class="pf-kpi"><span class="l">'+l+'</span><span class="v'+(cls?' '+cls:'')+'">'+v+'</span><span class="d">'+d+'</span></div>';
  $('pfKpis').innerHTML=
     k('Eval trade win rate',pct(wr(eRec.w,eRec.l)),'this week '+pct(wr(eLast.w,eLast.l))+' · break-even by firm above')
    +k('Funded trade win rate',pct(wr(fRec.w,fRec.l)),'break-even '+pct(fBE&&fBE.be)+' · '+fRec.w+'W '+fRec.l+'L '+fRec.be+'BE')
    +k('Winning-day win rate',pct(wr(dRec.w,dRec.l)),'break-even '+pct(dBE&&dBE.be)+' · '+dRec.w+'W '+dRec.l+'L');


  /* ---------- charts ---------- */
  const NS='http://www.w3.org/2000/svg';
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const el=(tag,attrs,parent)=>{const e=document.createElementNS(NS,tag);for(const a in attrs)e.setAttribute(a,attrs[a]);if(parent)parent.appendChild(e);return e;};
  const HALO=()=>({'paint-order':'stroke',stroke:css('--panel'),'stroke-width':4,'stroke-linejoin':'round'});
  const txt=(parent,x,y,s,o)=>{const t=el('text',Object.assign({x,y,'font-size':11.5,fill:css('--ink-4'),'font-family':css('--ui')},o||{}),parent);t.textContent=s;return t;};
  let tip=document.getElementById('pfTip'); if(!tip){tip=document.createElement('div');tip.id='pfTip';tip.setAttribute('role','tooltip');document.body.appendChild(tip);}
  const bindTip=(node,html)=>{node.setAttribute('tabindex','0');node.setAttribute('aria-label',html.replace(/<[^>]+>/g,' '));
    const show=(x,y)=>{tip.innerHTML=html;tip.classList.add('on');const r=tip.getBoundingClientRect();let L=x+14,Tt=y-r.height-12;if(L+r.width>innerWidth-8)L=x-r.width-14;if(Tt<8)Tt=y+16;tip.style.left=L+'px';tip.style.top=Tt+'px';};
    node.addEventListener('mousemove',e=>show(e.clientX,e.clientY));node.addEventListener('mouseleave',()=>tip.classList.remove('on'));
    node.addEventListener('focus',()=>{const b=node.getBoundingClientRect();show(b.left+b.width/2,b.top);});node.addEventListener('blur',()=>tip.classList.remove('on'));};
  const ticksOf=(lo,hi,c)=>{const sp=hi-lo||1,s0=sp/c,mg=Math.pow(10,Math.floor(Math.log10(s0))),f=s0/mg,st=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*mg,out=[];
    for(let v=Math.floor(lo/st)*st;v<=hi+1e-9;v+=st)out.push(+v.toFixed(6));if(out[out.length-1]<hi)out.push(out[out.length-1]+st);return out;};
  const frame=(id,h,padL)=>{const hst=$(id);if(!hst)return null;hst.innerHTML='';const W=hst.clientWidth;if(W<50)return null;
    const svg=el('svg',{viewBox:'0 0 '+W+' '+h,width:W,height:h,role:'img'},hst);return {svg,W,H:h,small:W<480,pad:{l:padL,r:12,t:18,b:30}};};
  const yAxis=(f,ticks,y,fmt)=>ticks.forEach(v=>{el('line',{x1:f.pad.l,x2:f.W-f.pad.r,y1:y(v),y2:y(v),stroke:v===0?css('--ink-4'):css('--edge-soft'),'stroke-width':1},f.svg);txt(f.svg,f.pad.l-8,y(v)+4,fmt(v),{'text-anchor':'end'});});
  const xLab=(f,cats,x,every)=>cats.forEach((c,i)=>{const last=i===cats.length-1;if(every>1&&i%every&&!(last&&(i%every)>every/2))return;txt(f.svg,x(i),f.H-8,c,{'text-anchor':'middle'});});
  const col=(x,y0,w,y1)=>{const up=y1<y0,h=Math.abs(y1-y0),r=Math.min(4,h,w/2);if(h<0.5)return '';
    return up?`M${x},${y0}V${y1+r}Q${x},${y1} ${x+r},${y1}H${x+w-r}Q${x+w},${y1} ${x+w},${y1+r}V${y0}Z`:`M${x},${y0}V${y1-r}Q${x},${y1} ${x+r},${y1}H${x+w-r}Q${x+w},${y1} ${x+w},${y1-r}V${y0}Z`;};
  const hb=(x0,y,x1,h)=>{const w=x1-x0,r=Math.min(4,w,h/2);if(w<0.5)return '';return `M${x0},${y}H${x1-r}Q${x1},${y} ${x1},${y+r}V${y+h-r}Q${x1},${y+h} ${x1-r},${y+h}H${x0}Z`;};
  /* cents on every dollar figure, axis ticks and bar labels included, 2026-10-01 by request */
  const kfmt=t=>money(t);
  const hit=(f,x0,w)=>el('rect',{x:x0,y:f.pad.t,width:w,height:f.H-f.pad.t-f.pad.b,fill:'transparent'},f.svg);
  const table=(id,head,rows)=>{const e=$(id);if(e)e.innerHTML='<table><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>';};

  function cCum(){const f=frame('pfCum',250,84);if(!f||!flow.length)return;const v=flow.map(x=>x.run),n=v.length,tk=ticksOf(Math.min(0,...v),Math.max(0,...v),4),lo=tk[0],hi=tk[tk.length-1];
    const x=i=>f.pad.l+14+i*(f.W-f.pad.l-f.pad.r-28)/Math.max(1,n-1),y=val=>f.pad.t+(hi-val)/(hi-lo)*(f.H-f.pad.t-f.pad.b);
    yAxis(f,tk,y,kfmt);
    /* 2026-10-07 by request: skip labels until each date has about 50px, so neighbours never overlap */
    xLab(f,flow.map(x=>lab(x.w)),x,Math.max(1,Math.ceil(50*Math.max(1,n-1)/Math.max(1,f.W-f.pad.l-f.pad.r-28))));const pts=v.map((val,i)=>[x(i),y(val)]);
    el('path',{d:'M'+pts.join('L')+`L${x(n-1)},${y(0)}L${x(0)},${y(0)}Z`,fill:css('--pf-s1'),'fill-opacity':.1},f.svg);
    el('path',{d:'M'+pts.join('L'),fill:'none',stroke:css('--pf-s1'),'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round'},f.svg);
    const hw=(f.W-f.pad.l-f.pad.r)/Math.max(1,n-1);
    pts.forEach((p,i)=>{el('circle',{cx:p[0],cy:p[1],r:i===n-1?5:3.5,fill:css('--pf-s1'),stroke:css('--panel'),'stroke-width':2},f.svg);
      bindTip(hit(f,p[0]-hw/2,hw),'<b>Week of '+lab(flow[i].w)+'</b><br>Running net '+money2(flow[i].run)+'<br>Spent '+money2(flow[i].s)+' · Paid '+money2(flow[i].p));});
    txt(f.svg,pts[n-1][0]-8,pts[n-1][1]-12,signed(v[n-1]),{'text-anchor':'end','font-size':13,'font-weight':600,fill:css('--ink')});
    table('pfCumT',['Week of','Spent','Paid out','Running net'],flow.map(x=>[lab(x.w),money2(x.s),money2(x.p),money2(x.run)]));}
  /* the weekly spent vs paid out chart was removed 2026-09-29 by request; the
     monthly one below carries it. flow stays: the running net reads it. */
  /* ROI per month, 2026-09-24, by request: paid out over spent, a multiple, as the
     Money tab's monthly table prints it; n/a for a month with no spend */
  const roiX=r=>r.s>0?(r.p/r.s).toFixed(2)+'x':'n/a';
  function cFlowM(){const f=frame('pfFlowM',270,84);if(!f||!flowM.length)return;f.pad.t=Math.max(f.pad.t,f.small?42:34);const n=flowM.length,tk=ticksOf(0,Math.max(...flowM.map(x=>Math.max(x.s,x.p)))*1.08,4),top=tk[tk.length-1];
    /* a phone column is narrower than a net figure with its cents: the nets sit on two staggered rows, so the plot starts lower */
    if(f.small)f.pad.t=48;
    const band=(f.W-f.pad.l-f.pad.r)/n,bw=Math.max(8,Math.min(46,(band-24)/2)),x=i=>f.pad.l+band*i+band/2,y=v=>f.pad.t+(top-v)/top*(f.H-f.pad.t-f.pad.b);
    yAxis(f,tk,y,kfmt);xLab(f,flowM.map(r=>f.small?MON[+r.m.slice(5,7)-1]:moLab(r.m)),x,1);
    flowM.forEach((r,i)=>{const a=col(x(i)-bw-2,y(0),bw,y(r.s)),b=col(x(i)+2,y(0),bw,y(r.p));
      if(a)el('path',{d:a,fill:css('--ink-4')},f.svg);if(b)el('path',{d:b,fill:css('--pf-s1')},f.svg);
      /* each figure hangs off the gap between the two bars, spent to the left of it and paid out to the right, so two figures with cents never meet */
      const vl=(v,cx,an)=>{if(v>0&&!f.small)txt(f.svg,cx,y(v)-7,kfmt(v),{'text-anchor':an,'font-size':11.5,'font-weight':600,fill:css('--ink-2')});};
      vl(r.s,x(i)-3,'end');vl(r.p,x(i)+3,'start');
      /* a phone column is too narrow for net and ROI on one line: ROI goes under it */
      const net=r.p-r.s,nc={'text-anchor':'middle','font-size':f.small?11.5:12.5,'font-weight':700,fill:net>=0?css('--pf-pos'):css('--pf-neg')};
      if(f.small){const lastC=i===n-1&&n>1;txt(f.svg,lastC?f.W-1:x(i),i%2?25:12,(Math.abs(net)<0.005?'':net<0?MINUS:'+')+money(Math.abs(net)),Object.assign({},nc,{'font-size':10.5},lastC?{'text-anchor':'end'}:{}));txt(f.svg,x(i),40,roiX(r),Object.assign({},nc,{'font-weight':600,fill:css('--ink-2')}));}
      else txt(f.svg,x(i),16,(net>0?'+':'')+money(net)+' · '+roiX(r),nc);
      bindTip(hit(f,x(i)-band/2,band),'<b>'+moLab(r.m)+'</b><br>Spent '+money2(r.s)+'<br>Paid out '+money2(r.p)+'<br>Net '+signed(net)+'<br>ROI '+roiX(r)+'<br>Running net '+money2(r.run));});
    table('pfFlowMT',['Month','Spent','Paid out','Net','ROI','Running net'],flowM.map(r=>[moLab(r.m),money2(r.s),money2(r.p),signed(r.p-r.s),roiX(r),money2(r.run)]));}
  function cPass(){const f=frame('pfPass',250,44);if(!f||!passW.length)return;if(f.small)f.pad.t=34;const n=passW.length,band=(f.W-f.pad.l-f.pad.r)/n,bw=Math.min(24,band*.5);
    const x=i=>f.pad.l+band*i+band/2,y=v=>f.pad.t+(1-v)*(f.H-f.pad.t-f.pad.b);yAxis(f,[0,.25,.5,.75,1],y,pct);xLab(f,passW.map(x=>moLab(x.w)),x,1);
    const avg=passAll/decided.length;el('line',{x1:f.pad.l,x2:f.W-f.pad.r,y1:y(avg),y2:y(avg),stroke:css('--ink-4'),'stroke-width':1.5,'stroke-dasharray':'4 4'},f.svg);
    if(f.small){el('line',{x1:f.pad.l,x2:f.pad.l+18,y1:10,y2:10,stroke:css('--ink-4'),'stroke-width':1.5,'stroke-dasharray':'4 4'},f.svg);
      txt(f.svg,f.pad.l+24,14,'All-time '+pct(avg),{fill:css('--ink-2')});}
    else txt(f.svg,f.W-f.pad.r,y(avg)-6,'All-time '+pct(avg),{'text-anchor':'end',fill:css('--ink-2')});
    const peak=passW.reduce((m,x,i)=>x.rate>passW[m].rate?i:m,0);
    passW.forEach((r,i)=>{const d=col(x(i)-bw/2,y(0),bw,y(r.rate));if(d)el('path',{d,fill:css('--pf-s1'),'fill-opacity':i===peak||i===n-1?1:.5},f.svg);
      txt(f.svg,x(i),y(r.rate)-7,pct(r.rate),Object.assign({'text-anchor':'middle','font-size':12,'font-weight':600,fill:css('--ink')},HALO()));
      bindTip(hit(f,x(i)-band/2,band),'<b>'+moLab(r.w)+'</b><br>'+r.p+' passed of '+r.n+' decided');});
    table('pfPassT',['Month decided','Passed','Blown','Pass rate'],passW.map(x=>[moLab(x.w),x.p,x.n-x.p,pct(x.rate)]));}
  function cFirm(){const sm=($('pfFirm')||{}).clientWidth<480,rowH=sm?64:48,f=frame('pfFirm',firms.length*rowH+34,96);if(!f)return;f.pad.r=sm?12:120;const mx=Math.max(.5,...firms.map(x=>x.rate));
    const x=v=>f.pad.l+v*(f.W-f.pad.l-f.pad.r)/mx;const tk=(sm?[0,.25,.5,.75,1]:[0,.1,.2,.3,.4,.5]).filter(t=>t<=mx+1e-9);
    tk.forEach(t=>{el('line',{x1:x(t),x2:x(t),y1:8,y2:firms.length*rowH+8,stroke:css('--edge-soft')},f.svg);txt(f.svg,x(t),firms.length*rowH+26,pct(t),{'text-anchor':'middle'});});
    firms.forEach((r,i)=>{const yy=14+i*rowH;txt(f.svg,f.pad.l-10,yy+13,r.f,{'text-anchor':'end','font-size':13,'font-weight':500,fill:css('--ink')});
      const d=hb(x(0),yy,x(r.rate),20);if(d)el('path',{d,fill:css('--pf-s1'),'fill-opacity':i===0?1:.5},f.svg);
      txt(f.svg,sm?x(0):x(r.rate)+8,sm?yy+40:yy+14,pct(r.rate)+' ('+r.p+'/'+r.n+')',{'font-size':12.5,'font-weight':600,fill:css('--ink')});
      txt(f.svg,f.W-4,sm?yy+40:yy+14,r.cpp?money(r.cpp)+' / pass':'no pass',{'text-anchor':'end','font-size':12.5,fill:css('--ink-2')});
      const h=el('rect',{x:0,y:yy-8,width:f.W,height:rowH-8,fill:'transparent'},f.svg);bindTip(h,'<b>'+r.f+'</b><br>'+r.p+' passed of '+r.n+' decided<br>'+(r.cpp?money2(r.cpp)+' spent per pass':''));});
    table('pfFirmT',['Firm','Passed','Decided','Pass rate','Cost per pass'],firms.map(r=>[r.f,r.p,r.n,pct(r.rate),r.cpp?money2(r.cpp):'n/a']));}
  function cWinM(){const f=frame('pfWinM',250,44);if(!f||!winM.length)return;f.pad.b=44;if(f.small)f.pad.t=20;const n=winM.length,band=(f.W-f.pad.l-f.pad.r)/n;
    const S=[['e','Eval',css('--pf-s1')],['f','Funded',css('--blue')],['d','Winning-day',css('--pf-s2')]],bw=Math.min(22,band*.8/3);
    const x=i=>f.pad.l+band*i+band/2,y=v=>f.pad.t+(1-v)*(f.H-f.pad.t-f.pad.b);yAxis(f,[0,.25,.5,.75,1],y,pct);
    winM.forEach((r,i)=>{S.forEach(([k,,c],j)=>{const q=r[k],cx=x(i)+(j-1)*(bw+3);if(q.rate==null)return;const d=col(cx-bw/2,y(0),bw,y(q.rate));
        if(d)el('path',{d,fill:c},f.svg);else el('line',{x1:cx-bw/2,x2:cx+bw/2,y1:y(0),y2:y(0),stroke:c,'stroke-width':3,'stroke-linecap':'round'},f.svg);
        if(!f.small||n<4)txt(f.svg,cx,y(q.rate)-6,pct(q.rate),Object.assign({'text-anchor':'middle','font-size':11,'font-weight':600,fill:css('--ink')},HALO()));});
      txt(f.svg,x(i),y(0)+18,moLab(r.m),{'text-anchor':'middle'});
      bindTip(hit(f,x(i)-band/2,band),'<b>'+moLab(r.m)+'</b>'+S.map(([k,nm])=>'<br>'+nm+' '+r[k].w+'W '+r[k].l+'L'+(r[k].be?' '+r[k].be+'BE':'')+' · '+(r[k].rate==null?'n/a':pct(r[k].rate))).join(''));});
    table('pfWinMT',['Month','Eval','Win rate','Funded','Win rate','Winning-day','Win rate'],winM.map(r=>[moLab(r.m)].concat(...['e','f','d'].map(k=>[r[k].w+'W '+r[k].l+'L'+(r[k].be?' '+r[k].be+'BE':''),r[k].rate==null?'n/a':pct(r[k].rate)]))));}
  function cTime(){const rowH=38,f=frame('pfTime',buckets.length*rowH+34,108);if(!f)return;f.pad.r=f.small?60:80;
    const x=v=>f.pad.l+v*(f.W-f.pad.l-f.pad.r-44);(f.small?[0,.5,1]:[0,.25,.5,.75,1]).forEach(t=>{el('line',{x1:x(t),x2:x(t),y1:6,y2:buckets.length*rowH+6,stroke:css('--edge-soft')},f.svg);txt(f.svg,x(t),buckets.length*rowH+24,pct(t),{'text-anchor':'middle'});});
        buckets.forEach((b,i)=>{const yy=10+i*rowH,r=wr(b.w,b.l);txt(f.svg,f.pad.l-10,yy+13,b.k,{'text-anchor':'end','font-size':12.5,fill:css('--ink')});
      if(r!=null){const d=hb(x(0),yy,x(r),18);if(d)el('path',{d,fill:css('--pf-s1')},f.svg);txt(f.svg,x(r)+8,yy+13,pct(r),Object.assign({'font-size':12.5,'font-weight':600,fill:css('--ink')},HALO()));}
      txt(f.svg,f.W-4,yy+13,b.w+'W '+b.l+'L',{'text-anchor':'end','font-size':12});
      bindTip(el('rect',{x:0,y:yy-8,width:f.W,height:rowH-4,fill:'transparent'},f.svg),'<b>'+b.k+' ET</b><br>'+b.w+'W '+b.l+'L · '+pct(r));});
    table('pfTimeT',['Entry time, ET','Won','Lost','Win rate'],buckets.map(b=>[b.k,b.w,b.l,pct(wr(b.w,b.l))]));}

  const all=()=>{if(!host.classList.contains('show'))return;cCum();cFlowM();cPass();cFirm();cWinM();cTime();};
  new MutationObserver(all).observe(host,{attributes:true,attributeFilter:['class']});
  new MutationObserver(all).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(all,120);});
  /* a chart drawn inside a closed fold has no width; the fold calls this when it opens */
  window.PF_RENDER=all;
  all();

  if(fails.length){const w=document.createElement('div');w.className='alwarn';w.innerHTML='<b>ANALYSIS SENTINEL FAILED.</b> '+fails.join(' · ');host.prepend(w);}
  console.log('ANALYSIS '+(fails.length?fails.length+' FAILED':'ok')+' · '+T.length+' trades: '+E.length+' eval, '+F.length+' funded, '+DY.length+' winning-day'
    +' · funded set one way, '+fRec.w+'W '+fRec.l+'L '+fRec.be+'BE, priced net '+money2(fNet)+' on '+fPriced.length+' of '+F.length+' · net '+money2(net)+' · eval '+eRec.w+'W '+eRec.l+'L break-even '+beFirmTxt(true)+' (blended '+pct(eBE&&eBE.be)+')'+' · funded '+fRec.w+'W '+fRec.l+'L break-even '+pct(fBE&&fBE.be)
    +' · winning-day '+dRec.w+'W '+dRec.l+'L break-even '+pct(dBE&&dBE.be)+' · passes '+passAll+' of '+decided.length);
})();
