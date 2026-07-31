// 个人中心
const app = getApp();
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
      authLevel: lv,
      // 演示统计；真实项目从云端聚合
      stat: { onsale: 0, fav: 0, done: 0, rate: lv >= 2 ? '100%' : '—' }
    });
  },

  goAuth() { wx.navigateTo({ url: '/pages/auth/auth' }); },
  goTrade() { wx.navigateTo({ url: '/pages/trade/trade' }); },
  goMyItems() { wx.navigateTo({ url: '/pages/trade/trade?tab=items' }); },
  todo() { toast('该功能二期开放'); }
});
