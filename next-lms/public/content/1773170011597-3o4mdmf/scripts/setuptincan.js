//TinCan.enableDebug();

        //
        // content definition
        //
			var courseid = 0;
			var sectionid = 0;
			var hasIntial = false;
			var pageArray = [];
			var currentState = {
										lastSeenIndex : 0,
										dataIndex : [],
										//scoreIndex : [],
										totalTime : 0,
										totalReset : 0,
										failed : false,
										completed : false,
										success : false,
										score : 0
			},
			tempState = {},
            currentPage = 0,
			lastPage = 0,
			totalTime = 0,
			intervalTimeID = null,
			intervalScrollID = null,
            startTimeStamp = null,
            processedUnload = false,
            reachedEnd = false,
            maxPageReached = 0,
            tincan = new TinCan (
                {
                    url: window.location.href,
                    activity: Content.CourseActivity
                }
            );
			if(tincan.recordStores.length == 0){
				isoffline = true;
			}
		if(!isoffline){
			if(typeof(tincan.context) != "undefined" && typeof(tincan.context.contextActivities) != "undefined" && typeof(tincan.context.contextActivities.grouping) != "undefined" && tincan.context.contextActivities.grouping.length > 0){
				for(var i = 0; i < tincan.context.contextActivities.grouping.length; i++){
					tincan.context.contextActivities.grouping[i].id = tincan.context.contextActivities.grouping[i].id.replace(/#/g, "");
					//console.log(tincan.context.contextActivities.grouping[i].id);
				}
			}
			tincan.sendStatement(
				{
					verb: "attempted",
					context: Content.getContext()
				}
			);
		}

        //
        // functions for sizing the iFrame
        //
        function setIframeHeight(id, navWidth) {
            if ( document.getElementById ) {
                var theIframe = document.getElementById(id);
                if (theIframe) {
                    var height = getWindowHeight();
                    theIframe.style.height = Math.round( height ) - navWidth + "px";
                    theIframe.style.marginTop = Math.round( ((height - navWidth) - parseInt(theIframe.style.height) )/2 ) + "px";
                }
            }
        }

        function getWindowHeight() {
            var height = 0;
            if (window.innerHeight){
                height = window.innerHeight - 18;
            }
            else if (document.documentElement && document.documentElement.clientHeight){
                height = document.documentElement.clientHeight;
            }
            else if (document.body && document.body.clientHeight) {
                height = document.body.clientHeight;
            }
            return height;
        }

		function setupPageArray(){
			for(var i = 0; i < treeArray.length; i++){
				if(typeof(treeArray[i].text) != "undefined"){
					treeArray[i].originalText = treeArray[i].text;
				}
				if(treeArray[i].ispage){
					pageArray.push(jQuery.extend(true, {}, treeArray[i]));
					pageArray[pageArray.length-1].title = pageArray[pageArray.length-1].text;
					var templimitattempted = 0;
					var templimitquizzed = 0;
					var tempmasteryscore = 0;
					var tempactivity = false;
					var tempreset = false;
					var tempatcp = true;
					var tempcalculatescore = true;
					var tempresetwhenquizzed = 0;
					var templimitreset = 0;
					var tempduration = "";
					var tempplayicon = false;
					if(typeof(pageArray[pageArray.length-1].limitattempted) == "undefined"){
						pageArray[pageArray.length-1].limitattempted = templimitattempted;
					}
					if(typeof(pageArray[pageArray.length-1].limitquizzed) == "undefined"){
						pageArray[pageArray.length-1].limitquizzed = templimitquizzed;
					}
					if(typeof(pageArray[pageArray.length-1].masteryscore) == "undefined"){
						pageArray[pageArray.length-1].masteryscore = tempmasteryscore;
					}
					if(typeof(pageArray[pageArray.length-1].activity) == "undefined"){
						pageArray[pageArray.length-1].activity = tempactivity;
					}
					if(typeof(pageArray[pageArray.length-1].reset) == "undefined"){
						pageArray[pageArray.length-1].reset = tempreset;
					}
					if(typeof(pageArray[pageArray.length-1].atcp) == "undefined"){
						pageArray[pageArray.length-1].atcp = tempatcp;
					}
					if(typeof(pageArray[pageArray.length-1].calculatescore) == "undefined"){
						pageArray[pageArray.length-1].calculatescore = tempcalculatescore;
					}
					if(typeof(pageArray[pageArray.length-1].resetwhenquizzed) == "undefined"){
						pageArray[pageArray.length-1].resetwhenquizzed = tempresetwhenquizzed;
					}
					if(typeof(pageArray[pageArray.length-1].limitreset) == "undefined"){
						pageArray[pageArray.length-1].limitreset = templimitreset;
					}
					if(typeof(pageArray[pageArray.length-1].duration) == "undefined"){
						pageArray[pageArray.length-1].duration = tempduration;
					}
					if(typeof(pageArray[pageArray.length-1].playicon) == "undefined"){
						pageArray[pageArray.length-1].playicon = tempplayicon;
					}
					/*pageArray.push({ id : treeArray[i].id, title : treeArray[i].text, detail : treeArray[i].detail, url : treeArray[i].url, activity : treeArray[i].activity });
					if(treeArray[i].activity){
						pageArray[pageArray.length-1].masteryscore = treeArray[i].masteryscore;
					}*/
					treeArray[i].a_attr = { href : "javascript:;" , onclick : "goToPage("+(pageArray.length-1)+");"};
					treeArray[i].indexpage = (pageArray.length-1);
				}
			}
		}

        function SetupIFrame(){
            //set our iFrame for the content to take up the full screen except for our navigation
            $(window).scrollTop(0).scrollLeft(0);
			var tempFullW = 0;
			var tempFullH = 0;
			if(DetectIpad()){
				tempFullW = window.innerWidth;
				tempFullH = window.innerHeight;
			}
			else{
				tempFullW = $(window).width();
				tempFullH = $(window).height();
			}
			$("body").css("height", tempFullH).css("width", tempFullW);
			if(DetectIos() || DetectAndroid()){
				$("#contentFrame").css("height", ($("body").height()-$("#menuBar").height())).css("width", $("body").width());
				$("#divContentFrame").css("height", ($("body").height()-$("#menuBar").height())).css("width", $("body").width());
			}
			else{
				$("#contentFrame").css("height", ($("body").height()-$("#menuBar").height())).css("width", $("body").width()-($("#menuTOC").width()+1)).css("left",$("#menuTOC").width()+1);
				$("#divContentFrame").css("height", ($("body").height()-$("#menuBar").height())).css("width", $("body").width()-($("#menuTOC").width()+1)).css("left",$("#menuTOC").width()+1);
			}
			$("#menuTOC").css("height", ($("body").height()-$("#menuBar").height()));
			setPositionTitle();
        }

		function setPositionTitle(){if(pageArray&&pageArray[currentPage]){$("#scotitle").html(pageArray[currentPage].title);}
			var tempLeft = ($("#menuBar").width()/2)-($("#scotitle").width()/2)-($("#butNext").width()/2+$("#butExit").width()/2+4/2)+($("#butTOC").width()/2+$("#butPrevious").width()/2+16/2);
			var tempTop = ($("#menuBar").height()/2)-($("#scotitle").height()/2);
			//alert(tempLeft);
			$("#scotitle").css("left", tempLeft).css("top", tempTop);
		}

        //
        // navigation functions
        //
        function doStart(){
			$("body,iframe").bind("contextmenu", function (e) {
				return false; 
			});
			$(window).bind("contextmenu", function (e) {
				return false; 
			});
			if(DetectIos() || DetectAndroid()){
				$("#menuTOC").css("width","100%");
				$("#menuTOC").css("left","-"+($("#menuTOC").width()+2)+"px");
				$("#menuTOC").css("background-color","white");
				$("#butTOC img").attr("src","images/expand_close.png").bind("click",showHideTOC);
				//$("#menuTOC").css("width","100%");
				//$("#menuTOC").width()
			}
			setupPageArray();
            //get the iFrame sized correctly and set up
            SetupIFrame();
			
			for(s=0;s<pageArray.length;s++){
				currentState.dataIndex.push({pageIndex : s, id : pageArray[s].id, attempted : false, numberattempted : 0, numberquizzed : 0, totalTime : 0, score : [], passed : false, quizzed : false});
			}

            //get activity_id bookmark if it exists
			if(!isoffline){
				var stateResult = tincan.getState("location");
				if (stateResult.err === null && stateResult.state !== null && stateResult.state.contents !== "") {
					//alert(stateResult.state.contents);
					tempState = JSON.parse(stateResult.state.contents);
					if(typeof(tempState.dataIndex) != "undefined" && tempState.dataIndex.length == currentState.dataIndex.length){
						currentState.dataIndex = tempState.dataIndex;
						//currentState.scoreIndex = tempState.scoreIndex;
						currentState.completed = tempState.completed;
						currentState.success = tempState.success;
						currentState.score = tempState.score;
						currentState.totalTime = tempState.totalTime;
						currentState.totalReset = tempState.totalReset;
						currentState.failed = tempState.failed;
						totalTime = currentState.totalTime;
						//alert(currentState.completed);
						/*if (confirm("ท่านต้องการไปหน้า \""+pageArray[tempState.lastSeenIndex].title+"\"\nซึ่งเป็นบทเรียนล่าสุดที่ท่านเข้าเรียนหรือไม่?")) {
							currentPage = tempState.lastSeenIndex;
						}*/
						if(isResume){
							currentPage = tempState.lastSeenIndex;
						}
					}
					else{
						/*alert("ไม่สามารถโหลดข้อมูลการเรียนได้\nกรุณาเข้าเรียนใหม่อีกครั้ง");
						isexit  = true;
						chkDoUnload = true;
						sendExitedStatement();
						window.close();*/
						if(isResume){
							currentPage = 0;
						}
					}
				}
				else {
					// if there isn't a stored bookmark, start the user at the first page
					if(stateResult.err === null && stateResult.state !== null && stateResult.state.contents === ""){
						if(isResume){
							currentPage = 0;
						}
					}
					else if(stateResult.err !== null){
						alert("ไม่สามารถโหลดข้อมูลการเรียนได้\nกรุณาเข้าเรียนใหม่อีกครั้ง");
						isexit  = true;
						chkDoUnload = true;
						sendExitedStatement();
						window.close();
					}
				}
			}
			drawTOC();
			$("#timeStamp").html(getTimeString(totalTime));
            goToPage();
			intervalTimeID = setInterval(function(){
				++totalTime;if(currentState&&currentState.dataIndex&&currentState.dataIndex[currentPage]){++currentState.dataIndex[currentPage].totalTime;}
				$("#timeStamp").html(getTimeString(totalTime));
				updateStatus();
				//alert(getTimeISO8601(totalTime));
			},1000);
			intervalScrollID = setInterval(function(){ $("#menuTOCStatus").css("bottom",(5-$("#menuTOC").scrollTop())+"px"); },10);
			$(window).bind('beforeunload', function(){
				if(!isexit && !currentState.dataIndex[currentPage].passed && !pageArray[currentPage].activity && !pageArray[currentPage].atcp){
					return 'ถ้าคุณออกจากบทเรียนตอนนี้ คุณต้องเรียนหน้านี้ใหม่อีกครั้ง\nคุณต้องการออกตอนนี้หรือไม่';
				}
			});
			hasIntial = true;
        }
		function strip(html)
			{
			   var tmp = document.implementation.createHTMLDocument("New").body;
			   tmp.innerHTML = html;
			   return tmp.textContent || tmp.innerText || "";
			}

        function goToPage(page){
			sendCurrentState();
			if(islinear){
				setCurrentState();
				if(!isLinearPattern(page)){
					var temppage = currentPage;
					if(typeof(page) != "undefined"){
						temppage = page;
					}
					
					var res_text = "กรุณาเรียนบทเรียนก่อนหน้า \n\""+strip(pageArray[temppage].title)+"\" ให้ผ่านก่อน";
					alert(res_text);
					//alert("กรุณาเรียนบทเรียนก่อนหน้า \""+pageArray[temppage].title+"\" ให้ผ่านก่อน");
					currentPage = lastPage;
					drawTOC();
					return false;
				}
			}
			if(typeof(page) != "undefined"){
				currentPage = page;
			}
			if(pageArray[currentPage].limitattempted != 0 && pageArray[currentPage].limitattempted <= currentState.dataIndex[currentPage].numberattempted){
				var temptitle = '';
				for(var i = 0; i < treeArray.length; i++){
					if(treeArray[i].ispage && treeArray[i].indexpage == currentPage){
						temptitle = treeArray[i].text;
					}
				}
				alert("คุณไม่สามารถเข้าหน้า \""+temptitle+"\"\nเนื่องจากคุณเข้าเรียนในหน้านี้ครบจำนวนครั้งที่กำหนดแล้ว");
				currentPage = lastPage;
				drawTOC();
				return false;
			}
			if(pageArray[currentPage].limitquizzed != 0 && pageArray[currentPage].limitquizzed <= currentState.dataIndex[currentPage].numberquizzed){
				var temptitle = '';
				for(var i = 0; i < treeArray.length; i++){
					if(treeArray[i].ispage && treeArray[i].indexpage == currentPage){
						temptitle = treeArray[i].text;
					}
				}
				if(pageArray[currentPage].reset && pageArray[currentPage].resetwhenquizzed <= currentState.dataIndex[currentPage].numberquizzed){
					checkReset();
					return false;
				}
				else{
					alert("คุณไม่สามารถเข้าหน้า \""+temptitle+"\"\nเนื่องจากคุณทำแบบทดสอบในหน้านี้ครบจำนวนครั้งที่กำหนดแล้ว");
					currentPage = lastPage;
					drawTOC();
					return false;
				}
			}
			setCurrentState();
			var chkconfirm = true;
			if(!currentState.dataIndex[lastPage].passed && !pageArray[lastPage].activity && !pageArray[currentPage].atcp){
				chkconfirm = confirm('ถ้าคุณเปลี่ยนหน้าตอนนี้ คุณต้องเรียนหน้านี้ใหม่อีกครั้ง\nคุณต้องการเปลี่ยนตอนนี้หรือไม่');
			}
			if(chkconfirm){
				setPositionTitle();
				var theIframe = document.getElementById("contentFrame"),
					prevButton = $("#butPrevious"),
					nextButton = $("#butNext"),
					prevButtonDisable = $("#butPreviousDisable"),
					nextButtonDisable = $("#butNextDisable");

				//pass the TC arguments to the iframe
				var tc_argStr = (pageArray[currentPage].url.indexOf("?") != -1) ? "&" + location.search.slice(1) : location.search;
				if(isoffline && typeof(pageArray[currentPage].urlOffline) != "undefined"){
					tc_argStr = (pageArray[currentPage].urlOffline.indexOf("?") != -1) ? "&" + location.search.slice(1) : location.search;
				}
				//navigate the iFrame to the content
				theIframe.src = pageArray[currentPage].url + tc_argStr;
				if(isoffline && typeof(pageArray[currentPage].urlOffline) != "undefined"){
					theIframe.src = pageArray[currentPage].urlOffline + tc_argStr;
				}

				//disable the prev/next buttons if we are on the first or last page.
				if (currentPage == 0){
					if(pageArray.length == 1){
						nextButton.hide();
						nextButtonDisable.show();
						prevButton.hide();
						prevButtonDisable.show();
					}
					else{
						nextButton.show();
						nextButtonDisable.hide();
						prevButton.hide();
						prevButtonDisable.show();
					}
				}
				else if (currentPage == (pageArray.length - 1)){
						nextButton.hide();
						nextButtonDisable.show();
						prevButton.show();
						prevButtonDisable.hide();
						
				}
				else{
						nextButton.show();
						nextButtonDisable.hide();
						prevButton.show();
						prevButtonDisable.hide();
				}

				// save the current location as the bookmark
				//tincan.setState("location", currentState, function () {});
				var newData = sendCurrentState();
				if(newData){
					sendAttemptedStatement();
					if(!pageArray[currentPage].activity){
						if(pageArray[currentPage].atcp){
							sendExperiencedStatement();
						}
					}
					currentState.dataIndex[currentPage].attempted = true;
					++currentState.dataIndex[currentPage].numberattempted;
					setCurrentState();
					sendCurrentState();
					updateStatus();
					drawTOC();
					lastPage = currentPage;
				}
			}
			else{
				currentPage = lastPage;
				drawTOC();
			}
			if(DetectIos() || DetectAndroid()){
				if(isShowTOC){
					showHideTOC();
				}
			}
        }

		function isEmptyState(){
			if(!isoffline){
				var stateResult = tincan.getState("location");
				if (stateResult.err === null && stateResult.state !== null && stateResult.state.contents !== "") {
					return false;
				}
				else{
					return true;
				}
			}
			else{
				return false;
			}
		}
		

		//send current state to lrs
		function sendCurrentState(){
			//setCurrentState();
			if(!isoffline){
				var stateResult = tincan.getState("location");
				if (stateResult.err === null && stateResult.state !== null && stateResult.state.contents !== "") {
					//alert(stateResult.state.contents);
					tempState = JSON.parse(stateResult.state.contents);
					if(typeof(tempState.dataIndex) != "undefined" && tempState.dataIndex.length == currentState.dataIndex.length){			
						//same reset
						if(currentState.totalReset == tempState.totalReset){
							for(var i = 0; i < tempState.dataIndex.length; i++){
								if(!currentState.dataIndex[i].attempted && tempState.dataIndex[i].attempted){
									currentState.dataIndex[i].attempted = tempState.dataIndex[i].attempted;
									currentState.dataIndex[i].numberattempted = tempState.dataIndex[i].numberattempted;
								}
								if(currentState.dataIndex[i].numberattempted < tempState.dataIndex[i].numberattempted){
									currentState.dataIndex[i].numberattempted = tempState.dataIndex[i].numberattempted;
								}
								if(!currentState.dataIndex[i].quizzed && tempState.dataIndex[i].quizzed){
									currentState.dataIndex[i].quizzed = tempState.dataIndex[i].quizzed;
									currentState.dataIndex[i].numberquizzed = tempState.dataIndex[i].numberquizzed;
									currentState.dataIndex[i].score = tempState.dataIndex[i].score;
								}
								if(currentState.dataIndex[i].numberquizzed < tempState.dataIndex[i].numberquizzed){
									currentState.dataIndex[i].numberquizzed = tempState.dataIndex[i].numberquizzed;
									currentState.dataIndex[i].score = tempState.dataIndex[i].score;
								}
								if(!currentState.dataIndex[i].passed && tempState.dataIndex[i].passed){
									currentState.dataIndex[i].passed = tempState.dataIndex[i].passed;
								}
								if(currentState.dataIndex[i].totalTime < tempState.dataIndex[i].totalTime){
									currentState.dataIndex[i].totalTime = tempState.dataIndex[i].totalTime;
								}
							}
							if(!currentState.completed && tempState.completed){
								currentState.completed = tempState.completed;
							}
							if(!currentState.success && tempState.success){
								currentState.success = tempState.success;
								currentState.score = tempState.score;
							}
							if(!currentState.failed && tempState.failed){
								currentState.failed = tempState.failed;
							}
						}
						//not same reset
						else{
							//current is old before reset
							if(currentState.totalReset < tempState.totalReset){
								currentState.dataIndex = tempState.dataIndex;
								//currentState.scoreIndex = tempState.scoreIndex;
								currentState.completed = tempState.completed;
								currentState.success = tempState.success;
								currentState.score = tempState.score;
								currentState.totalReset = tempState.totalReset;
								currentState.failed = tempState.failed;
							}
						}
						if(currentState.totalTime < tempState.totalTime){
							currentState.totalTime = tempState.totalTime;
							totalTime = currentState.totalTime;
						}
						tincan.setState("location", currentState);
						return true;
					}
					else{
						/*alert("ไม่สามารถโหลดข้อมูลการเรียนได้\nกรุณาเข้าเรียนใหม่อีกครั้ง");
						isexit  = true;
						chkDoUnload = true;
						sendExitedStatement();
						window.close();
						return false;*/
						tincan.setState("location", currentState);
						return true;
					}
				}
				else {
					// if there isn't a stored bookmark
					if(stateResult.err === null && stateResult.state !== null && stateResult.state.contents === ""){
						tincan.setState("location", currentState);
						return true;
					}
					else if(stateResult.err !== null){
						alert("ไม่สามารถโหลดข้อมูลการเรียนได้\nกรุณาเข้าเรียนใหม่อีกครั้ง");
						isexit  = true;
						chkDoUnload = true;
						sendExitedStatement();
						window.close();
						return false;
					}
					tincan.setState("location", currentState);
					return true;
				}
			}
			else{
				return true;
			}
		}

		//delete current state from lrs
		function deleteCurrentState(){
			//setCurrentState();
			if(!isoffline){
				tincan.deleteState("location", function () {});
				//alert(JSON.stringify(currentState));
			}
		}
		
		//set current state array
		function setCurrentState(){
			if(typeof(currentState.dataIndex[currentState.lastSeenIndex]) != "undefined" && !currentState.dataIndex[currentState.lastSeenIndex].passed && currentState.dataIndex[currentState.lastSeenIndex].attempted){
				if(!pageArray[currentState.lastSeenIndex].activity){
					if(pageArray[currentState.lastSeenIndex].atcp){
						currentState.dataIndex[currentState.lastSeenIndex].passed = true;
						currentState.dataIndex[currentState.lastSeenIndex].quizzed = true;
					}
				}
				else{//for activity

				}
			}
			var chkAttemptedAll = true;
			var chkPassedAll = true;
			for(var curr = 0; curr < currentState.dataIndex.length; curr++){
				if(completedWhenDoAllMasteryscore){
					if(typeof(pageArray[currentState.dataIndex[curr].pageIndex]) != "undefined" && pageArray[currentState.dataIndex[curr].pageIndex].activity && pageArray[currentState.dataIndex[curr].pageIndex].masteryscore >= 0 && !currentState.dataIndex[curr].passed){
						chkAttemptedAll = false;
						chkPassedAll = false;
					}
				}
				else{
					if(currentState.dataIndex[curr].attempted){
						if(!currentState.dataIndex[curr].passed){
							chkPassedAll = false;
						}
						if(!currentState.dataIndex[curr].quizzed){
							chkAttemptedAll = false;
						}
					}
					else{
						chkAttemptedAll = false;
						chkPassedAll = false;
					}
				}
			}
			if(chkPassedAll){
				if(!currentState.success){
					setOverAllScore();
					currentState.success = true;
				}
			}
			if(chkAttemptedAll){
				if(!currentState.completed){
					currentState.completed = true;
				}
				/*if((hasActivity() && chkPassedAll) || !hasActivity()){
					if(!currentState.completed){
						currentState.completed = true;
						//sendCompleteStatement();
					}
				}*/
				if(currentState.success && currentState.completed){
					if(!sendAllPassed){
						sendCompleteStatement();
						sendAllPassed = true;
						alert("คุณเรียนผ่านหลักสูตรนี้เรียบร้อยแล้ว");
					}
				}
			}
			currentState.lastSeenIndex = currentPage;
			currentState.totalTime = totalTime;
		}
		
		//set average of sum page that have score 
		function setOverAllScore(){
			if(hasActivity()){
				var tempOverAllScore = 0;
				var numactivity = 0;
				for(var curr = 0; curr < currentState.dataIndex.length; curr++){
					if(pageArray[currentState.dataIndex[curr].pageIndex].activity && currentState.dataIndex[curr].score.length > 0 && (typeof(pageArray[currentState.dataIndex[curr].pageIndex].calculatescore) == "undefined" || (typeof(pageArray[currentState.dataIndex[curr].pageIndex].calculatescore) != "undefined" && pageArray[currentState.dataIndex[curr].pageIndex].calculatescore) ) ){
						tempOverAllScore += currentState.dataIndex[curr].score[0].percent;
						++numactivity;
					}
				}
				currentState.score = tempOverAllScore/numactivity;
			}
		}

		function hasActivity(){
			var hasAct = false;
			for(var curr = 0; curr < currentState.dataIndex.length; curr++){
				if(pageArray[currentState.dataIndex[curr].pageIndex].activity){
					hasAct = true;
				}
			}
			return hasAct;
		}

		//get json to use in result statement
		function getResultJSON(){
			var resultJSON = {};
			if(currentState.completed){
				if(hasActivity()){
					setOverAllScore();
					resultJSON = {
								   completion: currentState.completed,
								   success : currentState.success,
								   score : {
									   scaled: currentState.score/100,
										raw : currentState.score,
										min : 0,
										max : 100
									},
								   duration : getTimeISO8601(totalTime)
							   };
				}
				else{
					resultJSON = {
								   completion: currentState.completed,
								   success : currentState.success,
								   duration : getTimeISO8601(totalTime)
							   };
				}
			}
			else{
				resultJSON = {
							   completion: currentState.completed,
							   duration : getTimeISO8601(totalTime)
						   };
			}
			return resultJSON;
		}

		function sendAllStatement(verb,title){
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
							verb: verb,
							context: Content.getContext(
								Content.CourseActivity.id
							)
				};
				tincan.sendStatement(stmt);
			}
		}

		function sendAllModifyStatement(verb,title){
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": pageArray[currentPage].title+" "+title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
							verb: verb,
							context: Content.getContext(
								Content.CourseActivity.id
							)
				};
				tincan.sendStatement(stmt);
			}
		}

		function sendAllFullStatement(verb,title,name){
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
							verb: {
								id : verb,
								display : {
									und : name
								}
							},
							context: Content.getContext(
								Content.CourseActivity.id
							)
				};
				tincan.sendStatement(stmt);
			}
		}

		function sendAllFullModifyStatement(verb,title,name){
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": pageArray[currentPage].title+" "+title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
							verb: {
								id : verb,
								display : {
									und : name
								}
							},
							context: Content.getContext(
								Content.CourseActivity.id
							)
				};
				tincan.sendStatement(stmt);
			}
		}

		function sendAllFullModifyStatementAsync(verb,title,name){
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": pageArray[currentPage].title+" "+title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
							verb: {
								id : verb,
								display : {
									und : name
								}
							},
							context: Content.getContext(
								Content.CourseActivity.id
							)
				};
				tincan.sendStatement(stmt,function(){ });
			}
		}

		function sendExperiencedModifyStatement(title){
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": pageArray[currentPage].title+" "+title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
							verb: "experienced",
							context: Content.getContext(
								Content.CourseActivity.id
							)
				};
				tincan.sendStatement(stmt);
			}
		}

		function sendExperiencedStatement(){
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": pageArray[currentPage].title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
							verb: "experienced",
							context: Content.getContext(
								Content.CourseActivity.id
							)
				};
				tincan.sendStatement(stmt);
			}
		}
		
		function sendAttemptedStatement(){
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": pageArray[currentPage].title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
							verb: "attempted",
							context: Content.getContext(
								Content.CourseActivity.id
							)
				};
				tincan.sendStatement(stmt);
			}
		}

		//send complete state to lrs
		function sendCompleteStatement(){
			var txtverb = "passed";
			if(!currentState.success){
				txtverb = "failed";
			}
			if(!isoffline){
				var stmt = {
						   verb: txtverb,
						   /*object: {
							   id: Content.CourseActivity.id
						   },*/
						   result: getResultJSON(),
						   context: Content.getContext()
				};
				tincan.sendStatement(stmt);
			}
		}

		//send fail state to lrs
		function sendFailStatement(){
			var txtverb = "failed";
			if(!isoffline){
				var stmt = {
						   verb: txtverb,
						   /*object: {
							   id: Content.CourseActivity.id
						   },*/
						   result: getResultJSON(),
						   context: Content.getContext()
				};
				tincan.sendStatement(stmt);
			}
		}
		
		//send exited state to lrs >> send timestamp
		function sendExitedStatement(){
			if(!isoffline){
				var stmt = {
						   /*verb: "http://adlnet.gov/expapi/verbs/exited",
						   object: {
							   id: Content.CourseActivity.id
						   },*/
						   verb: {
								id : "http://adlnet.gov/expapi/verbs/exited",
								display : {
									und : "exited"
								}
							},
						   result: {
								duration : getTimeISO8601(totalTime)	
							},
						   context: Content.getContext()
				};
				tincan.sendStatement(stmt);
			}
		}
		
		//add score to array in currentstate and check passed from that score
		function setCurrentPageScore(rawScore,totalScore,percentScore){
			//currentState.dataIndex[currentPage].score.push({raw : rawScore, total : totalScore, percent : percentScore});
			currentState.dataIndex[currentPage].score[0] = {raw : rawScore, total : totalScore, percent : percentScore};
			if(pageArray[currentPage].activity){
				if(percentScore >= pageArray[currentPage].masteryscore){/* if(percentScore >= currentState.dataIndex[currentPage].masteryscore && currentState.dataIndex[currentPage].activity && !currentState.dataIndex[currentPage].passed){ */
					currentState.dataIndex[currentPage].passed = true;
				}
				else{
					/*currentState.dataIndex[currentPage].passed = false;*/
				}
				currentState.dataIndex[currentPage].quizzed = true;
				++currentState.dataIndex[currentPage].numberquizzed;
				checkReset();
			}
		}

		function getCurrentPagePassedStatus(){
			return currentState.dataIndex[currentPage].passed;
		}

		function getCurrentPageNumberQuizzed(){
			return currentState.dataIndex[currentPage].numberquizzed;
		}

		function checkReset(){
			if(!currentState.dataIndex[currentPage].passed && pageArray[currentPage].reset && pageArray[currentPage].limitquizzed > 0 && ((pageArray[currentPage].resetwhenquizzed == 0 && currentState.dataIndex[currentPage].numberquizzed == pageArray[currentPage].limitquizzed) || (pageArray[currentPage].resetwhenquizzed > 0 && pageArray[currentPage].resetwhenquizzed <= currentState.dataIndex[currentPage].numberquizzed))){
				var tempnumquizzed = pageArray[currentPage].limitquizzed;
				if(pageArray[currentPage].resetwhenquizzed > 0){
					tempnumquizzed = pageArray[currentPage].resetwhenquizzed;
				}
				if(pageArray[currentPage].limitreset == 0 || (pageArray[currentPage].limitreset > 0 && pageArray[currentPage].limitreset > currentState.totalReset)){
						alert("คุณทำแบบทดสอบในหน้า \""+pageArray[currentPage].title+"\" ครบ "+tempnumquizzed+" ครั้ง\nและไม่ผ่านเกณฑ์\nระบบจะให้คุณเริ่มเรียนใหม่อีกครั้ง");
						resetStatus();
						goToPage(0);
				}
				else if(pageArray[currentPage].limitreset > 0 && pageArray[currentPage].limitreset <= currentState.totalReset){
					currentState.failed = true;
				}
			}
			/*if(!currentState.dataIndex[currentPage].passed && pageArray[currentPage].limitquizzed > 0 && pageArray[currentPage].limitquizzed == currentState.dataIndex[currentPage].numberquizzed){
				currentState.failed = true;
			}*/
		}

		function checkResetDITP(){
			if(!currentState.dataIndex[currentPage].passed && pageArray[currentPage].reset && pageArray[currentPage].limitquizzed > 0 && ((pageArray[currentPage].resetwhenquizzed == 0 && currentState.dataIndex[currentPage].numberquizzed == pageArray[currentPage].limitquizzed) || (pageArray[currentPage].resetwhenquizzed > 0 && pageArray[currentPage].resetwhenquizzed <= currentState.dataIndex[currentPage].numberquizzed))){
				var tempnumquizzed = pageArray[currentPage].limitquizzed;
				if(pageArray[currentPage].resetwhenquizzed > 0){
					tempnumquizzed = pageArray[currentPage].resetwhenquizzed;
				}
				if(pageArray[currentPage].limitreset == 0 || (pageArray[currentPage].limitreset > 0 && pageArray[currentPage].limitreset > currentState.totalReset)){
						alert("คุณทำแบบทดสอบในหน้า \""+pageArray[currentPage].title+"\" ครบ "+tempnumquizzed+" ครั้ง\nและไม่ผ่านเกณฑ์\nระบบจะให้คุณเริ่มเรียนใหม่อีกครั้ง");
						resetStatusDITP();
						goToPage(0);
				}
				else if(pageArray[currentPage].limitreset > 0 && pageArray[currentPage].limitreset <= currentState.totalReset){
					currentState.failed = true;
				}
			}
		}

		function checkCurrentOverLimitquizzed(){
			if(pageArray[currentPage].limitquizzed != 0 && pageArray[currentPage].limitquizzed <= currentState.dataIndex[currentPage].numberquizzed){
				return true;
			}
			else{
				return false;
			}
		}

		function isCurrentAttempted(){
			return currentState.dataIndex[currentPage].attempted;
		}

		function getFailed(){
			return currentState.failed;
		}
		
		function getCompleted(){
			return currentState.completed;
		}

        function doFinish(){
        }
		
		var chkDoUnload = false;
		function doUnload(){
			if(hasIntial){
				if(intervalTimeID != null && intervalScrollID != null){
					clearInterval(intervalTimeID);
					intervalTimeID = null;
					clearInterval(intervalScrollID);
					intervalScrollID = null;
				}
				if(!isoffline){
					if(!chkDoUnload){
						chkDoUnload = true;
						setCurrentState();
						var newData = sendCurrentState();
						if(newData){
							if(currentState.completed && currentState.success){
								if(!sendAllPassed){
									sendCompleteStatement();
									sendAllPassed = true;
								}
							}
							else if(currentState.failed){
								deleteCurrentState();
								sendFailStatement();
							}
							sendExitedStatement();
						}
					}
				}
			}
		}

		var sendAllPassed = false;
		function doPassed(){
			if(!isoffline){
					setCurrentState();
					var newData = sendCurrentState();
					if(newData){
						if(currentState.completed && currentState.success){
							if(!sendAllPassed){
								sendCompleteStatement();
								sendAllPassed = true;
							}
						}
					}
			}
		}
		
		var isexit = false;
		function doExit(){
			if(!currentState.dataIndex[currentPage].passed && !pageArray[currentPage].activity && !pageArray[currentPage].atcp){
				if(confirm("ถ้าคุณออกจากบทเรียนตอนนี้ คุณต้องเรียนหน้านี้ใหม่อีกครั้ง\nคุณต้องการออกตอนนี้หรือไม่")){
					goExit();
				}
			}
			else{
				goExit();
			}
        }

		function goExit(){
			doUnload();
			isexit  = true;
			window.close();
		}

		function forceExit(){
			isexit  = true;
			chkDoUnload = true;
			sendExitedStatement();
			window.close();
		}

        function doPrevious(){
				sendCurrentState();
				if (currentPage > 0){
					currentPage--;
				}
				goToPage();
        }

        function doNext(){
				sendCurrentState();
				if(islinear && !currentState.dataIndex[currentPage].passed && !pageArray[currentPage].atcp){
					alert("กรุณาเรียนบทเรียนในหน้าปัจจุบันให้ผ่านก่อน\nคุณถึงสามารถเรียนหัวข้อถัดไปได้");
					return;
				}
				if (currentPage < (pageArray.length - 1)){
					currentPage++;
				}
				goToPage();
        }

        //called from the assessmenttemplate.html page to record the results of a test
        //passes in score as a percentage
        function GetRecordTestStatement(score, activityId){
            // send score
            var scaledScore = score / 100,
                success = (scaledScore >= 0.8);

            var stmt = {
                verb: "http://adlnet.gov/expapi/verbs/completed",
                object: {
                    id: activityId
                },
                result: {
                    score: {
                        scaled: scaledScore,
                        raw: score,
                        min: 0,
                        max: 100
                    },
                    success: success
                },
                context: Content.getContext(Content.CourseActivity.id)
            };

            return stmt;
        }

        //called from the assessmenttemplate.html page to record the results of a question
        function GetQuestionAnswerStatement(id, questionText, questionChoices, questionType, learnerResponse, correctAnswer, wasCorrect, activityId){
            if (typeof console !== 'undefined') {
                console.log("GetQuestionAnswerStatement");
            }

            //send question info
            var qObj = {
                id: id,
                definition: {
                    type: "http://adlnet.gov/expapi/activities/cmi.interaction",
                    description: {
                        "en-US": questionText
                    },
                    interactionType: questionType,
                    correctResponsesPattern: [
                        String(correctAnswer)
                    ]
                }
            };

            if(questionChoices !== null && questionChoices.length > 0){
                var choices = [];
                for(var i = 0; i < questionChoices.length; i++){
                    var choice = questionChoices[i];
                    choices.push(
                        {
                            id: choice,
                            description: {
                                "en-US": choice
                            }
                        }
                    );
                }
                if (typeof console !== 'undefined') {
                    console.log(qObj);
                }
                qObj.definition.choices = choices;
            }

            return {
                verb: "http://adlnet.gov/expapi/verbs/answered",
                object: qObj,
                result: {
                    response: learnerResponse,
                    success: wasCorrect
                },
                context: Content.getContext(activityId)
            }
        }

        function FormatChoiceResponse(value){
            var newValue = new String(value);

            //replace all whitespace
            newValue = newValue.replace(/\W/g, "_");

            return newValue;
        }

		if(window.addEventListener){     
			window.addEventListener('orientationchange',updateOC,false); //W3C 
			if(!DetectAndroid() && !DetectIos() && !DetectWindowsPhone()){
				window.addEventListener('resize',updateOC,false); //W3C 
			}
		} 
		else{     
			window.attachEvent('onorientationchange',updateOC); //IE 	
			window.attachEvent('onresize',updateOC); //IE 
		}

		function updateOC(){
			if(!DetectAndroid() && !DetectIos() && !DetectWindowsPhone()){
				SetupIFrame();
			}
			else{
				setTimeout(function(){
					SetupIFrame();
				},500);
			}
		}
		
		var isShowTOC = false;
		function showHideTOC(){
			//$(".showqtip").qtip('destroy', true);
			if(!isShowTOC){
				$("#menuTOC").stop().animate({
					left : "0"
				},500);
				isShowTOC = true;
				$("#butTOC img").attr("src","images/expand_open.png");
			}
			else{
				$("#menuTOC").stop().animate({
					left : "-"+($("#menuTOC").width()+2)
				},500);
				isShowTOC = false;
				$("#butTOC img").attr("src","images/expand_close.png");
			}
		}
		
		var isShowStatus = false;
		var isCurrentPage = true;
		var statuspage = 0;
		function setShowHideStatus(page){
			if(page != currentPage){
				isCurrentPage = false;
			}
			else{
				isCurrentPage = true;
			}
			isShowStatus = false;
			statuspage = parseInt(page);
			showHideStatus();
		}

		function showHideStatus(){
			updateStatus();
			if(!isShowStatus){
				isShowStatus = true;
				$("#menuTOCStatus").show();
			}
			else{
				isShowStatus = false;
				$("#menuTOCStatus").hide();
			}
		}

		function updateStatus(){
			$("#menuTOCStatus").css("width","auto");
			var indexp = 0;
			if(!isCurrentPage){
				indexp = parseInt(statuspage);
			}
			else{
				indexp = parseInt(currentPage);
			}
			var txtqtip = "ชื่อ : ";
			for(var i = 0; i < treeArray.length; i++){
				if(treeArray[i].ispage && treeArray[i].indexpage == indexp){
					txtqtip += treeArray[i].text;
				}
			}
			txtqtip += "<br>สถานะ : ";
			if(currentState.dataIndex[indexp].passed){
				txtqtip += "ผ่าน";
			}
			else if(currentState.dataIndex[indexp].attempted && currentState.dataIndex[indexp].pageIndex == currentPage){
				txtqtip += "กำลังเรียน";
			}
			else if(currentState.dataIndex[indexp].attempted && !currentState.dataIndex[indexp].passed){
				txtqtip += "ไม่ผ่าน";
			}
			else{
				txtqtip += "ไม่เคยเข้าเรียน";
			}
			txtqtip += "<br>เข้าเรียน : " + currentState.dataIndex[indexp].numberattempted+" ครั้ง";
			if(pageArray[indexp].limitattempted > 0){
				txtqtip += "<br>จำกัดการเข้าเรียน : " + pageArray[indexp].limitattempted+" ครั้ง";
			}
			/*txtqtip += "<br>Limit Attempted : ";
			if(currentState.dataIndex[indexp].limitattempted == 0){
				txtqtip += "Unlimit";
			}
			else{
				txtqtip += currentState.dataIndex[indexp].limitattempted;
			}*/
			if(pageArray[indexp].activity){
				txtqtip += "<br>ทำแบบทดสอบ : " + currentState.dataIndex[indexp].numberquizzed+" ครั้ง";
				if(pageArray[indexp].limitquizzed > 0){
					txtqtip += "<br>จำกัดการทำแบบทดสอบ : " + pageArray[indexp].limitquizzed+" ครั้ง";
				}
				txtqtip += "<br>คะแนนครั้งล่าสุด : ";
				if(currentState.dataIndex[indexp].numberquizzed > 0 && currentState.dataIndex[indexp].score.length > 0){
					txtqtip += currentState.dataIndex[indexp].score[0].percent + "%";
				}
				else{
					txtqtip += "-";
				}
				if(pageArray[indexp].masteryscore > 0){
					txtqtip += "<br>เกณฑ์คะแนนที่ผ่าน : ตั้งแต่ " + pageArray[indexp].masteryscore+"% ขึ้นไป";
				}
				/*txtqtip += "<br>Mastery Score : " + currentState.dataIndex[indexp].masteryscore + "%";*/
			}
			txtqtip += "<br>เวลา : " + getTimeString(currentState.dataIndex[indexp].totalTime);
			$("#menuTOCStatus").html(txtqtip);
			//console.log($("#menuTOCStatus").width());
			if($("#menuTOC").get(0).scrollHeight > $("#menuTOC").height()){
				if($("#menuTOCStatus").width() < 265){
					$("#menuTOCStatus").css("width","265px");
				}
			}
			else{
				if($("#menuTOCStatus").width() < 280){
					$("#menuTOCStatus").css("width","280px");
				}
			}
		}

		function updateTree(){
			setPassedTree();
			setChildAttempted();
			setChildPassed();
			setIconTree();
			setCurrentNode();
		}

		function setCurrentNode(){
			for(var i=0;i<treeArray.length;i++){
				if(treeArray[i].ispage){
					if(treeArray[i].id == currentState.dataIndex[currentPage].id){
						treeArray[i].state = { selected : true };
						if(treeArray[i].activity){
							treeArray[i].icon = "./images/test_can.png";
						}
						else{
							treeArray[i].icon = "./images/item_can.png";
						}
					}
					else{
						treeArray[i].state = { selected : false };
					}
				}
			}
		}

		function setIconTree(){
			for(var i=0;i<treeArray.length;i++){
				if(treeArray[i].ispage){
					if(treeArray[i].passed){
						if(treeArray[i].activity){
							treeArray[i].icon = "./images/test_can_pass.png";
						}
						else{
							treeArray[i].icon = "./images/item_can_pass.png";
						}
					}
					else if(treeArray[i].attempted){
						if(treeArray[i].activity){
							treeArray[i].icon = "./images/test_can_fail.png";
						}
						else{
							treeArray[i].icon = "./images/item_can_fail.png";
						}
					}
					else{
						if(treeArray[i].activity){
							treeArray[i].icon = "./images/test_cannot.png";
						}
						else{
							treeArray[i].icon = "./images/item_cannot.png";
						}
					}
				}
				else{
					if(treeArray[i].passed){
						treeArray[i].icon = "./images/folderopen_can_pass.png";
					}
					else if(treeArray[i].attempted){
						treeArray[i].icon = "./images/folderopen_can.png";
					}
					else{
						treeArray[i].icon = "./images/folderopen_cannot.png";
					}
				}
			}
		}

		function setPassedTree(){
			for(var i=0;i<treeArray.length;i++){
				if(typeof(treeArray[i].attempted) == "undefined"){
					treeArray[i].attempted = false;
					treeArray[i].passed = false;
				}
			}
		}

		function setChildAttempted(){
			for(var a=0;a<treeArray.length;a++){
				if(treeArray[a].ispage){
					for(var b=0;b<currentState.dataIndex.length;b++){
						if(treeArray[a].id == currentState.dataIndex[b].id){
							treeArray[a].attempted = currentState.dataIndex[b].attempted;
							setParentAttempted(treeArray[a].parent);
						}
					}
				}
			}
			for(var a=0;a<treeArray.length;a++){
				if(!treeArray[a].ispage){
					setParentAttempted(treeArray[a].parent);
				}
			}
		}

		function setParentAttempted(parentid){
			var parentattempted = false;
			for(var z=0;z<treeArray.length;z++){
				if(treeArray[z].parent == parentid){
					if(treeArray[z].attempted){
						parentattempted = true;
						break;
					}
				}
			}
			for(var z=0;z<treeArray.length;z++){
				if(treeArray[z].id == parentid){
					treeArray[z].attempted = parentattempted;
				}
			}
		}

		function setChildPassed(){
			for(var a=0;a<treeArray.length;a++){
				if(treeArray[a].ispage){
					for(var b=0;b<currentState.dataIndex.length;b++){
						if(treeArray[a].id == currentState.dataIndex[b].id){
							treeArray[a].passed = currentState.dataIndex[b].passed;
							setParentPassed(treeArray[a].parent);
						}
					}
				}
			}
			for(var a=0;a<treeArray.length;a++){
				if(!treeArray[a].ispage){
					setParentPassed(treeArray[a].parent);
				}
			}
		}

		function setParentPassed(parentid){
			var parentpassed = true;
			for(var z=0;z<treeArray.length;z++){
				if(treeArray[z].parent == parentid){
					if(!treeArray[z].passed){
						parentpassed = false;
						break;
					}
				}
			}
			for(var z=0;z<treeArray.length;z++){
				if(treeArray[z].id == parentid){
					treeArray[z].passed = parentpassed;
				}
			}
		}
		
		var isopenqtip = false;
		var lastScrollTop = 0;
		function drawTOC(){
			lastScrollTop = $("#menuTOC").scrollTop();
			//$("#menuTOCTop").html("Loading...");
			updateTree();
			if(!hasIntial){
				var titleTOC = "";
				if(typeof(Content.CourseActivity.definition.name["en-US"]) != "undefined"){
					titleTOC = Content.CourseActivity.definition.name["en-US"];
				}
				else if(typeof(Content.CourseActivity.definition.name["th-TH"]) != "undefined"){
					titleTOC = Content.CourseActivity.definition.name["th-TH"];
				}
				var  outputHTML = '';
				outputHTML += '<table id="menuTable">';
				outputHTML += '<tr>';
				outputHTML += '<th colspan="2">';
				outputHTML += titleTOC;
				outputHTML += '</th>';
				outputHTML += '</tr>';
				for(var i=0;i<treeArray.length;i++){
					if(treeArray[i].ispage){
						outputHTML += '<tr valign="top" style="cursor:pointer;color:#676767;" onclick="'+treeArray[i].a_attr.onclick+'" class="learning-tab ';
						if(currentPage == treeArray[i].indexpage){
							outputHTML += 'selected';
						}
						outputHTML += '">';
						outputHTML += '<td valign="top" style="width:20px;border-right:none;padding-right:0px;">';
						outputHTML += '<i class="learning-status fa fa-circle ';
						if(currentPage == treeArray[i].indexpage){
							outputHTML += 'blue-color';
						}
						else{
							if(treeArray[i].passed){
								outputHTML += 'green-color';
							}
							else if(treeArray[i].attempted){
								outputHTML += 'red-color';
							}
							else{
								outputHTML += 'grey-color';
							}
						}
						outputHTML += '"></i></td>';
						outputHTML += '<td valign="top" style="border-left:none;border-right:none;"><span class="wordwrap">';
						outputHTML += treeArray[i].text;
						outputHTML += '</span></td>';
						/*outputHTML += '<td style="width:20px;text-align: center;border-left:none;border-right:none;padding-right:0px;" valign="top">';
						if(treeArray[i].playicon){
							outputHTML += '<i class="far fa-play-circle" style="font-size:18px;"></i>';
						}
						outputHTML += '</td>';
						outputHTML += '<td style="width:50px;text-align: center;border-left:none;" valign="top">';
						outputHTML += treeArray[i].duration;
						outputHTML += '</td>';*/
						outputHTML += '</tr>';
					}
				}
				outputHTML += '</table>';
				$('#menuTOCTop').html(outputHTML);
			}
			else{
				$(".learning-tab").removeClass("selected");
				$(".learning-status").removeClass("blue-color green-color red-color grey-color");
				for(var i=0;i<treeArray.length;i++){
					if(treeArray[i].ispage){
						if(currentPage == treeArray[i].indexpage){
							$(".learning-tab").eq(treeArray[i].indexpage).addClass("selected");
							$(".learning-status").eq(treeArray[i].indexpage).addClass("blue-color");
						}
						else{
							if(treeArray[i].passed){
								$(".learning-status").eq(treeArray[i].indexpage).addClass("green-color");
							}
							else if(treeArray[i].attempted){
								$(".learning-status").eq(treeArray[i].indexpage).addClass("red-color");
							}
							else{
								$(".learning-status").eq(treeArray[i].indexpage).addClass("grey-color");
							}
						}
					}
				}
			}
			/*outputHTML = '<div class="headerTOC" style="position:relative;padding-bottom:15px;color:#84bd00;display:none;"><div style="position:absolute;left:0px;">'+getPercentProgress()+'% Complete</div><div style="position:absolute;right:0px;">เวลาที่เรียน <span id="timeStamp">' + getTimeString(totalTime) + '</span></div></div><p><div class="headerTOC" style="display:none;padding:0px 0px 0px 15px;"><a href="javascript:void(0);" data-balloon="Chatroom" data-balloon-pos="right" data-balloon-length="small" style="display:block;width:31px;"><img id="wbIcon" src="./images/2.png" style="border: none;display:none;margin-right:5" onclick="openWB();"></a><a href="javascript:void(0);" data-balloon="Chatroom" data-balloon-pos="right" data-balloon-length="small" style="display:block;width:31px;"><img id="chatIcon" src="./images/3.png" style="border: none;margin-left:5px;display:none;" onclick="openChat();"></a></div></p>';
			var titleTOC = "";
			if(typeof(Content.CourseActivity.definition.name["en-US"]) != "undefined"){
				titleTOC = Content.CourseActivity.definition.name["en-US"];
			}
			else if(typeof(Content.CourseActivity.definition.name["th-TH"]) != "undefined"){
				titleTOC = Content.CourseActivity.definition.name["th-TH"];
			}
			outputHTML += '<b><span style="color:#004392;font-size:16px;">' + titleTOC + '</span></b>';
			$('#menuTOCTop').html(outputHTML);*/
		}

		function isLinearPattern(page){
			var temppage = 0;
			if(typeof(page) != "undefined"){
				temppage = page;
			}
			else{
				temppage = currentPage;
			}
			if(temppage > 0/* && !(temppage === lastPage+1)*/){
				var chkBeforePassed = false;
				for(a=0;a<currentState.dataIndex.length;a++){
					if(currentState.dataIndex[a].pageIndex == temppage-1 && currentState.dataIndex[a].attempted && currentState.dataIndex[a].passed){
						chkBeforePassed = true;
					}
				}
				if(!chkBeforePassed){
					return false;
				}
			}
			return true;
		}

		function setContentStatusPassed(){
			currentState.dataIndex[currentPage].passed = true;
			currentState.dataIndex[currentPage].quizzed = true;
			//alert('complete');
		}

		function resetStatus(){
			for(var curr = 0; curr < currentState.dataIndex.length; curr++){
				currentState.dataIndex[curr].attempted = false;
				currentState.dataIndex[curr].passed = false;
				currentState.dataIndex[curr].quizzed = false;
				currentState.dataIndex[curr].numberattempted = 0;
				currentState.dataIndex[curr].numberquizzed = 0;
				currentState.dataIndex[curr].score = [];
			}
			currentState.success = false;
			currentState.completed = false;
			currentState.lastSeenIndex = 0;
			currentState.score = 0;
			currentState.totalReset++;
		}

		function resetStatusDITP(){
			for(var curr = 0; curr < currentState.dataIndex.length; curr++){
				currentState.dataIndex[curr].attempted = false;
				currentState.dataIndex[curr].passed = false;
				currentState.dataIndex[curr].quizzed = false;
				currentState.dataIndex[curr].numberattempted = 0;
				if(!(currentPage == curr && pageArray[currentPage].resetwhenquizzed > 0)){
					currentState.dataIndex[curr].numberquizzed = 0;
				}
				currentState.dataIndex[curr].score = [];
			}
			currentState.success = false;
			currentState.completed = false;
			currentState.lastSeenIndex = 0;
			currentState.score = 0;
			currentState.totalReset++;
		}

		function getTimeISO8601(sec){
			return "PT" + parseInt(sec/3600) + "H" + parseInt((sec%3600)/60) + "M" + parseInt(sec%3600%60) + "S";
		}
		
		function convertTimeISO8601ToNumber(iso){
			/*pattern PTXXHXXMXXS*/
			var hourISO = parseInt(iso.substring(2,iso.indexOf("H")+1));
			var minISO = parseInt(iso.substring(iso.indexOf("H")+1,iso.indexOf("M")+1));
			var secISO = parseInt(iso.substring(iso.indexOf("M")+1,iso.indexOf("S")+1));
			var sumsec = hourISO*3600+minISO*60+secISO;
			return sumsec;
		}

		function getTimeString(sec){
			var timestring = "";
			if(sec >= 3600){
				timestring += parseInt(sec/3600) + " ชั่วโมง ";
			}
			if(sec >= 60){
				timestring += parseInt((sec%3600)/60) + " นาที ";
			}
			timestring += parseInt(sec%3600%60) + " วินาที";
			return timestring;
		}
		/*start code disable select text*/
		$.support.selectstart = "onselectstart" in document.createElement("div");
		$.fn.disableSelection = function() {
			return this.bind( ( $.support.selectstart ? "selectstart" : "mousedown" ) + ".ui-disableSelection", function( event ) {
				event.preventDefault();
			}).attr('unselectable','on').css('UserSelect','none').css('MozUserSelect','none').css('user-select', 'none').css('-moz-user-select', 'none').css('-webkit-user-select', 'none').css('-ms-user-select', 'none');
		};
		$("body").bind("contextmenu", function (e) {
		return false; 
		});
		$(window).disableSelection();
		/*end code disable select text*/

		function getTimestampISO8601(){
			var tempDate = new Date();
			return tempDate.toISOString();
		}

		function sendCurrentPagePassedStatement(passed,rawScore,totalScore,percentScore){
			var txtverb = "passed";
			if(!passed){
				txtverb = "failed";
			}
			if(!isoffline){
				var stmt = {
							object: {
								id: Content.CourseActivity.id + "/"+pageArray[currentPage].url,
								definition: {
									name: {
										"th-TH": pageArray[currentPage].title
									},
									description: {
										"th-TH": pageArray[currentPage].detail
									}
								},
								objectType: "Activity"
							},
						   verb: txtverb,
						   context: Content.getContext(
							  Content.CourseActivity.id
							),
							result : {
								score : {
									scaled: percentScore/100,
									raw : percentScore,
									min : 0,
									max : 100
								}
						   }
				};
				tincan.sendStatement(stmt);
			}
		}
		
		function saveState(numquestion,numquestioncorrect,currentStarStage,currentTime){
			//alert(numquestion+","+numquestioncorrect+","+currentStarStage+","+currentTime);
			//alert(Math.round(numquestioncorrect/numquestion*100)+","+100+","+Math.round(numquestioncorrect/numquestion*100));
			setCurrentPageScore(Math.round(numquestioncorrect/numquestion*100),100,Math.round(numquestioncorrect/numquestion*100));
			sendCurrentPagePassedStatement(getCurrentPagePassedStatus(),Math.round(numquestioncorrect/numquestion*100),100,Math.round(numquestioncorrect/numquestion*100));
			var temptitle = "";
			if(currentStarStage > 1){
				temptitle += currentStarStage+" stars in "+pageArray[currentPage].title;
			}
			else{
				temptitle += currentStarStage+" star in "+pageArray[currentPage].title;
			}
			/*if(currentState.dataIndex[currentPage].star < currentStarStage){
				currentState.dataIndex[currentPage].star = currentStarStage;
			}*/
			sendAllFullStatement("http://activitystrea.ms/schema/1.0/receive",temptitle,"received");
		}
		
		function getPercentProgress(){
			var resultProgress = 0;
			var totalPassed = 0;
			var totalSCO = 0;
			for(var curr = 0; curr < currentState.dataIndex.length; curr++){
				totalSCO++;
				if(currentState.dataIndex[curr].passed){
					totalPassed++;
				}
			}
			if(totalSCO > 0){
				resultProgress = parseFloat(totalPassed/totalSCO*100).toFixed(0);
			}
			return resultProgress;
		}
		
		function getQueryParams(qs) {qs = qs.split('+').join(' ');var params2 = {},tokens, re = /[?&]?([^=]+)=([^&]*)/g;while (tokens = re.exec(qs)) { params2[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]); } return params2;}
		
		function openWB(){
			window.open('../../collaboration/webboard/course?lrscourseid='+courseid);
		}
		
		function openChat(){
			window.open('../../collaboration/chatroom/section/'+sectionid, 'MsgWindow','width=800,height=550');
		}
