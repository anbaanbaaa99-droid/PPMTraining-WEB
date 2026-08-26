const API =
"https://script.google.com/macros/s/AKfycbxbaop9HbasKeMj1d9CqG9jjTqJRq68Gv3f-8zaVobcbv6pDW3LRu4IJpFezpO2nFRi/exec


// Load daftar peserta

fetch(`${API}?action=participants`)
.then(res=>res.json())
.then(data=>{

const list=document.getElementById("participants");

data.data.forEach(item=>{

let option=document.createElement("option");

option.value=`${item.nama} - ${item.nik}`;

list.appendChild(option);

});

});



// Search peserta

function searchPPM(){

let keyword=document.getElementById("search").value;


if(keyword.includes("-")){
keyword=keyword.split("-").pop().trim();
}


fetch(`${API}?action=search&keyword=${keyword}`)
.then(res=>res.json())
.then(result=>{


let area=document.getElementById("result");


if(!result.status){

area.innerHTML=`
<div class="card">
Data peserta tidak ditemukan
</div>`;

return;

}


let d=result.data;


area.innerHTML=`

<div class="card">

<h2 class="profile-title">
${d.nama}
</h2>


<div class="info">

<b>NIK:</b> ${d.nik}<br>

<b>Section:</b> ${d.section}<br>

<b>Current Level:</b> ${d.level}<br>

<b>Basic Wajib:</b> ${d.basic}

</div>


<h3>
Training Module
</h3>


${
d.modules.length ?

d.modules.map(module=>`

<div class="module">

<b>${module.module}</b>

<p>${module.category}</p>

<a href="${module.link}" target="_blank">
MULAI TRAINING
</a>

</div>

`).join("")

:

"<p>Tidak ada modul ditemukan</p>"

}


</div>

`;

});

}
