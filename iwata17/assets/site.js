/* NOTE: innerHTML below only ever receives our own static build-time data
   (e-Stat year labels/numbers, KSJ park names embedded by build.py) —
   never user input. Safe in this local static-site context. */
(function(){
"use strict";
const MORI = {};

/* Parse e-Stat Dashboard getData JSON into {labels, values, unit, statName, indicator} */
MORI.parseEstat = function(json){
  const sd = json.GET_STATS.STATISTICAL_DATA;
  const statName = (sd.TABLE_INF.STAT_NAME||[]).map(s=>s["$"]||s).join(" / ");
  let indicator="", unit="";
  const timeMap = {};
  const objs = sd.CLASS_INF.CLASS_OBJ || [];
  objs.forEach(c=>{
    if(c["@id"]==="indicator" && c.CLASS && c.CLASS[0]) indicator = c.CLASS[0]["@name"]||"";
    if(c["@id"]==="unit" && c.CLASS && c.CLASS[0]) unit = c.CLASS[0]["$"]||"";
    if(c["@id"]==="time" && c.CLASS) c.CLASS.forEach(t=>{ timeMap[t["@code"]]=t["@name"]; });
  });
  const rows = (sd.DATA_INF.DATA_OBJ||[]).map(o=>o.VALUE).filter(v=>v&&v["$"]!=="-"&&v["$"]!=="…");
  rows.sort((a,b)=>String(a["@time"]).localeCompare(String(b["@time"])));
  return {
    labels: rows.map(v=>timeMap[v["@time"]]||v["@time"]),
    values: rows.map(v=>parseFloat(v["$"])),
    unit, statName, indicator, count: rows.length
  };
};

/* Render chart + table. Bar if few points, line otherwise. Returns parsed data. */
MORI.renderSeries = function(canvasId, tableId, estatJson, title){
  const d = MORI.parseEstat(estatJson);
  const type = d.count <= 7 ? "bar" : "line";
  const cv = document.getElementById(canvasId);
  if(cv && window.Chart){
    new Chart(cv, {type,
      data:{labels:d.labels, datasets:[{label:title||d.indicator,
        data:d.values, borderWidth:2,
        borderColor:"#1f6feb", backgroundColor:type==="bar"?"rgba(31,111,235,.55)":"rgba(31,111,235,.12)",
        fill:type!=="bar", tension:.15}]},
      options:{responsive:true, plugins:{legend:{display:true}},
        scales:{y:{title:{display:!!d.unit,text:d.unit||""}}}}});
  }
  const tb = document.getElementById(tableId);
  if(tb){
    let h="<thead><tr><th>年次</th><th>"+(d.indicator||"値")+(d.unit?"（"+d.unit+"）":"")+"</th></tr></thead><tbody>";
    d.labels.forEach((l,i)=>{ h+="<tr><td>"+l+"</td><td>"+d.values[i].toLocaleString()+"</td></tr>"; });
    tb.innerHTML = h+"</tbody>";
  }
  return d;
};

/* Base boundary map. boundary = GeoJSON FeatureCollection */
MORI.baseMap = function(elId, boundary, opts){
  opts = opts||{};
  const map = L.map(elId).setView([opts.lat||34.85, opts.lon||137.95], opts.zoom||11);
  L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    {attribution:"国土地理院", maxZoom:18}).addTo(map);
  const layer = L.geoJSON(boundary, {style:{color:"#1f6feb",weight:3,fillOpacity:.12}}).addTo(map);
  try{ map.fitBounds(layer.getBounds(), {padding:[20,20]}); }catch(e){}
  L.control.scale({metric:true,imperial:false}).addTo(map);
  return {map, layer};
};

/* Parks overlay map: boundary base + park points, legend + popups */
MORI.parksMap = function(elId, boundary, parks){
  const r = MORI.baseMap(elId, boundary);
  const pts = L.geoJSON(parks, {
    pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:7,color:"#0a7a3d",fillOpacity:.8}),
    onEachFeature:(f,l)=>{
      const p=f.properties||{};
      l.bindPopup("<b>"+(p.nop||"公園")+"</b><br>面積: "+Number(p.opa||0).toLocaleString()+" m²<br>開設: "+(p.opd_year||"-")+"年");
    }}).addTo(r.map);
  const lg = L.control({position:"bottomright"});
  lg.onAdd = function(){
    const d=L.DomUtil.create("div");
    d.style.cssText="background:#fff;padding:8px 10px;border-radius:8px;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.2)";
    d.innerHTML="<b>凡例</b><br><span style='color:#1f6feb'>―</span> 仮想街いわた境界<br><span style='color:#0a7a3d'>●</span> 都市公園（81か所）";
    return d;
  };
  lg.addTo(r.map);
  return r;
};

window.MORI = MORI;
})();
