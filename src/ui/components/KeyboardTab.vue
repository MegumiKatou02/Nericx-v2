<template>
  <div class="keyboard-tab">
    <div class="header">
      <h1>
        <i class="fas fa-keyboard"></i>
        Tổ hợp phím
      </h1>
      <p class="description">Danh sách tất cả phím tắt có sẵn trong ứng dụng</p>
    </div>

    <div class="sections-container">
      <div class="shortcut-section">
        <div class="section-header">
          <i class="fas fa-music"></i>
          <h2>Tab Nghe nhạc</h2>
        </div>
        
        <div class="shortcuts-grid">
          <div class="shortcut-category">
            <h3>Điều khiển phát nhạc</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key">U</span>
                <div class="shortcut-info">
                  <span class="action">Phát/Tạm dừng</span>
                  <span class="desc">Phát hoặc tạm dừng bài hát hiện tại</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">I</span>
                <div class="shortcut-info">
                  <span class="action">Dừng nhạc</span>
                  <span class="desc">Dừng hoàn toàn và reset nhạc</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">X</span>
                <div class="shortcut-info">
                  <span class="action">Chế độ phát</span>
                  <span class="desc">Chuyển đổi Normal → Shuffle → Repeat</span>
                </div>
              </div>

              <div class="shortcut-item">
                <span class="key">P / Q</span>
                <div class="shortcut-info">
                  <span class="action">Tùy chỉnh nhạc</span>
                  <span class="desc">Bật/tắt advanced controls (volume, progress)</span>
                </div>
              </div>
            </div>
          </div>

          <div class="shortcut-category">
            <h3>Điều hướng</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key">← →</span>
                <div class="shortcut-info">
                  <span class="action">Chuyển bài</span>
                  <span class="desc">Bài trước / Bài kế tiếp</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">↑ ↓</span>
                <div class="shortcut-info">
                  <span class="action">Chọn bài</span>
                  <span class="desc">Di chuyển trong danh sách</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">Enter</span>
                <div class="shortcut-info">
                  <span class="action">Phát bài được chọn</span>
                  <span class="desc">Phát bài hát đang được highlight</span>
                </div>
              </div>

              <div class="shortcut-item">
                <span class="key">M</span>
                <div class="shortcut-info">
                  <span class="action">Đi đến bài hiện tại</span>
                  <span class="desc">Cuộn đến bài hát đang phát</span>
                </div>
              </div>
            </div>
          </div>

          <div class="shortcut-category">
            <h3>Tìm kiếm & Discord</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key combo">Ctrl + K</span>
                <div class="shortcut-info">
                  <span class="action">Tìm kiếm</span>
                  <span class="desc">Focus vào ô tìm kiếm bài hát</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">O</span>
                <div class="shortcut-info">
                  <span class="action">Discord</span>
                  <span class="desc">Bật/tắt Discord Rich Presence</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">Esc</span>
                <div class="shortcut-info">
                  <span class="action">Thoát tìm kiếm</span>
                  <span class="desc">Xóa nội dung và thoát search</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="shortcut-section">
        <div class="section-header">
          <i class="fas fa-cog"></i>
          <h2>Tổng quát</h2>
        </div>
        
        <div class="shortcuts-grid">
          <div class="shortcut-category">
            <h3>Điều hướng ứng dụng</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 1</span>
                <div class="shortcut-info">
                  <span class="action">Tab Chung</span>
                  <span class="desc">Chuyển đến tab Chung</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 2</span>
                <div class="shortcut-info">
                  <span class="action">Tab Sao lưu</span>
                  <span class="desc">Chuyển đến tab Sao lưu</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 3</span>
                <div class="shortcut-info">
                  <span class="action">Tab Nghe nhạc</span>
                  <span class="desc">Chuyển đến tab Nghe nhạc</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 4</span>
                <div class="shortcut-info">
                  <span class="action">Tab Phím tắt</span>
                  <span class="desc">Chuyển đến tab Phím tắt (hiện tại)</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 5</span>
                <div class="shortcut-info">
                  <span class="action">Tab Cài đặt</span>
                  <span class="desc">Chuyển đến tab Cài đặt</span>
                </div>
              </div>
            </div>
          </div>

          <div class="shortcut-category">
            <h3>Cửa sổ ứng dụng</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key combo">Alt + F4</span>
                <div class="shortcut-info">
                  <span class="action">Đóng ứng dụng</span>
                  <span class="desc">Thoát hoàn toàn khỏi Nericx</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">F11</span>
                <div class="shortcut-info">
                  <span class="action">Toàn màn hình</span>
                  <span class="desc">Bật/tắt chế độ fullscreen</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">Ctrl + Shift + I</span>
                <div class="shortcut-info">
                  <span class="action">DevTools</span>
                  <span class="desc">Mở công cụ phát triển</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="tips-section">
        <div class="section-header">
          <i class="fas fa-lightbulb"></i>
          <h2>Mẹo sử dụng</h2>
        </div>
        
        <div class="tips-grid">
          <div class="tip-item">
            <i class="fas fa-info-circle"></i>
            <div class="tip-content">
              <h4>Phím tắt trong Tab Nghe nhạc</h4>
              <p>Các phím tắt chỉ hoạt động khi <strong>không đang gõ</strong> trong ô tìm kiếm</p>
            </div>
          </div>
          
          <div class="tip-item">
            <i class="fas fa-keyboard"></i>
            <div class="tip-content">
              <h4>Tổ hợp phím</h4>
              <p>Sử dụng <strong>Ctrl</strong> + số để chuyển nhanh giữa các tab</p>
            </div>
          </div>
          
          <div class="tip-item">
            <i class="fas fa-music"></i>
            <div class="tip-content">
              <h4>Điều khiển nhạc</h4>
              <p>Có thể sử dụng phím tắt ngay cả khi không focus vào player</p>
            </div>
          </div>
          
          <div class="tip-item">
            <i class="fas fa-search"></i>
            <div class="tip-content">
              <h4>Tìm kiếm nhanh</h4>
              <p>Nhấn <strong>Ctrl + K</strong> từ bất kỳ đâu để tìm kiếm nhạc ngay lập tức</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

</script>

<style scoped>
.keyboard-tab {
  height: 100%;
  padding: 20px;
  color: var(--text-primary);
  background: var(--bg-primary);
  overflow-y: auto;
  scroll-behavior: smooth;
  user-select: none;
}

.keyboard-tab::-webkit-scrollbar {
  width: 8px;
}

.keyboard-tab::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.keyboard-tab::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border-radius: 4px;
}

.header {
  text-align: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--accent-color-transparent);
}

.header h1 {
  margin: 0;
  font-size: 2em;
  font-weight: 700;
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.header .description {
  margin: 8px 0 0 0;
  font-size: 1em;
  color: var(--text-muted);
  font-weight: 400;
}

.sections-container {
  display: flex;
  flex-direction: column;
  gap: 25px;
  max-width: 1200px;
  margin: 0 auto;
}

.shortcut-section {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--accent-color-transparent);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--accent-color-transparent);
}

.section-header i {
  font-size: 1.3em;
  color: var(--accent-color);
}

.section-header h2 {
  margin: 0;
  font-size: 1.5em;
  font-weight: 600;
  color: var(--text-primary);
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
}

.shortcut-category {
  background: var(--bg-tertiary);
  border-radius: 10px;
  padding: 15px;
  border: 1px solid var(--accent-color-transparent);
}

.shortcut-category h3 {
  margin: 0 0 12px 0;
  font-size: 1.1em;
  font-weight: 600;
  color: var(--accent-color);
  text-align: center;
}

.shortcut-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--bg-primary);
  border-radius: 6px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.shortcut-item:hover {
  background: var(--accent-hover-transparent);
  border-color: var(--accent-color-transparent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(var(--accent-rgb), 0.2);
}

.key {
  font-weight: bold;
  font-size: 0.8em;
  color: var(--accent-color);
  background: var(--bg-secondary);
  padding: 6px 10px;
  border-radius: 5px;
  min-width: 50px;
  text-align: center;
  font-family: 'Courier New', monospace;
  border: 2px solid var(--accent-color);
  box-shadow: 0 1px 3px rgba(var(--accent-rgb), 0.3);
  white-space: nowrap;
}

.key.combo {
  min-width: 70px;
  font-size: 0.75em;
}

.shortcut-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9em;
}

.desc {
  font-size: 0.8em;
  color: var(--text-muted);
  line-height: 1.3;
}

.tips-section {
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--accent-color-transparent);
  box-shadow: 0 4px 20px rgba(var(--accent-rgb), 0.1);
}

.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1px solid var(--accent-color-transparent);
  transition: all 0.3s ease;
}

.tip-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(var(--accent-rgb), 0.2);
  border-color: var(--accent-color);
}

.tip-item i {
  font-size: 1.2em;
  color: var(--accent-color);
  margin-top: 2px;
}

.tip-content h4 {
  margin: 0 0 6px 0;
  font-size: 1em;
  font-weight: 600;
  color: var(--text-primary);
}

.tip-content p {
  margin: 0;
  font-size: 0.85em;
  color: var(--text-muted);
  line-height: 1.4;
}

.tip-content strong {
  color: var(--accent-color);
  font-weight: 600;
}

@media (max-width: 768px) {
  .keyboard-tab {
    padding: 15px;
  }
  
  .shortcuts-grid {
    grid-template-columns: 1fr;
  }
  
  .tips-grid {
    grid-template-columns: 1fr;
  }
  
  .header h1 {
    font-size: 1.7em;
    flex-direction: column;
    gap: 8px;
  }
}
</style> 