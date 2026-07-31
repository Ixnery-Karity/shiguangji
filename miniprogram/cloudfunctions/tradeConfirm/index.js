// cloudfunctions/tradeConfirm/index.js
// 交易撮合闭环（v0.3.0：双向确认改为服务端真实逻辑）
//
// action = 'create'  参数 { itemId, itemTitle, price, sellerId, sellerName, chatId }
//                    以当前用户为买家创建交易记录（同一商品同一买家的进行中交易不重复创建）。
// action = 'confirm' 参数 { tradeId }
//                    当前用户按其在交易中的角色（买家/卖家）确认完成；
//                    双方都确认后：交易置为「已完成」，商品自动标记「已售」。
// action = 'get'     参数 { tradeId } 或 { itemId }
//                    查询交易最新状态（chatRoom 打开时恢复交易卡片用）。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function actionCreate(openid, ev) {
  const { itemId = '', itemTitle = '', price = 0, sellerId = '', sellerName = '', chatId = '' } = ev;
  if (!itemId) return { ok: false, msg: '缺少商品信息' };
  if (sellerId && sellerId === openid) return { ok: false, msg: '不能购买自己发布的商品' };

  // 已有进行中的交易则直接返回，避免重复发起
  const dup = await db.collection('trades')
    .where({ itemId, buyerId: openid, status: '待完成' }).limit(1).get();
  if (dup.data.length) return { ok: true, tradeId: dup.data[0]._id, trade: dup.data[0], existed: true };

  const data = {
    itemId, itemTitle, price: Number(price) || 0,
    buyerId: openid, sellerId, sellerName, chatId,
    status: '待完成', buyerDone: false, sellerDone: false,
    createdAt: db.serverDate()
  };
  const res = await db.collection('trades').add({ data });
  return { ok: true, tradeId: res._id, trade: Object.assign({ _id: res._id }, data) };
}

async function actionConfirm(openid, tradeId) {
  if (!tradeId) return { ok: false, msg: '缺少交易ID' };
  const res = await db.collection('trades').doc(tradeId).get();
  const t = res.data;
  if (!t) return { ok: false, msg: '交易不存在' };
  if (t.status === '已完成') return { ok: true, trade: t, msg: '交易已完成' };

  // 判定当前用户角色：买家 / 卖家（历史数据可能无 sellerId，兜底按“非买家即卖家”处理）
  let role = '';
  if (openid === t.buyerId) role = 'buyer';
  else if (!t.sellerId || openid === t.sellerId) role = 'seller';
  else return { ok: false, msg: '你不是本交易的参与方' };

  const patch = role === 'buyer' ? { buyerDone: true } : { sellerDone: true };
  const buyerDone = role === 'buyer' ? true : !!t.buyerDone;
  const sellerDone = role === 'seller' ? true : !!t.sellerDone;

  if (buyerDone && sellerDone) {
    patch.status = '已完成';
    patch.doneAt = db.serverDate();
  }
  await db.collection('trades').doc(tradeId).update({ data: patch });

  // 双方都确认 → 商品标记已售
  if (buyerDone && sellerDone && t.itemId) {
    try {
      await db.collection('items').doc(t.itemId).update({ data: { status: '已售' } });
    } catch (e) { console.warn('[tradeConfirm] 标记商品已售失败：', e.message || e); }
  }

  return {
    ok: true, role, buyerDone, sellerDone,
    status: buyerDone && sellerDone ? '已完成' : '待完成'
  };
}

async function actionGet(openid, ev) {
  if (ev.tradeId) {
    const res = await db.collection('trades').doc(ev.tradeId).get();
    return { ok: true, trade: res.data || null };
  }
  if (ev.itemId) {
    const res = await db.collection('trades')
      .where(_.and([
        { itemId: ev.itemId },
        _.or([{ buyerId: openid }, { sellerId: openid }])
      ]))
      .orderBy('createdAt', 'desc').limit(1).get();
    return { ok: true, trade: res.data[0] || null };
  }
  return { ok: false, msg: '缺少查询参数' };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { action } = event || {};
  if (!OPENID) return { ok: false, msg: '未获取到用户身份' };

  try {
    if (action === 'create') return await actionCreate(OPENID, event);
    if (action === 'confirm') return await actionConfirm(OPENID, event.tradeId);
    if (action === 'get') return await actionGet(OPENID, event);
    return { ok: false, msg: '未知操作' };
  } catch (e) {
    console.error('[tradeConfirm]', e);
    return { ok: false, msg: '服务异常，请稍后再试' };
  }
};
