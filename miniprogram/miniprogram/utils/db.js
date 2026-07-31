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

// 排序应用：new 最新 / priceAsc 价格升 / priceDesc 价格降
function applySort(data, sort) {
  if (sort === 'priceAsc') return data.sort((a, b) => (a.price || 0) - (b.price || 0));
  if (sort === 'priceDesc') return data.sort((a, b) => (b.price || 0) - (a.price || 0));
  return data.sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime(), tb = new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });
}

// 「七成新及以下」= 除全新/九成新/八成新以外的所有成色
const HIGH_CONDITIONS = ['全新', '九成新', '八成新'];
function matchCondition(item, condition) {
  if (!condition || condition === '全部') return true;
  if (condition === '七成新及以下') return HIGH_CONDITIONS.indexOf(item.condition) < 0;
  return item.condition === condition;
}

// 商品列表（支持分类、关键词、成色筛选、排序 v0.4.0）
async function listItems({ category = '全部', keyword = '', condition = '全部', sort = 'new' } = {}) {
  if (hasCloud()) {
    try {
      const _ = wx.cloud.database().command;
      const where = { status: '在售' };
      if (category && category !== '全部') where.category = category;
      if (condition && condition !== '全部') {
        where.condition = condition === '七成新及以下' ? _.nin(HIGH_CONDITIONS) : condition;
      }
      const orderField = sort === 'new' ? 'createdAt' : 'price';
      const orderDir = sort === 'priceAsc' ? 'asc' : 'desc';
      const res = await coll('items').where(where)
        .orderBy(orderField, orderDir).limit(50).get();
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
  data = data.filter(i => matchCondition(i, condition));
  if (keyword) data = data.filter(i => i.title.indexOf(keyword) >= 0);
  return applySort(data, sort);
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

// 卖家其他在售（v0.4.0）：云端按 _openid，mock 按 sellerName
async function listSellerItems({ sellerId = '', sellerName = '', excludeId = '' } = {}) {
  if (hasCloud() && sellerId) {
    try {
      const res = await coll('items').where({ _openid: sellerId, status: '在售' })
        .orderBy('createdAt', 'desc').limit(5).get();
      return (res.data || []).filter(i => i._id !== excludeId).slice(0, 4);
    } catch (e) { console.warn('[db] listSellerItems 回退：', e.errMsg || e); }
  }
  return mock.ITEMS.filter(i => i.sellerName === sellerName && i._id !== excludeId).slice(0, 4);
}

// 同分类相关推荐（v0.4.0）
async function listRelated({ category = '', excludeId = '' } = {}) {
  if (hasCloud() && category) {
    try {
      const res = await coll('items').where({ category, status: '在售' })
        .orderBy('createdAt', 'desc').limit(5).get();
      return (res.data || []).filter(i => i._id !== excludeId).slice(0, 4);
    } catch (e) { console.warn('[db] listRelated 回退：', e.errMsg || e); }
  }
  return mock.ITEMS.filter(i => i.category === category && i._id !== excludeId).slice(0, 4);
}

// 浏览量 +1（v0.4.0）：走 itemView 云函数（服务端 inc，规避客户端跨用户写权限），失败静默
function incView(itemId) {
  callFn('itemView', { itemId });
}

// ============ 收藏（v0.4.0） ============
// 云端 favorites 集合持久化；云不可用时回退本地缓存，保证零配置可用。
const FAV_KEY = 'favorites';

function localFavs() { return wx.getStorageSync(FAV_KEY) || []; }
function saveLocalFavs(list) { wx.setStorageSync(FAV_KEY, list); }

// 是否已收藏
async function isFaved(itemId) {
  const openid = getApp().globalData.openid;
  if (hasCloud() && openid) {
    try {
      const res = await coll('favorites').where({ itemId, _openid: openid }).limit(1).get();
      return res.data.length > 0;
    } catch (e) { console.warn('[db] isFaved 回退本地：', e.errMsg || e); }
  }
  return localFavs().some(f => f.itemId === itemId);
}

// 切换收藏，返回最新收藏态；快照字段冗余存储便于列表直接展示
async function toggleFav(item) {
  const snap = {
    itemId: item._id, title: item.title, price: item.price,
    cover: item.cover || '📦', condition: item.condition || '', createdAt: Date.now()
  };
  const openid = getApp().globalData.openid;
  if (hasCloud() && openid) {
    try {
      const exist = await coll('favorites').where({ itemId: snap.itemId, _openid: openid }).limit(1).get();
      if (exist.data.length) {
        await coll('favorites').doc(exist.data[0]._id).remove();
        return false;
      }
      await coll('favorites').add({ data: snap });
      return true;
    } catch (e) { console.warn('[db] toggleFav 回退本地：', e.errMsg || e); }
  }
  const list = localFavs();
  const idx = list.findIndex(f => f.itemId === snap.itemId);
  if (idx >= 0) { list.splice(idx, 1); saveLocalFavs(list); return false; }
  list.unshift(snap); saveLocalFavs(list);
  return true;
}

// 我的收藏列表
async function myFavs() {
  const openid = getApp().globalData.openid;
  if (hasCloud() && openid) {
    try {
      const res = await coll('favorites').where({ _openid: openid })
        .orderBy('createdAt', 'desc').limit(50).get();
      return res.data || [];
    } catch (e) { console.warn('[db] myFavs 回退本地：', e.errMsg || e); }
  }
  return localFavs();
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

// 发送消息，并同步会话摘要 + 对方未读数 +1（v0.4.0）
async function sendMessage({ chatId, content, type = 'text', chat = null }) {
  if (!hasCloud() || !chatId) throw new Error('云环境未就绪');
  const app = getApp();
  const me = app.globalData.openid;
  const res = await coll('messages').add({
    data: { chatId, content, type, from: me, createdAt: Date.now() }
  });
  try {
    const db = wx.cloud.database();
    const _ = db.command;
    const update = { lastMsg: type === 'text' ? content : `[${type}]`, lastAt: Date.now() };
    // 我是买家则给卖家未读 +1，反之亦然；未传入 chat 文档时查一次
    if (!chat) {
      const r = await coll('chats').doc(chatId).get();
      chat = r.data;
    }
    if (chat) update[me === chat.buyerId ? 'sellerUnread' : 'buyerUnread'] = _.inc(1);
    await coll('chats').doc(chatId).update({ data: update });
  } catch (e) { /* 摘要更新失败不影响消息本身 */ }
  return res;
}

// 清零我在某会话中的未读数（进入会话时调用，v0.4.0）
async function clearUnread(chatId, role) {
  if (!hasCloud() || !chatId) return;
  try {
    const field = role === 'seller' ? 'sellerUnread' : 'buyerUnread';
    await coll('chats').doc(chatId).update({ data: { [field]: 0 } });
  } catch (e) { /* 静默 */ }
}

// 我的未读消息总数（用于 tabBar 徽标，v0.4.0）
async function unreadTotal(openid) {
  const rows = await myChats(openid);
  if (!rows) return 0;
  return rows.reduce((sum, c) => {
    const n = c.buyerId === openid ? (c.buyerUnread || 0) : (c.sellerUnread || 0);
    return sum + n;
  }, 0);
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
  listSellerItems, listRelated, incView,
  isFaved, toggleFav, myFavs,
  getOrCreateChat, myChats, listMessages, sendMessage, watchMessages, watchTrade,
  clearUnread, unreadTotal,
  createTrade, confirmTrade, getTrade, myTrades,
  sendEmailCode, verifyEmailCode
};
