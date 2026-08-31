let token="";

const API="https://script.google.com/macros/s/AKfycbxbaop9HbasKeMj1d9CqG9jjTqJRq68Gv3f-8zaVobcbv6pDW3LRu4IJpFezpO2nFRi/exec";

function login(){

fetch(API,{
method:"POST",
body:new URLSearchParams({
action:"leaderLogin",
username:username.value,
password:password.value
})
})
.then(r=>r.json())
.then(r=>{

if(r.status){

token=r.data.token;

document.getElementById("login").classList.add("hidden");
document.getElementById("dashboard").classList.remove("hidden");

load();

}else alert(r.message);

});

}


function load(){

fetch(API+"?action=leaderParticipants&token="+token)
.then(r=>r.json())
.then(r=>{

document.getElementById("section").innerHTML=
"Section : "+r.data[0].section;


let html="";

let done=0;

r.data.forEach(p=>{

done+=p.percentage;

html+=`
<div class="person">
<b>${p.nama}</b><br>
${p.completed}/${p.totalModule} Modul
<br>
Progress ${p.percentage}%
</div>`;

});


document.getElementById("list").innerHTML=html;


new Chart(
document.getElementById("chart"),
{

type:"doughnut",


data:{


labels:[
"Completed",
"Remaining"
],


datasets:[{

data:[

progress,

100-progress

]


}]


},


options:{


responsive:true,


maintainAspectRatio:false,


plugins:{


legend:{


position:"bottom"


}


}


}


});
