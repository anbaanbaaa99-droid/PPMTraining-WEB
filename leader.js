let token = "";
const API = "https://script.google.com/macros/s/AKfycbxbaop9HbasKeMj1d9CqG9jjTqJRq68Gv3f-8zaVobcbv6pDW3LRu4IJpFezpO2nFRi/exec";
let chartInstance = null;

const username = document.getElementById("username");
const password = document.getElementById("password");

function login(){
  fetch(API,{
    method:"POST",
    body:new URLSearchParams({
      action:"leaderLogin",
      username: username.value.trim(),
      password: password.value
    })
  })
  .then(r=>r.json())
  .then(r=>{
    if(!r.status) throw new Error(r.message || "Login gagal");
    token = r.data.token;
    document.getElementById("login").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    load();
  })
  .catch(e=>alert(e.message));
}

function load(){
  fetch(API+"?action=leaderParticipants&token="+encodeURIComponent(token))
  .then(r=>r.json())
  .then(r=>{
    if(!r.status) throw new Error(r.message || "Data gagal dimuat");
    const data = Array.isArray(r.data) ? r.data : [];

    document.getElementById("section").textContent =
      data.length ? "Section : " + data[0].section : "Section tidak ditemukan";

    let html="";
    let total=0;
    let completed=0;
    let progressSum=0;

    data.forEach(p=>{
      total++;
      completed += Number(p.completed || 0);
      progressSum += Number(p.percentage || 0);

      html += `
      <div class="person">
        <b>${escapeHtml(p.nama)}</b><br>
        ${p.completed}/${p.totalModule} Modul<br>
        Progress ${p.percentage}%
      </div>`;
    });

    document.getElementById("list").innerHTML = html || "Tidak ada peserta";
    document.getElementById("total").textContent = total;
    document.getElementById("completed").textContent = completed;
    document.getElementById("average").textContent =
      total ? Math.round(progressSum / total) + "%" : "0%";

    const avg = total ? Math.round(progressSum / total) : 0;

    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(document.getElementById("chart"),{
      type:"doughnut",
      data:{
        labels:["Completed","Remaining"],
        datasets:[{
          data:[avg,100-avg]
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false
      }
    });
  })
  .catch(e=>alert(e.message));
}

function escapeHtml(text){
  return String(text || "")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;");
}
