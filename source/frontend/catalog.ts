export type Automation = {id:string;name:string;description:string;repository:string;workflow:string;branch:string;category:string};
export const aisensy: Automation = {
 id:'aisensy',name:'AiSensy broadcast sync',description:'Your latest broadcasts, content and campaign metrics. Together in Google Sheets.',
 repository:'Sarthak-B/aisensy-broadcast-tracker',workflow:'test.yml',branch:'',category:'Messaging'
};
export const sheetUrl='https://docs.google.com/spreadsheets/d/1jXnQPQngi-FbEBBHC0tvaOTXxmtE5_miv6Mq0rTbmLQ/edit';

export const discrepancy:Automation={id:"discrepancy",name:"Discrepancy tracker",description:"Compare UTM, FlexiFunnels and Zoom registrations with your selected report inputs.",repository:"Sarthak-B/flexifunnels-discrepancy-tracker",workflow:"",branch:"",category:"Reporting"};
