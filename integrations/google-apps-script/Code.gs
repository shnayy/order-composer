const SPREADSHEET_ID = "15OY1woERaiunJXR9kj13lvlId3ifOoBbWPL00KCzMl8";
const IMAGE_FOLDER_ID = "1I2KoF104ON0q0JRslK-dVAAXklP_kLkB";
const HEADERS = ["orderId", "imageFileName", "name", "waitSeconds", "effectSeconds", "categoryId"];

function doGet() {
  return json_({ ok: true, orders: getOrders_() });
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    let orderId = "";
    if (payload.action === "save") orderId = saveOrder_(payload);
    else if (payload.action === "delete") deleteOrder_(payload);
    else throw new Error("Unknown action");
    return json_({ ok: true, orderId, orders: getOrders_() });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
}

function getOrders_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(row => row[0]).map(row => ({
    orderId: String(row[0]),
    imageFileName: String(row[1] || ""),
    name: String(row[2] || ""),
    waitSeconds: Number(row[3] || 0),
    effectSeconds: Number(row[4] || 0),
    categoryId: String(row[5] || "other"),
    imageUrl: row[1] ? imageUrl_(String(row[1])) : "",
  }));
}

function saveOrder_(payload) {
  const order = payload.order || {};
  if (!String(order.name || "").trim()) throw new Error("Name is required");

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const isEdit = Boolean(payload.originalId);
  const originalId = String(payload.originalId || "");
  const currentIndex = isEdit
    ? values.findIndex((row, index) => index > 0 && String(row[0]) === originalId)
    : -1;
  if (isEdit && currentIndex < 1) throw new Error("Order not found");
  const orderId = isEdit ? String(values[currentIndex][0]) : nextOrderId_(values);

  const oldImageName = currentIndex > 0 ? String(values[currentIndex][1] || "") : "";
  let imageFileName = oldImageName || String(order.imageFileName || "");

  if (payload.imageData) {
    if (oldImageName) trashFiles_(oldImageName);
    const mime = String(payload.imageMime || "image/png");
    const extension = extensionForMime_(mime);
    imageFileName = `${orderId}.${extension}`;
    trashFiles_(imageFileName);
    const bytes = Utilities.base64Decode(String(payload.imageData).split(",").pop());
    const file = DriveApp.getFolderById(IMAGE_FOLDER_ID).createFile(Utilities.newBlob(bytes, mime, imageFileName));
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  }

  const row = [[
    orderId,
    imageFileName,
    String(order.name).trim(),
    Math.max(0, Number(order.waitSeconds || 0)),
    Math.max(0, Number(order.effectSeconds || 0)),
    String(order.categoryId || "other"),
  ]];

  if (currentIndex > 0) sheet.getRange(currentIndex + 1, 1, 1, HEADERS.length).setValues(row);
  else sheet.appendRow(row[0]);
  return orderId;
}

function nextOrderId_(values) {
  const highestId = values.slice(1).reduce((highest, row) => {
    const value = String(row[0] || "").trim();
    return /^\d+$/.test(value) ? Math.max(highest, Number(value)) : highest;
  }, 0);
  return String(highestId + 1);
}

function deleteOrder_(payload) {
  const orderId = String(payload.orderId || "");
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const index = values.findIndex((row, rowIndex) => rowIndex > 0 && String(row[0]) === orderId);
  if (index > 0) {
    const imageFileName = String(values[index][1] || payload.imageFileName || "");
    if (imageFileName) trashFiles_(imageFileName);
    sheet.deleteRow(index + 1);
  }
}

function imageUrl_(fileName) {
  const files = DriveApp.getFolderById(IMAGE_FOLDER_ID).getFilesByName(fileName);
  return files.hasNext() ? `https://drive.google.com/uc?export=view&id=${files.next().getId()}` : "";
}

function trashFiles_(fileName) {
  const files = DriveApp.getFolderById(IMAGE_FOLDER_ID).getFilesByName(fileName);
  while (files.hasNext()) files.next().setTrashed(true);
}

function extensionForMime_(mime) {
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  return extensions[mime] || "png";
}

function setupInitialImages_() {
  const files = DriveApp.getFolderById(IMAGE_FOLDER_ID).getFiles();
  while (files.hasNext()) {
    try {
      files.next().setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (_) {}
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
