var f=0;
$(document).ready(function() {
	$('#index1').click(function(){
		if(f%2==0){
			$('#add').animate({left:"40%"},"500000");
		}else{
			$('#add').animate({left:"46.5%"},"500000");
		}
		f++;
	});
});
var a=0;
$(document).ready(function() {
	$('#index3').click(function(){
		if(a%2==0){
			$('#whole3').children().attr("src","img/03_1.jpg");
		}else{
			$('#whole3').children().attr("src","img/03.jpg");
		}
		a++;
	});
});
var d=0;
$(document).ready(function() {
	$('#index4').click(function(){
		if(d%2==0){
			$('#whole4').children().attr("src","img/04/04_1.JPG");
		}else{
			$('#whole4').children().attr("src","img/04/04_2.JPG");
		}
		d++;
	});
});
var b=1,c=-1;
var flag=true;
$(document).ready(function() {
	$('#index2').click(function(){
		c++;
//		if(b<=6 && b>=0){
//			window.setInterval("change()",100); //100毫秒执行一次
//		}
		if(b<=7 && b>=1 && c%2==0){
			window.setInterval("open()",100); //100毫秒执行一次
		}else if(b<=7 && b>=1 && c%2!=0){
			window.setInterval("close()",100)//100毫秒执行一次
		}
	});
});
function open(){
	if(c%2==0 && flag && b<=6){
		$('#whole2').children().attr("src","img/02/02-"+b+".JPG");
		b++;
//		console.log(b);
		if(b>6){
			flag=false;
		}
	}
}
function close(){
	if(c%2!=0 && !flag && b>=1){
		b--;
		$('#whole2').children().attr("src","img/02/02-"+b+".JPG");
//		console.log(b);
		if(b<=1){
			flag=true;
		}
	}
}
//function change(){
//	if(c%2==0 && flag && b<=6){
//		$('#whole2').children().attr("src","img/02/02-"+b+".JPG");
//		b++;
//		console.log(b);
//		if(b>6){
//			flag=false;
//		}
//	}else if(c%2!=0 && !flag && b>=1){
//		b--;
//		$('#whole2').children().attr("src","img/02/02-"+b+".JPG");
//		
//		console.log(b);
//		if(b<=1){
//			flag=true;
//		}
//	}
//}