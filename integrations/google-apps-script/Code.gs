const SPREADSHEET_ID = "1D2VTd1wVTTUVFm2oUoWbKQaiTjLGqksJdGiF584TKkk";
const IMAGE_FOLDER_ID = "1UKcbxOA2LZZ7YiUqNIQAvJzCXZPSM-9M";
const HEADERS = ["orderId", "imageFileName", "name", "waitSeconds", "effectSeconds", "categoryId"];

function doGet() {
  return json_({ ok: true, orders: getOrders_() });
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    if (payload.action === "save") saveOrder_(payload);
    else if (payload.action === "delete") deleteOrder_(payload);
    else throw new Error("Unknown action");
    return json_({ ok: true, orders: getOrders_() });
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
  const originalId = String(payload.originalId || order.orderId || "");
  if (!/^[A-Za-z0-9_-]+$/.test(String(order.orderId || ""))) throw new Error("Invalid orderId");
  if (!String(order.name || "").trim()) throw new Error("Name is required");

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const currentIndex = values.findIndex((row, index) => index > 0 && String(row[0]) === originalId);
  const duplicateIndex = values.findIndex((row, index) => index > 0 && String(row[0]) === String(order.orderId));
  if (duplicateIndex > 0 && duplicateIndex !== currentIndex) throw new Error("Duplicate orderId");

  const oldImageName = currentIndex > 0 ? String(values[currentIndex][1] || "") : "";
  let imageFileName = oldImageName || String(order.imageFileName || "");

  if (payload.imageData) {
    if (oldImageName) trashFiles_(oldImageName);
    const mime = String(payload.imageMime || "image/png");
    const extension = extensionForMime_(mime);
    imageFileName = `${order.orderId}.${extension}`;
    trashFiles_(imageFileName);
    const bytes = Utilities.base64Decode(String(payload.imageData).split(",").pop());
    const file = DriveApp.getFolderById(IMAGE_FOLDER_ID).createFile(Utilities.newBlob(bytes, mime, imageFileName));
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  } else if (originalId !== String(order.orderId) && oldImageName) {
    const extension = oldImageName.includes(".") ? oldImageName.split(".").pop() : "png";
    imageFileName = `${order.orderId}.${extension}`;
    const files = DriveApp.getFolderById(IMAGE_FOLDER_ID).getFilesByName(oldImageName);
    if (files.hasNext()) files.next().setName(imageFileName);
  }

  const row = [[
    String(order.orderId),
    imageFileName,
    String(order.name).trim(),
    Math.max(0, Number(order.waitSeconds || 0)),
    Math.max(0, Number(order.effectSeconds || 0)),
    String(order.categoryId || "other"),
  ]];

  if (currentIndex > 0) sheet.getRange(currentIndex + 1, 1, 1, HEADERS.length).setValues(row);
  else sheet.appendRow(row[0]);
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

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
