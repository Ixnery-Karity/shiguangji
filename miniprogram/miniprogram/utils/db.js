// utils/db.js —— 数据访问层
// 设计：优先云数据库；若云环境未就绪或查询异常，则回退到本地 mock，
//       保证未接云开发时页面与流程仍可演示。
// v0.3.0：新增会话/消息（chats/messages）读写与 watch 实时监听，
//         新增 authEmail / tradeConfirm 云函数调用封装。
const mock = require('./mock');

function coll(name) {
  return wx.cloud.database().collection(name);
}
function hasCloud() {
  return !!(wx.cloud && wx.cloud.database);
}

// 云函数调用封装：失败返回 null（由调用方决定是否回退演示逻辑）
async function callFn(name, data) {
  if (!hasCloud() || !wx.cloud.callFunction) return null;
  try {
    const res = await wx.cloud.callFunction({ name, data });
    return res.result || null;
  } catch (e) {
    console.warn(`[db] 云函数 ${name} 调用失败：`, e.errMsg || e);
    return null;
  }
}

// 商品列表（支持分类、关键词）
async function listItems({ category = '全部', keyword = '' } = {}) {
  if (hasCloud()) {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const where = { status: '在售' };
      if (category && category !== '全部') where.category = category;
      let q = coll('items').where(where);
      const res = await q.orderBy('createdAt', 'desc').limit(50).get();
      let data = res.data || [];
      if (keyword) data = data.filter(i => (i.title || '').indexOf(keyword) >= 0);
      if (data.length) return data;
    } catch (e) {
      console.warn('[db] listItems 回退 mock：', e.errMsg || e);
    }
  }
  // 回退 mock
  let data = mock.ITEMS.slice();
  if (category && category !== '全部') data = data.filter(i => i.category === category);
  if (keyword) data = data.filter(i => i.title.indexOf(keyword) >= 0);
  return data;
}

// 商品详情
async function getItem(id) {
  if (hasCloud()) {
    try {
      const res = await coll('items').doc(id).get();
      if (res.data) return res.data;
    } catch (e) {
      console.warn('[db] getItem 回退 mock：', e.errMsg || e);
    }
  }
  return mock.ITEMS.find(i => i._id === id) || null;
}

// 发布商品
async function addItem(item) {
  if (!hasCloud()) throw new Error('云环境未就绪，无法真实发布');
  const db = wx.cloud.database();
  const data = Object.assign({
    status: '在售', createdAt: db.serverDate(), images: [], condition: '九成新'
  }, item);
  return coll('items').add({ data });
}

// 我的发布
async function myItems(openid) {
  if (hasCloud()) {
    try {
      const res = await coll('items').where({ _openid: openid })
        .orderBy('createdAt', 'desc').get();
      return res.data || [];
    } catch (e) { console.warn('[db] myItems 回退：', e.errMsg || e); }
  }
  return [];
}

// ============ 会话 / 消息（v0.3.0） ============

// 获取或创建会话：同一商品+同一买家只保留一条会话
// 返回 chat 文档；云不可用时返回 null（调用方走演示模式）
async function getOrCreateChat({ itemId, itemTitle = '', price = 0, cover = '📦', sellerId = '', sellerName = '', buyerName = '' }) {
  if (!hasCloud()) return null;
  try {
    const db = wx.cloud.database();
    const app = getApp();
    const openid = app.globalData.openid;
    if (!openid) return null;
    const exist = await coll('chats').where({ itemId, buyerId: openid }).limit(1).get();
    if (exist.data.length) return exist.data[0];

    const data = {
      itemId, itemTitle, price: Number(price) || 0, cover,
      buyerId: openid, buyerName: buyerName || '我',
      sellerId, sellerName,
      lastMsg: '', lastAt: Date.now(),
      createdAt: db.serverDate()
    };
    const res = await coll('chats').add({ data });
    return Object.assign({ _id: res._id }, data);
  } catch (e) {
    console.warn('[db] getOrCreateChat 失败：', e.errMsg || e);
    return null;
  }
}

// 我的会话列表（买家或卖家视角）
async function myChats(openid) {
  if (hasCloud() && openid) {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const res = await coll('chats')
        .where(_.or([{ buyerId: openid }, { sellerId: openid }]))
        .orderBy('lastAt', 'desc').limit(50).get();
      return res.data || [];
    } catch (e) { console.warn('[db] myChats 回退：', e.errMsg || e); }
  }
  return null; // null 表示云不可用，由页面决定是否展示演示会话
}

// 历史消息
async function listMessages(chatId) {
  if (!hasCloud() || !chatId) return [];
  try {
    const res = await coll('messages').where({ chatId })
      .orderBy('createdAt', 'asc').limit(100).get();
    return res.data || [];
  } catch (e) {
    console.warn('[db] listMessages 失败：', e.errMsg || e);
    return [];
  }
}

// 发送消息，并同步会话摘要
async function sendMessage({ chatId, content, type = 'text' }) {
  if (!hasCloud() || !chatId) throw new Error('云环境未就绪');
  const app = getApp();
  const res = await coll('messages').add({
    data: { chatId, content, type, from: app.globalData.openid, createdAt: Date.now() }
  });
  try {
    await coll('chats').doc(chatId).update({
      data: { lastMsg: type === 'text' ? content : `[${type}]`, lastAt: Date.now() }
    });
  } catch (e) { /* 摘要更新失败不影响消息本身 */ }
  return res;
}

// 实时监听会话消息：返回 watcher（需在页面 onUnload 调用 watcher.close()）
// 云不可用时返回 null
function watchMessages(chatId, onChange) {
  if (!hasCloud() || !chatId) return null;
  try {
    return coll('messages').where({ chatId }).watch({
      onChange(snapshot) {
        const docs = (snapshot.docs || []).slice()
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        onChange(docs, snapshot);
      },
      onError(e) { console.warn('[db] watchMessages 断开：', e.errMsg || e); }
    });
  } catch (e) {
    console.warn('[db] watchMessages 启动失败：', e.errMsg || e);
    return null;
  }
}

// 实时监听单条交易（双向确认状态同步）
function watchTrade(tradeId, onChange) {
  if (!hasCloud() || !tradeId) return null;
  try {
    const db = wx.cloud.database();
    const _ = db.command;
    return coll('trades').where({ _id: tradeId }).watch({
      onChange(snapshot) {
        const t = (snapshot.docs || [])[0];
        if (t) onChange(t);
      },
      onError(e) { console.warn('[db] watchTrade 断开：', e.errMsg || e); }
    });
  } catch (e) {
    console.warn('[db] watchTrade 启动失败：', e.errMsg || e);
    return null;
  }
}

// ============ 交易（v0.3.0：优先走 tradeConfirm 云函数） ============

// 交易：发起（服务端创建，避免越权写；失败回退旧的直写方式）
async function createTrade(trade) {
  const r = await callFn('tradeConfirm', Object.assign({ action: 'create' }, trade));
  if (r && r.ok) return r;
  if (!hasCloud()) throw new Error('云环境未就绪');
  const db = wx.cloud.database();
  const res = await coll('trades').add({
    data: Object.assign({
      status: '待完成', buyerDone: false, sellerDone: false,
      createdAt: db.serverDate()
    }, trade)
  });
  return { ok: true, tradeId: res._id };
}

// 交易：确认完成（服务端按角色判定，双方完成自动闭环+标记已售）
async function confirmTrade(tradeId) {
  const r = await callFn('tradeConfirm', { action: 'confirm', tradeId });
  if (r) return r;
  throw new Error('云环境未就绪');
}

// 交易：查询最新状态
async function getTrade({ tradeId, itemId }) {
  const r = await callFn('tradeConfirm', { action: 'get', tradeId, itemId });
  return (r && r.ok) ? r.trade : null;
}

// 我的交易列表
async function myTrades(openid) {
  if (hasCloud()) {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const res = await coll('trades')
        .where(_.or([{ buyerId: openid }, { sellerId: openid }]))
        .orderBy('createdAt', 'desc').get();
      return res.data || [];
    } catch (e) { console.warn('[db] myTrades 回退：', e.errMsg || e); }
  }
  return [];
}

// ============ 认证（v0.3.0：authEmail 云函数） ============

// 发送邮箱验证码：云函数不可用时返回 null（页面回退本地演示码）
async function sendEmailCode(email) {
  return callFn('authEmail', { action: 'send', email });
}

// 校验邮箱验证码
async function verifyEmailCode(email, code) {
  return callFn('authEmail', { action: 'verify', email, code });
}

module.exports = {
  hasCloud, listItems, getItem, addItem, myItems,
  getOrCreateChat, myChats, listMessages, sendMessage, watchMessages, watchTrade,
  createTrade, confirmTrade, getTrade, myTrades,
  sendEmailCode, verifyEmailCode
};
