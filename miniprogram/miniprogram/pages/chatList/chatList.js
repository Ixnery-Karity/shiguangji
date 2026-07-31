// 消息列表
// v0.3.0：优先读取云端 chats 集合（我参与的会话）；云未就绪时回退演示数据。
const app = getApp();
const db = require('../../utils/db');
const { fromNow } = require('../../utils/util');

const DEMO_CHATS = [
  { id: 'c1', avatar: '👦', name: '王同学', lastMsg: '可以，一言为定 👍', time: '刚刚', unread: 1,
    itemId: 'm1', itemTitle: '高等数学 同济第七版', price: 15 },
  { id: 'c2', avatar: '👧', name: '陈同学', lastMsg: '口红全新未拆，晚上5楼下当面看？', time: '10分钟前', unread: 0,
    itemId: 'm4', itemTitle: '全新口红 色号#12', price: 60 }
];

Page({
  data: { chats: [], live: false },

  onShow() { this.load(); },

  async load() {
    const openid = app.globalData.openid;
    const rows = await db.myChats(openid);
    if (rows === null) {
      // 云不可用：演示数据
      this.setData({ chats: DEMO_CHATS, live: false });
      return;
    }
    const me = openid;
    let unreadSum = 0;
    const chats = rows.map(c => {
      const iAmBuyer = c.buyerId === me;
      const unread = (iAmBuyer ? c.buyerUnread : c.sellerUnread) || 0;
      unreadSum += unread;
      return {
        id: c._id, chatId: c._id,
        avatar: iAmBuyer ? '👦' : '🧑',
        name: (iAmBuyer ? c.sellerName : c.buyerName) || '同学',
        lastMsg: c.lastMsg || '（暂无消息）',
        time: fromNow(c.lastAt),
        unread,
        itemId: c.itemId, itemTitle: c.itemTitle, price: c.price
      };
    });
    this.setData({ chats, live: true });
    // 同步 tabBar 徽标（v0.4.0）
    if (unreadSum > 0) wx.setTabBarBadge({ index: 2, text: unreadSum > 99 ? '99+' : String(unreadSum), fail: () => {} });
    else wx.removeTabBarBadge({ index: 2, fail: () => {} });
  },

  openChat(e) {
    const c = this.data.chats[e.currentTarget.dataset.i];
    let url = `/pages/chatRoom/chatRoom?itemId=${c.itemId}` +
              `&title=${encodeURIComponent(c.itemTitle)}&price=${c.price}` +
              `&seller=${encodeURIComponent(c.name)}`;
    if (c.chatId) url += `&chatId=${c.chatId}`;
    wx.navigateTo({ url });
  }
});
