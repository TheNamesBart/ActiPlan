import {samplePlan,validatePlan,occursOn,dateFromIsoWeek,weeksInYear,orderActivities,recurrenceLabel} from "../js/core.js";
const plan=samplePlan();
const checks=[
  ["voorbeeldplanning is geldig",validatePlan(plan).length===0],
  ["fout format wordt geweigerd",validatePlan({...plan,format:"fout"}).length>0],
  ["dagelijkse herhaling",occursOn(plan.activities[0],new Date(2024,1,29))],
  ["maanddag 31 werkt in schrikkeljaar",occursOn(plan.activities[3],new Date(2024,1,29))],
  ["voorbeeldplanning bevat 40 taken",plan.activities.length===40],
  ["voorbeeldplanning demonstreert variatie",new Set(plan.activities.map(a=>a.daypart)).size===5&&plan.activities.some(a=>a.recurrence.type==="monthly")&&plan.activities.some(a=>!a.active)&&plan.activities.filter(a=>a.deadline).length>=4&&plan.activities.some(a=>!a.description)&&plan.activities.some(a=>!a.durationMinutes)],
  ["ISO maandag",dateFromIsoWeek(2024,1).getDay()===1],
  ["week 53",weeksInYear(2020)===53],
  ["vaste dagdeelvolgorde",orderActivities([{...plan.activities[1],sortOrder:2},{...plan.activities[0],sortOrder:0}])[0].daypart==="before_opening"]
  ,["wekelijkse herhaling wordt duidelijk weergegeven",recurrenceLabel({type:"weekly",weekdays:["mon","thu"]})==="Wekelijks (Maandag, Donderdag)"]
  ,["maandelijkse herhaling wordt duidelijk weergegeven",recurrenceLabel({type:"monthly",day:31})==="Maandelijks (dag 31)"]
  ,["deadline wordt toegestaan",validatePlan({...plan,activities:[{...plan.activities[0],deadline:"11:00"}]}).length===0]
  ,["ongeldige deadline wordt geweigerd",validatePlan({...plan,activities:[{...plan.activities[0],deadline:"25:00"}]}).some(x=>x.includes("deadline"))]
  ,["korte beschrijving is optioneel",validatePlan({...plan,activities:[{...plan.activities[0],description:""}]}).length===0]
];
for(const [name,ok] of checks) console.log(`${ok?"✓":"✗"} ${name}`);
if(checks.some(([,ok])=>!ok)) process.exit(1);
