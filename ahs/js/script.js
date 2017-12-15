function setSizes(time){
	$('.pane')
		.css('width', innerWidth)
		.css('height', innerHeight);

	//set the height of each of the rotated text things
	$('#sidebar .rotated .year').each(function(i, e){
		var width = $(e).width();
		if(width != 0) $(e).parent().parent().css("min-height", width);
	})

	$('#viewport .big').each(function(){
		if(!$(this).data('loaded')){
			return;
		}
		// console.log(this.height, innerHeight, this.width, innerWidth)
		var ratio = Math.max(innerHeight / innerWidth, this.height / this.width);

		// console.log(ratio, ratio * innerHeight);
		$(this).css('height', innerWidth * ratio + 'px')
		// Math.min(this.width / innerWidth, this.height / innerHeight)
		// console.log('loaded ', this)
	})

	//set the bottom thing
	$("#sidebar .page").last().css('height', innerHeight - 80);
	if(time == 'initial'){
		var element = $(location.hash);
		if(element[0]){
			selected = element[0];
			$("html, body").cap().animate({scrollTop: element.offset().top}, {duration: 0});

			setTimeout(function(){
				detectSelection('force')
			}, 762)
		}else{
			detectSelection('force');
		}
	}else{
		detectSelection('force');
	}
}

jQuery.fn.cap = function(){
	var q = $(this).queue('fx');
	if(q){
		q.splice(1, q.length)
	}
	return $(this)
}

function scrollPic(sel, reflow){
	var pic = $(sel).data('big');
	var pos = $(pic)[0].offsetTop;

	$('#viewport')
		// .clearQueue()
		.cap()
		.animate({scrollTop: pos}, {
			queue: false,
			duration: (new Date - init < 500 || reflow == 'force') ? 0 :  1500
		});  
}

function scrollWords(sel, reflow){
	var words = $(sel).data('pane');
	var pos = $(words)[0].offsetTop - 50;

	$('#textport')
		// .clearQueue()
		.cap()
		.animate({scrollTop: pos}, {
			duration:  (new Date - init < 500 || reflow == 'force') ? 0 :  1000
		})  
}

function detectSelection(reflow){
	if($("html, body").queue('fx').length) return;
	if($('#viewport').queue('fx').length) return;
	//fancy mode only
	if($('#sidebar').is(':hidden')) return;

	var sel = $('.page').filter(function(i,e){
		return $(e).offset().top - 50 < $(window).scrollTop()
	}).last();

	// setPage(sel, reflow);
}


function setPage(sel, reflow){
	if(selected != sel[0] || reflow == 'force'){
		scrollPic(sel, reflow)
		scrollWords(sel, reflow)
	}
	if(selected != sel[0]){
		if(location.hash != $(sel).find(".year").attr('href')){
			if(history.pushState){
				history.pushState({}, $(sel).find(".year").text(), $(sel).find(".year").attr('href'));
			}else{
				location.href = $(sel).find(".year").attr('href');	
			}	
		}
		
		

		selected = sel[0];

		$('.page').removeClass('selected');
		$(sel).addClass('selected');
	}
}

function pageGo(delta){
	var sections = $('#sidebar .rotated .year').map(function(){return $(this).attr('href')}).toArray();
	var index = jQuery.inArray(location.hash, sections);
	if(index != -1 && index < sections.length){
		$('#sidebar .rotated .year[href="' + sections[index + delta] + '"]').click()	
		return true
	}
	return false	
}

var selected = null;
var init = null;
$(document).ready(function(){
	init = +new Date;
	//initialize fancy mode
	//$("#main > *").clone().appendTo("#sidebar");

	$("#sidebar .date").addClass("rotated");
	
	$('img').addClass('not-loaded')

	$("body").on('mousewheel', function(e){
		var vertical = e.originalEvent.wheelDeltaY;
		if(Math.abs(vertical) > 100 ){
			

			if(pageGo( vertical > 0 ? -1 : +1)){
				e.preventDefault()	
			}

			
			
		}
		
	})
	//$("#main > a").remove();

	$('#sidebar .page').each(function(i,e){
		var big = $(e).find('.big').clone();
		$(e).data("big", big);
		$("#viewport").append(big);
		var content = $(e).find('.content').clone();
		var title = content.find("h1");
		var pane = $("<div>")
			.addClass("pane")
			.append(title)
			.append(content)
			.appendTo("#textport");
		$(e).data("pane", pane);
	})


	$('img').load(function(){
		$(this).data('loaded', true)
		$(this).removeClass('not-loaded')
		setSizes('initial');
	})


	$(window).scroll(function(){
		setTimeout(detectSelection, 100)
	})
	

	$('a').live('click', function(e){
		//fancy mode only
		if($('#sidebar').is(':hidden')) return;
		var href = $(this).attr('href');
		if(href.indexOf(location.pathname) != -1 || /^#/.test(href)){
			var element = $($(this).attr('href'));
			// history.pushState({}, "", $(this).attr('href'))
			// scrollPic(element.next(), false)
			setPage(element.next(), false);
			$("html, body").cap().animate({scrollTop: element.offset().top}, "slow", function(){
				// detectSelection()
			});
			e.preventDefault();
		}
	})


	$(window).keydown(function(e){
		if(e.keyCode == ' '.charCodeAt(0)){ //space
			pageGo(e.shiftKey ? -1 : +1)
			e.preventDefault();
		}else if(!e.shiftKey && !e.ctrlKey){
			if(e.keyCode == 34 || e.keyCode == 74){ //page down, j
				pageGo(+1)
				e.preventDefault();
			}else if(e.keyCode == 33 || e.keyCode == 75){ // page up, k
				pageGo(-1)
				e.preventDefault();
			}
		}
	})

	$(window).resize(setSizes);
	setSizes('initial');
})

