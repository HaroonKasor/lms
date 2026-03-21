var exitPageStatus;
var nolp_lesson_status="";
var nolp_state = "";


var sco_target = [];
sco_target['pass'] = sco_target['fail'] = null;
var passscore = 0;

if (window.location.search.length > 0){
	var strQuery = window.location.search.substring(1);
	var arrQuery = strQuery.split('&');
	for (var i=0;i<arrQuery.length;i++){
		var arr_value = arrQuery[i].split('=');
		var arrval = arr_value[0].toLowerCase();
		if((arr_value[1] != null) && (arr_value[1] != '')){
			switch(arrval){
				case "nolp_target1":
					sco_target['pass'] = arr_value[1];
					break;
				case "nolp_target2":
					sco_target['fail'] = arr_value[1];
					break;
				case "passscore":
					passscore = arr_value[1];
					if(typeof(passscore) != 'number') passscore = parseInt(passscore);
					break;
			}
		}
	}
}

function winopen(url,name,feature)
{
	if(typeof(media_server) != "undefined" && media_server != '' && media_server != '/'){
		var url_chk = url.toLowerCase();
		if(url_chk.indexOf('.wmv') != -1 || url_chk.indexOf('.asf') != -1 || url_chk.indexOf('.avi') != -1)
			url = media_server + url;
	}

	var win = window.open(url,name,feature);
	win.focus();
}

function checkSound()
{
	if(document.nolpifrm.document.MediaPlayer1)
	{
		document.nolpifrm.document.MediaPlayer1.Play();

		if(document.nolpifrm.document.MediaPlayer1.playState != 2)
			document.nolpifrm.document.MediaPlayer1.Play();
	}

}

function soundPlay()
{
	if(document.nolpifrm.document.MediaPlayer1)
		document.nolpifrm.document.MediaPlayer1.Play();
}

function soundPause()
{
	if(document.nolpifrm.document.MediaPlayer1)
	{
		  var playerStatus = document.nolpifrm.document.MediaPlayer1.playState;
		  if (playerStatus == 2)
		  {
			document.nolpifrm.document.MediaPlayer1.Pause();
		  }
		  if (playerStatus == 1)
		  {
			document.nolpifrm.document.MediaPlayer1.Play();
		  }
	}
}

function soundStop()
{
	if(document.nolpifrm.document.MediaPlayer1)
	{
	  document.nolpifrm.document.MediaPlayer1.Stop();
	  document.nolpifrm.document.MediaPlayer1.CurrentPosition = 0;
	}
}


function BrowserCheck() {
	var b = navigator.appName
	this.mac = (navigator.appVersion.indexOf('Mac') != -1)
	if (b=="Netscape") this.b = 'ns'
	else if (b=="Microsoft Internet Explorer") this.b = 'ie'
	else this.b = b
	this.version = navigator.appVersion
	this.v = parseInt(this.version)
	this.ns = (this.b=="ns" && this.v>=5)
	this.ns5 = (this.b=="ns" && this.v==5)
	this.ns6 = (this.b=="ns" && this.v==5)
	this.ie = (this.b=="ie" && this.v>=4)
	this.ie4 = (this.version.indexOf('MSIE 4')>0)
	this.ie5 = (this.version.indexOf('MSIE 5')>0)
	if (this.mac) this.ie = this.ie5
	this.ie5mac = (this.ie5 && this.mac);
	this.min = (this.ns||this.ie)
}

is = new BrowserCheck();

if ((is.min == false)||(is.ie5mac)){
	//alert('Your browser can\'t handle this page. You need NS6 or IE5 on Windows, or NS6 on Mac.');
//	history.back();
}

function PageDim(){
//Get the page width and height
	this.W = 20;
	this.H = 20;
	if (is.ns) this.W = window.innerWidth;
	if (is.ie) this.W = document.body.clientWidth;
	if (is.ns) this.H = window.innerHeight;
	if (is.ie) this.H = document.body.clientHeight;
}

var pg = null;

function showSoundIcon()
{
	pg = new PageDim();

	var top = pg.H - 20;
	var left = pg.W - 20;

	var data = "";
	data += "<div id='soundicon' style='position:absolute; width:20;height:20;top:"+top+"px;left:"+left+"px; z-index:10'>";
	data += "<img src=\"asset/sound.gif\" border=0>";
	data += "</div>";
	document.write(data);
}

function goPoint(point)
{
	location.href='#'+point;
}

function listPage(s,numpage)
{
	var w = h = 0;
	if(listpage_w) w = listpage_w;
	if(listpage_h) h = listpage_h;

	var data = '';
	data += '<select id="selectpage" name="selectpage" onchange="chgPage('+s+',this.value)" class="formav" style="';
	if(w > 0) data += 'width:'+w+'px;';
	if(h > 0) data += 'height:'+h+'px;';
	data += '";>';
	for(i=1;i<=numpage;i++)
	{
		data += '<option value="'+i+'"';
		if(pagenow == i)
			data += ' selected';

		data += '>'+i;
	}
	data += '</select>';

	if(document.getElementById("LP"))
		document.getElementById("LP").innerHTML = data;
}

function chgPage(s,p)
{
	showButton('back', !(p == 1));
	if(
		(
			(typeof(sco_target['pass']) != 'undefined' && sco_target['pass'] != null) || 
			(typeof(sco_target['fail']) != 'undefined' && sco_target['fail'] != null)
		)
		&& passscore > 0
	){
		showButton('quit', (p == numpage));
	}
	else
	{
		showButton('next', !(p == numpage));
		hideButton('quit');
	}

	pageNo(p);
	pagenow = p;
	listPage(s,numpage);
	var u = 'content.htm?scoid='+s+';page=' + p;
	if(document.nolpifrm)
		document.nolpifrm.location.href=u;
	else
	{
		if(document.getElementById("nolpifrm"))
		{
			document.getElementById("nolpifrm").src = u;
		}
	}
}

function pageNo(n)
{
	if(document.getElementById("SD1"))
		document.getElementById("SD1").innerHTML = n;
}


function goPage(state){

	switch(state.toLowerCase()){
		case 'back':
			if(pagenow > 1)
			{
				pagenow--;
				chgPage(scoid,pagenow);
			}
			else
			{
				nolp_state = "back";
				goPage('exit');
			}
			break;
		case 'next':
			if(pagenow < numpage)
			{
				pagenow++;
				chgPage(scoid,pagenow);
			}
			else
			{
				if(pagenow == numpage)
				{
					nolp_state = "next";
					goPage('exit');
				}
			}
			break;
		case 'quit':
			if (confirm("ต้องการออกจากบทเรียนใช่หรือไม่"))
				goPage('exit');
			break;
		case 'exit':
			if(pagenow == numpage && usescorm && passscore > 0){
				if(passscore <= userScore){
					if(sco_target['pass'] != null) doLMSSetValue('adl.nav.request', '{target='+sco_target['pass']+'}choice');
				}
				else
				{
					if(sco_target['fail'] != null) doLMSSetValue('adl.nav.request', '{target='+sco_target['fail']+'}choice');
				}
			}
			
			location.href='about:blank';
			break;
	}
}

var elem_button = [];
function showButton(type, show){
	if(show==null || typeof(show) == 'undefined') show = true;
	show = true;

	if(typeof(elem_button[type]) == 'undefined'){
		var docObj = document.documentElement;
		var elem = getElementsByTagName( docObj, 'span');
		if(elem != null){
			for(var i = 0;i < elem.length;i++){
				var e = elem[i];
				if(e.innerHTML.indexOf(type) != -1){
//					e.style.display = show?'none':'';
					elem_button[type] = e;
					break;
				}
			}
		}
	}

	if(typeof(elem_button[type]) != 'undefined') elem_button[type].style.display = show?'':'none';
}

function hideButton(type){
	showButton(type, false);
}

function getElementsByTagName(obj, tagname){
	try
	{
		var xmlObj = obj.getElementsByTagName(tagname);
		if((xmlObj == null) || (typeof(xmlObj) == 'undefined')) xmlObj = obj.getElementsByTagName(tagname.toLowerCase());
		return xmlObj;
	}
	catch(e){ }
	return null;
}

function getAttribute(obj, tagname){
	try
	{
		var objValue = obj.getAttribute(tagname);
		if((objValue == null) || (typeof(objValue) == 'undefined') || (objValue == '')) objValue = obj.getAttribute(tagname.toLowerCase());
		return objValue;
	}
	catch(e){ }
	return null;
}


function displayRte(rtetag){
	if(usescorm)
	{
		var val = '';
		
		switch(rtetag){
			case "first_page":
				if(document.nolpifrm) document.nolpifrm.firstPage();
				break;
			default:
				val = doLMSGetValue('cmi.core.'+rtetag);
				break;
		}
		
		return val;
	}
	else
	{
		return " ("+rtetag+")";
	}
}




function startSCO(){
//	loadPage();
	var result = doLMSInitialize();
	if(result=="true")
	{
		/*
		var pn = doLMSGetValue("cmi.core.lesson_location");
		if(!isNaN(pn) && (pn <= numpage) && (pn != '') && (pn != null))
			pagenow = pn;
		*/
		pagenow = 1;

	   nolp_lesson_status = doLMSGetValue( "cmi.core.lesson_status" );
	   nolp_lesson_mode = doLMSGetValue( "cmi.core.lesson_mode" );
	   if(nolp_lesson_mode == "browse") nolp_lesson_status = "browsed";

	   if (nolp_lesson_status == "not attempted")
	   {
//		  doLMSSetValue( "cmi.core.lesson_status", "incomplete" );
	   }

	   exitPageStatus = false;
	   startTimer();
	}
	
	return result;
}

function finishSCO(){
	if(usescorm){
		switch(nolp_lesson_status){
			case "browsed":
			case "passed":
			case "failed":
				break;
			default:
				if(pagenow != numpage)
					nolp_lesson_status = "incomplete";
				else
					nolp_lesson_status = "completed";
				break;
		}

		if(nolp_lesson_status != ''){ 
			var result_exit = unloadPage(nolp_lesson_status);
			if(result_exit=="false") alert('Error: Connot save data.\nPlease contact your administrator.');
		}

	}
}

function clock() {
if (!document.layers && !document.all) return;
var digital = new Date();
var hours = digital.getHours();
var minutes = digital.getMinutes();
var seconds = digital.getSeconds();
var amOrPm = "AM";
if (hours > 11) amOrPm = "PM";
//if (hours > 12) hours = hours - 12;
if (hours == 0) hours = 12;
if (minutes <= 9) minutes = "0" + minutes;
if (seconds <= 9) seconds = "0" + seconds;
//dispTime = hours + ":" + minutes + ":" + seconds + " " + amOrPm;
dispTime = hours + ":" + minutes + ":" + seconds;
if (document.layers) {
document.layers.pendule.document.write(dispTime);
document.layers.pendule.document.close();
}
else
if (document.all)
pendule.innerHTML = dispTime;
setTimeout("clock()", 1000);
}


var up,down;
var min1,sec1;
var cmin1,csec1,cmin2,csec2;
var hr1,chr1;
var nolptime = "00:00:00";

function Minutes(data) {
for(var i=0;i<data.length;i++) if(data.substring(i,i+1)==":") break;
return(data.substring(0,i)); }

function Seconds(data) {
for(var i=0;i<data.length;i++) if(data.substring(i,i+1)==":") break;
return(data.substring(i+1,data.length)); }

function Hours(data) {
for(var i=0;i<data.length;i++) if(data.substring(i,i+1)==":") break;
return(data.substring(i+1,data.length)); }

function Display(hr,min,sec) {
var disp;

if(hr<=9) { hr= "0"+hr }
if(min<=9) { min= "0"+min }
if(sec<=9) { sec= "0"+sec }

disp=hr + ":" + min + ":" + sec;

return(disp); }
function startCounter() {
var starttime;
starttime="00:00:00";

// ??????? ??? ?????????
chr1=0;
cmin1=0;
csec1=0;
// ================

hr1=0+Hours(starttime);
min1=0+Minutes(starttime);
sec1=0+Seconds(starttime);
UpRepeat(); }

function UpRepeat() {
csec1++;

if(csec1==60) { csec1=0; cmin1++; }
//Clock.innerHTML=Display(hr1,cmin1,csec1);

if(cmin1==60) { cmin1=0; chr1++;}

//Clock.innerHTML="<b>"+Display(chr1,cmin1,csec1) + "</b>";
nolptime = Display(chr1,cmin1,csec1);

if((cmin1==min1)&&(csec1==sec1)) alert("Timer-CountUp Stopped");
else up=setTimeout("UpRepeat()",1000); }


function chkSummaryScore(){
			
			var next = 0;
			var chktest = "";
			var real_score = 0;
			for(n=0;n<numtest;n++)
			{
				if(score_suit[n] >= 0){
					if(score_suit[n] != null)
						real_score+= parseInt(score_suit[n]);
					else{
						if(next > 0)
						{
							if(next > (n+1))
								next = (n+1);
						}
						else
							next = (n+1);

						chktest+= (thai)?"\n - ชุดที่ "+(n+1):"\n- Exercise: "+(n+1);
					}
				}
				else{
						if(next > 0)
						{
							if(next > (n+1))
								next = (n+1);
						}
						else
							next = (n+1);


					chktest+= (thai)?"\n - ชุดที่ "+(n+1):"\n- Exercise: "+(n+1);
				}
			}

			if(chktest ==""){
				var test_result = "failed";
				real_score = parseInt(real_score/score_suit.length);
//				msg_score = (thai)?"คุณได้คะแนนเฉลี่ย "+real_score+"% \nจากข้อสอบทั้งหมด "+score_suit.length+" ชุด":"Average Score: "+real_score+"%\nFrom "+score_suit.length+" exercises.";
				msg_score = system_message['avg'];
				msg_score = replaceAll(msg_score, '{pc_score}', real_score);
				msg_score = replaceAll(msg_score, '{total_suit}', score_suit.length);

				alert(msg_score);

				finishQuiz();
				
					if(usescorm){
//						if(document.nolpifrm.score_save){
							doLMSSetValue("cmi.core.score.raw",real_score);

							var suspend_data = 0;
							if(document.nolpifrm.suspend_data)
								suspend_data = document.nolpifrm.suspend_data;

							doLMSSetValue("cmi.suspend_data",suspend_data);
							doLMSCommit();
//						}
					}

				return true;
			}
			else
			{
//				var msg_alert = (thai)?"คุณยังไม่ได้ทำข้อสอบ":"You must do:";
				var msg_alert = system_message['mustdo'];
				alert(msg_alert+chktest);

				if(next > 0)
				{
/*
					var divbutt = '<input type=button name=butt value=\'Next &gt;&gt;\' style="width:120px;font-family: Verdana, Arial, Helvetica, sans-serif;font-size: 11px;" onclick="parent.chgPage(\''+scoid+'\',\''+next+'\')">';
					
					if(document.nolpifrm.document.getElementById("CheckButtonDiv"))
						document.nolpifrm.document.getElementById("CheckButtonDiv").innerHTML = divbutt;
					else
						document.nolpifrm.document.write('<center>'+divbutt+'</center>');
*/
				}

				return false;
			}
}


function finishQuiz(){
	if(usescorm){

		if(document.nolpifrm){
			var nolpifrm_body = document.nolpifrm.document.body.innerHTML;
			nolpifrm_body = '<p align=center><H2><FONT COLOR="#FF0000">'+system_message['finishquiz']+'</FONT></H2></p>' + nolpifrm_body;
			document.nolpifrm.document.body.innerHTML = nolpifrm_body;
		}
	}
}


var flash_score = 0;
var flash_score_total = 1;
function sendScore(n, total, end){
	if((n == null) || (n < 0)) n = 0;
	if((total == null) || (total <= 0)) total = 1;
	if(end == null) end = false;


	if(flash_score_total <= numtest)
	{

		flash_score += n;
		flash_score_total += total;
		if((flash_score_total == 0) || (flash_score_total==null)) flash_score_total = 1;
		if(flash_score_total > numtest){
			flash_score_total = numtest;
			end = true;
		}

		if(end){

			if(flash_score_total < numtest)
				flash_score_total = numtest;

			var real_score = Math.ceil((flash_score/flash_score_total)*100);
			if(real_score > 100) real_score = 100;
//			msg_score = (thai)?"คุณได้คะแนนเฉลี่ย "+real_score+"% \nจากข้อสอบทั้งหมด "+flash_score_total+" ชุด":"Average Score: "+real_score+"%\nFrom "+flash_score_total+" exercises.";

			msg_score = system_message['avg'];
			msg_score = replaceAll(msg_score, '{pc_score}', real_score);
			msg_score = replaceAll(msg_score, '{total_suit}', flash_score_total);

			if(usescorm){
				doLMSSetValue("cmi.core.score.raw",real_score);
			}
			alert(msg_score);
		}

	}
}

function setSystemMsg(){
	system_message = new Array();
	system_message['chkanswer'] = (thai)?'ตรวจคำตอบ':'Check Answer';
	system_message['showanswer'] = (thai)?'เฉลยคำตอบ':'Show Answer';
	system_message['remark'] = (thai)?'หมายเหตุ: ตัวอักษรสีแดง คือคำตอบที่ถูกต้อง':'Remark: Red Sentence is Correct Answer.';
	system_message['mustdoquiz'] = (thai)?'กรุณาทำข้อสอบให้ครบทุกข้อ':'Please select answer.';
	system_message['suspend_data'] = (thai)?new Array('บันทึกข้อมูลเรียบร้อยแล้ว', 'ข้อความควรมีความยาวรวมทั้งหมดไม่เกิน 4096 ตัวอักษร'):new Array('Already saved data','The data must not be length more than 4096 characters');
	system_message['viewscore'] = (thai)?'คลิกเพื่อดูคะแนน':'Click to view your score';
	system_message['close'] = (thai)?'ปิดหน้าต่าง':'Close Window';
	system_message['next'] = (thai)?'ถัดไป':'Next';

	system_message['score'] = thai?'คุณทำข้อสอบได้ {score} คะแนน\nจากทั้งหมด {total_score} คะแนน\nคิดเป็น {pc_score}%':'Your mark is {pc_score}%';
	system_message['avg'] = thai?'คุณได้คะแนนเฉลี่ย {pc_score}%\nจากข้อสอบทั้งหมด {total_suit} ชุด':'Average Score: {pc_score}%\nFrom {total_suit} exercises';
	system_message['mustdo'] = thai?'คุณยังไม่ได้ทำข้อสอบ':'You must do:';
	system_message['direction'] = thai?'จงเลือกคำตอบที่ถูกต้อง':'Please choose the correct answer';
	system_message['finishquiz'] = thai?'เมื่ออ่านเฉลยจบแล้ว ให้กดปุ่ม ปิด แล้วรอการประมวลผลจากระบบ':'เมื่ออ่านเฉลยจบแล้ว ให้กดปุ่ม ปิด แล้วรอการประมวลผลจากระบบ';
}


function replaceAll(text, tag, value){
	while((text.indexOf( tag ) != -1) != false)
		text = text.replace( tag , value );
	return text;
}

/***********************************************************************************************************************************/

if (!Array.prototype.push) {
	Array.prototype.push = function array_push() {
		for(var i=0;i<arguments.length;i++)
			this[this.length]=arguments[i];
		return this.length;
	}
};

if (!Array.prototype.pop) {
	Array.prototype.pop = function array_pop() {
		lastElement = this[this.length-1];
		this.length = Math.max(this.length-1,0);
		return lastElement;
	}
};


/***********************************************************************************************************************************/

function aboutus(){
	var msg ='';
	msg = 'NOLP Content Package for SCORM 1.2 Confermance';
	msg += '\nCopyright ? 2000-2006 NOLP';
	msg += '\n\nDeveloped by ';
	msg += '\n- Thongchai Ruangtorwongs (thongchai@thai2learn.com)';
	alert(msg);
}