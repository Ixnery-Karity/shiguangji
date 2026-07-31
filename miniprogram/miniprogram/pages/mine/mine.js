// 个人中心
const app = getApp();
const db = require('../../utils/db');
const { toast } = require('../../utils/util');

Page({
  data: {
    nickname: '校园用户',
    avatarText: '我',
    authLevel: 0,
    stat: { onsale: 0, fav: 0, done: 0, rate: '—' }
  },

  onShow() {
    const u = app.globalData.userInfo || {};
    const lv = app.globalData.authLevel || 0;
    const name = u.nickname || '校园用户';
    this.setData({
      nickname: name,
      avatarText: name.charAt(0),
      authLevel: lv
    });
    this.loadStats();
  },

  // 真实统计：在售 / 收藏 / 已成交（v0.4.0）
  async loadStats() {
    const openid = app.globalData.openid;
    const [items, favs, trades] = await Promise.all([
      openid ? db.myItems(openid) : [],
      db.myFavs(),
      openid ? db.myTrades(openid) : []
    ]);
    const done = (trades || []).filter(t => t.status === '已完成').length;
    this.setData({
      stat: {
        onsale: (items || []).filter(i => i.status === '在售').length,
        fav: (favs || []).length,
        done,
        rate: done > 0 ? '100%' : '—'
      }
    });
  },

  goAuth() { wx.navigateTo({ url: '/pages/auth/auth' }); },
  goTrade() { wx.navigateTo({ url: '/pages/trade/trade' }); },
  goMyItems() { wx.navigateTo({ url: '/pages/trade/trade?tab=items' }); },
  goFavs() { wx.navigateTo({ url: '/pages/trade/trade?tab=favs' }); },
  todo() { toast('该功能二期开放'); }
});
