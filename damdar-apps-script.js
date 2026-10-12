// ===================== بخش قبلی: ثبت واکسیناسیون میدانی (بدون تغییر) =====================
function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  // اگر درخواست مربوط به بخش دامدار (جستجو/به‌روزرسانی) باشد
  if (data.action === 'update' && data.record) {
    return handleDamdarUpdate(data.record, data.oldNationalCode || '');
  }
  if (data.action === 'bulkUpdate' && data.records) {
    return handleDamdarBulk(data.records);
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

// ===================== بخش جدید: اپ جستجو / ویرایش دامدار - فقط ۶ فیلد =====================

var DAMDAR_SHEET_NAME = 'Damdars';
var DAMDAR_COLUMNS = [
  'firstName', 'lastName', 'nationalCode', 'fatherName', 'mobile', 'village'
];
var DAMDAR_HEADERS_FA = [
  'نام', 'نام خانوادگی', 'کد ملی', 'نام پدر', 'شماره موبایل', 'روستا / آدرس'
];

function getDamdarSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DAMDAR_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DAMDAR_SHEET_NAME);
    sheet.getRange('C:C').setNumberFormat('@'); // کد ملی به صورت متن
    sheet.getRange('E:E').setNumberFormat('@'); // موبایل به صورت متن
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

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// اصلاح یا افزودن یک رکورد؛ اگر کد ملی ویرایش شده باشد با کد ملی قبلی ردیف پیدا می‌شود
function handleDamdarUpdate(record, oldNationalCode) {
  var sheet = getDamdarSheet();
  var lastRow = sheet.getLastRow();
  var lookupCode = (oldNationalCode || record.nationalCode || '').toString();
  var foundRow = -1;

  if (lastRow > 1) {
    var codeCol = DAMDAR_COLUMNS.indexOf('nationalCode');
    var mobileCol = DAMDAR_COLUMNS.indexOf('mobile');
    var data = sheet.getRange(2, 1, lastRow - 1, DAMDAR_COLUMNS.length).getValues();
    for (var i = 0; i < data.length; i++) {
      if (lookupCode && data[i][codeCol].toString() === lookupCode) { foundRow = i + 2; break; }
    }
    if (foundRow === -1 && !lookupCode && record.mobile) {
      for (var j = 0; j < data.length; j++) {
        if (data[j][mobileCol].toString() === record.mobile.toString()) { foundRow = j + 2; break; }
      }
    }
  }

  var rowValues = DAMDAR_COLUMNS.map(function(col) { return record[col] || ''; });
  if (foundRow > -1) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  return jsonOut({success: true, updated: foundRow > -1});
}

// ورود گروهی (از اکسل): یک‌جا می‌خواند و یک‌جا می‌نویسد
function handleDamdarBulk(records) {
  var sheet = getDamdarSheet();
  var lastRow = sheet.getLastRow();
  var cols = DAMDAR_COLUMNS.length;
  var codeCol = DAMDAR_COLUMNS.indexOf('nationalCode');

  var existing = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, cols).getValues() : [];
  var index = {};
  for (var i = 0; i < existing.length; i++) {
    var c = existing[i][codeCol].toString();
    if (c) index[c] = i;
  }

  var added = 0, updated = 0, newRows = [];
  records.forEach(function(rec) {
    var row = DAMDAR_COLUMNS.map(function(col) { return rec[col] || ''; });
    var code = (rec.nationalCode || '').toString();
    if (code && index.hasOwnProperty(code)) {
      existing[index[code]] = row;
      updated++;
    } else {
      newRows.push(row);
      added++;
    }
  });

  if (existing.length) {
    sheet.getRange(2, 1, existing.length, cols).setValues(existing);
  }
  if (newRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, cols).setValues(newRows);
  }
  return jsonOut({success: true, added: added, updated: updated});
}
