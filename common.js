/* ============================================================
   اپ جستجو و ویرایش دامدار - منطق مشترک
   ============================================================ */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyVyC4YDARhRY29giI11OUw51trWUvt5TweesBFXkmXlDlmDGq0eAKcUV1V6UEhLIQMsA/exec";

const FIELD_LABELS = {
  firstName: "نام",
  lastName: "نام خانوادگی",
  nationalCode: "کد ملی",
  fatherName: "نام پدر",
  mobile: "شماره موبایل",
  village: "روستا / آدرس"
};
const FIELD_ICONS = {
  firstName: "👤", lastName: "👨‍👩‍👧", nationalCode: "🆔",
  fatherName: "👨", mobile: "📱", village: "📍"
};
const FIELD_ORDER = ["firstName","lastName","nationalCode","fatherName","mobile","village"];
const LOCAL_KEY = "damdarRecords";

function esc(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/* ---------- حافظه محلی ---------- */
function getLocalRecords(){
  try{ return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; }
  catch(e){ return []; }
}
function saveLocalRecords(records){
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
}

// هر کلمه باید در مجموعه نام، فامیل، کد ملی و موبایل باشد
function matchRecord(rec, q){
  q = q.trim().toLowerCase();
  if(!q) return false;
  const combined = ["firstName","lastName","nationalCode","mobile"]
    .map(f => (rec[f]||"").toString().toLowerCase()).join(" ");
  return q.split(/\s+/).filter(Boolean).every(w => combined.includes(w));
}
function searchLocal(q){ return getLocalRecords().filter(r => matchRecord(r,q)); }

// اضافه یا جایگزین کردن یک رکورد در حافظه محلی (بر اساس کد ملی قبلی)
function upsertLocal(rec, oldNationalCode){
  const list = getLocalRecords();
  const key = oldNationalCode || rec.nationalCode;
  const i = list.findIndex(r => r.nationalCode === key);
  if(i !== -1) list[i] = rec; else list.push(rec);
  saveLocalRecords(list);
  return i !== -1;
}

/* ---------- ارتباط با گوگل شیت ---------- */
async function searchOnline(q){
  const res = await fetch(`${SCRIPT_URL}?action=search&query=${encodeURIComponent(q)}`);
  if(!res.ok) throw new Error("server");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results || []);
}
async function postToScript(payload){
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify(payload)
  });
  if(!res.ok) throw new Error("server");
  return res.json().catch(()=>({}));
}
function updateOnline(record, oldNationalCode){
  return postToScript({ action:"update", record, oldNationalCode: oldNationalCode || "" });
}

/* ---------- نمایش نتایج ---------- */
let CURRENT_RESULTS = [];

function render(records, source, container, editable){
  CURRENT_RESULTS = records;
  container.innerHTML = "";
  records.forEach((rec, idx) => {
    const card = document.createElement("div");
    card.className = "result-card";
    const SHORT = {nationalCode:"کد ملی", fatherName:"پدر", mobile:"موبایل", village:"روستا"};
    let fields = "";
    FIELD_ORDER.forEach(key => {
      if(key === "firstName" || key === "lastName") return;   // در ابتدای خط نمایش داده می‌شوند
      const val = rec[key];
      if(val === undefined || val === "") return;
      fields += `<span class="rc-item"><span class="rc-k">${SHORT[key]}:</span> <span class="rc-v">${esc(val)}</span></span>`;
    });
    const tag = source === "local"
      ? `<span class="rc-tag" title="حافظه دستگاه">📱</span>`
      : `<span class="rc-tag" title="سرور مرکزی">☁️</span>`;
    const edit = editable
      ? `<button class="rc-edit" onclick="openEditForm(${idx})">✏️ ویرایش</button>`
      : "";
    card.innerHTML = `<div class="rc-line">
      <span class="rc-name">${tag} ${esc(rec.firstName)} ${esc(rec.lastName)}</span>
      ${fields}${edit}
    </div>`;
    container.appendChild(card);
  });
}

/* ---------- جستجو ---------- */
// اولویت با گوگل شیت است تا نتیجه روی همه دستگاه‌ها یکی باشد.
// حافظه دستگاه فقط وقتی استفاده می‌شود که اینترنت یا سرور در دسترس نباشد.
function withTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))
  ]);
}

async function performSearch(q, statusEl, resultsEl, editable){
  resultsEl.innerHTML = "";
  q = (q || "").trim();
  if(!q){
    statusEl.innerHTML = "🔍 یک نام یا شماره برای جستجو وارد کنید";
    statusEl.className = "status info";
    return;
  }
  statusEl.innerHTML = "⏳ در حال جستجو...";
  statusEl.className = "status loading";

  let serverReached = false;
  if(navigator.onLine){
    try{
      const online = await withTimeout(searchOnline(q), 15000);
      serverReached = true;
      if(online.length){
        render(online, "online", resultsEl, editable);
        statusEl.innerHTML = `✅ ${online.length} نتیجه از سرور مرکزی`;
        statusEl.className = "status success";
        return;
      }
    }catch(e){ /* سرور در دسترس نبود؛ می‌رویم سراغ حافظه دستگاه */ }
  }

  const local = searchLocal(q);
  if(local.length){
    render(local, "local", resultsEl, editable);
    statusEl.innerHTML = serverReached
      ? `⚠️ ${local.length} نتیجه فقط روی این دستگاه ذخیره شده و هنوز به سرور نرسیده`
      : `⚠️ اتصال به سرور برقرار نشد؛ ${local.length} نتیجه از حافظه دستگاه (ممکن است کامل نباشد)`;
    statusEl.className = "status warn";
    return;
  }

  if(serverReached){
    resultsEl.innerHTML = `<div class="no-result">❌ هیچ دامداری با این مشخصات پیدا نشد</div>`;
    statusEl.innerHTML = "";
    statusEl.className = "";
  }else{
    statusEl.innerHTML = navigator.onLine
      ? "⚠️ اتصال به سرور برقرار نشد. اگر VPN دارید روشن کنید و دوباره تلاش کنید"
      : "⚠️ اینترنت وصل نیست و نتیجه‌ای در حافظه دستگاه پیدا نشد";
    statusEl.className = "status error";
  }
}

/* ---------- ویرایش (فقط admin) ---------- */
let EDITING_RECORD = null;

function openEditForm(idx){
  const record = CURRENT_RESULTS[idx];
  if(!record) return;
  EDITING_RECORD = record;
  const fields = FIELD_ORDER.map(key => `
    <div class="form-field">
      <label for="edit_${key}">${FIELD_ICONS[key]} ${FIELD_LABELS[key]}</label>
      <input type="text" id="edit_${key}" class="form-input" value="${esc(record[key])}" />
    </div>`).join("");
  const modal = document.createElement("div");
  modal.id = "editModal";
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeEditForm()">
      <div class="modal-dialog" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>✏️ ویرایش اطلاعات دامدار</h2>
          <button class="modal-close" onclick="closeEditForm()">✕</button>
        </div>
        <div class="modal-body">${fields}</div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="saveEditedRecord()">💾 ذخیره تغییرات</button>
          <button class="btn-secondary" onclick="closeEditForm()">انصراف</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function closeEditForm(){
  const m = document.getElementById("editModal");
  if(m) m.remove();
  EDITING_RECORD = null;
}

async function saveEditedRecord(){
  if(!EDITING_RECORD) return;
  const old = EDITING_RECORD;
  const updated = {};
  FIELD_ORDER.forEach(k => { updated[k] = document.getElementById("edit_"+k).value.trim(); });

  const empty = FIELD_ORDER.filter(k => !updated[k]);
  if(empty.length){
    alert("⚠️ این فیلدها نباید خالی باشند:\n" + empty.map(k => FIELD_LABELS[k]).join("\n"));
    return;
  }
  upsertLocal(updated, old.nationalCode);   // اگر در حافظه دستگاه بود، اصلاح می‌شود

  let onlineOk = true;
  if(navigator.onLine){
    try{ await updateOnline(updated, old.nationalCode); }
    catch(e){ onlineOk = false; }
  }else{
    onlineOk = false;
  }
  closeEditForm();
  alert(onlineOk
    ? "✅ تغییرات ذخیره شد."
    : "⚠️ تغییرات فقط روی این دستگاه ذخیره شد. اینترنت وصل نبود یا ارسال به گوگل شیت انجام نشد.");
  const btn = document.getElementById("searchInput");
  if(btn && typeof doSearch === "function") doSearch();
}
