// cloudfunctions/itemView/index.js
// 商品浏览量 +1。客户端无权改他人商品文档，由服务端统一自增。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { itemId } = event || {};
  if (!itemId) return { ok: false, msg: '缺少 itemId' };
  try {
    await db.collection('items').doc(itemId).update({ data: { views: _.inc(1) } });
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: e.errMsg || String(e) };
  }
};
