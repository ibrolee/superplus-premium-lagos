import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePtPayout, payPeriodFromStart } from '../src/lib/pt-payroll.ts';
function fixture() {
  const input={trainers:[],memberships:[],evaluations:[],assignmentMap:new Map(),payoutPeriodStart:'2026-10-01',payoutPool:null,payoutRuns:[],selectedPayoutRun:null,today:'2026-10-15'};
  for(const [id,count,title] of [['a',3,'In-house Coach'],['b',5,'In-house Coach'],['c',2,'In-house Coach'],['d',0,'In-house Coach'],['e',4,'Part-time Coach']]) {
    input.trainers.push({staff_profile_id:id,display_name:id,staff_title:title,active:true});
    for(let i=0;i<count;i++) {const row={id:id+i,member_id:id+i,start_date:'2026-10-01',end_date:'2026-10-31',status:'active',payment_status:'paid',created_at:'2026-10-01'};input.memberships.push(row);input.assignmentMap.set(row.id,{trainer_staff_profile_id:id});}
  }
  return input;
}
test('fixed dates handle February, leap years and year rollover',()=>{
 assert.equal(payPeriodFromStart('2026-10-01').payDate,'2026-10-16');
 assert.equal(payPeriodFromStart('2026-10-16').payDate,'2026-11-01');
 assert.equal(payPeriodFromStart('2028-02-16').end,'2028-02-29');
 assert.equal(payPeriodFromStart('2027-02-16').end,'2027-02-28');
 assert.equal(payPeriodFromStart('2026-12-16').payDate,'2027-01-01');
});
test('8 eligible cycles suggest 80k, low volume receives separate 20k, part-time excluded',()=>{
 const result=calculatePtPayout(fixture());
 assert.equal(result.autoPool,80000);assert.equal(result.totalRecommended,100000);
 assert.equal(result.rows.find(r=>r.trainer_name==='c').trainee_commission,20000);
 assert.equal(result.rows.find(r=>r.trainer_name==='a').trainee_commission,0);
 assert.equal(result.rows.find(r=>r.trainer_name==='d').recommended_payout,0);
 assert.equal(result.rows.some(r=>r.trainer_name==='e'),false);
});
test('manual override keeps automatic reference, automatic saved drafts update with new cycles',()=>{
 const input=fixture();input.payoutPool='100000';let result=calculatePtPayout(input);
 assert.equal(result.autoPool,80000);assert.equal(result.totalRecommended,120000);assert.equal(result.poolOverridden,true);
 input.payoutPool=null;input.selectedPayoutRun={status:'pending',payout_pool:40000,auto_payout_pool:40000,breakdown:[]};
 assert.equal(calculatePtPayout(input).pool,80000);
 input.selectedPayoutRun.payout_pool=45000;assert.equal(calculatePtPayout(input).pool,45000);
});
test('paid and partially paid periods always use the recorded snapshot',()=>{
 for(const status of ['paid','pending']) {
  const input=fixture(),result=calculatePtPayout(input);
  input.selectedPayoutRun={status,financial_locked:true,period_start:'2026-10-01',period_end:'2026-10-15',pay_date:'2026-10-16',payout_pool:80000,auto_payout_pool:80000,breakdown:result.rows};
  const snapshot=calculatePtPayout(input);input.memberships=[];input.trainers=[];input.payoutPool='1';
  assert.deepEqual(calculatePtPayout(input),snapshot);
 }
});
test('same membership never generates a second commission in the second half',()=>{
 const input=fixture();input.payoutPeriodStart='2026-10-16';input.today='2026-10-31';
 const result=calculatePtPayout(input);assert.equal(result.autoPool,0);assert.equal(result.commissionTotal,0);
 assert.equal(result.rows.find(r=>r.trainer_name==='c').trainee_count,2);
 input.payoutPeriodStart='2026-10-01';input.payoutRuns=[{period_start:'2026-09-16',breakdown:[{payable_membership_ids:['c0','c1']}]}];
 assert.equal(calculatePtPayout(input).rows.find(r=>r.trainer_name==='c').trainee_commission,0);
});
test('one evaluation does not change performance; two evaluations establish rating',()=>{
 const input=fixture();const baseline=calculatePtPayout(input).rows.find(r=>r.trainer_name==='a').performance_share;
 input.evaluations=[{trainer_staff_profile_id:'a',overall_rating:1,submitted_at:'2026-10-10T10:00:00Z'}];
 assert.equal(calculatePtPayout(input).rows.find(r=>r.trainer_name==='a').performance_share,baseline);
 input.evaluations.push({...input.evaluations[0],submitted_at:'2026-10-11T10:00:00Z'});
 assert.equal(calculatePtPayout(input).rows.find(r=>r.trainer_name==='a').performance_index,.2);
});

test('an active PT membership in a selected period counts regardless of when it began',()=>{
 const input=fixture();input.today='2026-10-08';
 input.memberships.push(
   {id:'prior-period',member_id:'old-pt',start_date:'2026-09-02',end_date:'2026-10-01',status:'expired',payment_status:'paid',created_at:'2026-09-02'},
   {id:'cancelled',member_id:'cancelled-pt',start_date:'2026-09-01',end_date:'2026-10-15',status:'cancelled',payment_status:'paid',created_at:'2026-09-01'},
   {id:'paused',member_id:'paused-pt',start_date:'2026-10-01',end_date:'2026-10-31',status:'paused',payment_status:'paid',created_at:'2026-10-01'},
   {id:'unpaid',member_id:'unpaid-pt',start_date:'2026-10-01',end_date:'2026-10-31',status:'active',payment_status:'pending',created_at:'2026-10-01'},
 );
 let result=calculatePtPayout(input);
 assert.equal(result.unassignedCount,1);
 assert.equal(result.autoPool,80000);
 input.payoutPeriodStart='2026-10-16';
 result=calculatePtPayout(input);
 assert.equal(result.unassignedCount,0);
});

test('cancelled or paused PT cannot inflate coach trainee count or commissions',()=>{
 const input=fixture();
 input.memberships.find(row=>row.id==='a0').status='cancelled';
 input.memberships.find(row=>row.id==='a1').status='paused';
 const result=calculatePtPayout(input);
 assert.equal(result.rows.find(row=>row.trainer_name==='a').trainee_count,1);
 assert.equal(result.rows.find(row=>row.trainer_name==='a').trainee_commission,10000);
 assert.equal(result.autoPool,50000);
});
