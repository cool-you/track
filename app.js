class LocationTracker {
  constructor() {
    this.currentUser = null;
    this.currentPosition = null;
    this.targetFriend = null;
    this.watchId = null;
    this.compassHeading = 0;
    this.mode = 'follow';
    this.updateInterval = null;
    this.confirmCallback = null;

    this.init();
  }

  init() {
    this.initElements();
    this.initEventListeners();
    this.checkAuth();
  }

  initElements() {
    this.authScreen = document.getElementById('authScreen');
    this.mainScreen = document.getElementById('mainScreen');
    this.loginForm = document.getElementById('loginForm');
    this.registerForm = document.getElementById('registerForm');
    this.authTabs = document.querySelectorAll('.auth-tab');

    this.compassRing = document.getElementById('compassRing');
    this.compassArrow = document.getElementById('compassArrow');
    this.distanceValue = document.getElementById('distanceValue');
    this.distanceUnit = document.getElementById('distanceUnit');
    this.bearingValue = document.getElementById('bearingValue');
    this.bearingLabel = document.getElementById('bearingLabel');

    this.trackingStatus = document.getElementById('trackingStatus');
    this.trackingAvatar = document.getElementById('trackingAvatar');
    this.trackingName = document.getElementById('trackingName');
    this.trackingTime = document.getElementById('trackingTime');
    this.trackingCancel = document.getElementById('trackingCancel');

    this.userAvatar = document.getElementById('userAvatar');
    this.userName = document.getElementById('userName');
    this.friendList = document.getElementById('friendList');
    this.friendCount = document.getElementById('friendCount');

    this.friendModal = document.getElementById('friendModal');
    this.shareModal = document.getElementById('shareModal');
    this.confirmModal = document.getElementById('confirmModal');

    this.toast = document.getElementById('toast');
    this.toastMessage = document.getElementById('toastMessage');

    this.addFriendBtn = document.getElementById('addFriendBtn');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.modeFollow = document.getElementById('modeFollow');
    this.modeFixed = document.getElementById('modeFixed');
  }

  initEventListeners() {
    this.authTabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
    });

    this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));

    this.addFriendBtn.addEventListener('click', () => this.showFriendModal());
    this.logoutBtn.addEventListener('click', () => this.handleLogout());

    document.getElementById('friendModalCancel').addEventListener('click', () => this.hideFriendModal());
    document.getElementById('friendModalConfirm').addEventListener('click', () => this.addFriend());

    document.getElementById('closeShareModal').addEventListener('click', () => this.hideShareModal());
    document.getElementById('copyUsername').addEventListener('click', () => this.copyUsername());

    document.getElementById('confirmCancel').addEventListener('click', () => this.hideConfirmModal());
    document.getElementById('confirmOk').addEventListener('click', () => this.handleConfirmOk());
    this.trackingCancel.addEventListener('click', () => this.cancelTracking());

    this.modeFollow.addEventListener('click', () => this.setMode('follow'));
    this.modeFixed.addEventListener('click', () => this.setMode('fixed'));

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => this.handleOrientation(e));
    }

    window.addEventListener('storage', (e) => this.handleStorageChange(e));
  }

  switchAuthTab(tab) {
    this.authTabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    if (tab === 'login') {
      this.loginForm.classList.remove('hidden');
      this.registerForm.classList.add('hidden');
    } else {
      this.loginForm.classList.add('hidden');
      this.registerForm.classList.remove('hidden');
    }
  }

  getUsers() {
    const users = localStorage.getItem('locationTracker_users');
    return users ? JSON.parse(users) : {};
  }

  saveUsers(users) {
    localStorage.setItem('locationTracker_users', JSON.stringify(users));
  }

  handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;

    if (username.length < 3 || username.length > 20) {
      this.showToast('用户名需要3-20个字符', 'error');
      return;
    }

    if (password.length < 6) {
      this.showToast('密码至少6位', 'error');
      return;
    }

    if (password !== confirm) {
      this.showToast('两次密码不一致', 'error');
      return;
    }

    const users = this.getUsers();
    if (users[username]) {
      this.showToast('用户名已存在', 'error');
      return;
    }

    users[username] = {
      password: this.hashPassword(password),
      friends: [],
      location: null,
      lastUpdate: 0
    };

    this.saveUsers(users);
    this.showToast('注册成功，请登录', 'success');
    this.switchAuthTab('login');
    document.getElementById('loginUsername').value = username;
    document.getElementById('loginPassword').value = '';
  }

  handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    const users = this.getUsers();
    const user = users[username];

    if (!user || user.password !== this.hashPassword(password)) {
      this.showToast('用户名或密码错误', 'error');
      return;
    }

    this.currentUser = username;
    localStorage.setItem('locationTracker_currentUser', username);
    
    this.showMainScreen();
    this.startTracking();
  }

  handleLogout() {
    this.stopTracking();
    this.currentUser = null;
    localStorage.removeItem('locationTracker_currentUser');
    this.hideMainScreen();
  }

  checkAuth() {
    const savedUser = localStorage.getItem('locationTracker_currentUser');
    if (savedUser) {
      const users = this.getUsers();
      if (users[savedUser]) {
        this.currentUser = savedUser;
        this.showMainScreen();
        this.startTracking();
        return;
      }
    }
    this.showAuthScreen();
  }

  showAuthScreen() {
    this.authScreen.classList.remove('hidden');
    this.mainScreen.classList.add('hidden');
  }

  showMainScreen() {
    this.authScreen.classList.add('hidden');
    this.mainScreen.classList.remove('hidden');
    this.updateUserInfo();
    this.updateFriendList();
  }

  hideMainScreen() {
    this.authScreen.classList.remove('hidden');
    this.mainScreen.classList.add('hidden');
  }

  updateUserInfo() {
    this.userName.textContent = this.currentUser;
    this.userAvatar.textContent = this.currentUser.charAt(0).toUpperCase();
    document.getElementById('myUsername').value = this.currentUser;
  }

  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  startTracking() {
    if (!navigator.geolocation) {
      this.showToast('浏览器不支持定位', 'error');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionSuccess(position),
      (error) => this.handlePositionError(error),
      options
    );

    this.updateInterval = setInterval(() => this.updateMyLocation(), 3000);
    this.refreshFriendsLocation();
  }

  stopTracking() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  handlePositionSuccess(position) {
    this.currentPosition = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now()
    };

    this.compassRing.classList.add('active');

    if (this.targetFriend) {
      this.updateCompass();
    }
  }

  handlePositionError(error) {
    let message = '定位失败';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = '请允许定位权限';
        break;
      case error.POSITION_UNAVAILABLE:
        message = '位置信息不可用';
        break;
      case error.TIMEOUT:
        message = '定位超时';
        break;
    }
    this.showToast(message, 'error');
    this.compassRing.classList.remove('active');
  }

  updateMyLocation() {
    if (!this.currentUser || !this.currentPosition) return;

    const users = this.getUsers();
    if (users[this.currentUser]) {
      users[this.currentUser].location = this.currentPosition;
      users[this.currentUser].lastUpdate = Date.now();
      this.saveUsers(users);
    }

    this.refreshFriendsLocation();
  }

  refreshFriendsLocation() {
    const users = this.getUsers();
    const myUser = users[this.currentUser];
    
    if (!myUser || !myUser.friends) return;

    myUser.friends.forEach(friendName => {
      const friend = users[friendName];
      if (friend && friend.location) {
        const timeDiff = Date.now() - friend.lastUpdate;
        if (timeDiff > 30000) {
          friend.location = null;
        }
      }
    });

    this.saveUsers(users);
    this.updateFriendList();

    if (this.targetFriend) {
      const targetData = users[this.targetFriend];
      if (targetData && targetData.location) {
        this.updateCompass();
      } else {
        this.showToast('目标位置已离线', 'error');
      }
    }
  }

  handleOrientation(event) {
    let heading = event.alpha;

    if (heading !== null) {
      if (event.webkitCompassHeading !== undefined) {
        heading = event.webkitCompassHeading;
      }

      this.compassHeading = heading;
      this.updateCompassRotation();
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.modeFollow.classList.toggle('active', mode === 'follow');
    this.modeFixed.classList.toggle('active', mode === 'fixed');
    this.updateCompassRotation();
  }

  showFriendModal() {
    this.friendModal.classList.add('active');
    document.getElementById('friendUsername').value = '';
    document.getElementById('friendUsername').focus();
  }

  hideFriendModal() {
    this.friendModal.classList.remove('active');
  }

  addFriend() {
    const friendName = document.getElementById('friendUsername').value.trim();

    if (!friendName) {
      this.showToast('请输入用户名', 'error');
      return;
    }

    if (friendName === this.currentUser) {
      this.showToast('不能添加自己为好友', 'error');
      return;
    }

    const users = this.getUsers();
    const myUser = users[this.currentUser];

    if (!users[friendName]) {
      this.showToast('用户不存在', 'error');
      return;
    }

    if (myUser.friends.includes(friendName)) {
      this.showToast('已是好友', 'error');
      return;
    }

    myUser.friends.push(friendName);
    this.saveUsers(users);

    this.hideFriendModal();
    this.updateFriendList();
    this.showToast(`已添加好友: ${friendName}`, 'success');
  }

  removeFriend(friendName) {
    document.getElementById('confirmTitle').textContent = '删除好友';
    document.getElementById('confirmMessage').textContent = `确定要删除好友 ${friendName} 吗？`;
    
    this.confirmModal.classList.add('active');
    this.confirmCallback = () => {
      const users = this.getUsers();
      const myUser = users[this.currentUser];
      myUser.friends = myUser.friends.filter(f => f !== friendName);
      this.saveUsers(users);

      if (this.targetFriend === friendName) {
        this.cancelTracking();
      }

      this.updateFriendList();
      this.showToast(`已删除好友: ${friendName}`);
    };
  }

  handleConfirmOk() {
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
    this.hideConfirmModal();
  }

  updateFriendList() {
    const users = this.getUsers();
    const myUser = users[this.currentUser];

    if (!myUser || !myUser.friends || myUser.friends.length === 0) {
      this.friendList.innerHTML = `
        <div class="empty-state">
          <p>暂无好友</p>
          <p class="hint">点击右上角添加好友</p>
        </div>
      `;
      this.friendCount.textContent = '0';
      return;
    }

    this.friendCount.textContent = myUser.friends.length;

    let html = '';
    myUser.friends.forEach(friendName => {
      const friend = users[friendName];
      const isOnline = friend && friend.location && (Date.now() - friend.lastUpdate < 30000);
      const isTracking = this.targetFriend === friendName;
      
      let distance = null;
      if (this.currentPosition && friend && friend.location) {
        distance = this.calculateDistance(
          this.currentPosition.latitude,
          this.currentPosition.longitude,
          friend.location.latitude,
          friend.location.longitude
        );
      }

      let locationText = '位置未知';
      if (friend && friend.location) {
        const timeDiff = Math.floor((Date.now() - friend.lastUpdate) / 1000);
        if (timeDiff < 60) {
          locationText = `${timeDiff}秒前在线`;
        } else if (timeDiff < 3600) {
          locationText = `${Math.floor(timeDiff / 60)}分钟前在线`;
        } else {
          locationText = `${Math.floor(timeDiff / 3600)}小时前在线`;
        }
      } else {
        locationText = '离线';
      }

      html += `
        <div class="friend-item ${isTracking ? 'active' : ''}" data-username="${friendName}">
          <div class="friend-avatar">
            ${friendName.charAt(0).toUpperCase()}
            <div class="online-indicator ${isOnline ? 'online' : 'offline'}"></div>
          </div>
          <div class="friend-info">
            <div class="friend-name">${friendName}</div>
            <div class="friend-location">${locationText}</div>
          </div>
          ${distance !== null ? `
            <div class="friend-distance">
              <div class="friend-distance-value">${this.formatDistance(distance)}</div>
              <div class="friend-distance-label">距离</div>
            </div>
          ` : ''}
          <div class="friend-actions">
            <button class="friend-action-btn track ${isTracking ? 'active' : ''}" title="追踪">
              🎯
            </button>
            <button class="friend-action-btn delete" title="删除">
              🗑️
            </button>
          </div>
        </div>
      `;
    });

    this.friendList.innerHTML = html;

    this.friendList.querySelectorAll('.friend-item').forEach(item => {
      const friendName = item.dataset.username;

      item.querySelector('.friend-action-btn.track').addEventListener('click', (e) => {
        e.stopPropagation();
        this.startTrackingFriend(friendName);
      });

      item.querySelector('.friend-action-btn.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFriend(friendName);
      });
    });
  }

  startTrackingFriend(friendName) {
    const users = this.getUsers();
    const friend = users[friendName];

    if (!friend || !friend.location) {
      this.showToast('该好友位置不可用', 'error');
      return;
    }

    this.targetFriend = friendName;
    this.targetPosition = friend.location;

    this.trackingStatus.classList.add('active');
    this.trackingAvatar.textContent = friendName.charAt(0).toUpperCase();
    this.trackingName.textContent = `正在追踪: ${friendName}`;
    this.trackingTime.textContent = '刚刚更新';
    this.trackingCancel.classList.remove('hidden');
    this.bearingLabel.textContent = friendName;

    this.updateCompass();
    this.updateFriendList();

    this.showToast(`开始追踪 ${friendName}`, 'success');
  }

  cancelTracking() {
    this.targetFriend = null;
    this.targetPosition = null;

    this.trackingStatus.classList.remove('active');
    this.trackingAvatar.textContent = '🎯';
    this.trackingName.textContent = '未选择追踪目标';
    this.trackingTime.textContent = '--';
    this.trackingCancel.classList.add('hidden');
    this.bearingLabel.textContent = '选择追踪目标';

    this.compassArrow.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    this.distanceValue.textContent = '--';
    this.bearingValue.textContent = '--°';

    this.updateFriendList();
  }

  updateCompass() {
    if (!this.currentPosition || !this.targetPosition) return;

    const bearing = this.calculateBearing(
      this.currentPosition.latitude,
      this.currentPosition.longitude,
      this.targetPosition.latitude,
      this.targetPosition.longitude
    );

    const distance = this.calculateDistance(
      this.currentPosition.latitude,
      this.currentPosition.longitude,
      this.targetPosition.latitude,
      this.targetPosition.longitude
    );

    this.bearingValue.textContent = `${Math.round(bearing)}°`;
    this.distanceValue.textContent = this.formatDistance(distance).split(' ')[0];
    this.distanceUnit.textContent = this.formatDistance(distance).split(' ')[1] || '米';

    const users = this.getUsers();
    if (this.targetFriend && users[this.targetFriend]) {
      const timeDiff = Math.floor((Date.now() - users[this.targetFriend].lastUpdate) / 1000);
      if (timeDiff < 60) {
        this.trackingTime.textContent = `${timeDiff}秒前更新`;
      } else {
        this.trackingTime.textContent = `${Math.floor(timeDiff / 60)}分钟前更新`;
      }
    }

    this.updateCompassRotation();
  }

  updateCompassRotation() {
    if (!this.targetPosition || !this.currentPosition) return;

    const bearing = this.calculateBearing(
      this.currentPosition.latitude,
      this.currentPosition.longitude,
      this.targetPosition.latitude,
      this.targetPosition.longitude
    );

    let rotation;
    if (this.mode === 'follow') {
      rotation = bearing - this.compassHeading;
    } else {
      rotation = bearing;
    }

    this.compassArrow.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = toDeg(Math.atan2(y, x));
    bearing = (bearing + 360) % 360;

    return bearing;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)} 米`;
    } else {
      return `${(meters / 1000).toFixed(1)} 公里`;
    }
  }

  handleStorageChange(e) {
    if (e.key === 'locationTracker_users' && this.currentUser) {
      this.refreshFriendsLocation();
    }
  }

  hideShareModal() {
    this.shareModal.classList.remove('active');
  }

  copyUsername() {
    const input = document.getElementById('myUsername');
    input.select();
    document.execCommand('copy');
    this.showToast('用户名已复制', 'success');
  }

  hideConfirmModal() {
    this.confirmModal.classList.remove('active');
    this.confirmCallback = null;
  }

  showToast(message, type = '') {
    this.toastMessage.textContent = message;
    this.toast.className = 'toast active';
    if (type) {
      this.toast.classList.add(type);
    }

    setTimeout(() => {
      this.toast.classList.remove('active');
    }, 2500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LocationTracker();
});
