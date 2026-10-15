// Screen-space grouping keeps distant cities separate as the map is zoomed in.
// Complete-link distance prevents chains of neighbors from swallowing a continent.
export function clusterPoints(entries,project,radius=64) {
  const groups=[];
  for(const entry of entries){
    if(!Number.isFinite(Number(entry.latitude))||!Number.isFinite(Number(entry.longitude)))continue;
    const p=project(entry),position={x:p.x,y:p.y};
    const group=groups.find(g=>g.positions.every(other=>Math.hypot(position.x-other.x,position.y-other.y)<radius));
    if(group){group.items.push(entry);group.positions.push(position);}
    else groups.push({items:[entry],positions:[position]});
  }
  return groups.map(g=>({items:g.items,latitude:g.items.reduce((s,p)=>s+Number(p.latitude),0)/g.items.length,longitude:g.items.reduce((s,p)=>s+Number(p.longitude),0)/g.items.length}));
}
