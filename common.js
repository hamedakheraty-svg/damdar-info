/* ============================================================
   تنظیمات مشترک
   ============================================================ */
// آدرس Google Apps Script Web App (همون مورد استفاده در فایل ثبت واکسیناسیون)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyVyC4YDARhRY29giI11OUw51trWUvt5TweesBFXkmXlDlmDGq0eAKcUV1V6UEhLIQMsA/exec";

// نام فیلدهای رکورد دامدار - در صورت نیاز با ساختار گوگل شیت خودتان هماهنگ کنید
const FIELD_LABELS = {
  firstName: "نام",
  lastName: "نام خانوادگی",
  nationalCode: "کد ملی",
  mobile: "موبایل",
  village: "روستا / آدرس",
  livestockType: "نوع دام",
  livestockCount: "تعداد دام",
  lastVaccinationDate: "تاریخ آخرین واکسیناسیون",
  vaccineType: "نوع واکسن",
  notes: "توضیحات"
};

const LOCAL_KEY = "damdarRecords";

/* ============================================================
   حالت محلی (localStorage)
   ============================================================ */
function getLocalRecords(){
  try{
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  }catch(e){ return []; }
}
function saveLocalRecords(records){
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
}
function matchRecord(rec, q){
  q = q.trim().toLowerCase();
  if(!q) return false;
  return ["firstName","lastName","nationalCode","mobile"].some(f=>
    (rec[f]||"").toString().toLowerCase().includes(q)
  );
}
function searchLocal(q){
  return getLocalRecords().filter(r=>matchRecord(r,q));
}

/* ============================================================
   حالت آنلاین (Google Apps Script)
   ============================================================ */
async function searchOnline(q){
  const url = `${SCRIPT_URL}?action=search&query=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error("خطا در ارتباط با سرور");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results || []);
}

async function updateOnline(record){
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify({ action:"update", record })
  });
  if(!res.ok) throw new Error("خطا در ارسال به سرور");
  return res.json().catch(()=>({}));
}

/* ============================================================
   نمایش نتایج (کارت‌های دامدار)
   ============================================================ */
function render(records, source, container, editable){
  container.innerHTML = "";
  records.forEach(rec=>{
    const card = document.createElement("div");
    card.className = "result-card";
    const tag = source==="local"
      ? `<span class="source-tag source-local">📱 حافظه دستگاه</span>`
      : `<span class="source-tag source-online">☁️ گوگل شیت مرکزی</span>`;
    let rowsHtml = "";
    Object.keys(FIELD_LABELS).forEach(key=>{
      const val = rec[key];
      if(val===undefined || val==="") return;
      rowsHtml += `<div class="field-row"><span class="k">${FIELD_LABELS[key]}</span><span class="v">${val}</span></div>`;
    });
    card.innerHTML = `
      ${tag}
      <h3>${rec.firstName||""} ${rec.lastName||""}</h3>
      ${rowsHtml}
      ${editable ? `<div class="edit-actions"><button class="btn-secondary btn-small" onclick='openEditForm(${JSON.stringify(rec).replace(/'/g,"&#39;")})'>ویرایش این رکورد</button></div>` : ""}
    `;
    container.appendChild(card);
  });
}

/* ============================================================
   جستجوی عمومی (هم برای صفحه اصلی، هم بخش مدیر)
   اول محلی، بعد آنلاین
   ============================================================ */
async function performSearch(q, statusEl, resultsEl, editable){
  resultsEl.innerHTML = "";
  if(!q){ statusEl.textContent="لطفاً یک عبارت برای جستجو وارد کنید."; statusEl.className="status err"; return; }

  statusEl.textContent = "در حال جستجو...";
  statusEl.className = "status warn";

  const localMatches = searchLocal(q);
  if(localMatches.length){
    render(localMatches, "local", resultsEl, editable);
    statusEl.textContent = `${localMatches.length} نتیجه از حافظه دستگاه پیدا شد.`;
    statusEl.className = "status ok";
    return;
  }

  if(!navigator.onLine){
    statusEl.textContent = "نتیجه‌ای در دستگاه پیدا نشد و اینترنت وصل نیست.";
    statusEl.className = "status err";
    return;
  }
  try{
    const onlineMatches = await searchOnline(q);
    if(onlineMatches.length){
      render(onlineMatches, "online", resultsEl, editable);
      statusEl.textContent = `${onlineMatches.length} نتیجه از گوگل شیت مرکزی پیدا شد.`;
      statusEl.className = "status ok";
    } else {
      resultsEl.innerHTML = `<div class="no-result">هیچ دامداری با این مشخصات پیدا نشد.</div>`;
      statusEl.textContent = "";
    }
  }catch(e){
    statusEl.textContent = "خطا در جستجوی آنلاین. اتصال اینترنت را بررسی کنید.";
    statusEl.className = "status err";
  }
}
