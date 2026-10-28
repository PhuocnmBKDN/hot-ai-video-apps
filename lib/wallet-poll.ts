export function walletPollDelay(active:boolean,elapsed:number):number|null {
 if(!active||elapsed>=600000)return null;
 if(elapsed<60000)return 5000;
 return elapsed<300000?15000:30000;
}
