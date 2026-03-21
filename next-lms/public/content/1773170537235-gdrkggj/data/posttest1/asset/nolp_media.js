
function runSound(action)
{
	if(nolpifrm)
	{
		if(nolpifrm.document.MediaPlayer1){
			if(typeof(wm_media)=="undefined") wm_media=6;

			switch(wm_media){
				case 6:

					switch(action){
						case 'play':
							nolpifrm.document.MediaPlayer1.Play();
							if(nolpifrm.document.MediaPlayer1.playState != 2)
								nolpifrm.document.MediaPlayer1.Play();
							break;
						case 'pause':

							var playerStatus = nolpifrm.document.MediaPlayer1.playState;
							if (playerStatus == 2)
								nolpifrm.document.MediaPlayer1.Pause();

							if (playerStatus == 1)
								nolpifrm.document.MediaPlayer1.Play();

							break;
						case 'stop':
							nolpifrm.document.MediaPlayer1.Stop();
							nolpifrm.document.MediaPlayer1.CurrentPosition = 0;
							break;
					}

					break;
				default:

					switch(action){
						case 'play':
							nolpifrm.document.MediaPlayer1.controls.Play();
							if(nolpifrm.document.MediaPlayer1.controls.playState != 2)
								nolpifrm.document.MediaPlayer1.controls.Play();
							break;
						case 'pause':

							var playerStatus = nolpifrm.document.MediaPlayer1.playState;
							if (playerStatus == 3)
								nolpifrm.document.MediaPlayer1.controls.Pause();

							if((playerStatus == 1) || (playerStatus == 2))
								nolpifrm.document.MediaPlayer1.controls.Play();

							break;
						case 'stop':
							nolpifrm.document.MediaPlayer1.controls.Stop();
							nolpifrm.document.MediaPlayer1.controls.CurrentPosition = 0;
							break;
					}

					break;
			}
		}
	}

}


function sound(){
	var md = '';
	var filename = sound.arguments[0];
	var autostart = sound.arguments[1];
	var autorewind = sound.arguments[2];
	var w = sound.arguments[3];
	var h = sound.arguments[4];

	if((typeof(media_server) != "undefined") && (media_server != '') && (media_server != null)){
		if(media_server.substring( (media_server.length - 1) ) != '/') media_server += '/';
		filename = media_server+filename;
	}

	if(w == null) w = 0;
	if(h == null) h = 0;
	autostart = ((autostart == null) || (autostart==true))?1:0;
	autorewind = ((autorewind == null) || (autorewind==false))?0:1;

	if((filename != null) && (filename != '')){

		if(typeof(wm_media)=="undefined") wm_media=6;

		switch(wm_media){
			case 6:

				md = '';
				md ='<OBJECT ID="MediaPlayer1"';
				md +='classid="CLSID:22D6F312-B0F6-11D0-94AB-0080C74C7E95"';
				md +='codebase="http://activex.microsoft.com/activex/controls/mplayer/en/nsmp2inf.cab#Version=5,1,52,701" ';
				md +='standby="Loading Microsoft? Windows? Media Player components..." ';
				md +='type="application/x-oleobject" width="'+w+'" height="'+h+'">  ';
				md +='<PARAM NAME="FileName" value="'+filename+'">';
				md +='<param name="ShowControls" value="1">';
				md +='	<param name="ShowPositionControls" value="0">';
				md +='	<param name="ShowAudioControls" value="1">';
				md +='	<param name="ShowTracker" value="0">';
				md +='	<param name="ShowDisplay" value="0">';
				md +='	<param name="ShowStatusBar" value="1">';
				md +='	<param name="AutoSize" value="0">';
				md +='	<param name="ShowGotoBar" value="0">';
				md +='	<param name="ShowCaptioning" value="0">';
				md +='	<param name="AutoStart" value="'+autostart+'">';
				md +='	<param name="AnimationAtStart" value="0">';
				md +='	<param name="TransparentAtStart" value="0">';
				md +='	<param name="AllowScan" value="1">';
				md +='	<param name="Volume" value="100">';
				md +='	<param name="EnableContextMenu" value="1">';
				md +='	<param name="ClickToPlay" value="0">';
				md +='	<PARAM NAME="LOOP" VALUE="'+autorewind+'">';
				md +='  <EMBED type="application/x-mplayer2" ';
				md +='	pluginspage="http://www.microsoft.com/Windows/MediaPlayer/"';
				md +='	src="'+filename+'"';
				md +='	name="MediaPlayer1"';
				md +='	width='+w;
				md +='	height='+h;
				md +='	autostart='+autostart;
				md +='	Volume=100';
				md +='	showcontrols=1';
				md +='	showpositioncontrols=0';
				md +='	showstatusbar=0';
				md +='	LOOP='+autorewind;
				md +='	showcaptioning=0>';
				md +='  </EMBED>';
				md +='</OBJECT>';

				break;
			default:

				md = '';
				md ='<OBJECT ID="MediaPlayer1"';
				md +='classid="CLSID:6BF52A52-394A-11d3-B153-00C04F79FAA6"';
				md +='codebase="http://activex.microsoft.com/activex/controls/mplayer/en/nsmp2inf.cab#Version=5,1,52,701" ';
				md +='standby="Loading Microsoft? Windows? Media Player components..." ';
				md +='type="application/x-oleobject" width="0" height="0">  ';
				md +='<PARAM NAME="URL" value="'+filename+'">';
				md +='	<PARAM NAME="LOOP" VALUE="'+autorewind+'">';
				md +='</OBJECT>';

				break;
		}

	}

	return md;
}


function video(filename, w, h){
	var md = '';

	if((filename != null) && (filename != '')){

		if((typeof(media_server) != "undefined") && (media_server != '') && (media_server != null)){
			if(media_server.substring( (media_server.length - 1) ) != '/') media_server += '/';
			filename = media_server+filename;
		}

		if(typeof(wm_media)=="undefined") wm_media=6;

		switch(wm_media){
			case 6:

				md = '';
				md +='<OBJECT ID="MPlayerVideo"   width="'+w+'"  height="'+h+'"';
				md +='	classid="CLSID:22D6F312-B0F6-11D0-94AB-0080C74C7E95"';
				md +='	codebase=	"http://activex.microsoft.com/activex/controls/mplayer/en/nsmp2inf.cab#Version=5,1,52,701"';
				md +='	standby="Loading Microsoft? Windows? Media Player components..." ';
				md +='	type="application/x-oleobject">';
				md +='	<PARAM NAME="FileName" VALUE="'+filename+'">';
				md +='	<PARAM NAME="ShowControls" VALUE="1">';
				md +='	<PARAM NAME="ShowPositionControls" VALUE="1">';
				md +='	<PARAM NAME="ShowAudioControls" VALUE="1">';
				md +='	<PARAM NAME="ShowTracker" VALUE="0">';
				md +='	<PARAM NAME="ShowDisplay" VALUE="0">';
				md +='	<PARAM NAME="ShowStatusBar" VALUE="0">';
				md +='	<PARAM NAME="AutoSize" VALUE="0">';
				md +='	<PARAM NAME="AutoRewind" VALUE="0">';
				md +='	<PARAM NAME="ShowGotoBar" VALUE="0">';
				md +='	<PARAM NAME="ShowCaptioning" VALUE="0">';
				md +='	<PARAM NAME="AutoStart" VALUE="1">';
				md +='	<PARAM NAME="AnimationAtStart" VALUE="0">';
				md +='	<PARAM NAME="TransparentAtStart" VALUE="0">';
				md +='	<PARAM NAME="AllowScan" VALUE="1">';
				md +='	<PARAM NAME="EnableContextMenu" VALUE="1">';
				md +='	<PARAM NAME="ClickToPlay" VALUE="0">';
				md +='	<PARAM NAME="InvokeURLs" VALUE="1">';
				md +='	<PARAM NAME="Volume" VALUE="0">';
				md +='	<EMBED TYPE="application/x-mplayer2" ';
				md +='		PLUGINSPAGE="http://www.microsoft.com/Windows/MediaPlayer/"';
				md +='		SRC="'+filename+'"';
				md +='		NAME="MPlayerVideo"';
				md +='		WIDTH="'+w+'"';
				md +='		HEIGHT="'+h+'"';
				md +='		ShowControls="true"';
				md +='		ShowPositionControls="true"';
				md +='		ShowAudioControls="true"';
				md +='		ShowTracker="false"';
				md +='		ShowDisplay="false"';
				md +='		ShowStatusBar="false"';
				md +='		AutoSize="false"';
				md +='		AutoRewind="false"';
				md +='		ShowGotoBar="false"';
				md +='		ShowCaptioning="false"';
				md +='		AutoStart="true"';
				md +='		AnimationAtStart="false"';
				md +='		TransparentAtStart="false"';
				md +='		AllowScan="true"';
				md +='		EnableContextMenu="true"';
				md +='		ClickToPlay="false"';
				md +='		InvokeURLs="true">';
				md +='	</EMBED>';
				md +='	</OBJECT>';

				break;
			default:

				md = '';
				md +='<OBJECT ID="MPlayerVideo"   width="'+w+'"  height="'+h+'"';
				md +='	classid="CLSID:6BF52A52-394A-11d3-B153-00C04F79FAA6"';
				md +='	codebase=	"http://activex.microsoft.com/activex/controls/mplayer/en/nsmp2inf.cab#Version=5,1,52,701"';
				md +='	standby="Loading Microsoft? Windows? Media Player components..." ';
				md +='	type="application/x-oleobject">';
				md +='	<PARAM NAME="URL" VALUE="'+filename+'">';
				md +='	</OBJECT>';

				break;
		}

		md = mediaBorder(md);

	}
	return md;
}


function image(filename, w, h){
	var md = '';

	if((filename != null) && (filename != '')){
		md += '<img src="'+filename+'">';
		md = mediaBorder(md);
	}

	return md;
}


function flash(filename, w, h){
	var md = '';

	if((filename != null) && (filename != '')){

		md +='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" ';
		md +='codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=5,0,0,0" ';
		md +='width="'+w+'" height="'+h+'">';
		md +='<param name=movie value="'+filename+'">';
		md +='<param name=quality value=high>';
		md +='<embed width="'+w+'" height="'+h+'" src="'+filename+'" quality=high ';
		md +='pluginspage="http://www.macromedia.com/shockwave/download/index.cgi?P1_Prod_Version=ShockwaveFlash" ';
		md +='type="application/x-shockwave-flash"></embed></object>';
	}

	return md;
}

function mediaBorder(m){
	var mm = '<table width="100%" height="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align=center>';
	mm += m;
	mm += '</td></tr></table>';
	return mm;
}



	function callTxt(val)
	{
		var x = val.indexOf(":");
		if(x > -1)
		{
			var a = val.substring(0,x);
			var b = val.substring(x + 1,val.length);
			if(document.getElementById("SD"+b)){
				var ly = document.getElementById("SD"+b);
				var txt_ly = eval("txt_" + a + "_" + b);
				if(txt_ly)
					ly.innerHTML = txt_ly;
			}
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
					document.getElementById("SIMG").innerHTML = '<img src="'+img_ly.src+'" border=0>';//
			}
		}

	}