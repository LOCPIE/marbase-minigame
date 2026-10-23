# ⚡ Chiến Trường MarBase - Minigame Trắc Nghiệm Đấu Trí & Kỹ Năng

Game trắc nghiệm tương tác thời gian thực dành cho nhóm lên đến 10 người chơi với hệ thống 20 kỹ năng độc đáo, đường đua kịch tính và bảng xếp hạng trực tiếp.

---

## 🌟 Tính Năng Nổi Bật

1. **👑 Vai trò MC / Host Độc Lập:**
   - Host là người điều phối trận đấu (bấm bắt đầu, chuyển câu, mở kết quả), không phải người chơi thi đấu.
   - Host hoàn toàn không biết trước đáp án đúng cho đến khi kết quả được mở công khai.
   - Bảng điều khiển theo dõi tiến độ trả lời trực tiếp của từng người chơi.

2. **⚡ Hệ Thống Nộ & 20 Kỹ Năng Siêu Bựa:**
   - 3 câu đầu tiên: người chơi trả lời đúng hay sai đều được +1 Nộ.
   - Sau 3 câu đầu: cả đội cùng đầy 3 Nộ, kích hoạt giai đoạn tung kỹ năng.
   - Cơ chế cân bằng: Ưu tiên 2 người chơi có điểm thấp nhất bảng được quyền tung chiêu trước.
   - 20 kỹ năng chia làm 4 bậc phẩm chất: Huyền Thoại (6%), Sử Thi (18%), Hiếm (34%), Phổ Thông (42%).
   - Kỹ năng *Hoán Đổi Càn Khôn*: Nếu đang đứng Top 1 sẽ tự biến chuyển thành ngẫu nhiên 1 kỹ năng khác.
   - Kỹ năng *Bàn Tay Đạo Tặc*: Hút 30% điểm đối thủ (giới hạn tối đa 100đ).

3. **🏎️ Đường Đua Siêu Tốc (Racetrack):**
   - Đua xe theo thời gian thực mô phỏng tiến độ điểm số và thứ hạng của người chơi.
   - Hiệu ứng nitro, hào quang khiên bảo vệ, đóng băng, bom hẹn giờ và tia năng lượng trực quan.

4. **🌟 Câu Hỏi Vàng & Vòng Sinh Tồn (Sudden Death):**
   - Câu hỏi vàng (mốc câu 5, 10, câu cuối): Nhân đôi điểm số (x2).
   - Vòng sinh tồn (3 câu cuối): Trả lời sai hoặc hết giờ bị trừ 30 điểm.

5. **🔥 Chuỗi Thắng & Tiền Thưởng Săn Đầu (On-Fire & Bounty):**
   - Đạt chuỗi 3 trận thắng kích hoạt trạng thái "Rực Lửa" (+20% điểm).
   - Dập tắt người đang Rực Lửa nhận ngay +50đ tiền thưởng.

6. **🤡 Cà Khịa Trực Tiếp & Soundboard:**
   - Thanh reaction thả icon bay màn hình: `🤣`, `😭`, `🤡`, `🤬`, `💥`.
   - Host Soundboard âm thanh: Vỗ tay, Báo động, Quạ kêu, Kèn khải hoàn.

7. **🎰 Biến Cố Phòng Ngẫu Nhiên:**
   - Siêu tốc (Blitz 8s), Sương mù che khuất BXH (Fog), Jackpot người nhanh nhất (+100đ).

8. **🏆 Lễ Trao Giải & 5 Danh Hiệu MVP Cuối Trận:**
   - Vua Tốc Độ, Chúa Tể Đạo Tặc, Thánh Xả Kỹ Năng, Bao Cát Vàng, Chúa Tể Lạc Đề.

---

## 🚀 Cài Đặt & Chạy Ứng Dụng

### Yêu cầu:
- Node.js (phiên bản 16 trở lên)

### Cài đặt dependencies:
```bash
npm install
```

### Khởi động Server:
```bash
node server.js
```

Mở trình duyệt:
- **Chơi nội bộ trên máy:** `http://localhost:3000`
- **Chơi qua mạng LAN (cùng Wi-Fi):** `http://<IP-MAY-BAN>:3000`
