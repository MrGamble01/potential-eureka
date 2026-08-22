function saveGame(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(G)); }catch(e){}
}

function loadGame(){
  try{
    var raw = localStorage.getItem(SAVE_KEY);
    if(raw){ Object.assign(G, JSON.parse(raw)); }
    if(!G.activeCrafts) G.activeCrafts={}; // saves from before crafts were persisted
    if(typeof G.goalIndex!=='number'||G.goalIndex<0) G.goalIndex=0; // saves from before the goal ladder
    // A save written mid-warning restores sweepWarned:true, but the timer
    // that would fire the sweep died with the old tab — leaving it set
    // blocks every future lookout warning for the rest of the save.
    G.sweepWarned=false; G.packedUp=false;
  }catch(e){}
}
