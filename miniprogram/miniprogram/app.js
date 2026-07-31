// app.js —— 小程序入口，初始化云开发 + 全局状态
App({
  globalData: {
    openid: '',          // 当前用户 openid
    userInfo: null,      // 当前用户档案（users 集合中的记录）
    authLevel: 0         // 认证等级：0 游客 / 1 邮箱已验证 / 2 已认证学生
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请使用 2.2.3 及以上基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      // env: 'your-env-id',  // TODO: 替换为你自己的云环境 ID；DYNAMIC_CURRENT_ENV 会用默认环境
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    });
    // 静默登录：拿 openid + 用户档案
    this.login();
  },

  // 登录：调用 login 云函数拿 openid，再查/建用户档案
  login() {
    return wx.cloud.callFunction({ name: 'login' })
      .then(res => {
        const openid = res.result && res.result.openid;
        this.globalData.openid = openid || '';
        return this.refreshUser();
      })
      .catch(err => {
        console.warn('登录失败（请确认已开通云开发并部署 login 云函数）', err);
      });
  },

  // 刷新当前用户档案；不存在则创建一条游客档案
  refreshUser() {
    const db = wx.cloud.database();
    const openid = this.globalData.openid;
    if (!openid) return Promise.resolve(null);
    return db.collection('users').where({ _openid: openid }).get().then(res => {
      if (res.data && res.data.length) {
        const u = res.data[0];
        this.globalData.userInfo = u;
        this.globalData.authLevel = u.authLevel || 0;
        return u;
      }
      // 新用户：建游客档案
      const doc = {
        nickname: '校园用户',
        avatar: '',
        school: '',
        authLevel: 0,
        credit: 100,
        createdAt: db.serverDate()
      };
      return db.collection('users').add({ data: doc }).then(() => this.refreshUser());
    });
  }
});
