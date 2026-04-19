Component({
  options: {
    multipleSlots: false
  },
  /**
   * 组件的属性列表
   */
  properties: {
    // 初始位置坐标
    x: {
      type: Number,
      value: 300
    },
    y: {
      type: Number,
      value: 500
    },
    // 按钮大小
    size: {
      type: Number,
      value: 60
    },
    // 按钮颜色
    color: {
      type: String,
      value: '#07C160'
    },
    // 图标
    icon: {
      type: String,
      value: ''
    },
    // 登录状态
    isLogin: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    // 触摸开始时的位置
    startX: 0,
    startY: 0,
    // 按钮当前位置
    currentX: 0,
    currentY: 0,
    // 按钮是否可以拖动
    isDragging: false,
    // 屏幕宽高
    screenWidth: 0,
    screenHeight: 0,
    // 按钮样式对象
    buttonStyle: ''
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 获取屏幕宽高（使用较新的API）
      const { windowWidth, windowHeight } = wx.getWindowInfo();
      this.setData({
        screenWidth: windowWidth,
        screenHeight: windowHeight,
        currentX: this.properties.x,
        currentY: this.properties.y
      });
      // 初始化样式
      this.updateButtonStyle();
    }
  },
  
  /**
   * 监听器
   */
  observers: {
    'currentX, currentY, size, color': function() {
      this.updateButtonStyle();
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 更新按钮样式
     */
    updateButtonStyle: function() {
      const { currentX, currentY, size, color } = this.data;
      const left = currentX - size / 2;
      const top = currentY - size / 2;
      
      this.setData({
        buttonStyle: `left: ${left}px; top: ${top}px; width: ${size}px; height: ${size}px; background-color: ${color};`
      });
    },
    
    // 触摸开始事件
    touchStart(e) {
      const touch = e.touches[0];
      this.setData({
        startX: touch.clientX,
        startY: touch.clientY,
        isDragging: false
      });
    },
    
    // 触摸移动事件
    touchMove(e) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - this.data.startX;
      const deltaY = touch.clientY - this.data.startY;
      
      // 判断是否为拖动（移动超过一定距离才视为拖动）
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        this.setData({ isDragging: true });
      }
      
      if (this.data.isDragging) {
        let newX = this.data.currentX + deltaX;
        let newY = this.data.currentY + deltaY;
        
        // 限制在屏幕范围内
        const min = this.properties.size / 2;
        const maxX = this.data.screenWidth - min;
        const maxY = this.data.screenHeight - min;
        
        newX = Math.max(min, Math.min(newX, maxX));
        newY = Math.max(min, Math.min(newY, maxY));
        
        this.setData({
          currentX: newX,
          currentY: newY,
          startX: touch.clientX,
          startY: touch.clientY
        });
      }
    },
    
    // 触摸结束事件
    touchEnd() {
      if (!this.data.isDragging) {
        // 如果不是拖动，视为点击
        this.handleTap();
      }
    },
    
    // 处理点击事件
    handleTap() {
      console.log('聊天悬浮按钮被点击');
      
      // 检查是否已登录，未登录则提示登录
      if (!this.properties.isLogin) {
        wx.showModal({
          title: '提示',
          content: '该功能需要登录后才能使用',
          showCancel: true,
          cancelText: '取消',
          confirmText: '立即登录',
          confirmColor: '#ff6bb5',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/pages/login/login'
              });
            }
          }
        });
        return;
      }
      
      // 已登录则导航到聊天页面
      wx.navigateTo({
        url: '/pages/chat-with-model/chat-with-model',
        fail: (err) => {
          console.error('导航失败:', err);
          wx.showToast({
            title: '无法打开聊天页面',
            icon: 'none'
          });
        }
      });
      
      // 触发自定义事件
      this.triggerEvent('click');
    }
  }
});