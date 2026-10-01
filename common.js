// ===================== بخش قبلی: ثبت واکسیناسیون میدانی (بدون تغییر) =====================
function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  // اگر درخواست مربوط به بخش دامدار (جستجو/به‌روزرسانی) باشد
  if (data.action === 'update' && data.record) {
    return handleDamdarUpdate(data.record);
  }

  // در غیر این صورت، همان منطق قبلی برای ثبت گروهی رکوردهای واکسیناسیون
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Records');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Records');
  }

  var records = data.records || [];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID','تاریخ میلادی','تاریخ شمسی','روستا','نام','نام خانوادگی','کد ملی','نام پدر','شماره تماس','نوع دام','نوع واکسن','تعداد','وضعیت پرداخت','مبلغ','ثبت‌کننده','زمان دریافت سرور']);
  }

  var lastRow = sheet.getLastRow();
  var idRowMap = {};
  if (lastRow > 1) {
    var idRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idRange.length; i++) {
      idRowMap[idRange[i][0]] = i + 2;
    }
  }

  var added = 0, updated = 0;
  records.forEach(function(r) {
    var rowValues = [
      r.id, r.date, r.dateJalali, r.village, r.firstName, r.lastName,
      r.nationalId, r.fatherName, r.phone, r.animal, r.vaccine,
      r.count, r.paymentStatus, r.amount, r.worker, new Date()
    ];
    if (idRowMap[r.id]) {
      sheet.getRange(idRowMap[r.id], 1, 1, rowValues.length).setValues([rowValues]);
      updated++;
    } else {
      sheet.appendRow(rowValues);
      idRowMap[r.id] = sheet.getLastRow();
      added++;
    }
  });

  return ContentService.createTextOutput(JSON.stringify({success: true, added: added, updated: updated}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  // اگر درخواست جستجوی دامدار باشد
  if (e.parameter.action === 'search') {
    return handleDamdarSearch(e.parameter.query || '');
  }

  return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== بخش جدید: اپ جستجو / به‌روزرسانی دامدار =====================

// نام و ترتیب ستون‌های شیت اطلاعات دامدار
var DAMDAR_SHEET_NAME = 'Damdars';
var DAMDAR_COLUMNS = [
  'firstName', 'lastName', 'nationalCode', 'fatherName', 'mobile',
  'village', 'livestockType', 'livestockCount', 'lastVaccinationDate',
  'vaccineType', 'notes'
];
var DAMDAR_HEADERS_FA = [
  'نام', 'نام خانوادگی', 'کد ملی', 'نام پدر', 'شماره موبایل',
  'روستا / آدرس', 'نوع دام', 'تعداد دام', 'تاریخ آخرین واکسیناسیون',
  'نوع واکسن', 'توضیحات'
];

function getDamdarSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DAMDAR_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DAMDAR_SHEET_NAME);
    sheet.appendRow(DAMDAR_HEADERS_FA);
  }
  return sheet;
}

function handleDamdarSearch(query) {
  var sheet = getDamdarSheet();
  var lastRow = sheet.getLastRow();
  var results = [];

  if (lastRow > 1 && query) {
    var q = query.toString().trim().toLowerCase();
    var words = q.split(/\s+/).filter(function(w) { return w; });
    var values = sheet.getRange(2, 1, lastRow - 1, DAMDAR_COLUMNS.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var rec = {};
      for (var c = 0; c < DAMDAR_COLUMNS.length; c++) {
        rec[DAMDAR_COLUMNS[c]] = row[c] !== undefined && row[c] !== null ? row[c].toString() : '';
      }
      var combined = [rec.firstName, rec.lastName, rec.nationalCode, rec.mobile]
        .join(' ').toLowerCase();
      var isMatch = words.every(function(w) {
        return combined.indexOf(w) !== -1;
      });
      if (isMatch) results.push(rec);
    }
  }

  return ContentService.createTextOutput(JSON.stringify(results))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleDamdarUpdate(record) {
  var sheet = getDamdarSheet();
  var lastRow = sheet.getLastRow();

  var idKey = record.nationalCode ? 'nationalCode' : 'mobile';
  var idColIndex = DAMDAR_COLUMNS.indexOf(idKey);
  var foundRow = -1;

  if (lastRow > 1) {
    var idValues = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idValues.length; i++) {
      if (idValues[i][0] !== undefined && idValues[i][0].toString() === (record[idKey] || '').toString()) {
        foundRow = i + 2;
        break;
      }
    }
  }

  var rowValues = DAMDAR_COLUMNS.map(function(col) { return record[col] || ''; });

  if (foundRow > -1) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return ContentService.createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
