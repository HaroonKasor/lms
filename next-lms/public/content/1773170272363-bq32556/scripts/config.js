var isoffline = false;/*set offline*/
var islinear = true;/*set linear learning*/
var completedWhenDoAllMasteryscore = true;/*set complete condition do all exam, that have masteryscore greater than 0 */
var isResume = true;/* set resume last page when exit */
var treeArray = [
{ parent : "#", id : "chapter1", ispage : false, state : { opened : true }, text : "ชุมชนจะอยู่อย่างไรกับ Climate Change", detail : ""}



,{ parent : "chapter1", id : "chapter1page1", ispage : true, url : "data/m01/index.html", urlOffline : "data/m01/index.html", text : "บทที่ 1 การลดใช้พลังงาน เพื่อลดโลกร้อน", detail : "",activity : true, atcp : false,  playicon : true, calculatescore : false, duration : "36:19"}

,{ parent : "chapter2", id : "chapter2page1", ispage : true, url : "data/m02/index.html", urlOffline : "data/m02/index.html", text : "บทที่ 2 การจัดการขยะอาหาร เพื่อลดโลกร้อน", detail : "", activity : true, atcp : false,  playicon : true, calculatescore : false, duration : "43:02"}

,{ parent : "chapter3", id : "chapter3page1", ispage : true, url : "data/m03/index.html", urlOffline : "data/m03/index.html", text : "บทที่ 3 การปลูกป่า เพื่อลดโลกร้อน", detail : "", activity : true, atcp : false, playicon : true, calculatescore : false, duration : "39:09"}

,{ parent : "chapter4", id : "chapter4page1", ispage : true, url : "data/m04/index.html", urlOffline : "data/m04/index.html", text : "บทที่ 4 พื้นที่เขียวกับการกักเก็บคาร์บอน เพื่อลดโลกร้อน", detail : "", activity : true, atcp : false, playicon : true, calculatescore : false, duration : "38:46"}

,{ parent : "chapter5", id : "chapter5page1", ispage : true, url : "data/m05/index.html", urlOffline : "data/m05/index.html", text : "บทที่ 5 หมอกควัน ไฟป่า กับปัญหาโลกร้อน", detail : "", activity : true, atcp : false, playicon : true, calculatescore : false, duration : "41:20"}

,{ parent : "chapter6", id : "chapter6page1", ispage : true, url : "data/m06/index.html", urlOffline : "data/m06/index.html", text : "บทที่ 6 วิกฤติสุขภาพของชุมชนกับการปรับตัวต่อผลกระทบโลกร้อน", detail : "", activity : true, atcp : false, playicon : true, duration : "03:32"}

,{ parent : "chapter7", id : "chapter7page1", ispage : true, url : "data/m07/index.html", urlOffline : "data/m07/index.html", text : "บทที่ 7 การจัดการท่องเที่ยวกับโลกร้อน", detail : "", activity : true, atcp : false, playicon : true, duration : "22:07"}

,{ parent : "chapter8", id : "chapter8page1", ispage : true, url : "data/m08/index.html", urlOffline : "data/m08/index.html", text : "บทที่ 8 การจัดการน้ำ อุทกภัย และภัยพิบัติ", detail : "", activity : true, atcp : false, playicon : true, duration : "05:33"}

,{ parent : "chapter9", id : "chapter9page1", ispage : true, url : "data/m09/index.html", urlOffline : "data/m09/index.html", text : "บทที่ 9 ภัยแล้ง กับการรับมือและปรับตัวของชุมชน", detail : "", activity : true, atcp : false, playicon : true, duration : "15:44"}

,{ parent : "chapter10", id : "chapter10page1", ispage : true, url : "data/m10/index.html", urlOffline : "data/m10/index.html", text : "บทที่ 10 การปรับตัวด้านการเกษตร และความมั่นคงทางอาหาร", detail : "", activity : true, atcp : false, playicon : true, duration : "31:47"}

,{ parent : "chapter11", id : "chapter11page1", ispage : true, url : "data/m11/index.html", urlOffline : "data/m11/index.html", text : "บทที่ 11 การจัดการทรัพยากรธรรมชาติและระบบนิเวศ", detail : "", activity : true, atcp : false, playicon : true, duration : "31:47"}

,{ parent : "chapter11", id : "chapter11page2", ispage : true, url : "data/posttest1/index.html", text : "เเบบทดสอบหลังบท", detail : "", activity : true, masteryscore : 80, playicon : false,limitquizzed: 3 , duration : "",reset : true, resetwhenquizzed : 3}



];/*change here*/

Content = {};

Content.CourseActivity = {
    id: "https://e-learning.dcce.go.th/lrs_deqp/How_Communities_Can_Live_With_Climate_Change",/*change here*/
    definition: {
        type: "http://adlnet.gov/expapi/activities/course",
        name: {
            "th-TH": "ชุมชนจะอยู่อย่างไรกับ Climate Change"/*change here*/
        },
        description: {
            "th-TH": "ชุมชนจะอยู่อย่างไรกับ Climate Change"/*change here*/
        }
    }
};

Content.getContext = function(parentActivityId) {
var ctx = {
contextActivities: {
/*grouping: {
id: Content.CourseActivity.id
}*/
}
};
/*if (parentActivityId !== undefined && parentActivityId !== null) {*/
ctx.contextActivities.parent = {
id: Content.CourseActivity.id,
definition: {
name: Content.CourseActivity.definition.name,
description: Content.CourseActivity.definition.description
}
};
/*}*/
return ctx;
};