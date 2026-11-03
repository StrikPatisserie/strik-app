import 'server-only';
import {createHash} from 'node:crypto';
import type {CorrectionContext} from './correctionContext';
import type {CorrectionRecord,ImportVerification} from './correctionTypes';
import type {ReviewShift} from './reviewTypes';
function identity(shift:ReviewShift){
 return createHash('sha256').update(JSON.stringify([shift.id,shift.sourceRevision||null,shift.employeeId,shift.departmentId,shift.start.iso,shift.end.iso,shift.breakMinutes,shift.breakCode,shift.reportedNetMinutes,shift.comments,shift.kind,shift.activity,shift.planStatusCode,shift.employeeApproved])).digest('hex');
}
export function importVerification(context:CorrectionContext,selected=context.before):ImportVerification{
 const mine=(shift:ReviewShift)=>shift.employeeId===selected.employeeId;
 return {transport:'v2-import',planned:context.dataset.planned.filter(mine).map(identity).sort(),otherActual:context.dataset.actual.filter(s=>mine(s)&&s.id!==selected.id).map(identity).sort()};
}
export function surroundingShiftsMatch(record:CorrectionRecord,current:CorrectionContext){
 if(!current.complete||record.verification?.transport!=='v2-import')return false;
 const now=importVerification(current);
 return JSON.stringify(now.planned)===JSON.stringify(record.verification.planned)&&JSON.stringify(now.otherActual)===JSON.stringify(record.verification.otherActual);
}
export function importResponseSuccess(response:unknown):boolean|null{
 if(!Array.isArray(response)||!response.length||response.some(row=>!row||typeof row!=='object'||typeof row.Success!=='boolean'))return null;
 return response.every(row=>row.Success===true);
}
