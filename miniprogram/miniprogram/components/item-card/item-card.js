// 商品卡片组件
Component({
  properties: {
    item: { type: Object, value: {} }
  },
  data: { colorClass: '' },
  observers: {
    'item': function (item) {
      // 根据分类给缩略图配色
      const map = { '数码': 'b', '生活': 'c', '美妆': 'd' };
      this.setData({ colorClass: map[item && item.category] || '' });
    }
  },
  methods: {
    onTap() {
      const id = this.data.item._id;
      if (!id) return;
      wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
    }
  }
});
