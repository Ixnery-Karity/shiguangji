// 我的交易 / 我发布的
const app = getApp();
const db = require('../../utils/db');

Page({
  data: {
    tab: 'ongoing',   // ongoing / done / items
    list: [],
    myItems: []
  },

  onLoad(q) {
    if (q.tab) this.setData({ tab: q.tab });
    this.load();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.t });
    this.load();
  },

  async load() {
    const openid = app.globalData.openid;
    if (this.data.tab === 'items') {
      const items = await db.myItems(openid);
      this.setData({ myItems: items });
    } else {
      let trades = await db.myTrades(openid);
      const wantDone = this.data.tab === 'done';
      trades = trades.filter(t => (t.status === '已完成') === wantDone);
      this.setData({ list: trades });
    }
  },

  openItem(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  }
});
