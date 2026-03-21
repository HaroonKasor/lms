var isoffline = false;/*set offline*/
var islinear = true;/*set linear learning*/
var completedWhenDoAllMasteryscore = true;/*set complete condition do all exam, that have masteryscore greater than 0 */
var isResume = true;/* set resume last page when exit */
var treeArray = [
{ parent : "#", id : "chapter1", ispage : false, state : { opened : true }, text : "Develop a manager mindset | Google People Management Essentials", detail : ""}



,{ parent : "chapter1", id : "chapter1page1", ispage : true, url : "data/m01/index.html", urlOffline : "data/m01/index.html", text : "Develop a manager mindset | Google People Management Essentials", detail : "",activity : true, atcp : false,  playicon : true, calculatescore : false, duration : "36:19"}



];/*change here*/

Content = {};

Content.CourseActivity = {
    id: "https://e-learning.dcce.go.th/lrs_deqp/How_Communities_Can_Live_With_Climate_Change",/*change here*/
    definition: {
        type: "http://adlnet.gov/expapi/activities/course",
        name: {
            "th-TH": "Develop a manager mindset | Google People Management Essentials"/*change here*/
        },
        description: {
            "th-TH": "Develop a manager mindset | Google People Management Essentials"/*change here*/
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