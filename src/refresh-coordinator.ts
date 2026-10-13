/** Global bounded work queue. One request per key, even across parallel group
 * refreshes. A failed job releases its slot for subsequent work. */
export function createBoundedWorkQueue<T>(maxActive:number){
 if(!Number.isInteger(maxActive)||maxActive<1)throw new Error("Invalid concurrency limit");
 const pending=new Map<string,Promise<T>>();
 const scheduled:Array<()=>void>=[];
 let active=0;
 const pump=()=>{
  while(active<maxActive&&scheduled.length){
   const next=scheduled.shift()!;
   next();
  }
 };
 const run=(key:string,task:()=>Promise<T>):Promise<T>=>{
  const prior=pending.get(key);if(prior)return prior;
  let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;
  const result=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  pending.set(key,result);
  scheduled.push(()=>{
   active++;
   Promise.resolve().then(task).then(resolve,reject).finally(()=>{
    active--;pending.delete(key);pump();
   });
  });
  pump();
  return result;
 };
 return {run,get pendingCount(){return pending.size;},get activeCount(){return active;}};
}

/** Shared by legacy and Smart Feed endpoints to avoid parallel network storms. */
export const globalFeedWork=createBoundedWorkQueue<void>(3);
