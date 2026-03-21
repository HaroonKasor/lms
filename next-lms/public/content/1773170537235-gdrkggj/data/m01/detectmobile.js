
var engineWebKit = "webkit";
var deviceIphone = "iphone";
var deviceIpod = "ipod";
var deviceIpad = "ipad";
var deviceAndroid = "android";
// Detects if the current browser is based on WebKit.
function DetectWebkit()
{
	var uagent = "";
	if (navigator && navigator.userAgent)
		uagent = navigator.userAgent.toLowerCase();
   if (uagent.search(engineWebKit) > -1)
      return true;
   else
      return false;
}
// Detects if the current device is an iPad tablet.
function DetectIpad(){
	var uagent = "";
	if (navigator && navigator.userAgent)
		uagent = navigator.userAgent.toLowerCase();
   if (uagent.search(deviceIpad) > -1  && DetectWebkit())
      return true;
   else
      return false;
}
// Detects if the current device is an iPhone or iPod Touch.
function DetectIphoneOrIpod(){
   //We repeat the searches here because some iPods 
   //  may report themselves as an iPhone, which is ok.
   var uagent = "";
	if (navigator && navigator.userAgent)
		uagent = navigator.userAgent.toLowerCase();
   if (uagent.search(deviceIphone) > -1 || uagent.search(deviceIpod) > -1)
       return true;
    else
       return false;
}
// Detects *any* iOS device: iPhone, iPod Touch, iPad.
function DetectIos(){
   if (DetectIphoneOrIpod() || DetectIpad())
      return true;
   else
      return false;
}

// Detects *any* Android OS-based device: phone, tablet, and multi-media player.
function DetectAndroid(){
	var uagent = "";
	if (navigator && navigator.userAgent)
		uagent = navigator.userAgent.toLowerCase();
   if (uagent.search(deviceAndroid) > -1)
      return true;
   else
      return false;
}

//Detects Android Version
function DetectAndroidVersion(){
	if(DetectAndroid()){
		var ua = navigator.userAgent; 
		var androidversion = parseFloat(ua.slice(ua.indexOf("Android")+8));
		return androidversion;
	}
}

//Dectects Windows Phone
function DetectWindowsPhone(){
	if ((navigator.userAgent.match(/Windows Phone/i)) || (navigator.userAgent.match(/ZuneWP7/i))) {
		return true;
	}
	else{
		return false;
	}
}