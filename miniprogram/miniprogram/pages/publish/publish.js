// 发布闲置
const app = getApp();
const db = require('../../utils/db');
const { toast } = require('../../utils/util');

// 简易违禁词（真实项目应放后端/云端配置）
const BANNED = ['管制刀具', '仿真枪', '处方药', '发票', '代考', '烟'];

Page({
  data: {
    authLevel: 0,
    images: [],
    title: '', desc: '', price: '', location: '',
    cats: ['教材', '数码', '生活', '美妆', '卡券', '其他'],
    category: '教材',
    conditions: ['全新', '九成新', '七成新', '有使用痕迹'],
    condition: '九成新',
    canSubmit: false
  },

  onShow() {
    this.setData({ authLevel: app.globalData.authLevel || 0 });
  },

  goAuth() { wx.navigateTo({ url: '/pages/auth/auth' }); },

  onField(e) {
    this.setData({ [e.currentTarget.dataset.k]: e.detail.value }, this.checkForm);
  },
  onChip(e) {
    const { k, v } = e.currentTarget.dataset;
    this.setData({ [k]: v });
  },

  chooseImg() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      success: (res) => {
        const paths = res.tempFiles.map(f => f.tempFilePath);
        this.setData({ images: this.data.images.concat(paths) }, this.checkForm);
      }
    });
  },
  removeImg(e) {
    const idx = e.currentTarget.dataset.idx;
    const images = this.data.images.slice();
    images.splice(idx, 1);
    this.setData({ images }, this.checkForm);
  },
  previewImg(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.previewImage({ current: this.data.images[idx], urls: this.data.images });
  },

  checkForm() {
    const { title, price, images } = this.data;
    this.setData({ canSubmit: !!(title.trim() && Number(price) > 0 && images.length) });
  },

  async onSubmit() {
    // 1) 认证拦截
    if (this.data.authLevel < 2) {
      wx.showModal({
        title: '需要学生认证', content: '发布商品前请先完成学生认证',
        confirmText: '去认证',
        success: (r) => { if (r.confirm) this.goAuth(); }
      });
      return;
    }
    if (!this.data.canSubmit) { toast('请填写标题、价格并至少上传1张图'); return; }

    // 2) 违禁词校验
    const text = this.data.title + this.data.desc;
    const hit = BANNED.find(w => text.indexOf(w) >= 0);
    if (hit) { toast(`包含违禁内容「${hit}」，无法发布`); return; }

    // 3) 上传图片到云存储
    wx.showLoading({ title: '发布中…' });
    try {
      const imgFileIds = await this.uploadImages();
      const user = app.globalData.userInfo || {};
      await db.addItem({
        title: this.data.title.trim(),
        desc: this.data.desc.trim(),
        price: Number(this.data.price),
        category: this.data.category,
        condition: this.data.condition,
        location: this.data.location || '校内',
        images: imgFileIds.length ? imgFileIds : ['📦'],
        cover: imgFileIds[0] || '📦',
        sellerName: user.nickname || '我',
        sellerVerified: true,
        sellerCredit: '新晋卖家'
      });
      wx.hideLoading();
      toast('发布成功', 'success');
      this.resetForm();
      // 通知首页刷新
      const pages = getCurrentPages();
      const home = pages.find(p => p.route === 'pages/home/home');
      if (home) home._needRefresh = true;
      setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 1200);
    } catch (e) {
      wx.hideLoading();
      console.error(e);
      toast(e.message || '发布失败，请确认云环境已就绪');
    }
  },

  // 上传图片，返回 fileID 数组；云环境未就绪则返回空数组
  async uploadImages() {
    if (!db.hasCloud()) return [];
    const ids = [];
    for (const p of this.data.images) {
      const ext = (p.match(/\.\w+$/) || ['.png'])[0];
      const cloudPath = `items/${Date.now()}-${Math.floor(Math.random() * 1e6)}${ext}`;
      const r = await wx.cloud.uploadFile({ cloudPath, filePath: p });
      ids.push(r.fileID);
    }
    return ids;
  },

  resetForm() {
    this.setData({ images: [], title: '', desc: '', price: '', location: '', category: '教材', condition: '九成新', canSubmit: false });
  }
});
