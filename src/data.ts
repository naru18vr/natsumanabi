import type {Data,Settings,Task} from './types';
export const settings:Settings={version:1,setupDone:false,studyStartDate:'2026-07-21',summerVacationEndDate:'2026-08-31',homeworkGoalDate:'2026-07-31',examDate:'2026-09-25',periodicTestDates:['2026-09-16','2026-09-17'],dailyLimitMinutes:180,accommodationDates:[],availableDevice:'phone',japaneseChoice:'未確認',organChoice:'未確認',kihonPages:0,mathReviewPages:0,musicMode:'未確認',gradeSong:'',classSong:'',part:'',healthDueDate:''};
const mk=(id:string,subject:string,title:string,date:string,min:number,total?:number,unit?:string,location='自宅のみ',priority:Task['priority']='required'):Task=>({id,source:'initial',subject,category:'夏休み宿題',type:'homework',title,description:'詳細・必要物を確認して進めよう',date,targetDueDate:date<'2026-07-31'?'2026-07-30':'2026-07-31',estimatedMinutes:min,actualMinutes:0,priority,status:'pending',totalAmount:total,completedAmount:0,unit,requiresMarking:['数学','英語','理科'].includes(subject),markingCompleted:false,correctionCompleted:false,requiredTools:location==='自宅のみ'?['紙教材']:['スマートフォン'],availableLocations:[location],tags:[subject],rescheduleHistory:[]});
const steps=(prefix:string,subject:string,title:string,names:string[],start=21)=>names.map((x,i)=>mk(`${prefix}-${i}`,subject,`${title}：${x}`,`2026-07-${Math.min(start+i,31)}`,25,undefined,undefined,'自宅のみ',i<3?'required':'high'));
export function initialData():Data{const tasks:Task[]=[
...Array.from({length:10},(_,i)=>mk(`dragon-${i}`,'数学',`ドラゴン桜 ${i<4?5:4}枚`,`2026-07-${21+i}`,35,i<4?5:4,'枚')),
...Array.from({length:10},(_,i)=>mk(`meki-${i}`,'英語',`めきめきEnglish ${i<3?8:7}ページ`,`2026-07-${21+i}`,45,i<3?8:7,'ページ')),
...Array.from({length:10},(_,i)=>mk(`science-${i}`,'理科',`問題集 ${i<9?2:1}ページ`,`2026-07-${21+i}`,25,i<9?2:1,'ページ')),
...steps('school','学年','上級学校調べ',['学校を決める','見本と説明','基本情報','特徴・学科','下書き','清書','色付け','最終確認']),
...steps('jp','国語','選択課題',['課題を決める','資料を集める','内容整理','構成','下書き','修正','清書','最終確認'],22),
...steps('organ','理科','臓器しらべ',['臓器決定','資料収集','仕組み','図を決める','レイアウト','下書き','図作成','ペン書き','参考文献','最終確認'],21),
...steps('sports','保健体育','スポーツ新聞',['説明確認','テーマ決定','資料収集','内容整理','レイアウト','下書き','清書','写真・図','最終確認'],22),
...steps('art1','美術','はがき作品1',['条件確認','アイデア','下書き','着色','仕上げ','最終確認'],21),
...steps('art2','美術','はがき作品2',['条件確認','アイデア','下書き','着色','仕上げ','最終確認'],24),
...steps('cooking','家庭科','サケのムニエル',['説明確認','材料準備','調理・撮影','感想整理','レポート','確認','Classroom提出','提出済み確認'],21),
...steps('wash','家庭科','洗濯実習',['説明確認','洗濯物決定','表示確認','実習','結果記録','感想','提出確認'],24),
mk('music','音楽','合唱曲を聴く','2026-07-21',15,50,'回','どこでも実施可能','high'),
mk('eiken-min','英検','中1英語の復習＋単語','2026-07-21',15,undefined,undefined,'スマートフォンがあれば可能','required')];
return {settings:{...settings},tasks,events:[{id:'test1',type:'exam',title:'定期テスト①',date:'2026-09-16'},{id:'test2',type:'exam',title:'定期テスト②',date:'2026-09-17'},{id:'eiken',type:'exam',title:'英検4級',date:'2026-09-25'}],importHistory:[]}}
