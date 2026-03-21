	var scoid = "";
	var page = 1;

   if (window.location.search.length > 0)
   {
      var strQuery = window.location.search.substring(1);
	  var arrQuery = strQuery.split(';');
	  for (var i=0;i<arrQuery.length;i++)
	  {
	     var arr_value = arrQuery[i].split('=');
		 var arrval = arr_value[0].toLowerCase();
		 if((arr_value[1] != null) && (arr_value[1] != ''))
		 {
			 switch(arrval){
				 case "scoid":
					 scoid = arr_value[1];
					 break;
				 case "page":
					 page = arr_value[1];
					 break;
			 }
		 }
	  } 
   }

function checkSound()
{
	if(document.MediaPlayer1)
	{
		document.MediaPlayer1.Play();

//		alert(document.MediaPlayer1.playState);

		if(document.MediaPlayer1.playState != 2)
			document.MediaPlayer1.Play();
	}

}

   if(scoid != "")
   {		
		var f = "";
		f += "<script language=\"JavaScript\" src=\"asset/"+scoid+"_"+page+".js\">";
		f += "</";
		f += "script>";
		document.write(f);
   }
   else
   {
		alert("Cannot Display Content");
   }



function winopen(url,name,feature)
{
	var win = window.open(url,name,feature);
	win.focus();
}


function goPoint(point)
{
	location.href='#'+point;
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
	var w = pg.H;
	var h = pg.W;

	if(parent.content_w != null){
		if(parent.content_w > 0) w = parent.content_w;
	}

	if(parent.content_h != null){
		if(parent.content_h > 0) h = parent.content_h;
	}


	var top = h - 30;
	var left = w - 40;

	var data = "";
	data += "<span id='soundicon' style='position:absolute; width:20;height:20;top:"+top+"px;left:"+left+"px; z-index:10'>";
	data += "<img src=\"asset/sound.gif\" border=0>";
	data += "</span>";
	document.write(data);
}


	function chkFrm(testformat)
	{				
		var msg = '';
		var frm = document.form1;

		switch(testformat){
			case 1:
				   if(!checkRadios()) { 
					msg += "\n- Please select Answer";
				   }
				  break;
			case 2:
				   if(!checkRadios()) { 
					msg += "\n- Please select Answer";
				   }
				break;
			case 3:

				for(i=1;i<=10;i++)
				{
					var ch = eval("document.form1.ch_" + i);
					if(ch.selectedIndex == 0)
					{
						msg += "\n- Please select Answer";
						break;
					}
				}

				break;
			case 4:
				break;

		}

		if(msg.length > 0)
			alert("Warning!" + msg);
		else
			frm.submit();

	}


function checkRadios() {
 var el = document.forms[0].elements;
 for(var i = 0 ; i < el.length ; ++i) {
  if(el[i].type == "radio") {
   var radiogroup = el[el[i].name]; // get the whole set of radio buttons.
   var itemchecked = false;
   for(var j = 0 ; j < radiogroup.length ; ++j) {
    if(radiogroup[j].checked) {
	 itemchecked = true;
	 break;
	}
   }
   if(!itemchecked) { 
//    alert("กรุณา กรอกแบบสอบถามให้ครบทุกข้อ "+el[i].name+"");
    if(el[i].focus)
     el[i].focus();
	return false;
   }
  }
 }
 return true;
} 

	function showDialog(url,w,h){
	if (window.showModalDialog) 
		{ 
			window.showModalDialog(url, window,'status:no;dialogWidth:'+w+'px; dialogHeight:'+h+'px; center:yes;scrollbars:no');
		} 
	else 
		{ 
			alert('Please launch the Internet explorer version 5.0 and up.');
		}

	}


	function callTxt(val)
	{
		var x = val.indexOf(":");
		if(x > -1)
		{
			var a = val.substring(0,x);
			var b = val.substring(x + 1,val.length);
			var ly = document.getElementById("SD"+b);
			var txt_ly = eval("txt_" + a + "_" + b);
			if(txt_ly)
				ly.innerHTML = txt_ly;
		}
		else
		{
			var txt_ly = val;
			if(txt_ly){
				if(document.getElementById("SB"))
					document.getElementById("SB").innerHTML = txt_ly;
			}
		}

	}

	function callImg(val)
	{
		var x = val.indexOf(":");
		if(x > -1)
		{
			var a = val.substring(0,x);
			var b = val.substring(x + 1,val.length);
			var img_ly = eval("img_" + a + "_" + b);
			var img_pos = eval("document.img" + b);
			if(img_ly)
				img_pos.src = img_ly.src;
		}
		else
		{
			var img_ly = eval("img_" + val + "_0");
			if(img_ly){
				if(document.getElementById("SIMG"))
					document.getElementById("SIMG").innerHTML = '<img src="'+img_ly.src+'" border=0>';
			}
		}

	}



function textblink(){
re="rgb("+Math.round(Math.random()*256)+",";
re += Math.round(Math.random()*256)+",";
re += Math.round(Math.random()*256)+")";
if(document.getElementById("showblink"))
	document.getElementById("showblink").style.color=re;
}
setInterval(textblink,300);

function firstPage(){
	if(parent.usescorm)
	{
		var nolp_total_time = parent.doLMSGetValue("cmi.core.total_time");
		if((nolp_total_time != "00:00:00") && (nolp_total_time != "0000:00:00.00") && (nolp_total_time != "0000:00:00.0") && (nolp_total_time != "00:00:00.00") && (nolp_total_time != "00:00:00.0")){
//			var pn = parent.doLMSGetValue("cmi.core.lesson_location");
//			if((pn != null) && (pn != ''))
			document.write("<p align=center>ครั้งที่ผ่านมา คุณใช้เวลาไปทั้งหมด "+nolp_total_time+"</p>");
		}			
	}
}

function doLMSGetValue(cmd, value){
	return parent.doLMSGetValue(cmd, value);
}

function doLMSGetValue(cmd){
	return parent.doLMSGetValue(cmd);
}

function sound(filename){
	return parent.sound(filename);
}

function video(filename, w, h){
	return parent.video(filename, w, h);
}

function flash(filename, w, h){
	return parent.flash(filename, w, h);
}

function drawLayer(txt, name, left, top, width ,height, zindex, scroll){
	if(scroll == null) scroll = 0;
	if(zindex == null) zindex = 1;

	var scrolling = "";
	switch(scroll){
		case 1: scrolling = "overflow:scroll"; break;
		case 2: scrolling = "overflow:auto"; break;
	}

	var layer = "";
	layer += "<span id='"+name+"' ";
	layer += "style='position:absolute;";
	layer += "left:"+left+"px;";
	layer += "top:"+top+"px;";
	layer += "width:"+width+"px;";
	layer += "height:"+height+"px;";
	layer += "zindex:"+zindex+"px;";
	layer += scrolling;
	layer += "'>";
	layer += txt;
	layer += "</span>";

	return layer;
}

function sendScore(n, total, end){
	if((n == null) || (n < 0)) n = 0;
	if((total == null) || (total <= 0)) total = 1;
	if(end == null) end = false;

	if(parent.sendScore(n, total, end)){
	}
}


/** Learner Comment ***************************************************************************************/
var cm_tag = '<@>';
var cm_page = '<#>';

function getLearnerContent(frm, part){
	if(part == null) part = 1;
	if(parent.usescorm)
	{

		var text = parent.doLMSGetValue('cmi.suspend_data');
		text = text.split(cm_page);

		var txt_cm = '';
		var addr = part - 1;
		if(addr < 0) addr = 0;

		if(text[addr]){
			var text_cm = text[addr].split(cm_tag);
			with(frm){

				for(var i=0;i<elements.length;i++){
					if((elements[i].type.toLowerCase() == "text") || (elements[i].type.toLowerCase() == "textarea")){
						if(text_cm[i]) elements[i].value = text_cm[i].replace('<br>','\n');
					}
				}

			}
		}


	}
}

function setLearnerContent(frm, part){
	if(part == null) part = 1;
	if(parent.usescorm)
	{


		var text = '';
		with(frm){
			for(var i=0;i<elements.length;i++){
				if((elements[i].type.toLowerCase() == "text") || (elements[i].type.toLowerCase() == "textarea")){
					if(text != '') text += cm_tag;
					text += elements[i].value;
				}
			}
		}

		if(text.length > 4096)
			alert(parent.system_message['suspend_data'][1]);
		else
		{

			text = text.replace("<br>","\n");

			var text_cm = parent.doLMSGetValue('cmi.suspend_data');
			text_cm = text_cm.split(cm_page);

			var text_now = '';
			var addr = part - 1;
			if(addr < 0) addr = 0;

			for(var i=0;i<text_cm.length;i++){
				var txt = (i==addr)?text:text_cm[i];
				text_now += txt;
				text_now += cm_page;
			}


			parent.doLMSSetValue('cmi.suspend_data', text_now);
			var scm = parent.doLMSCommit();

			if((scm != '401') && (scm != '403'))
				alert(parent.system_message['suspend_data'][0]);

		}

	}

	return false;
}


/*****************************************************************************************/

if (window.Event) // Only Netscape will have the CAPITAL E.
  document.captureEvents(Event.MOUSEUP); // catch the mouse up event

function nocontextmenu() // this function only applies to IE4, ignored otherwise.
{
   event.cancelBubble = true
   event.returnValue = false;

   return false;
}

function norightclick(e)   // This function is used by all others
{
   if (window.Event)   // again, IE or NAV ?
   {
      if (e.which == 2 || e.which == 3)
         return false;
   }
   else
      if (event.button == 2 || event.button == 3)
      {
         event.cancelBubble = true
         event.returnValue = false;
         return false;
      }
   
}

document.oncontextmenu = nocontextmenu;      // for IE5+
document.onmousedown = norightclick;      // for all others

function disableselect(e){
return false
}

function reEnable(){
return true
}

//if IE4+
document.onselectstart=new Function ("return false")

//if NS6
if (window.sidebar){
document.onmousedown=disableselect
document.onclick=reEnable
}