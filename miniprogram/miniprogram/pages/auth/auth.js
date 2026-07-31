// 学生认证
// v0.3.0：邮箱验证码改为 authEmail 云函数服务端生成/校验（配置 SMTP 后真实发信）；
//         云未就绪时回退本地演示码，保证零配置可跑通。
const app = getApp();
const db = require('../../utils/db');
const { toast, isCampusEmail, genCode } = require('../../utils/util');

const LEVEL_TEXT = { 0: '游客（未认证）', 1: '邮箱已验证', 2: '已认证学生 ✔' };

Page({
  data: {
    authLevel: 0,
    levelText: '',
    email: '', code: '', devCode: '',
    codeSent: false, counting: false, countdown: 60,
    maskedEmail: '',
    certImg: '', certSubmitted: false
  },

  onShow() {
    const lv = app.globalData.authLevel || 0;
    const u = app.globalData.userInfo || {};
    this.setData({
      authLevel: lv,
      levelText: LEVEL_TEXT[lv],
      maskedEmail: u.email ? this.mask(u.email) : ''
    });
  },

  mask(email) {
    const [name, domain] = email.split('@');
    const head = name.slice(0, 2);
    return `${head}****@${domain}`;
  },

  onEmail(e) { this.setData({ email: e.detail.value }); },
  onCode(e) { this.setData({ code: e.detail.value }); },

  // 发送验证码：优先 authEmail 云函数（服务端存码，配置 SMTP 后真实发信）
  async sendCode() {
    if (this.data.counting) return;
    if (!isCampusEmail(this.data.email)) {
      toast('请输入正确的校园邮箱（edu.cn 后缀）');
      return;
    }

    const r = await db.sendEmailCode(this.data.email);
    if (r && !r.ok) { toast(r.msg || '发送失败'); return; }

    if (r && r.ok) {
      // 服务端模式：mailed=true 真实发信不回传验证码；未配 SMTP 时返回 devCode 便于演示
      this._serverMode = true;
      this._code = '';
      this.setData({ codeSent: true, devCode: r.devCode || '' });
      toast(r.mailed ? '验证码已发送到邮箱' : '验证码已生成（演示）', 'success');
    } else {
      // 云函数不可用：回退本地演示码
      this._serverMode = false;
      const c = genCode();
      this._code = c;
      this.setData({ codeSent: true, devCode: c });
      toast('验证码已发送（本地演示）', 'success');
    }

    this.setData({ counting: true, countdown: 60 });
    this.timer = setInterval(() => {
      const n = this.data.countdown - 1;
      if (n <= 0) { clearInterval(this.timer); this.setData({ counting: false }); }
      else this.setData({ countdown: n });
    }, 1000);
  },

  // 校验邮箱验证码 → 升级为 level 1
  async verifyEmail() {
    if (!this.data.code) { toast('请输入验证码'); return; }

    if (this._serverMode) {
      const r = await db.verifyEmailCode(this.data.email, this.data.code);
      if (!r || !r.ok) { toast((r && r.msg) || '验证失败，请重试'); return; }
      // 服务端已更新 users 记录，这里同步本地状态即可
      await this.saveLevel(r.authLevel || 1, { email: this.data.email }, /* skipCloud */ true);
    } else {
      if (this.data.code !== this._code) { toast('验证码不正确'); return; }
      await this.saveLevel(1, { email: this.data.email });
    }
    this.setData({
      authLevel: Math.max(this.data.authLevel, 1),
      levelText: LEVEL_TEXT[Math.max(this.data.authLevel, 1)],
      maskedEmail: this.mask(this.data.email)
    });
    toast('邮箱验证成功', 'success');
  },

  uploadCert() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'],
      success: (res) => this.setData({ certImg: res.tempFiles[0].tempFilePath })
    });
  },

  // 提交学生证审核。演示：直接标记通过；真实项目应上传+后台人工审核
  submitCert() {
    if (this.data.authLevel < 1) { toast('请先完成第一步邮箱验证'); return; }
    if (!this.data.certImg) { toast('请先上传学生证照片'); return; }
    this.setData({ certSubmitted: true });
    wx.showLoading({ title: '提交中…' });
    // 演示环境：模拟审核通过。生产环境应写 authRecords 待审核，由后台通过后再升级
    setTimeout(() => {
      this.saveLevel(2, {}).then(() => {
        wx.hideLoading();
        this.setData({ authLevel: 2, levelText: LEVEL_TEXT[2] });
        wx.showModal({
          title: '认证通过', content: '恭喜！你已成为认证学生，现在可以发布与交易了。',
          showCancel: false, confirmText: '好的',
          success: () => wx.navigateBack()
        });
      });
    }, 1500);
  },

  // 写入用户认证等级（skipCloud=true 时仅更新本地，云端已由云函数写好）
  async saveLevel(level, extra, skipCloud) {
    app.globalData.authLevel = level;
    if (app.globalData.userInfo) {
      app.globalData.userInfo = Object.assign({}, app.globalData.userInfo, { authLevel: level }, extra);
    }
    if (skipCloud) return;
    if (db.hasCloud() && app.globalData.openid) {
      try {
        const cdb = wx.cloud.database();
        await cdb.collection('users').where({ _openid: app.globalData.openid })
          .update({ data: Object.assign({ authLevel: level }, extra) });
      } catch (e) { console.warn('保存认证等级失败（演示环境可忽略）', e); }
    }
  },

  onUnload() { if (this.timer) clearInterval(this.timer); }
});
