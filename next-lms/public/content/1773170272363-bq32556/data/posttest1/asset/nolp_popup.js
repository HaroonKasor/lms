
/** Learner Comment ***************************************************************************************/

function getLearnerContent(frm, part){
	if(window.opener){
		if(window.opener.getLearnerContent(frm, part)){}
	}
}

function setLearnerContent(frm, part){
	if(window.opener){
		return window.opener.setLearnerContent(frm, part);
	}

	return false;
}

function closeWin(){
	if(window.opener)
		window.opener.focus();

	window.close();
}